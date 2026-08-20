#!/usr/bin/env python
"""Serve the app's own frontend in a browser, with a stubbed Tauri bridge.

Why this exists: three things built for this window shipped "verified
structurally and by test, not looked at in a running window", and the first
time one of them was looked at, the project-settings dialog turned out to
put **Save** 149px below the fold at the app's minimum window size. Tests
that read the DOM cannot see that; a browser can measure it.

What it is *not*: a substitute for the app. Every `invoke` here answers from
`stub.js`, so this proves layout, not behaviour, and it renders in whatever
browser you point at it rather than in WebView2. Anything about *what the
commands do* still has to be checked in the real window.

    python tools/preview/preview.py

Then open http://localhost:8731/tools/preview/preview.html.

`preview.html` is generated from `src/index.html` on every run rather than
kept beside it, so it cannot drift from the markup it is meant to preview --
and it is generated *here* rather than into `src/`, because `src/` is
`frontendDist` and everything in it is bundled into the installer.
"""

import http.server
import os
import pathlib
import socketserver

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parent.parent
PORT = 8731

STUB = '<script src="/tools/preview/stub.js"></script>'
# `<base>` rather than rewriting each href: the page lives two directories
# away from the markup it copies, and every relative path in it -- style.css,
# main.js, the ES modules main.js imports, the fonts style.css asks for --
# has to resolve as if it were still in src/.
BASE = '<base href="/src/" />'


def build() -> pathlib.Path:
    html = (ROOT / "src" / "index.html").read_text(encoding="utf-8")
    assert "<head>" in html and '<script type="module" src="main.js">' in html
    html = html.replace("<head>", "<head>\n    " + BASE, 1)
    html = html.replace(
        '<script type="module" src="main.js"></script>',
        STUB + '\n    <script type="module" src="main.js"></script>',
        1,
    )
    out = HERE / "preview.html"
    out.write_text(html, encoding="utf-8")
    return out


def main() -> None:
    out = build()
    os.chdir(ROOT)
    handler = http.server.SimpleHTTPRequestHandler
    with socketserver.TCPServer(("127.0.0.1", PORT), handler) as httpd:
        rel = out.relative_to(ROOT).as_posix()
        print(f"http://localhost:{PORT}/{rel}")
        httpd.serve_forever()


if __name__ == "__main__":
    main()
