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
fn from_manifest(manifest: &Path) -> Option<PathBuf> {
    let body = fs::read_to_string(manifest).ok()?;
    let v: serde_json::Value = serde_json::from_str(&body).ok()?;
    let icons = v.get("icons")?.as_array()?;

    let mut best: Option<(u64, PathBuf)> = None;
    for icon in icons {
        let src = icon.get("src")?.as_str()?;
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
        let rel = src.trim_start_matches('/');
        let path = manifest.parent()?.join(rel);
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
fn largest_png(dir: &Path) -> Option<PathBuf> {
    let mut best: Option<(u64, PathBuf)> = None;
    for entry in fs::read_dir(dir).ok()?.flatten() {
        let p = entry.path();
        if p.extension().and_then(|e| e.to_str()) != Some("png") {
            continue;
        }
        let size = entry.metadata().ok()?.len();
        if best.as_ref().is_none_or(|(b, _)| size > *b) {
            best = Some((size, p));
        }
    }
    best.map(|(_, p)| p)
}

/// Look for an icon under `root`. `None` is the common and correct answer.
pub fn find(root: &Path) -> Option<PathBuf> {
    // 1 & 2 & 3: the web conventions, per static root.
    for dir in WEB_ROOTS {
        let base = if *dir == "." {
            root.to_path_buf()
        } else {
            root.join(dir)
        };
        if !base.is_dir() {
            continue;
        }
        for name in MANIFESTS {
            let m = base.join(name);
            if m.is_file() {
                if let Some(icon) = from_manifest(&m) {
                    return Some(icon);
                }
            }
        }
        for name in FAVICONS {
            let f = base.join(name);
            if readable_file(&f) {
                return Some(f);
            }
        }
    }

    // 4: Android. `mipmap-*` is a family of density buckets; the largest
    // file across them is the highest-density copy of the same icon.
    for res in ["app/src/main/res", "src/main/res", "res"] {
        let dir = root.join(res);
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
                    let p = entry.path().join(icon);
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
    for assets in ["Assets.xcassets", "ios/Assets.xcassets", "Resources/Assets.xcassets"] {
        let dir = root.join(assets).join("AppIcon.appiconset");
        if dir.is_dir() {
            if let Some(p) = largest_png(&dir) {
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
        assert_eq!(find(&root).unwrap(), root.join("public/favicon.svg"));
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
        assert_eq!(find(&root).unwrap(), root.join("public/logo-512.png"));
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
        assert_eq!(find(&root).unwrap(), root.join("icon-512.png"));
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
        assert_eq!(find(&root).unwrap(), root.join("public/icon.png"));
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
        assert_eq!(find(&root).unwrap(), root.join("favicon.ico"));
    }

    #[test]
    fn an_android_launcher_icon_is_found() {
        let root = tmp("android");
        write(&root.join("app/src/main/res/mipmap-mdpi/ic_launcher.png"), b"s");
        write(
            &root.join("app/src/main/res/mipmap-xxxhdpi/ic_launcher.png"),
            b"much-larger-file",
        );
        assert_eq!(
            find(&root).unwrap(),
            root.join("app/src/main/res/mipmap-xxxhdpi/ic_launcher.png")
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
}
