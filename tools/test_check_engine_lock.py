"""Tests of check-engine-lock.py: a lock that is malformed, an engine source that says something else, a schema
copy that drifted and an engine binary that answers differently are each refused, and only an engine in step
with the lock passes. GitHub is never asked: the end-to-end cases build a local repository and pass --engine.

    python -m unittest discover -s tools -p "test_*.py"
"""

import contextlib
import importlib.util
import io
import json
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

SPEC = importlib.util.spec_from_file_location("check_engine_lock", Path(__file__).with_name("check-engine-lock.py"))
lock_mod = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(lock_mod)

SHA = "5fdb34c659ed9f93eb96dbe4f7341b5f8aebe683"
ROUTES = ["checklist", "commits", "loaded", "loaded/snapshots", "telemetry", "telemetry/snapshots"]
LOCK_TEXT = (
    "# a comment\n"
    "repo = https://github.com/WKDSteve/docmap.nvim\n"
    f"commit = {SHA}\n"
    "schema = 6\n"
    f"routes = {' '.join(ROUTES)}\n"
)
SCAN = "local M = {}\n\n---The artifact schema this build writes.\nM.SCHEMA = 6\n\nreturn M\n"
# The shape of core/api.lua: bare and bracketed keys, a nested table after it that must not be read.
API = (
    "M.routes = {\n"
    "  telemetry = M.telemetry,\n"
    '  ["telemetry/snapshots"] = M.telemetry_snapshots,\n'
    "  loaded = M.loaded,\n"
    '  ["loaded/snapshots"] = M.loaded_snapshots,\n'
    "  checklist = M.checklist,\n"
    "  commits = M.commits,\n"
    "}\n\n"
    "local other = {\n  not_a_route = true,\n}\n"
)
SCHEMA_JSON = b'{ "title": ".docmap.json" }\n'


class ReadLock(unittest.TestCase):
    def test_the_lock_of_this_repository_reads(self):
        with open(Path(__file__).parent.parent / "engine.lock", encoding="utf-8") as f:
            lock = lock_mod.read_lock(f.read())
        self.assertTrue(lock_mod.COMMIT.match(lock["commit"]))
        self.assertEqual(lock["routes"], sorted(lock["routes"]))

    def test_a_full_lock_reads(self):
        lock = lock_mod.read_lock(LOCK_TEXT)
        self.assertEqual(lock["commit"], SHA)
        self.assertEqual(lock["schema"], 6)
        self.assertEqual(lock["routes"], ROUTES)

    def test_everything_else_is_refused(self):
        bad = {
            "a short commit": LOCK_TEXT.replace(SHA, SHA[:12]),
            "no schema number": LOCK_TEXT.replace("schema = 6", "schema = six"),
            "no routes": LOCK_TEXT.replace(f"routes = {' '.join(ROUTES)}", "routes ="),
            "unsorted routes": LOCK_TEXT.replace("checklist commits", "commits checklist"),
            "a repeated route": LOCK_TEXT.replace("checklist commits", "checklist checklist commits"),
            "a route that is not a name": LOCK_TEXT.replace("commits", "commit/<sha>"),
            "a repo that is not https": LOCK_TEXT.replace("https://", "git@"),
            "a line that is not key = value": LOCK_TEXT + "stray\n",
        }
        for why, text in bad.items():
            with self.subTest(why), self.assertRaises(ValueError):
                lock_mod.read_lock(text)


class ReadEngineSource(unittest.TestCase):
    def test_schema_and_routes_are_read(self):
        self.assertEqual(lock_mod.lua_schema(SCAN), 6)
        self.assertEqual(lock_mod.lua_routes(API), ROUTES)

    def test_absent_is_none_not_empty(self):
        self.assertIsNone(lock_mod.lua_schema("M.OTHER = 6\n"))
        self.assertIsNone(lock_mod.lua_routes("local routes = {}\n"))


class SourceProblems(unittest.TestCase):
    def setUp(self):
        self.lock = lock_mod.read_lock(LOCK_TEXT)

    def test_in_step_is_no_problem(self):
        self.assertEqual(lock_mod.source_problems(self.lock, SCAN, API, SCHEMA_JSON, SCHEMA_JSON), [])

    def test_each_drift_is_named(self):
        cases = {
            "schema 7": (SCAN.replace("= 6", "= 7"), API, SCHEMA_JSON, SCHEMA_JSON),
            "routes": (SCAN, API.replace("  commits = M.commits,\n", ""), SCHEMA_JSON, SCHEMA_JSON),
            "is not docs/docmap.schema.json": (SCAN, API, SCHEMA_JSON, b"{}\n"),
            "is missing": (SCAN, API, SCHEMA_JSON, None),
            "no 'M.SCHEMA": ("", API, SCHEMA_JSON, SCHEMA_JSON),
            "no 'M.routes": (SCAN, "", SCHEMA_JSON, SCHEMA_JSON),
        }
        for needle, args in cases.items():
            with self.subTest(needle):
                problems = lock_mod.source_problems(self.lock, *args)
                self.assertEqual(len(problems), 1, problems)
                self.assertIn(needle, problems[0])


class CapabilityProblems(unittest.TestCase):
    def setUp(self):
        self.lock = lock_mod.read_lock(LOCK_TEXT)

    def test_the_same_schema_and_more_routes_pass(self):
        caps = {"schema": 6, "routes": ROUTES + ["endpoints"]}
        self.assertEqual(lock_mod.capability_problems(self.lock, caps), [])

    def test_another_schema_a_missing_route_or_no_answer_is_refused(self):
        cases = {
            "schema 7": {"schema": 7, "routes": ROUTES},
            "schema 5": {"schema": 5, "routes": ROUTES},
            "does not answer commits": {"schema": 6, "routes": [r for r in ROUTES if r != "commits"]},
            "reports no schema": {"routes": ROUTES},
            "reports no routes": {"schema": 6},
        }
        for needle, caps in cases.items():
            with self.subTest(needle):
                problems = lock_mod.capability_problems(self.lock, caps)
                self.assertEqual(len(problems), 1, problems)
                self.assertIn(needle, problems[0])


