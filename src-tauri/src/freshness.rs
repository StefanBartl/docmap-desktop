//! Whether a project's map has fallen behind its sources.
//!
//! **What this can and cannot say, stated first because the wording of the
//! answer depends on it.** This compares modification times: the newest file
//! under the root against the map's own. That answers *"something was
//! touched since"*, in milliseconds, over a walk this crate already does for
//! language counting.
//!
//! It does **not** answer *"the map would come out different"*. A file saved
//! with no edit in it counts here and would not change a byte of the
//! artifact. The exact answer exists — `docmap <root> --check` regenerates
//! into memory and byte-compares — and costs a full scan, which is why it is
//! a thing to ask for rather than a thing to show for thirty-three
//! repositories.
//!
//! So the mark says *sources are newer than the map*, and never *the map is
//! wrong*. A cheap signal worded as an expensive one is the failure this
//! project keeps designing against, arrived at from the polite direction.

use std::fs;
use std::path::{Path, PathBuf};
use std::time::SystemTime;

use serde::Serialize;

use crate::languages::{is_nested_checkout, SKIP_DIRS};

/// Same cap as the language scan, for the same reason: a walk that cannot be
/// bounded is one that can hang the window on a pathological tree.
const MAX_FILES: usize = 20_000;

#[derive(Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct Freshness {
    /// Whether there is a map at all. `false` makes every other field
    /// meaningless, and is a different state from "stale" — a project that
    /// has never been generated is not behind, it is absent.
    pub has_map: bool,
    /// Sources are newer than the map. Only meaningful when `has_map`.
    pub stale: bool,
    /// The repository-relative path of the newest file found, so the answer
    /// can name its own evidence rather than asserting a verdict. `None`
    /// when the tree holds no files this walk reached.
    pub newest: Option<String>,
    /// Seconds between the map and the newest source, when stale. Shown as
    /// an age rather than a timestamp: "2 hours behind" is read faster than
    /// two clock times that have to be subtracted by the reader.
    pub behind_secs: Option<u64>,
    /// The walk hit [`MAX_FILES`]. The answer is then a lower bound: there
    /// may be newer files it never reached, so "not stale" becomes "not
    /// known to be stale" and the caller has to say so.
    pub truncated: bool,
    /// How long ago the map was written, in seconds. `None` when there is
    /// none.
    ///
    /// Returned separately from `behind_secs` because they answer different
    /// questions and only one of them has an answer most of the time:
    /// `behind_secs` is a gap and exists only while stale, this is an age
    /// and exists whenever a map does. It is what the "least recently
    /// generated" order reads — a question about the map alone, which
    /// staleness cannot answer because a repository nobody has touched
    /// stays un-stale forever no matter how old its map is.
    ///
    /// Costs nothing: `check` already reads this timestamp to compare
    /// against, and was throwing it away.
    pub generated_secs: Option<u64>,
}

fn mtime(path: &Path) -> Option<SystemTime> {
    fs::metadata(path).ok()?.modified().ok()
}

