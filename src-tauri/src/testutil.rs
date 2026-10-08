//! Helpers shared by the tests of several modules: links, and a scratch
//! directory that is canonical.

use std::fs;
use std::path::{Path, PathBuf};

/// A directory link: a symlink on Unix, a junction on Windows - which needs no
/// privilege, so a test built on it is expected to run wherever the tests do
/// and should assert that the link was made rather than skip.
pub fn dir_link(link: &Path, target: &Path) -> bool {
    #[cfg(unix)]
    {
        std::os::unix::fs::symlink(target, link).is_ok()
    }
    #[cfg(windows)]
    {
        // `mklink` reads a `/` as one of its switches.
        let back = |p: &Path| p.to_string_lossy().replace('/', "\\");
        std::process::Command::new("cmd")
            .args(["/C", "mklink", "/J"])
            .arg(back(link))
            .arg(back(target))
            .output()
            .map(|o| o.status.success())
            .unwrap_or(false)
    }
}

/// A file symlink. On Windows creating one needs a privilege (or Developer
/// Mode): `false` there means "cannot test this here", and the test says so.
pub fn file_link(link: &Path, target: &Path) -> bool {
    #[cfg(unix)]
    {
        std::os::unix::fs::symlink(target, link).is_ok()
    }
    #[cfg(windows)]
    {
        std::os::windows::fs::symlink_file(target, link).is_ok()
    }
}

/// An empty directory under the temp directory, canonical (on Windows that is
/// the `\\?\` form), emptied first if an earlier run left it behind.
pub fn fresh_dir(name: &str) -> PathBuf {
    let root = fs::canonicalize(std::env::temp_dir()).unwrap();
    let dir = root.join(name);
    let _ = fs::remove_dir_all(&dir);
    fs::create_dir_all(&dir).unwrap();
    fs::canonicalize(&dir).unwrap()
}
