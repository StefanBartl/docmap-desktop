//! Finding a project's own icon, by following conventions somebody else
//! defined.
//!
//! **Every candidate below is a standard, not a guess.** That distinction is
//! the whole design: inventing a rule — "we look for `logo.png`" — means
//! documenting it, teaching it, and living with it, and a project that does
//! not know the rule gets nothing anyway. Following existing conventions
//! means a project that already ships an icon for a real reason is
//! recognised without being told.
//!
//! In priority order, most specific first:
//!
//! 1. **A web app manifest** (`manifest.json`, `site.webmanifest`) and its
//!    `icons` array. This is the W3C standard for exactly this question, it
//!    carries sizes, and the entry it names is the one the project itself
//!    considers its icon.
//! 2. **`apple-touch-icon.png`** — Apple's home-screen convention, and in
//!    practice the highest-resolution single file a web project ships.
//! 3. **A favicon**, `.svg` before `.png` before `.ico`: SVG scales, and
//!    `.ico` is often a 16px relic.
//! 4. **An Android launcher icon** under `res/mipmap-*/ic_launcher.png`.
//! 5. **An iOS app icon** under an `AppIcon.appiconset/`.
//!
//! Nothing matches for most repositories — a Neovim plugin has no icon and
//! is not supposed to — and nothing is exactly what they get. An absent icon
//! renders as absent, never as a placeholder: a grey square in front of
//! thirty projects is noise pretending to be information.

use std::fs;
use std::path::{Component, Path, PathBuf};

use crate::safe_read;

/// Directories a web project keeps its static files in, root first.
///
/// Not a search of the whole tree: an icon is a top-level fact about a
/// project, and walking a repository looking for any `.png` called
/// something promising is how you end up showing a screenshot from a
/// tutorial in someone's `docs/`.
const WEB_ROOTS: &[&str] = &[".", "public", "static", "www", "app", "src", "assets"];

const MANIFESTS: &[&str] = &["manifest.json", "site.webmanifest", "manifest.webmanifest"];

const FAVICONS: &[&str] = &[
    "apple-touch-icon.png",
    "favicon.svg",
    "icon.svg",
    "favicon.png",
    "icon.png",
    "favicon.ico",
];

fn readable_file(p: &Path) -> bool {
    p.is_file() && fs::metadata(p).map(|m| m.len() > 0).unwrap_or(false)
}

