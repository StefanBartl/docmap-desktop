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
use std::path::{Path, PathBuf};

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
fn from_manifest(root: &Path, manifest: &Path, dir_rel: &str) -> Option<PathBuf> {
    let body = safe_read::read_text(manifest, 1 << 20, false)?;
    let v: serde_json::Value = serde_json::from_str(&body).ok()?;
    let icons = v.get("icons")?.as_array()?;
    let dir_rel = Path::new(dir_rel);

    let mut best: Option<(u64, PathBuf)> = None;
    for icon in icons {
        let Some(src) = icon.get("src").and_then(|s| s.as_str()) else {
            continue;
        };
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
        let Ok(path) = crate::resolve_inside(root, &dir_rel.join(rel).to_string_lossy()) else {
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
fn largest_png(root: &Path, rel_dir: &str, dir: &Path) -> Option<PathBuf> {
    let mut best: Option<(u64, PathBuf)> = None;
    for entry in fs::read_dir(dir).ok()?.flatten() {
        let name = entry.file_name().to_string_lossy().to_string();
        if Path::new(&name).extension().and_then(|e| e.to_str()) != Some("png") {
            continue;
        }
        let Some(p) = inside(root, &format!("{rel_dir}/{name}")) else {
            continue;
        };
        let Ok(meta) = fs::metadata(&p) else {
            continue;
        };
        if meta.is_file() && best.as_ref().is_none_or(|(b, _)| meta.len() > *b) {
            best = Some((meta.len(), p));
        }
    }
    best.map(|(_, p)| p)
}

/// `rel` inside `root` — resolved through [`crate::resolve_inside`], which
/// refuses a shape that leaves the project and a link to another machine
/// *before* anything is statted. Every probe below goes through this: `is_dir`,
/// `is_file` and `metadata` all follow links, and on Windows a `favicon.ico`
/// that is a link to `\\host\share` makes the machine contact that host just to
/// answer "is it a file".
fn inside(root: &Path, rel: &str) -> Option<PathBuf> {
    crate::resolve_inside(root, rel).ok()
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
pub fn find(root: &Path) -> Option<PathBuf> {
    // Canonical, so what a manifest names can be checked against it.
    let root = fs::canonicalize(root).ok()?;
    let root = root.as_path();
    // 1 & 2 & 3: the web conventions, per static root.
    for dir in WEB_ROOTS {
        let Some(base) = inside(root, if *dir == "." { "" } else { dir }) else {
            continue;
        };
        if !base.is_dir() {
            continue;
        }
        for name in MANIFESTS {
            let Some(m) = inside(root, &join_rel(dir, name)) else {
                continue;
            };
            if m.is_file() {
                if let Some(icon) = from_manifest(root, &m, if *dir == "." { "" } else { dir }) {
                    return Some(icon);
                }
            }
        }
        for name in FAVICONS {
            let Some(f) = inside(root, &join_rel(dir, name)) else {
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
        let Some(dir) = inside(root, res) else {
            continue;
        };
        if !dir.is_dir() {
            continue;
        }
        let mut best: Option<(u64, PathBuf)> = None;
        if let Ok(entries) = fs::read_dir(&dir) {
            for entry in entries.flatten() {
                let name = entry.file_name().to_string_lossy().to_string();
                if !name.starts_with("mipmap") && !name.starts_with("drawable") {
                    continue;
                }
                for icon in ["ic_launcher.png", "ic_launcher_round.png"] {
                    let Some(p) = inside(root, &format!("{res}/{name}/{icon}")) else {
                        continue;
                    };
                    if let Ok(meta) = fs::metadata(&p) {
                        if best.as_ref().is_none_or(|(b, _)| meta.len() > *b) {
                            best = Some((meta.len(), p));
                        }
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
        let Some(dir) = inside(root, &rel_dir) else {
            continue;
        };
        if dir.is_dir() {
            if let Some(p) = largest_png(root, &rel_dir, &dir) {
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
