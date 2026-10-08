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

/// A documentation-range address (RFC 5737) that no test of this run used
/// before, and that no run of the last minute is likely to have used.
///
/// Windows remembers an unreachable host for a while: a second look at the
/// same address returns at once. A test that only asserts "this did not take
/// long" would then pass with the guard removed on every re-run, after the
/// first, red, one.
// Only the tests that need a link to a host call it, and those exist on
// Windows alone.
#[cfg_attr(not(windows), allow(dead_code))]
pub fn unc_host() -> String {
    use std::sync::atomic::{AtomicU64, Ordering};
    use std::sync::OnceLock;
    static NEXT: AtomicU64 = AtomicU64::new(0);
    // Drawn once: the offset from the clock is what differs between runs, the
    // counter is what differs inside one.
    static START: OnceLock<u64> = OnceLock::new();
    let start = *START.get_or_init(|| {
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_millis() as u64 % 250)
            .unwrap_or(0)
    });
    // 7 is coprime to 250, so up to 250 calls of one run never repeat.
    let n = (start + NEXT.fetch_add(1, Ordering::Relaxed) * 7) % 250 + 1;
    format!("203.0.113.{n}")
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