/// The largest icon a web app manifest declares, resolved against it.
///
/// Largest rather than first: the array is ordered by nothing in
/// particular, and a 16px entry is a favicon while a 512px one is the icon
/// the project means when it says icon.
///
/// `root` is the canonical project root, `manifest` the (resolved) file to read
/// and `dir_rel` the directory the manifest is *found* in, relative to the root.
/// A relative `src` is looked up against where the manifest is found — a
/// browser resolves it against the manifest's own URL — not against where a
/// symlinked manifest happens to point. Every
/// `src` is **untrusted text from the repository**: `Path::join` replaces its
/// base when the right-hand side is absolute, so a `src` of `\\host\share\a.png`
/// made Windows contact that host just to ask whether the file exists, and a
/// `C:\...` or `../..` one probed (and then showed, through the asset
/// protocol) any file on disk. It is therefore resolved with
/// [`crate::resolve_inside`], which refuses such shapes before touching the
/// disk and requires the result to stay inside the project.
///
/// `b` is what is left of the budget of this `find`: a manifest can hold some
/// seventy thousand `src` values, `find` looks at up to twenty-one manifests,
/// and each value costs a walk and a `canonicalize`. A real manifest is a few
/// kilobytes and lists a handful of icons.
fn from_manifest(root: &Path, manifest: &Path, dir_rel: &str, b: &mut Budget) -> Option<PathBuf> {
    if b.entries == 0 || b.manifest_bytes == 0 {
        return None;
    }
    let body = safe_read::read_text(manifest, b.manifest_bytes.min(1 << 20), false)?;
    b.manifest_bytes -= body.len() as u64;
    let v: serde_json::Value = serde_json::from_str(&body).ok()?;
    let icons = v.get("icons")?.as_array()?;
    let dir_rel = Path::new(dir_rel);

    let mut best: Option<(u64, PathBuf)> = None;
    for icon in icons {
        let Some(src) = icon.get("src").and_then(|s| s.as_str()) else {
            continue;
        };
        if b.entries == 0 {
            break;
        }
        b.entries -= 1;
        // `sizes` is "48x48" or "48x48 96x96" or "any"; take the first
        // number it offers and treat "any" (an SVG) as larger than any
        // raster, because it is.
        let sizes = icon.get("sizes").and_then(|s| s.as_str()).unwrap_or("");
        let px: u64 = if sizes.contains("any") {
            u64::MAX
        } else {
            sizes
                .split(['x', ' '])
                .filter_map(|n| n.parse::<u64>().ok())
                .max()
                .unwrap_or(0)
        };

        // A manifest `src` is relative to the manifest itself, and a leading
        // `/` means the *web* root — which is the manifest's directory here,
        // not the filesystem root. Reading it as absolute would send this
        // looking in `C:/`.
        let rel = src.trim_start_matches(['/', '\\']);
        let Ok(path) = crate::resolve_inside_budgeted(
            root,
            &dir_rel.join(rel).to_string_lossy(),
            &mut b.steps,
        ) else {
            continue;
        };
        if readable_file(&path) && best.as_ref().is_none_or(|(b, _)| px > *b) {
            best = Some((px, path));
        }
    }
    best.map(|(_, p)| p)
}

/// The largest `.png` in a directory, by file size.
///
/// For icon sets that encode the size in the filename in a dozen different
/// ways (`ic_launcher.png` in `mipmap-xxxhdpi/`, `Icon-App-60x60@3x.png`),
/// bytes are the one comparison that needs no parser.
///
/// Each candidate is resolved like every other probe — a link that stays in
/// the project is followed, one that leaves it (or reaches another machine)
/// is not — and the size is the resolved file's, not the link's.
///
/// Bounded: the directory is repository content, and resolving a link costs a
/// walk and a `canonicalize` (tens of milliseconds for a chain of links). At
/// most [`MAX_ENTRIES`] files are looked at and the links among them draw on
/// the budget `b`.
fn largest_png(root: &Path, rel_dir: &str, dir: &Path, b: &mut Budget) -> Option<PathBuf> {
    let mut best: Option<(u64, PathBuf)> = None;
    let pngs = fs::read_dir(dir)
        .ok()?
        .flatten()
        .filter(|e| {
            Path::new(&e.file_name())
                .extension()
                .and_then(|x| x.to_str())
                == Some("png")
        })
        .take(MAX_ENTRIES);
    for entry in pngs {
        let name = entry.file_name().to_string_lossy().to_string();
        let Some((size, p)) = probe(
            root,
            &format!("{rel_dir}/{name}"),
            Some(&dir.join(&name)),
            b,
        ) else {
            continue;
        };
        if best.as_ref().is_none_or(|(b, _)| size > *b) {
            best = Some((size, p));
        }
    }
    best.map(|(_, p)| p)
}

/// How many directory entries one probe looks at, and how many links it
/// resolves along the way, in a directory that is repository content.
const MAX_ENTRIES: usize = 256;
const MAX_LINKS: usize = 32;
/// Components the link walk may look at, over every path one `find` resolves.
/// An ordinary project needs a few hundred; each look costs the kernel a walk
/// of the whole prefix, so a hostile tree can make the same few thousand cost
/// minutes.
const FIND_WALK_STEPS: u32 = 4096;
/// Bytes of manifest read and parsed, in all the manifests of one `find`.
const MAX_MANIFEST_BYTES: u64 = 2 << 20;

