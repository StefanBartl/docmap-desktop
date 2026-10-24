#!/usr/bin/env python3
"""Fail when the engine contract of engine.lock is not what documentation.nvim publishes.

engine.lock names one commit of documentation.nvim and what that commit offers a host: the artifact
schema and the /api/* routes. contract/docmap.schema.json is the `.docmap.json` schema of that commit.
This checks that

  * the lock is well-formed (a full commit, a schema number, a sorted route list);
  * at that commit, `M.SCHEMA` (core/scan.lua) is the lock's schema, `M.routes` (core/api.lua) is the
    lock's route list, and docs/docmap.schema.json is the copy, byte for byte;
  * with --binary, an engine binary answers --capabilities with the lock's schema and at least the
    lock's routes (the rolling release has no number to pin, so this is how it is held to the lock).

The engine's Lua namespace is read as `lua/docmap/` and, failing that, `lua/documentation/`, so the
check survives the rename of the plugin to docmap.nvim.

    python tools/check-engine-lock.py                       fetch the pinned commit from GitHub
    python tools/check-engine-lock.py --engine <clone>      read the pinned commit from a local clone
    python tools/check-engine-lock.py --binary <docmap>     also hold an engine binary to the lock
    python tools/check-engine-lock.py --write --commit <sha> [--engine <clone>]
                                                            move the lock to <sha> (then review the diff)

Exit 0: in step. Exit 1: drift, what is wrong is listed. Exit 2: the lock cannot be read, or the engine
cannot be reached or asked (no answer is no pass).
"""

import argparse
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile

LOCK = "engine.lock"
SCHEMA_COPY = "contract/docmap.schema.json"
ENGINE_SCHEMA_FILE = "docs/docmap.schema.json"
# Newest namespace first: after the rename the old one may survive as a shim and must not win.
NAMESPACES = ("docmap", "documentation")
COMMIT = re.compile(r"^[0-9a-f]{40}$")
ROUTE = re.compile(r"^[a-z][a-z0-9_]*(?:/[a-z][a-z0-9_]*)*$")
LUA_SCHEMA = re.compile(r"^M\.SCHEMA\s*=\s*(\d+)\s*$", re.M)
LUA_ROUTES_BLOCK = re.compile(r"^M\.routes\s*=\s*\{\n(?P<body>.*?)^\}", re.M | re.S)
LUA_ROUTE_KEY = re.compile(r"""^\s*(?:\[\s*"(?P<quoted>[^"]+)"\s*\]|(?P<bare>[A-Za-z_][A-Za-z0-9_]*))\s*=""", re.M)


class Unreachable(Exception):
    """The engine could not be fetched, read or asked: exit 2, never a pass."""


def read_lock(text):
    """The lock as a dict (repo, commit, schema, routes), or raise ValueError saying what is wrong."""
    values = {}
    for line in text.splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        key, sep, value = line.partition("=")
        if not sep:
            raise ValueError(f"not a 'key = value' line: {line}")
        values[key.strip()] = value.strip()
    repo, commit = values.get("repo", ""), values.get("commit", "")
    if not repo.startswith("https://"):
        raise ValueError(f"repo must be an https URL, got '{repo}'")
    if not COMMIT.match(commit):
        raise ValueError(f"commit must be a full commit id, got '{commit}'")
    schema = values.get("schema", "")
    if not schema.isdigit():
        raise ValueError(f"schema must be a number, got '{schema}'")
    routes = values.get("routes", "").split()
    if not routes:
        raise ValueError("routes is empty: a contract with no route checks nothing")
    bad = [r for r in routes if not ROUTE.match(r)]
    if bad:
        raise ValueError(f"not a route name: {', '.join(bad)}")
    if routes != sorted(set(routes)):
        raise ValueError("routes must be sorted and without repeats")
    return {"repo": repo, "commit": commit, "schema": int(schema), "routes": routes}


def lua_schema(text):
    """`M.SCHEMA` of core/scan.lua, or None when the assignment is not there."""
    match = LUA_SCHEMA.search(text)
    return int(match.group(1)) if match else None


