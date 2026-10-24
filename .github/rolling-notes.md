**This is not a release.** It is the newest state of `main`, rebuilt after every green CI run and replaced each time. Nothing here is signed or tested by hand; use a release for anything that matters.

**Install it with the script** (for the current user, no administrator rights, and no SmartScreen stop: the script downloads the installer itself and checks it against `SHA256SUMS`):

```
powershell -ExecutionPolicy Bypass -c "irm https://github.com/StefanBartl/docmap-desktop/releases/download/latest/install.ps1 | iex"   # Windows
curl -fsSL https://github.com/StefanBartl/docmap-desktop/releases/download/latest/install.sh | sh                                      # Linux x86-64
```

Run it again to update to the newest rolling build. Or take the file yourself:

- **Windows:** `docmap-desktop-windows-x86_64-setup.exe`, the NSIS setup, with the engine inside. Windows SmartScreen warns about an unsigned installer you downloaded in the browser: "More info", then "Run anyway".
- **Linux:** `docmap-desktop-linux-x86_64.AppImage`, with the engine inside. `chmod +x` it and run it; it needs FUSE 2 (`libfuse2`), or run it with `--appimage-extract-and-run`.
- `SHA256SUMS` holds the checksums of all files.

There is no macOS build of the rolling kind: the engine is not published for macOS. A release has the `.dmg`. The installers are named by their platform, not by a version: `docmap-desktop --version` does not exist, the window's **Help → About** names the engine and the build.
