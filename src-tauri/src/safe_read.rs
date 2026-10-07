//! Reading files of unknown size and kind without trusting either.
//!
//! Everything this program reads out of a repository is text somebody else
//! wrote — and "somebody else" includes a repository that ships a 2 GB
//! `module_map.json`, a symlink to `/dev/zero`, or a named pipe called
//! `build.log`. `fs::read_to_string` on any of those allocates until the
//! process dies or blocks forever, and it does so on whichever thread asked.
//!
//! The rules, in the order they are applied, each because a real input breaks
//! the one before it:
//!
//! 1. **`fs::metadata` first, not `File::open`.** It follows a symlink to the
//!    real file (a legitimate link keeps working) and tells a regular file
//!    from a FIFO or a device *without opening it* — opening a FIFO with no
//!    writer blocks.
//! 2. **A size cap on that metadata**, so the usual oversized file is refused
//!    before a byte is read.
//! 3. **The cap again while reading** (`take(max + 1)`): the size from step 2
//!    can be stale or `0` (some filesystems report no size), and a file can
//!    grow between the two calls.
//! 4. **Binary sniffing on the first 4 KiB only.** A NUL there is what git
//!    uses to call a file binary, and it is known after one small read — the
//!    rest of an image or an archive never needs to be read at all.

use std::fs;
use std::io::Read;
use std::path::Path;

/// Bytes sniffed for a NUL before the rest of the file is read.
const SNIFF: usize = 4096;

/// Upper bound for a generated map's JSON, and for any file the map server
/// hands out: far above any real map (the largest known is about 2 MB). Not
/// higher, because parsing into `serde_json::Value` costs several times the
/// file's size in memory — 32 MiB of JSON is a few hundred MiB resident.
pub const MAP_JSON_MAX: u64 = 32 * 1024 * 1024;

/// Read `path` as raw bytes if it is a regular file of at most `max` bytes.
///
/// For what is served rather than parsed (a map's images and scripts), so no
/// text decoding and no binary sniffing — only the checks that keep a hostile
/// repository from making this read forever or allocate without end.
pub fn read_bytes(path: &Path, max: u64) -> Option<Vec<u8>> {
    let meta = fs::metadata(path).ok()?;
    if !meta.is_file() || meta.len() > max {
        return None;
    }
    let mut bytes = Vec::with_capacity((meta.len() as usize).min(1 << 20));
    fs::File::open(path)
        .ok()?
        .take(max + 1)
        .read_to_end(&mut bytes)
        .ok()?;
    if bytes.len() as u64 > max {
        return None;
    }
    Some(bytes)
}

/// Read `path` as text if it is a regular file of at most `max` bytes.
///
/// `None` for anything else: not a regular file, too large, unreadable, or —
/// when `skip_binary` — a file whose first 4 KiB hold a NUL. Invalid UTF-8 is
/// not a refusal: it is replaced, because a Latin-1 source file is still a
/// source file whose lines can be counted and searched.
pub fn read_text(path: &Path, max: u64, skip_binary: bool) -> Option<String> {
    let meta = fs::metadata(path).ok()?;
    if !meta.is_file() || meta.len() > max {
        return None;
    }

    let mut file = fs::File::open(path).ok()?;
    let mut bytes = Vec::with_capacity((meta.len() as usize).min(1 << 20));
    (&mut file)
        .take(SNIFF as u64)
        .read_to_end(&mut bytes)
        .ok()?;
    if skip_binary && bytes.contains(&0) {
        return None;
    }
    // One byte past the cap is enough to know the file is over it.
    let room = (max + 1).saturating_sub(bytes.len() as u64);
    (&mut file).take(room).read_to_end(&mut bytes).ok()?;
    if bytes.len() as u64 > max {
        return None;
    }

    Some(match String::from_utf8(bytes) {
        Ok(text) => text,
        Err(e) => String::from_utf8_lossy(e.as_bytes()).into_owned(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    fn tmp(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("docmap-safe-read-{name}"));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn a_normal_text_file_is_read_whole() {
        let dir = tmp("text");
        fs::write(dir.join("a.txt"), "one\ntwo\n").unwrap();
        assert_eq!(
            read_text(&dir.join("a.txt"), 100, true).as_deref(),
            Some("one\ntwo\n")
        );
    }

    #[test]
    fn a_file_over_the_cap_is_refused_not_truncated() {
        let dir = tmp("big");
        fs::write(dir.join("a.txt"), "x".repeat(101)).unwrap();
        assert_eq!(read_text(&dir.join("a.txt"), 100, true), None);
        // Exactly at the cap is fine: the limit is inclusive.
        fs::write(dir.join("b.txt"), "x".repeat(100)).unwrap();
        assert!(read_text(&dir.join("b.txt"), 100, true).is_some());
    }

    #[test]
    fn a_nul_in_the_first_block_makes_it_binary_unless_asked_not_to_care() {
        let dir = tmp("bin");
        fs::write(dir.join("a.bin"), b"ab\0cd").unwrap();
        assert_eq!(read_text(&dir.join("a.bin"), 100, true), None);
        assert!(read_text(&dir.join("a.bin"), 100, false).is_some());
    }

    #[test]
    fn raw_bytes_are_bounded_the_same_way() {
        let dir = tmp("bytes");
        fs::write(dir.join("a.bin"), [0u8, 1, 2, 3]).unwrap();
        assert_eq!(read_bytes(&dir.join("a.bin"), 4), Some(vec![0, 1, 2, 3]));
        assert_eq!(read_bytes(&dir.join("a.bin"), 3), None, "over the cap");
        assert_eq!(read_bytes(&dir, 100), None, "a directory is not a file");
    }

    #[cfg(unix)]
    #[test]
    fn a_link_to_a_regular_file_is_followed_and_a_link_to_a_directory_is_not() {
        let dir = tmp("links");
        fs::write(dir.join("real.txt"), "x").unwrap();
        fs::create_dir_all(dir.join("sub")).unwrap();
        std::os::unix::fs::symlink(dir.join("real.txt"), dir.join("link.txt")).unwrap();
        std::os::unix::fs::symlink(dir.join("sub"), dir.join("dirlink")).unwrap();
        assert!(read_text(&dir.join("link.txt"), 100, true).is_some());
        assert_eq!(read_text(&dir.join("dirlink"), 100, true), None);
    }

    #[test]
    fn a_directory_and_a_missing_path_are_none() {
        let dir = tmp("dir");
        assert_eq!(read_text(&dir, 100, true), None);
        assert_eq!(read_text(&dir.join("nope"), 100, true), None);
    }

    #[test]
    fn invalid_utf8_is_replaced_not_refused() {
        let dir = tmp("latin1");
        fs::write(dir.join("a.txt"), b"caf\xe9\n").unwrap();
        let text = read_text(&dir.join("a.txt"), 100, true).unwrap();
        assert!(text.starts_with("caf"));
        assert!(text.contains('\u{FFFD}'));
    }

    #[test]
    fn a_nul_after_the_first_block_does_not_hide_a_text_file() {
        // Sniffing is deliberately limited to the first 4 KiB, like git.
        let dir = tmp("late-nul");
        let mut body = vec![b'a'; SNIFF + 10];
        body.push(0);
        fs::write(dir.join("a.txt"), &body).unwrap();
        assert!(read_text(&dir.join("a.txt"), 1 << 20, true).is_some());
    }
}