/// What one [`find`] may spend. The repository decides how much there is to
/// look at - thousands of manifest entries, links, levels - so the work is
/// bounded per request and not per path, and every part of the lookup draws on
/// the same budget.
struct Budget {
    /// Links resolved in the directory scans.
    links: usize,
    /// `src` values resolved, in all the manifests.
    entries: usize,
    /// Components looked at by the link walk, over all paths.
    steps: u32,
    /// Manifest bytes still to be read.
    manifest_bytes: u64,
}

impl Budget {
    fn new() -> Self {
        Budget {
            links: MAX_LINKS,
            entries: MAX_ENTRIES,
            steps: FIND_WALK_STEPS,
            manifest_bytes: MAX_MANIFEST_BYTES,
        }
    }
}

/// `rel` under `root` as an icon candidate: its size and where to read it.
///
/// `plain` is the same file spelled through directories already resolved and
/// known to be real ones. If it is a regular file it is taken as it is - a path
/// of plain components cannot lead anywhere else, and one `lstat` replaces the
/// walk and the `canonicalize`. Only a link goes through [`inside`], and only
/// while the budget lasts.
fn probe(root: &Path, rel: &str, plain: Option<&Path>, b: &mut Budget) -> Option<(u64, PathBuf)> {
    if let Some(p) = plain {
        let meta = fs::symlink_metadata(p).ok()?;
        if meta.is_file() {
            return Some((meta.len(), p.to_path_buf()));
        }
        if !meta.file_type().is_symlink() {
            return None;
        }
    }
    if b.links == 0 {
        return None;
    }
    b.links -= 1;
    let p = inside(root, rel, b)?;
    let meta = fs::metadata(&p).ok()?;
    meta.is_file().then_some((meta.len(), p))
}

/// `rel` inside `root` — resolved through [`crate::resolve_inside`], which
/// refuses a shape that leaves the project and a link to another machine
/// *before* anything is statted. Every probe below goes through this: `is_dir`,
/// `is_file` and `metadata` all follow links, and on Windows a `favicon.ico`
/// that is a link to `\\host\share` makes the machine contact that host just to
/// answer "is it a file".
fn inside(root: &Path, rel: &str, b: &mut Budget) -> Option<PathBuf> {
    crate::resolve_inside_budgeted(root, rel, &mut b.steps).ok()
}

/// `dir/name`, with `.` meaning the root itself.
fn join_rel(dir: &str, name: &str) -> String {
    if dir == "." {
        name.to_string()
    } else {
        format!("{dir}/{name}")
    }
}

/// Look for an icon under `root`. `None` is the common and correct answer.
///
/// The answer is handed on without its `\\?\` prefix (to the asset protocol,
/// which opens it as given), and Win32 reads a component that ends in a dot or
/// a space as a different name - through a link beside it. So a path with such
/// a component is never the answer, however it was found.
pub fn find(root: &Path) -> Option<PathBuf> {
    find_unchecked(root).filter(|p| {
        !p.components()
            .any(|c| matches!(c, Component::Normal(n) if crate::languages::win32_rewrites_name(n)))
    })
}