class RenderLock(unittest.TestCase):
    def test_values_move_and_comments_stay(self):
        other = "1" * 40
        text = lock_mod.render_lock(LOCK_TEXT, other, 7, ROUTES + ["zz"])
        self.assertIn("# a comment\n", text)
        lock = lock_mod.read_lock(text)
        self.assertEqual((lock["commit"], lock["schema"], lock["routes"][-1]), (other, 7, "zz"))


def git(cwd, *args):
    subprocess.run(["git", "-C", cwd, *args], check=True, capture_output=True)


class EndToEnd(unittest.TestCase):
    """A local engine repository at one commit, the lock and the copy in a temporary working folder."""

    def make_engine(self, namespace, scan=SCAN):
        repo = os.path.join(self.tmp.name, f"engine-{namespace}")
        for rel, data in (
            (f"lua/{namespace}/core/scan.lua", scan.encode()),
            (f"lua/{namespace}/core/api.lua", API.encode()),
            ("docs/docmap.schema.json", SCHEMA_JSON),
        ):
            path = os.path.join(repo, rel)
            os.makedirs(os.path.dirname(path), exist_ok=True)
            with open(path, "wb") as f:
                f.write(data)
        git(self.tmp.name, "init", "-q", repo)
        git(repo, "add", "-A")
        git(repo, "-c", "user.name=t", "-c", "user.email=t@t", "commit", "-q", "-m", "engine")
        sha = subprocess.run(["git", "-C", repo, "rev-parse", "HEAD"], check=True, capture_output=True, text=True)
        return repo, sha.stdout.strip()

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.lock = os.path.join(self.tmp.name, "engine.lock")
        self.copy = os.path.join(self.tmp.name, "contract", "docmap.schema.json")
        os.makedirs(os.path.dirname(self.copy))
        with open(self.copy, "wb") as f:
            f.write(SCHEMA_JSON)

    def tearDown(self):
        self.tmp.cleanup()

    def run_check(self, *extra):
        out = io.StringIO()
        with contextlib.redirect_stdout(out):
            code = lock_mod.main(["--lock", self.lock, "--copy", self.copy, *extra])
        return code, out.getvalue()

    def write_lock(self, sha):
        with open(self.lock, "w", encoding="utf-8") as f:
            f.write(LOCK_TEXT.replace(SHA, sha))

    def test_both_namespaces_pass_and_docmap_wins(self):
        for namespace in ("documentation", "docmap"):
            with self.subTest(namespace):
                repo, sha = self.make_engine(namespace)
                self.write_lock(sha)
                code, out = self.run_check("--engine", repo)
                self.assertEqual(code, 0, out)

    def test_a_schema_bump_at_the_commit_is_drift(self):
        repo, sha = self.make_engine("documentation", scan=SCAN.replace("= 6", "= 7"))
        self.write_lock(sha)
        code, out = self.run_check("--engine", repo)
        self.assertEqual(code, 1, out)
        self.assertIn("schema 7", out)

    def test_a_commit_the_clone_does_not_have_cannot_be_checked(self):
        repo, _ = self.make_engine("documentation")
        self.write_lock("2" * 40)
        code, out = self.run_check("--engine", repo)
        self.assertEqual(code, 2, out)

    def test_write_moves_the_lock_and_the_copy(self):
        repo, sha = self.make_engine("documentation", scan=SCAN.replace("= 6", "= 7"))
        self.write_lock(SHA)
        with open(self.copy, "wb") as f:
            f.write(b"old\n")
        code, out = self.run_check("--engine", repo, "--write", "--commit", sha)
        self.assertEqual(code, 0, out)
        with open(self.lock, encoding="utf-8") as f:
            lock = lock_mod.read_lock(f.read())
        self.assertEqual((lock["commit"], lock["schema"]), (sha, 7))
        with open(self.copy, "rb") as f:
            self.assertEqual(f.read(), SCHEMA_JSON)
        self.assertEqual(self.run_check("--engine", repo)[0], 0)

    def test_a_binary_is_held_to_the_lock(self):
        repo, sha = self.make_engine("documentation")
        self.write_lock(sha)
        for schema, expected in ((6, 0), (7, 1)):
            with self.subTest(schema=schema):
                fake = os.path.join(self.tmp.name, f"fake-{schema}.py")
                with open(fake, "w", encoding="utf-8") as f:
                    f.write(f"print({json.dumps(json.dumps({'schema': schema, 'routes': ROUTES}))})\n")
                # A one-line launcher, so --binary gets one path as it does with the real engine.
                launcher = os.path.join(self.tmp.name, f"fake-{schema}")
                if os.name == "nt":
                    launcher += ".cmd"
                    body = f'@"{sys.executable}" "{fake}" %*\n'
                else:
                    body = f'#!/bin/sh\nexec "{sys.executable}" "{fake}" "$@"\n'
                with open(launcher, "w", encoding="utf-8") as f:
                    f.write(body)
                os.chmod(launcher, 0o755)
                code, out = self.run_check("--engine", repo, "--binary", launcher)
                self.assertEqual(code, expected, out)

    def test_a_binary_that_cannot_answer_is_no_pass(self):
        repo, sha = self.make_engine("documentation")
        self.write_lock(sha)
        code, out = self.run_check("--engine", repo, "--binary", os.path.join(self.tmp.name, "absent"))
        self.assertEqual(code, 2, out)


if __name__ == "__main__":
    unittest.main()
