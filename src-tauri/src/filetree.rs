//! The repository as it is on disk, one directory at a time.
//!
//! **Why this is here and not in the engine.** The map's tree is the *module*
//! tree: it deliberately hides everything that is not a module, which is what
//! makes it readable and what makes it the wrong answer to "what is actually
//! in this repository". A real filetree is different data, and putting it in
//! the artifact would make it a snapshot — wrong the moment somebody adds a
//! file, in a document whose whole claim is that it is byte-deterministic.
//!
//! Read live instead, by the program that is already walking these
//! directories for language counts and staleness. It is also the program that
//! can open a file when asked, which is the other half of what this is for.
//!
//! **One level per call.** A repository is tens of thousands of files and a
//! reader opens perhaps a dozen directories; walking everything to show one
//! level is work nobody asked for and a window that stalls on a monorepo.
//! Directories that would be skipped by the scan are listed rather than
//! hidden — `node_modules` is genuinely there, and a filetree that quietly
//! omits it is lying about the disk — but they carry the flag, so the caller
//! can say *why* the map ignores them instead of leaving a reader to wonder.

use std::fs;
use std::path::Path;
use std::time::{SystemTime, UNIX_EPOCH};

use serde::Serialize;

use crate::languages::SKIP_DIRS;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Entry {
    pub name: String,
    /// Repository-relative, forward-slashed — the same shape the artifact
    /// uses, so a path from here can be handed straight to `open_in_editor`.
    pub path: String,
    pub is_dir: bool,
    /// `None` for a directory: the size of a directory entry is a number
    /// about the filesystem, not about the project, and showing 4096 next to
    /// every folder teaches nothing.
    pub size: Option<u64>,
    /// Unix seconds. `None` when the platform will not say.
    pub modified: Option<u64>,
    /// This directory is one the scan skips, so nothing under it appears in
    /// the map. Listed anyway — it is on the disk — but the caller can say so.
    pub skipped: bool,
    /// A directory that is its own checkout. The scan stops at these, and a
    /// reader looking for why half a tree is missing from the map deserves
    /// the answer rather than a guess.
    pub nested_repo: bool,
    /// On disk, and git has never been told about it.
    ///
    /// The map reads the *disk*, so an untracked file is mapped like any
    /// other — which is the surprise worth naming. A reader who sees a
    /// module in the map that is not in their last commit is looking at
    /// this, and nothing else in the window says so.
    ///
    /// `false` when the project is not a git repository at all: absence of
    /// git is not evidence about a file, and a window that called every file
    /// in a non-repository "untracked" would be confidently wrong about all
    /// of them.
    pub untracked: bool,
    /// On disk, and `.gitignore` covers it.
    ///
    /// Distinct from `skipped`, and the distinction is the whole point of
    /// carrying both. `skipped` is *this tool's* rule — `node_modules`,
    /// `target`, a nested checkout — and is the same in every repository.
    /// This is the *repository's own* rule, which only its author knows, and
    /// it explains the case `skipped` cannot: a directory the map walked and
    /// a reader expected it to leave alone, or one they ignore in git and are
    /// surprised to find in the map.
    ///
    /// **Ignored does not mean skipped.** The scan does not read
    /// `.gitignore` — a repository can quite reasonably ignore a directory
    /// the map should still describe — so this is a fact shown beside the
    /// entry, never one that changes what the map contains.
    pub ignored: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Listing {
    pub entries: Vec<Entry>,
    /// The directory listed, repository-relative. Empty string for the root.
    pub path: String,
}

fn secs(t: SystemTime) -> Option<u64> {
    t.duration_since(UNIX_EPOCH).ok().map(|d| d.as_secs())
}

/// What git says about the entries of one directory: untracked, and ignored.
///
/// **One call per listing, scoped to the directory being listed.** The pane
/// already reads one level at a time for the reason its own header gives, and
/// asking git the same way keeps the cost proportional — a monorepo's root is
/// answered by looking at the root, not at the monorepo.
///
/// `-unormal` rather than `-uall`, deliberately: it collapses an untracked
/// *directory* to the directory itself instead of listing every file beneath
/// it. That is exactly what a one-level pane wants, and it is also what keeps
/// an untracked `node_modules` from producing forty thousand lines to parse
/// and throw away.
///
/// **Not being a git repository is a real answer, not an error.** Every entry
/// then reports `false` for both, which is the honest state: absence of git
/// is not evidence about a file. The same holds for a git that is missing or
/// fails — the pane still lists the directory, and simply says less about it.
///
/// Returns the names *directly inside* `dir` that git calls untracked or
/// ignored, plus whether `dir` **itself** is one of those.
///
/// **That last pair is not a refinement, it is the case `-unormal` creates.**
/// Collapsing means an untracked directory is reported as one line — `?? src/`
/// — and its contents are never mentioned. Listing that directory would then
/// flag nothing at all, even though every file in it is untracked by
/// definition. Found by a test rather than by reading: the first version
/// passed at the repository root and silently flagged nothing one level down.
///
/// Git reports repository-relative paths and marks a directory with a
/// trailing slash; both are reduced to the first path segment below `dir`, so
/// a deep path still lands on the entry the pane actually shows. A report of
/// `dir` itself reduces to the empty string, which is what the two booleans
/// carry instead of being dropped.
fn git_states(root: &Path, dir: &Path) -> GitStates {
    use std::collections::HashSet;
    let mut out = GitStates {
        untracked: HashSet::new(),
        ignored: HashSet::new(),
        dir_untracked: false,
        dir_ignored: false,
    };

    if !root.join(".git").exists() {
        return out;
    }

    let mut cmd = std::process::Command::new("git");
    cmd.arg("-C")
        .arg(root)
        .args(["status", "--porcelain", "--ignored=matching", "-unormal", "--"])
        .arg(dir);
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }

    let reported = match cmd.output() {
        Ok(o) if o.status.success() => o,
        _ => return out,
    };

    // The prefix of the listed directory, so a reported path can be reduced
    // to the entry it belongs to. Empty when listing the root.
    let prefix = dir
        .strip_prefix(root)
        .map(|r| crate::portable(r))
        .unwrap_or_default();
    let prefix = if prefix.is_empty() {
        String::new()
    } else {
        format!("{}/", prefix.trim_end_matches('/'))
    };

    for line in String::from_utf8_lossy(&reported.stdout).lines() {
        if line.len() < 4 {
            continue;
        }
        let code = &line[..2];
        // Porcelain v1 quotes a path containing unusual bytes. Unquoted here
        // rather than parsed: a name this pane cannot match is a flag it does
        // not set, which is a smaller wrong than a mangled one.
        let rest = line[3..].trim_matches('"');
        let Some(after) = rest.strip_prefix(prefix.as_str()) else {
            continue;
        };
        let name = after.split('/').next().unwrap_or(after);
        // `dir` itself, reported because it is collapsed. Everything the
        // listing is about to show is inside it, so the answer is the same
        // for all of them.
        if name.is_empty() {
            match code {
                "??" => out.dir_untracked = true,
                "!!" => out.dir_ignored = true,
                _ => {}
            }
            continue;
        }
        match code {
            "??" => {
                out.untracked.insert(name.to_string());
            }
            "!!" => {
                out.ignored.insert(name.to_string());
            }
            _ => {}
        }
    }

    out
}