def lua_routes(text):
    """The sorted keys of `M.routes = { ... }` in core/api.lua, or None when the table is not there."""
    block = LUA_ROUTES_BLOCK.search(text)
    if not block:
        return None
    names = [m.group("quoted") or m.group("bare") for m in LUA_ROUTE_KEY.finditer(block.group("body"))]
    return sorted(set(names))


def source_problems(lock, scan_text, api_text, engine_schema_bytes, copy_bytes):
    """What the engine source at the pinned commit says differently from the lock and the copy."""
    problems = []
    schema = lua_schema(scan_text)
    if schema is None:
        problems.append("core/scan.lua has no 'M.SCHEMA = <n>' line: the engine moved it, the check must follow")
    elif schema != lock["schema"]:
        problems.append(f"the engine writes schema {schema} at {lock['commit'][:12]}, {LOCK} says {lock['schema']}")
    routes = lua_routes(api_text)
    if routes is None:
        problems.append("core/api.lua has no 'M.routes = { ... }' table: the engine moved it, the check must follow")
    elif routes != lock["routes"]:
        problems.append(f"the engine answers routes {' '.join(routes)}, {LOCK} says {' '.join(lock['routes'])}")
    if copy_bytes is None:
        problems.append(f"{SCHEMA_COPY} is missing")
    elif engine_schema_bytes != copy_bytes:
        problems.append(f"{SCHEMA_COPY} is not {ENGINE_SCHEMA_FILE} of {lock['commit'][:12]}")
    return problems


def capability_problems(lock, caps):
    """What an engine's --capabilities answer says differently from the lock.

    Routes are a lower bound, not an equality: an engine that answers one route more serves this app
    exactly as well, while one route less leaves a panel empty. The schema is an equality, because a
    newer schema may remove a field the window reads (docs/hosting.md: "Remove a field. Allowed").
    """
    problems = []
    schema = caps.get("schema")
    if not isinstance(schema, int):
        problems.append("the engine reports no schema: it is older than the contract this app is checked against")
    elif schema != lock["schema"]:
        problems.append(f"the engine writes schema {schema}, {LOCK} says {lock['schema']}")
    routes = caps.get("routes")
    if not isinstance(routes, list):
        problems.append("the engine reports no routes")
    else:
        missing = [r for r in lock["routes"] if r not in routes]
        if missing:
            problems.append(f"the engine does not answer {' '.join(missing)}")
    return problems


class Source:
    """Files of one commit, read through `git show` from a local clone or a fetched one."""

    def __init__(self, repo, commit, clone=None):
        self.commit = commit
        self._tmp = None
        if clone:
            self.git_dir = clone
        else:
            self._tmp = tempfile.mkdtemp(prefix="engine-lock-")
            self.git_dir = self._tmp
            self._git("init", "-q")
            # A commit GitHub does not know ends here ("not our ref"): the case engine.lock must
            # never be in, because CI could not check it out either.
            self._git("fetch", "-q", "--depth", "1", repo, commit, timeout=300)

    def _git(self, *args, timeout=60):
        result = subprocess.run(
            ["git", "-C", self.git_dir, *args],
            capture_output=True,
            timeout=timeout,
            check=False,
        )
        if result.returncode != 0:
            raise Unreachable(f"git {' '.join(args[:2])} failed: {result.stderr.decode(errors='replace').strip()}")
        return result.stdout

    def read(self, path):
        """The bytes of `path` at the commit, or None when the commit has no such file."""
        try:
            return self._git("show", f"{self.commit}:{path}")
        except Unreachable:
            return None

    def lua(self, rel):
        """The text of `lua/<namespace>/<rel>`, newest namespace first."""
        for ns in NAMESPACES:
            data = self.read(f"lua/{ns}/{rel}")
            if data is not None:
                return data.decode("utf-8")
        raise Unreachable(f"neither lua/{'/ nor lua/'.join(NAMESPACES)}/ has {rel} at {self.commit[:12]}")

    def close(self):
        if self._tmp:
            shutil.rmtree(self._tmp, ignore_errors=True)


