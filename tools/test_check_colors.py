"""Tests of tools/check-colors.py: python -m unittest discover -s tools -p "test_*.py"."""

import importlib.util
import pathlib
import unittest

HERE = pathlib.Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("check_colors", HERE / "check-colors.py")
colors = importlib.util.module_from_spec(spec)
spec.loader.exec_module(colors)
KIT = colors.kit_check()

FILES = {
    "src/appkit-tokens.css": ":root { --bg: light-dark(#fff, #000); }",
    "src/appkit-tokens-fallback.css": ":root { --bg: #fff; }",
    "src/style.css": "body {\n  color: var(--ink);\n  box-shadow: 0 1px 2px rgb(0 0 0 / 0.1);\n}",
    "src/lib/x.test.js": "const c = '#123456';",
    "tools/preview/x.css": "a { color: #abc; }",
}


class Findings(unittest.TestCase):
    def test_the_two_token_files_may_hold_colours_nothing_else_may(self):
        found, count = colors.findings(KIT, list(FILES), FILES.get)
        self.assertEqual(found, [("src/style.css", 3, "rgb(")])
        self.assertEqual(count, 1)

    def test_an_unreadable_file_is_not_counted(self):
        found, count = colors.findings(KIT, ["src/style.css"], lambda path: None)
        self.assertEqual((found, count), ([], 0))

    def test_the_repository_is_clean(self):
        top, paths = KIT.tracked_files()

        def read(path):
            try:
                return (pathlib.Path(top) / path).read_text(encoding="utf-8")
            except OSError:
                return None

        found, count = colors.findings(KIT, paths, read)
        self.assertGreater(count, 0)
        self.assertEqual(found, [])


if __name__ == "__main__":
    unittest.main()