/// What `git_states` answers about one directory.
struct GitStates {
    untracked: std::collections::HashSet<String>,
    ignored: std::collections::HashSet<String>,
    /// The listed directory is itself untracked, so everything in it is.
    dir_untracked: bool,
    /// The listed directory is itself ignored, so everything in it is.
    dir_ignored: bool,
}

/// List one directory of a project.
///
/// `sub` is repository-relative; empty lists the root. Refuses anything that
/// resolves outside the project, for the same reason `open_in_editor` does:
/// the caller is a window rendering somebody's repository, and `..` is the
/// difference between browsing a project and browsing a disk.
pub fn list(root: &Path, sub: &str) -> Result<Listing, String> {
    let root = fs::canonicalize(root).map_err(|e| format!("cannot resolve project root: {e}"))?;
    let dir = if sub.is_empty() {
        root.clone()
    } else {
        fs::canonicalize(root.join(sub)).map_err(|_| format!("no such directory: {sub}"))?
    };
    if !dir.starts_with(&root) {
        return Err(format!("{sub} resolves outside the project"));
    }
    if !dir.is_dir() {
        return Err(format!("{sub} is not a directory"));
    }

    // Asked once, before the loop: this is one subprocess for the whole
    // listing, not one per entry.
    let git = git_states(&root, &dir);

    let mut entries = Vec::new();
    for entry in fs::read_dir(&dir).map_err(|e| format!("cannot read {sub}: {e}"))?.flatten() {
        let ft = match entry.file_type() {
            Ok(t) => t,
            Err(_) => continue,
        };
        let name = entry.file_name().to_string_lossy().to_string();
        let path = entry.path();
        let rel = path
            .strip_prefix(&root)
            .map(|r| crate::portable(r))
            .unwrap_or_else(|_| name.clone());
        let meta = entry.metadata().ok();
        // A symlink is reported as what it is rather than followed: following
        // one is how a walk leaves the project without any `..` in sight.
        let is_dir = ft.is_dir() && !ft.is_symlink();

        entries.push(Entry {
            skipped: is_dir && SKIP_DIRS.contains(&name.as_str()),
            nested_repo: is_dir && crate::languages::is_nested_checkout(&path),
            untracked: git.dir_untracked || git.untracked.contains(&name),
            ignored: git.dir_ignored || git.ignored.contains(&name),
            size: if is_dir { None } else { meta.as_ref().map(|m| m.len()) },
            modified: meta.as_ref().and_then(|m| m.modified().ok()).and_then(secs),
            is_dir,
            name,
            path: rel,
        });
    }

    // Directories first, then by name, case-insensitively — the order every
    // file manager uses, and the one a reader's eye is already trained on.
    entries.sort_by(|a, b| {
        b.is_dir
            .cmp(&a.is_dir)
            .then_with(|| a.name.to_lowercase().cmp(&b.name.to_lowercase()))
    });

    Ok(Listing {
        entries,
        path: sub.to_string(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;
    use std::path::PathBuf;

    fn tmp(name: &str) -> PathBuf {
        let d = std::env::temp_dir().join(format!("docmap-ft-{name}"));
        let _ = fs::remove_dir_all(&d);
        fs::create_dir_all(&d).unwrap();
        d
    }

    fn write(path: &Path, bytes: &[u8]) {
        fs::create_dir_all(path.parent().unwrap()).unwrap();
        fs::File::create(path).unwrap().write_all(bytes).unwrap();
    }

    /// A real repository, because these two flags come from real `git`.
    ///
    /// Returns `None` when git is not on PATH or refuses to initialise —
    /// the tests that need it then skip rather than fail. A machine without
    /// git is a real machine, and a red test there would say nothing about
    /// this code.
    fn git_repo(name: &str) -> Option<PathBuf> {
        let root = tmp(name);
        let run = |args: &[&str]| -> bool {
            std::process::Command::new("git")
                .arg("-C")
                .arg(&root)
                .args(args)
                .output()
                .map(|o| o.status.success())
                .unwrap_or(false)
        };
        if !run(&["init", "-q"]) {
            return None;
        }
        // A commit needs an identity, and the machine's own may be absent in
        // CI. Set locally so nothing outside this directory is touched.
        run(&["config", "user.email", "t@example.com"]);
        run(&["config", "user.name", "t"]);
        Some(root)
    }

    fn entry<'a>(l: &'a Listing, name: &str) -> &'a Entry {
        l.entries.iter().find(|e| e.name == name).unwrap_or_else(|| panic!("no entry {name}"))
    }

    #[test]
    fn untracked_and_ignored_are_two_different_facts() {
        let Some(root) = git_repo("git-states") else {
            return;
        };
        write(&root.join(".gitignore"), b"secret.txt\nbuilt/\n");
        write(&root.join("tracked.lua"), b"x");
        write(&root.join("fresh.lua"), b"x");
        write(&root.join("secret.txt"), b"x");
        write(&root.join("built/out.js"), b"x");

        let ok = std::process::Command::new("git")
            .arg("-C")
            .arg(&root)
            .args(["add", ".gitignore", "tracked.lua"])
            .output()
            .map(|o| o.status.success())
            .unwrap_or(false);
        if !ok {
            return;
        }
        let _ = std::process::Command::new("git")
            .arg("-C")
            .arg(&root)
            .args(["commit", "-q", "-m", "t"])
            .output();

        let l = list(&root, "").unwrap();

        // Committed: neither flag. The uninteresting case, asserted because
        // a version that flagged everything would still pass the two below.
        assert!(!entry(&l, "tracked.lua").untracked);
        assert!(!entry(&l, "tracked.lua").ignored);

        // On disk, git has never been told about it — and the map reads the
        // disk, so this file *is* in the map. That is the surprise the flag
        // exists to name.
        assert!(entry(&l, "fresh.lua").untracked);
        assert!(!entry(&l, "fresh.lua").ignored);

        // The repository's own rule, which only its author knows.
        assert!(entry(&l, "secret.txt").ignored);
        assert!(!entry(&l, "secret.txt").untracked);

        // An ignored *directory*: `-unormal` collapses it, and the flag has
        // to land on the directory the pane actually shows rather than on a
        // path below it that the pane never lists.
        assert!(entry(&l, "built").ignored);
        assert!(entry(&l, "built").is_dir);
    }

    #[test]
    fn ignored_is_not_skipped_and_the_two_are_carried_separately() {
        // `skipped` is this tool's rule and is the same everywhere;
        // `ignored` is the repository's own. A directory can be either, both
        // or neither, and collapsing them would lose the case that actually
        // confuses a reader: the map walked a directory they ignore in git.
        let Some(root) = git_repo("git-vs-skip") else {
            return;
        };
        write(&root.join(".gitignore"), b"mine/\n");
        fs::create_dir_all(root.join("mine")).unwrap();
        fs::create_dir_all(root.join("node_modules")).unwrap();
        write(&root.join("node_modules/x.js"), b"x");

        let l = list(&root, "").unwrap();

        let mine = entry(&l, "mine");
        assert!(mine.ignored, "git ignores it");
        assert!(!mine.skipped, "but the scan still walks it — .gitignore is not read");

        let nm = entry(&l, "node_modules");
        assert!(nm.skipped, "the scan skips it by its own rule");
    }

    #[test]
    fn a_directory_that_is_not_a_repository_reports_neither_flag() {
        // Absence of git is not evidence about a file. Calling every file in
        // a non-repository "untracked" would be confidently wrong about all
        // of them.
        let root = tmp("no-git");
        write(&root.join("a.lua"), b"x");
        let l = list(&root, "").unwrap();
        assert!(!entry(&l, "a.lua").untracked);
        assert!(!entry(&l, "a.lua").ignored);
    }

    #[test]
    fn a_subdirectory_listing_reduces_paths_to_its_own_entries() {
        // git reports repository-relative paths; the pane lists one level.
        // Without stripping the prefix, `src/new.lua` would be looked up as
        // an entry named `src/new.lua`, which no listing ever contains — so
        // the flag would silently never appear below the root.
        let Some(root) = git_repo("git-sub") else {
            return;
        };
        write(&root.join("src/new.lua"), b"x");
        let l = list(&root, "src").unwrap();
        assert!(entry(&l, "new.lua").untracked);
    }

    #[test]
    fn directories_come_first_then_names_case_insensitively() {
        let root = tmp("order");
        write(&root.join("zebra.lua"), b"x");
        write(&root.join("Apple.lua"), b"x");
        fs::create_dir_all(root.join("src")).unwrap();
        fs::create_dir_all(root.join("Docs")).unwrap();
        let names: Vec<String> = list(&root, "").unwrap().entries.into_iter().map(|e| e.name).collect();
        assert_eq!(names, vec!["Docs", "src", "Apple.lua", "zebra.lua"]);
    }

    #[test]
    fn a_skipped_directory_is_listed_and_flagged_rather_than_hidden() {
        // It is genuinely on the disk. A filetree that omits `node_modules`
        // is lying about the disk to make the map look consistent.
        let root = tmp("skip");
        fs::create_dir_all(root.join("node_modules")).unwrap();
        fs::create_dir_all(root.join("src")).unwrap();
        let l = list(&root, "").unwrap();
        let nm = l.entries.iter().find(|e| e.name == "node_modules").unwrap();
        let src = l.entries.iter().find(|e| e.name == "src").unwrap();
        assert!(nm.skipped);
        assert!(!src.skipped);
    }

    #[test]
    fn a_nested_checkout_is_flagged() {
        // The reason half a tree can be missing from the map, and the one
        // thing a reader would otherwise have no way to find out.
        let root = tmp("nested");
        write(&root.join("sub/.git"), b"gitdir: elsewhere");
        fs::create_dir_all(root.join("plain")).unwrap();
        let l = list(&root, "").unwrap();
        assert!(l.entries.iter().find(|e| e.name == "sub").unwrap().nested_repo);
        assert!(!l.entries.iter().find(|e| e.name == "plain").unwrap().nested_repo);
    }

    #[test]
    fn files_carry_a_size_and_directories_do_not() {
        let root = tmp("size");
        write(&root.join("a.lua"), b"1234567890");
        fs::create_dir_all(root.join("d")).unwrap();
        let l = list(&root, "").unwrap();
        assert_eq!(l.entries.iter().find(|e| e.name == "a.lua").unwrap().size, Some(10));
        assert_eq!(l.entries.iter().find(|e| e.name == "d").unwrap().size, None);
    }

    #[test]
    fn a_subdirectory_lists_with_repository_relative_paths() {
        // The paths have to be in the artifact's own shape, because they are
        // handed straight to `open_in_editor`.
        let root = tmp("rel");
        write(&root.join("lua/x/init.lua"), b"x");
        let l = list(&root, "lua/x").unwrap();
        assert_eq!(l.path, "lua/x");
        assert_eq!(l.entries[0].path, "lua/x/init.lua");
    }

    #[test]
    fn escaping_the_project_is_refused() {
        // The caller is a window showing somebody's repository, and `..` is
        // the difference between browsing a project and browsing a disk.
        let root = tmp("escape");
        fs::create_dir_all(root.join("src")).unwrap();
        assert!(list(&root, "../..").is_err());
    }

    #[test]
    fn a_directory_that_is_not_there_is_an_error_not_an_empty_listing() {
        // An empty listing would render as "this folder is empty", which is a
        // different and wrong statement.
        let root = tmp("missing");
        assert!(list(&root, "nope").is_err());
    }
}
