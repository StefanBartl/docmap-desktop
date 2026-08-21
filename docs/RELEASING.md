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
- [A draft ages, and it ages fast](#a-draft-ages-and-it-ages-fast)
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

**Refresh the engine first, and check that it actually built.** The Windows
and Linux installers bundle whatever `documentation.nvim`'s rolling
`standalone-latest` release holds *at build time*, so an app release with a
stale engine ships features that talk to flags the bundled engine does not
have. That is not hypothetical either: cutting `v0.2.0` found
`standalone-latest` five weeks of engine work behind — 58 commits, including
the `--exclude=`/`--languages=` flags that this app's own **Project
settings…** dialog passes.

```bash
gh -R StefanBartl/documentation.nvim release view standalone-latest --json publishedAt
gh -R StefanBartl/documentation.nvim workflow run release-engine.yml
```

Then watch it, because *both* platform jobs have to pass — the publish step
is skipped if either fails, and the rolling tag then still holds the old
engine while nothing says so:

```bash
gh -R StefanBartl/documentation.nvim run list --workflow=release-engine.yml --limit 1
```

Rebuilding the engine is also the only thing that runs its `standalone` gate
on a clean machine, which is why it is where two Neovim-only API calls were
caught in one afternoon. Expect it to find something if the engine has moved
much since the last release.

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

**Which engine the check actually exercises.** Since 2026-08-20 the bundled
one wins over anything on `PATH`, so opening the installed app verifies the
engine that shipped in it — which is the point of the step. Before that
change it did not: an older `docmap.exe` on the tester's `PATH` silently
took precedence, and the app looked correct while running a two-day-old
engine with four languages instead of twenty-three. If you want to confirm
which one is in use, the sidebar says `(bundled)` or `(found on PATH)`.

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

**Until something is published, both of those are broken, and they say so
out loud.** Checked on 2026-08-21, with `v0.1.0` and `v0.2.0` sitting in the
Releases page as drafts and nothing public:

```
$ curl -sI .../releases/latest            # 302, to the releases list
$ curl -s .../badge/v/release/...         # "release: no releases or repo not found"
```

The README's *Download the latest release* link and its version badge are the
first two things a visitor sees, and a repository with three tags and two
drafts renders as a repository with no releases at all. That is not an
argument against the draft step — it is an argument for finishing it.

---

## A draft ages, and it ages fast

`v0.2.0` was cut on 2026-08-20 with nine green assets and never published.
By the next morning **22 desktop commits and 17 engine commits** had landed
on top of it. Publishing it then would have shipped a version nobody would
ever install, and the walkthrough below — install it, open it, click four
things — would have been done on software that was already history.

So: **the check is part of the cut, not a task for later.** If a draft
cannot be opened within a day or so of building it, the honest move is to
let it go stale on purpose and re-cut from `main` when there is time to
check it.

What to do with the number is a smaller question with a clear answer.
`v0.2.0` was never public, so 0.2.0 was technically free — but `HANDOVER.md`
and `PLAN-DONE.md` already described what was *in* it, and a tag pointing at
a different tree than the prose written about it is worse than a gap in the
sequence. The draft was deleted, the tag left standing as a point in the
history, and the next release took the next number.

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
