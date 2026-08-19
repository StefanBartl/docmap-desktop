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
