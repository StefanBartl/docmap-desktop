# Releasing

Cutting a release of this app, start to finish. Written after doing it for
`v0.1.0`, so every step below is one that was actually taken rather than one
that ought to work.

## Table of content

- [What a release is here](#what-a-release-is-here)
- [Before tagging](#before-tagging)
- [Tagging](#tagging)
- [What the workflow does](#what-the-workflow-does)
- [Checking the draft](#checking-the-draft)
- [Publishing](#publishing)
- [If something is wrong](#if-something-is-wrong)
- [Two things worth knowing before you publish](#two-things-worth-knowing-before-you-publish)

---

## What a release is here

A pushed tag matching `v*`, and nothing else. `.github/workflows/release.yml`
does the rest: it builds an installer per platform and attaches them to a
GitHub Release **as a draft**.

The draft is the point, and it is deliberate — the workflow says so where it
sets it:

> Draft, not published outright: a build succeeding on every platform is not
> the same guarantee as someone having opened the result, and a draft lets
> that happen before the release goes public.

So the last step is a person opening the app. Nothing automates that, and
nothing should.

---

## Before tagging

**CI has to be green on `main`.** A release built from a red pipeline is the
thing a release exists to avoid — and this is not hypothetical here: `v0.1.0`
was held up because `main` had been failing on macOS for weeks without anyone
noticing, in a way that had nothing to do with the code being released.

```bash
gh run list --branch main --limit 1
```

If it is not green, find out why before anything else:

```bash
gh run view <run-id> --json jobs --jq '.jobs[] | "\(.conclusion)  \(.name)"'
gh run view <run-id> --log-failed | tail -25
```

**The version in the manifests is the version you tag.** `src-tauri/tauri.conf.json`
and `src-tauri/Cargo.toml` both carry it, and they must agree with each other
and with the tag. Bump them in a commit of their own before tagging, so the
tag points at a tree that already claims that number.

---

## Tagging

An annotated tag, with a message that says what is in the release. It is the
first thing anyone reads on the Releases page.

```bash
git tag -a v0.2.0 -F -
```

…then type the message and end with `Ctrl+D`. Or keep it in a file and pass
`-F notes.md`.

```bash
git push origin v0.2.0
```

Pushing the tag is what starts the build. Nothing before that point is
public.

---

## What the workflow does

One job per platform, in parallel:

| Platform | Produces | Engine bundled |
|---|---|---|
| Windows | `_x64_en-US.msi`, `_x64-setup.exe` | yes |
| Linux | `_amd64.deb`, `.x86_64.rpm`, `_amd64.AppImage` | yes |
| macOS | `_x64.dmg` and `_aarch64.dmg`, plus an `.app.tar.gz` each | **no** |

Nine files for `v0.1.0`, which is the number to expect — two Windows, three
Linux, four macOS. Listed from the real run rather than from the workflow,
because the workflow says `cargo tauri build` and Tauri decides the rest.

The engine sidecar is downloaded from `documentation.nvim`'s own
`standalone-latest` rolling release and staged where
`tauri.windows.conf.json` / `tauri.linux.conf.json` expect it. macOS is
skipped on purpose rather than by oversight: `documentation.nvim` does not
publish a macOS build of the engine. A macOS build of this app still works —
it simply starts with no bundled fallback and finds an engine on `PATH`, or
says it found none.

Watch it:

```bash
gh run list --workflow=release.yml --limit 1
gh run view <run-id> --json jobs --jq '.jobs[] | "\(.conclusion // .status)  \(.name)"'
```

The draft Release appears as soon as the *first* job finishes, and the others
attach their assets to it as they land. A draft with only some platforms in
it means the rest are still building, not that they failed.

---

## Checking the draft

```bash
gh release view v0.2.0 --web
```

Drafts are visible only to people with write access; there is nothing public
yet.

Download the installer for the platform you are on:

```bash
gh release download v0.2.0 --pattern "*.msi" --dir .
```

Install it, open it, and walk through the things a build cannot check:

- a project selects and its map loads;
- **Generate map** runs and the status bar reports it;
- **File → Settings…** opens and the theme switch takes;
- **Help → About** names an engine and a build.

That last one is worth reading rather than glancing at. It says which engine
the installed app found and, when the engine is a bundled build, the commit
it came from and whether that commit describes it.

---

## Publishing

```bash
gh release edit v0.2.0 --draft=false
```

Or on the release page: **Edit**, then **Publish release** at the bottom.

It is then at `/releases/latest`, and the badge in the README follows it.

---

## If something is wrong

Do not publish it. Delete the draft and the tag together, fix, and start
over:

```bash
gh release delete v0.2.0 --yes --cleanup-tag
```

Then commit the fix, re-tag, and push. While nothing is published this costs
nothing. A public release that gets withdrawn is already in somebody's
download history, which is why the draft step exists at all.

---

## Two things worth knowing before you publish

**The macOS installers ship a menu bar nobody has checked on macOS.**
[`MENUBAR.md`](MENUBAR.md) records that the tree needs a documented macOS
variant before shipping there — on that platform the first submenu is the
*application* menu and carries About, Preferences and Quit by convention, and
File does not own Quit. The tests that would catch a wrong tree cannot run on
macOS either: `muda::Menu` refuses to be created off the main thread and
Rust's test harness runs every test on a worker, so those three are gated off
that platform. A test that cannot run is not evidence.

If you would rather not ship that yet, drop the macOS assets from the draft
before publishing:

```bash
gh release view v0.2.0 --json assets --jq '.assets[].name'
gh release delete-asset v0.2.0 <name>.dmg --yes
```

**The engine has its own release, and it rolls.** `standalone-latest` is a
moving tag in `documentation.nvim`. Two installers of this app built a month
apart therefore bundle different engines, and that is by design — which is
exactly why About reports the engine's own commit rather than assuming the
app's version implies it.