def ask_binary(path):
    """The parsed --capabilities answer of an engine binary."""
    try:
        result = subprocess.run([path, "--capabilities"], capture_output=True, timeout=60, check=False)
    except (OSError, subprocess.SubprocessError) as err:
        raise Unreachable(f"cannot run {path}: {err}") from err
    if result.returncode != 0:
        raise Unreachable(f"{path} --capabilities exited {result.returncode}: {result.stderr.decode(errors='replace').strip()}")
    try:
        caps = json.loads(result.stdout)
    except ValueError as err:
        raise Unreachable(f"{path} --capabilities is not JSON: {err}") from err
    if not isinstance(caps, dict):
        raise Unreachable(f"{path} --capabilities is not a JSON object")
    return caps


def render_lock(text, commit, schema, routes):
    """The lock text with commit, schema and routes replaced, comments and order kept."""
    wanted = {"commit": commit, "schema": str(schema), "routes": " ".join(routes)}
    out = []
    for line in text.splitlines(keepends=True):
        key = line.partition("=")[0].strip()
        if not line.lstrip().startswith("#") and key in wanted:
            out.append(f"{key} = {wanted.pop(key)}\n")
        else:
            out.append(line)
    if wanted:
        raise ValueError(f"the lock has no line for {', '.join(wanted)}")
    return "".join(out)


def read_file(path):
    try:
        with open(path, "rb") as f:
            return f.read()
    except FileNotFoundError:
        return None


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument("--lock", default=LOCK)
    parser.add_argument("--copy", default=SCHEMA_COPY)
    parser.add_argument("--engine", help="a local clone of documentation.nvim to read the commit from")
    parser.add_argument("--binary", help="an engine binary to hold to the lock as well")
    parser.add_argument("--write", action="store_true", help="move the lock to --commit")
    parser.add_argument("--commit", help="with --write: the commit to move to")
    args = parser.parse_args(argv)

    try:
        with open(args.lock, encoding="utf-8") as f:
            lock_text = f.read()
        lock = read_lock(lock_text)
    except (OSError, ValueError) as err:
        print(f"cannot read {args.lock}: {err}")
        return 2
    if args.write and not (args.commit and COMMIT.match(args.commit)):
        print("--write needs --commit <full commit id>")
        return 2
    commit = args.commit if args.write else lock["commit"]

    source = None
    try:
        source = Source(lock["repo"], commit, args.engine)
        scan_text, api_text = source.lua("core/scan.lua"), source.lua("core/api.lua")
        engine_schema = source.read(ENGINE_SCHEMA_FILE)
        if engine_schema is None:
            raise Unreachable(f"{ENGINE_SCHEMA_FILE} is not in {commit[:12]}")
        if args.write:
            schema, routes = lua_schema(scan_text), lua_routes(api_text)
            if schema is None or routes is None:
                print("the engine source no longer has M.SCHEMA or M.routes where this check reads them")
                return 1
            with open(args.lock, "w", encoding="utf-8", newline="\n") as f:
                f.write(render_lock(lock_text, commit, schema, routes))
            os.makedirs(os.path.dirname(args.copy) or ".", exist_ok=True)
            with open(args.copy, "wb") as f:
                f.write(engine_schema)
            print(f"moved {args.lock} to {commit[:12]} (schema {schema}, {len(routes)} routes): review the diff")
            return 0
        problems = source_problems(lock, scan_text, api_text, engine_schema, read_file(args.copy))
        if args.binary:
            caps = ask_binary(args.binary)
            problems += [f"{args.binary}: {p}" for p in capability_problems(lock, caps)]
    except Unreachable as err:
        print(f"the check could not run: {err}")
        return 2
    except (OSError, ValueError, subprocess.SubprocessError) as err:
        print(f"the check could not run: {err}")
        return 2
    finally:
        if source:
            source.close()

    if problems:
        for problem in problems:
            print(problem)
        return 1
    held = f", binary {args.binary} held to it" if args.binary else ""
    print(f"ok: engine {lock['commit'][:12]}, schema {lock['schema']}, {len(lock['routes'])} routes{held}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