fn find_unchecked(root: &Path) -> Option<PathBuf> {
    // Canonical, so what a manifest names can be checked against it.
    let root = fs::canonicalize(root).ok()?;
    let root = root.as_path();
    let mut b = Budget::new();
    // 1 & 2 & 3: the web conventions, per static root.
    for dir in WEB_ROOTS {
        let Some(base) = inside(root, if *dir == "." { "" } else { dir }, &mut b) else {
            continue;
        };
        if !base.is_dir() {
            continue;
        }
        for name in MANIFESTS {
            let Some(m) = inside(root, &join_rel(dir, name), &mut b) else {
                continue;
            };
            if m.is_file() {
                let dir_rel = if *dir == "." { "" } else { dir };
                if let Some(icon) = from_manifest(root, &m, dir_rel, &mut b) {
                    return Some(icon);
                }
            }
        }
        for name in FAVICONS {
            let Some(f) = inside(root, &join_rel(dir, name), &mut b) else {
                continue;
            };
            if readable_file(&f) {
                return Some(f);
            }
        }
    }

    // 4: Android. `mipmap-*` is a family of density buckets; the largest
    // file across them is the highest-density copy of the same icon.
    for res in ["app/src/main/res", "src/main/res", "res"] {
        let Some(dir) = inside(root, res, &mut b) else {
            continue;
        };
        if !dir.is_dir() {
            continue;
        }
        let mut best: Option<(u64, PathBuf)> = None;
        if let Ok(entries) = fs::read_dir(&dir) {
            let buckets = entries
                .flatten()
                .filter(|e| {
                    let name = e.file_name().to_string_lossy().to_string();
                    (name.starts_with("mipmap") || name.starts_with("drawable"))
                        && !crate::languages::win32_rewrites_name(&e.file_name())
                })
                .take(MAX_ENTRIES);
            for entry in buckets {
                let name = entry.file_name().to_string_lossy().to_string();
                // A bucket that is a real directory has plain contents; one
                // that is a link is resolved file by file, like any link.
                let real_dir = entry.file_type().is_ok_and(|t| t.is_dir());
                for icon in ["ic_launcher.png", "ic_launcher_round.png"] {
                    let plain = dir.join(&name).join(icon);
                    let Some((size, p)) = probe(
                        root,
                        &format!("{res}/{name}/{icon}"),
                        real_dir.then_some(plain.as_path()),
                        &mut b,
                    ) else {
                        continue;
                    };
                    if best.as_ref().is_none_or(|(b, _)| size > *b) {
                        best = Some((size, p));
                    }
                }
            }
        }
        if let Some((_, p)) = best {
            return Some(p);
        }
    }

    // 5: iOS. The appiconset is a directory of sizes with a JSON index; the
    // largest file in it is the one worth showing.
    for assets in [
        "Assets.xcassets",
        "ios/Assets.xcassets",
        "Resources/Assets.xcassets",
    ] {
        let rel_dir = format!("{assets}/AppIcon.appiconset");
        let Some(dir) = inside(root, &rel_dir, &mut b) else {
            continue;
        };
        if dir.is_dir() {
            if let Some(p) = largest_png(root, &rel_dir, &dir, &mut b) {
                return Some(p);
            }
        }
    }

    None
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;

    fn tmp(name: &str) -> PathBuf {
        let d = std::env::temp_dir().join(format!("docmap-icon-{name}"));
        let _ = fs::remove_dir_all(&d);
        fs::create_dir_all(&d).unwrap();
        d
    }

    /// `find` answers with canonical paths (it checks manifest entries against
    /// the canonical root), so what it is compared with is canonical too.
    fn canon(p: PathBuf) -> PathBuf {
        fs::canonicalize(p).unwrap()
    }

    fn write(path: &Path, bytes: &[u8]) {
        fs::create_dir_all(path.parent().unwrap()).unwrap();
        fs::File::create(path).unwrap().write_all(bytes).unwrap();
    }

    #[test]
    fn a_repository_with_no_icon_gets_none() {
        // The common case, and the one that must not produce a placeholder:
        // a Neovim plugin has no icon and is not supposed to.
        let root = tmp("none");
        write(&root.join("lua/x/init.lua"), b"return {}");
        assert_eq!(find(&root), None);
    }

    #[test]
    fn a_favicon_is_found_and_svg_beats_png() {
        let root = tmp("favicon");
        write(&root.join("public/favicon.png"), b"png-bytes");
        write(&root.join("public/favicon.svg"), b"<svg/>");
        assert_eq!(find(&root).unwrap(), canon(root.join("public/favicon.svg")));
    }

    #[test]
    fn a_manifest_wins_over_a_favicon_beside_it() {
        // The manifest is the project saying which image is its icon; a
        // favicon is a browser-tab detail that happens to be an image.
        let root = tmp("manifest");
        write(&root.join("public/favicon.png"), b"fav");
        write(&root.join("public/logo-512.png"), b"big");
        write(
            &root.join("public/manifest.json"),
            br#"{"icons":[{"src":"logo-512.png","sizes":"512x512"}]}"#,
        );
        assert_eq!(
            find(&root).unwrap(),
            canon(root.join("public/logo-512.png"))
        );
    }

    #[test]
    fn the_manifests_largest_icon_wins() {
        let root = tmp("sizes");
        write(&root.join("icon-16.png"), b"s");
        write(&root.join("icon-512.png"), b"l");
        write(
            &root.join("manifest.json"),
            br#"{"icons":[{"src":"icon-16.png","sizes":"16x16"},
                          {"src":"icon-512.png","sizes":"512x512"}]}"#,
        );
        assert_eq!(find(&root).unwrap(), canon(root.join("icon-512.png")));
    }

    #[test]
    fn a_manifest_src_rooted_at_slash_stays_inside_the_project() {
        // `"/icon.png"` means the *web* root. Reading it as a filesystem
        // path would send this looking at `C:/icon.png`, which on a machine
        // that happens to have one would show a stranger's image.
        let root = tmp("slash");
        write(&root.join("public/icon.png"), b"x");
        write(
            &root.join("public/manifest.json"),
            br#"{"icons":[{"src":"/icon.png","sizes":"192x192"}]}"#,
        );
        assert_eq!(find(&root).unwrap(), canon(root.join("public/icon.png")));
    }

    #[test]
    fn a_manifest_naming_a_file_that_is_not_there_falls_through() {
        // Common in a repository whose build generates its icons: the
        // manifest is checked in, the images are not.
        let root = tmp("dangling");
        write(&root.join("favicon.ico"), b"ico");
        write(
            &root.join("manifest.json"),
            br#"{"icons":[{"src":"generated/icon.png","sizes":"512x512"}]}"#,
        );
        assert_eq!(find(&root).unwrap(), canon(root.join("favicon.ico")));
    }

    #[test]
    fn an_android_launcher_icon_is_found() {
        let root = tmp("android");
        write(
            &root.join("app/src/main/res/mipmap-mdpi/ic_launcher.png"),
            b"s",
        );
        write(
            &root.join("app/src/main/res/mipmap-xxxhdpi/ic_launcher.png"),
            b"much-larger-file",
        );
        assert_eq!(
            find(&root).unwrap(),
            canon(root.join("app/src/main/res/mipmap-xxxhdpi/ic_launcher.png"))
        );
    }

    #[test]
    fn an_empty_file_is_not_an_icon() {
        // A zero-byte `favicon.ico` is what a failed download leaves behind,
        // and it renders as a broken image rather than as nothing.
        let root = tmp("empty");
        write(&root.join("favicon.ico"), b"");
        assert_eq!(find(&root), None);
    }

    #[test]
    fn a_manifest_src_that_leaves_the_project_is_never_returned() {
        // The manifest is the repository's own text. `..` and an absolute path
        // used to be joined as they were, so a project could name a file
        // anywhere on the machine as its icon, and the window then loaded it.
        let outer = tmp("escape");
        let project = outer.join("project");
        write(&outer.join("secret.png"), b"not yours");
        let absolute = outer.join("secret.png").to_string_lossy().to_string();
        for src in ["../secret.png", r"..\secret.png", absolute.as_str()] {
            write(
                &project.join("manifest.json"),
                serde_json::json!({"icons": [{"src": src, "sizes": "512x512"}]})
                    .to_string()
                    .as_bytes(),
            );
            assert_eq!(find(&project), None, "{src}");
        }
    }

    #[cfg(windows)]
    #[test]
    fn a_manifest_src_naming_another_machine_is_refused_without_contacting_it() {
        let project = tmp("unc");
        write(
            &project.join("manifest.json"),
            serde_json::json!({"icons": [{"src": r"\\192.0.2.1\share\i.png", "sizes": "512x512"}]})
                .to_string()
                .as_bytes(),
        );
        let started = std::time::Instant::now();
        assert_eq!(find(&project), None);
        assert!(
            started.elapsed().as_secs() < 3,
            "it must not wait for the host"
        );
    }

    #[cfg(unix)]
    #[test]
    fn a_favicon_that_is_a_link_out_of_the_project_is_not_the_icon() {
        // Every probe resolves through the same check as the manifest entries,
        // not only the manifest: a checked-out link must not become the icon
        // of the project (or, on Windows, make the machine contact a host).
        let outer = tmp("faviconlink");
        let project = outer.join("project");
        write(&outer.join("private.png"), b"not yours");
        fs::create_dir_all(&project).unwrap();
        std::os::unix::fs::symlink(outer.join("private.png"), project.join("favicon.png")).unwrap();
        assert_eq!(find(&project), None);
    }

    #[cfg(unix)]
    #[test]
    fn a_symlinked_manifest_resolves_its_src_where_it_is_found() {
        // public/manifest.json is a link to config/manifest.json; its relative
        // `src` means public/logo.png, as a browser reads it.
        let root = tmp("manifestlink");
        write(&root.join("public/logo.png"), b"big");
        write(
            &root.join("config/manifest.json"),
            br#"{"icons":[{"src":"logo.png","sizes":"512x512"}]}"#,
        );
        std::os::unix::fs::symlink(
            root.join("config/manifest.json"),
            root.join("public/manifest.json"),
        )
        .unwrap();
        assert_eq!(find(&root).unwrap(), canon(root.join("public/logo.png")));
    }

    #[cfg(unix)]
    #[test]
    fn an_ios_icon_that_links_inside_the_project_is_found_and_one_that_leaves_is_not() {
        let outer = tmp("iosicon");
        let project = outer.join("project");
        let set = project.join("Assets.xcassets/AppIcon.appiconset");
        write(&project.join("shared/Icon-1024.png"), b"inside-and-larger");
        write(&outer.join("private.png"), b"outside-and-even-larger-bytes");
        write(&set.join("Icon-60.png"), b"s");
        std::os::unix::fs::symlink(
            project.join("shared/Icon-1024.png"),
            set.join("Icon-1024.png"),
        )
        .unwrap();
        std::os::unix::fs::symlink(outer.join("private.png"), set.join("Leak.png")).unwrap();
        // The in-project link wins on size; the one that leaves is ignored.
        assert_eq!(
            find(&project).unwrap(),
            canon(project.join("shared/Icon-1024.png"))
        );
    }

    #[test]
    fn a_plain_file_costs_no_link_and_a_link_costs_one() {
        let root = canon(tmp("probe"));
        write(&root.join("d/a.png"), b"abc");
        let plain = root.join("d/a.png");
        // A regular file is taken as it is, even with no links left.
        let mut none = Budget::new();
        none.links = 0;
        let (size, p) = probe(&root, "d/a.png", Some(&plain), &mut none).unwrap();
        assert_eq!((size, none.links, p), (3, 0, plain.clone()));

        if !crate::testutil::file_link(&root.join("d/l.png"), &plain) {
            eprintln!("SKIP: no privilege to create symlinks");
            return;
        }
        let link = root.join("d/l.png");
        assert!(probe(&root, "d/l.png", Some(&link), &mut none).is_none());
        let mut one = Budget::new();
        one.links = 1;
        let (size, p) = probe(&root, "d/l.png", Some(&link), &mut one).unwrap();
        assert_eq!((size, one.links, p), (3, 0, plain));
    }

    #[test]
    fn links_in_an_icon_set_are_resolved_within_a_budget() {
        let root = canon(tmp("linkbudget"));
        let rel = "Assets.xcassets/AppIcon.appiconset";
        write(&root.join(rel).join("plain.png"), b"p");
        write(&root.join("big.png"), b"the-linked-one-is-larger");
        if !crate::testutil::file_link(&root.join(rel).join("l0.png"), &root.join("big.png")) {
            eprintln!("SKIP: no privilege to create symlinks");
            return;
        }
        for i in 1..(MAX_LINKS + 8) {
            assert!(crate::testutil::file_link(
                &root.join(rel).join(format!("l{i}.png")),
                &root.join("big.png")
            ));
        }
        let mut b = Budget::new();
        let found = largest_png(&root, rel, &root.join(rel), &mut b).unwrap();
        // More links than the budget: it is spent, not exceeded, and the call
        // still answers (with the linked file, the larger of what it saw).
        assert_eq!(b.links, 0);
        assert_eq!(found, root.join("big.png"));
        // With nothing left, only plain files are considered.
        let mut none = Budget::new();
        none.links = 0;
        let found = largest_png(&root, rel, &root.join(rel), &mut none).unwrap();
        assert_eq!(found, root.join(rel).join("plain.png"));
    }

    /// A manifest listing `missing` icons that are not there, then `logo.png`
    /// if `logo`.
    fn manifest_json(missing: usize, logo: bool) -> String {
        let mut icons: Vec<_> = (0..missing)
            .map(|i| serde_json::json!({"src": format!("missing{i}.png")}))
            .collect();
        if logo {
            icons.push(serde_json::json!({"src": "logo.png", "sizes": "512x512"}));
        }
        serde_json::json!({ "icons": icons }).to_string()
    }

    #[test]
    fn a_manifest_is_read_for_a_limited_number_of_icons() {
        let root = tmp("manifestcap");
        write(&root.join("logo.png"), b"png");
        write(
            &root.join("manifest.json"),
            manifest_json(MAX_ENTRIES, true).as_bytes(),
        );
        // The 257th entry is past what is looked at.
        assert_eq!(find(&root), None);
        write(
            &root.join("manifest.json"),
            manifest_json(MAX_ENTRIES - 1, true).as_bytes(),
        );
        assert_eq!(find(&root).unwrap(), canon(root.join("logo.png")));
    }

    #[test]
    fn the_icon_budget_is_shared_by_all_the_manifests_of_one_find() {
        let root = tmp("manifestshared");
        write(&root.join("logo.png"), b"png");
        // 200 + 100 missing entries, and the logo as the 301st: out of reach
        // with one budget for the lookup, found with one per manifest.
        write(
            &root.join("manifest.json"),
            manifest_json(200, false).as_bytes(),
        );
        write(
            &root.join("site.webmanifest"),
            manifest_json(100, true).as_bytes(),
        );
        assert_eq!(find(&root), None);
        // On its own the second one is fine.
        fs::remove_file(root.join("manifest.json")).unwrap();
        assert_eq!(find(&root).unwrap(), canon(root.join("logo.png")));
    }

    #[test]
    fn the_bytes_of_manifests_read_are_shared_too() {
        let root = tmp("manifestbytes");
        write(&root.join("logo.png"), b"png");
        let padded = |pad: usize, logo: bool| {
            let mut v: serde_json::Value = serde_json::from_str(&manifest_json(0, logo)).unwrap();
            v["pad"] = serde_json::Value::String("x".repeat(pad));
            v.to_string()
        };
        // Two manifests of a megabyte that say nothing use up most of the
        // budget; the real one, a few hundred kilobytes, no longer fits.
        write(
            &root.join("manifest.json"),
            padded(1_000_000, false).as_bytes(),
        );
        write(
            &root.join("site.webmanifest"),
            padded(1_000_000, false).as_bytes(),
        );
        write(
            &root.join("manifest.webmanifest"),
            padded(200_000, true).as_bytes(),
        );
        assert_eq!(find(&root), None);
        fs::remove_file(root.join("manifest.json")).unwrap();
        assert_eq!(find(&root).unwrap(), canon(root.join("logo.png")));
    }

    #[test]
    fn the_work_of_the_link_walk_is_shared_by_all_the_paths_of_one_find() {
        let mut b = Budget::new();
        b.steps = 3;
        let root = canon(tmp("steps"));
        write(&root.join("a/b/c/d/e.png"), b"png");
        // Five components cost five looks; three are all there is.
        #[cfg(windows)]
        {
            assert!(inside(&root, "a/b/c/d/e.png", &mut b).is_none());
            assert_eq!(b.steps, 0);
            // Spent: nothing is looked at any more, not even a short path.
            assert!(inside(&root, "a", &mut b).is_none());
        }
        #[cfg(not(windows))]
        {
            // The link walk is a Windows thing; elsewhere there is no cost.
            assert!(inside(&root, "a/b/c/d/e.png", &mut b).is_some());
        }
    }

    #[cfg(windows)]
    #[test]
    fn a_name_win32_rewrites_never_reaches_the_asset_protocol() {
        // `evil.` is a real directory (made through the verbatim root) beside
        // a junction `evil`. The path find() answers with is handed on
        // without its `\\?\` prefix, and then Win32 opens `evil.` as `evil`.
        // `fresh_dir`, not `tmp`: only a verbatim path can remove a directory
        // named `evil.` again for the next run.
        let root = crate::testutil::fresh_dir("docmap-icon-rewritten");
        let elsewhere = crate::testutil::fresh_dir("docmap-icon-rewritten-target");
        write(&elsewhere.join("icon.png"), b"the-other-one");

        // A manifest `src` through such a directory.
        write(&root.join("public/evil./icon.png"), b"png");
        assert!(crate::testutil::dir_link(
            &root.join("public/evil"),
            &elsewhere
        ));
        write(
            &root.join("public/manifest.json"),
            br#"{"icons":[{"src":"evil./icon.png","sizes":"512x512"}]}"#,
        );
        assert_eq!(find(&root), None);

        // An Android bucket of that name.
        fs::remove_file(root.join("public/manifest.json")).unwrap();
        write(
            &root.join("app/src/main/res/mipmap-hdpi./ic_launcher.png"),
            b"png",
        );
        assert_eq!(find(&root), None);
    }

    #[test]
    fn an_icon_set_link_that_leaves_the_project_is_ignored_on_every_platform() {
        let outer = tmp("iosleave");
        let project = outer.join("project");
        let set = project.join("Assets.xcassets/AppIcon.appiconset");
        write(&set.join("Icon-60.png"), b"s");
        write(&outer.join("private.png"), b"outside-and-much-larger-bytes");
        if !crate::testutil::file_link(&set.join("Leak.png"), &outer.join("private.png")) {
            eprintln!("SKIP: no privilege to create symlinks");
            return;
        }
        assert_eq!(find(&project).unwrap(), canon(set.join("Icon-60.png")));
    }

    #[cfg(windows)]
    #[test]
    fn an_icon_set_link_to_another_machine_is_not_followed() {
        let project = tmp("iosunc");
        let set = project.join("Assets.xcassets/AppIcon.appiconset");
        write(&set.join("Icon-60.png"), b"s");
        let target = format!(r"\\{}\share\Leak.png", crate::testutil::unc_host());
        if !crate::testutil::file_link(&set.join("Leak.png"), Path::new(&target)) {
            eprintln!("SKIP: no privilege to create symlinks");
            return;
        }
        let started = std::time::Instant::now();
        assert_eq!(find(&project).unwrap(), canon(set.join("Icon-60.png")));
        assert!(
            started.elapsed().as_secs() < 3,
            "it must not wait for a host"
        );
    }

    #[test]
    fn an_entry_without_a_src_does_not_end_the_search() {
        let root = tmp("nosrc");
        write(&root.join("icon-512.png"), b"l");
        write(
            &root.join("manifest.json"),
            br#"{"icons":[{"sizes":"16x16"},{"src":"icon-512.png","sizes":"512x512"}]}"#,
        );
        assert_eq!(find(&root).unwrap(), canon(root.join("icon-512.png")));
    }
}