/// Compare the newest source under `root` against the map in `map_dir`.
pub fn check(root: &Path, map_dir: &Path) -> Result<Freshness, String> {
    if !root.is_dir() {
        return Err(format!("{} is not a directory", root.display()));
    }

    // `module_map.json` rather than `index.html`: both are written by the
    // same run, and the JSON is the one a byte-deterministic `--check`
    // compares — so if the two ever disagree, this reads the one that
    // decides.
    let map_time = match mtime(&map_dir.join("module_map.json")) {
        Some(t) => t,
        None => {
            return Ok(Freshness {
                has_map: false,
                ..Default::default()
            })
        }
    };

    // Saturating rather than erroring: a file dated in the future (a bad
    // clock, a restored archive) is not a reason to refuse an answer about
    // every other project, and "written 0 seconds ago" is the harmless
    // reading of it.
    let generated_secs = SystemTime::now()
        .duration_since(map_time)
        .map(|d| d.as_secs())
        .ok();

    let mut newest: Option<(SystemTime, PathBuf)> = None;
    let mut visited = 0usize;
    let mut truncated = false;
    let mut stack = vec![root.to_path_buf()];

    while let Some(dir) = stack.pop() {
        // An unreadable subdirectory costs its own contents, not the answer
        // for everything above it — the same rule the language walk follows.
        let entries = match fs::read_dir(&dir) {
            Ok(e) => e,
            Err(_) => continue,
        };

        for entry in entries.flatten() {
            if visited >= MAX_FILES {
                truncated = true;
                break;
            }
            // `file_type` rather than `metadata`: it does not follow
            // symlinks, which is what keeps a symlink back up the tree from
            // being a cycle.
            let ft = match entry.file_type() {
                Ok(t) => t,
                Err(_) => continue,
            };
            if ft.is_symlink() {
                continue;
            }
            let name = entry.file_name().to_string_lossy().to_string();

            if ft.is_dir() {
                let path = entry.path();
                // The map directory is excluded for the obvious reason: it is
                // written *by* the thing being compared against, so including
                // it would make every freshly generated map look stale
                // against itself.
                if !SKIP_DIRS.contains(&name.as_str())
                    && path != map_dir
                    && !is_nested_checkout(&path)
                {
                    stack.push(path);
                }
                continue;
            }

            visited += 1;
            let path = entry.path();
            if let Some(t) = mtime(&path) {
                if newest.as_ref().is_none_or(|(best, _)| t > *best) {
                    newest = Some((t, path));
                }
            }
        }

        if truncated {
            break;
        }
    }

    let (stale, behind_secs) = match &newest {
        Some((t, _)) => match t.duration_since(map_time) {
            Ok(d) => (true, Some(d.as_secs())),
            // `duration_since` errors when the source is *older*, which is
            // the healthy case.
            Err(_) => (false, None),
        },
        None => (false, None),
    };

    Ok(Freshness {
        has_map: true,
        stale,
        newest: newest.and_then(|(_, p)| {
            p.strip_prefix(root)
                .ok()
                .map(|r| crate::portable(&r))
        }),
        behind_secs,
        truncated,
        generated_secs,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs::File;
    use std::io::Write;

    fn touch(path: &Path, when: SystemTime) {
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).unwrap();
        }
        File::create(path).unwrap().write_all(b"x").unwrap();
        // `set_modified` rather than sleeping: a test that waits a second to
        // prove an ordering is a test nobody runs twice.
        File::options()
            .write(true)
            .open(path)
            .unwrap()
            .set_modified(when)
            .unwrap();
    }

    fn tmp(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("docmap-fresh-{name}"));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    const HOUR: u64 = 3600;

    fn ago(secs: u64) -> SystemTime {
        SystemTime::UNIX_EPOCH + std::time::Duration::from_secs(1_700_000_000 - secs)
    }

    #[test]
    fn no_map_is_not_the_same_as_stale() {
        // A project that has never been generated is not behind; it is
        // absent. Conflating the two would put a "regenerate" mark on
        // something that has nothing to regenerate.
        let root = tmp("nomap");
        touch(&root.join("src/a.lua"), ago(HOUR));
        let f = check(&root, &root.join("docs/map")).unwrap();
        assert!(!f.has_map);
        assert!(!f.stale);
    }

    /// The age of the map exists whenever a map does — including on a
    /// repository nobody has touched, which is the whole case the "least
    /// recently generated" order was added for. Staleness cannot answer
    /// there: an untouched tree stays un-stale forever, however old its map.
    #[test]
    fn the_map_age_is_reported_even_when_nothing_is_stale() {
        let root = tmp("age-fresh");
        let map = root.join("docs/map");
        touch(&root.join("src/a.lua"), ago(4 * HOUR));
        touch(&map.join("module_map.json"), ago(2 * HOUR));
        let f = check(&root, &map).unwrap();
        assert!(!f.stale, "nothing was touched after the map");
        assert_eq!(f.behind_secs, None, "a gap only exists while stale");
        // Roughly two hours old; exactness here would be testing the clock.
        assert!(f.generated_secs.unwrap() >= 2 * HOUR - 5);
    }

    /// No map is no age. The sort treats that as its own case rather than
    /// as "infinitely old", the same distinction `no_map_is_not_the_same_as_stale`
    /// draws for the mark.
    #[test]
    fn no_map_has_no_age() {
        let root = tmp("age-nomap");
        touch(&root.join("src/a.lua"), ago(HOUR));
        let f = check(&root, &root.join("docs/map")).unwrap();
        assert!(!f.has_map);
        assert_eq!(f.generated_secs, None);
    }

    #[test]
    fn a_source_newer_than_the_map_is_stale_and_names_itself() {
        let root = tmp("stale");
        let map = root.join("docs/map");
        touch(&map.join("module_map.json"), ago(2 * HOUR));
        touch(&root.join("src/a.lua"), ago(HOUR));
        let f = check(&root, &map).unwrap();
        assert!(f.has_map);
        assert!(f.stale);
        assert_eq!(f.newest.as_deref(), Some("src/a.lua"));
        // Roughly an hour behind; exactness here would be testing the clock.
        assert!(f.behind_secs.unwrap() >= HOUR - 5);
    }

    #[test]
    fn a_map_newer_than_everything_is_fresh() {
        let root = tmp("fresh");
        let map = root.join("docs/map");
        touch(&root.join("src/a.lua"), ago(2 * HOUR));
        touch(&map.join("module_map.json"), ago(HOUR));
        let f = check(&root, &map).unwrap();
        assert!(!f.stale);
        assert_eq!(f.behind_secs, None);
    }

    #[test]
    fn the_map_directory_does_not_make_itself_stale() {
        // The map is written *into* the tree being compared. Without the
        // exclusion, `index.html` — written a moment after `module_map.json`
        // by the same run — would report every freshly generated map as
        // already behind.
        let root = tmp("selfstale");
        let map = root.join("docs/map");
        touch(&map.join("module_map.json"), ago(2 * HOUR));
        touch(&map.join("index.html"), ago(HOUR));
        touch(&root.join("src/a.lua"), ago(3 * HOUR));
        let f = check(&root, &map).unwrap();
        assert!(!f.stale, "the map's own files must not count as sources");
    }

    #[test]
    fn skipped_directories_do_not_count() {
        // A `git pull` rewrites `.git` constantly, and `node_modules` is
        // touched by every install. Either would report a project as stale
        // forever without a single line of its source having changed.
        let root = tmp("skips");
        let map = root.join("docs/map");
        touch(&root.join("src/a.lua"), ago(3 * HOUR));
        touch(&map.join("module_map.json"), ago(2 * HOUR));
        touch(&root.join("node_modules/pkg/index.js"), ago(HOUR));
        touch(&root.join(".git/HEAD"), ago(HOUR));
        let f = check(&root, &map).unwrap();
        assert!(!f.stale, "newest was {:?}", f.newest);
    }

    #[test]
    fn a_nested_checkout_does_not_count() {
        // The rule the language walk learned the hard way: 306 of one
        // repository's 448 Lua files were copies of itself under
        // `.claude/worktrees/`.
        let root = tmp("nested");
        let map = root.join("docs/map");
        touch(&root.join("src/a.lua"), ago(3 * HOUR));
        touch(&map.join("module_map.json"), ago(2 * HOUR));
        touch(&root.join("sub/.git"), ago(HOUR));
        touch(&root.join("sub/b.lua"), ago(HOUR));
        let f = check(&root, &map).unwrap();
        assert!(!f.stale, "newest was {:?}", f.newest);
    }
}
