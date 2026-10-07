//! Finding things: text in files, file names, and what the map itself shows.
//!
//! Three questions share one box in the window, and they are answered from
//! different places on purpose:
//!
//! * **Text** — a `grep`: every line under a folder that contains the query.
//! * **Files** — a `find`: every file whose path contains the query.
//! * **View** — what the *map* shows. The generated page is a separate
//!   document this window cannot read into, but everything it draws comes
//!   from `module_map.json` next to it, so searching that file searches the
//!   page's content: names, paths, summaries, signatures, parameters,
//!   documentation and features.
//!
//! The first two walk the project with the same rules every other walk here
//! uses — [`SKIP_DIRS`], nested checkouts, the map directory, no symlinks —
//! because "search" that goes through `node_modules` and a generated
//! 700 KB `index.html` finds mostly noise. The rules are stated in
//! [`crate::languages`] and not re-argued here.
//!
//! **No regular expressions.** A plain, case-insensitive substring is what
//! the box promises, it needs no dependency, and it cannot be made to run
//! for a minute by a pattern. The walk is bounded instead: by results, by
//! files and by time, and says so when it stopped early.

use std::borrow::Cow;
use std::fs;
use std::path::Path;
use std::time::{Duration, Instant};

use serde::Serialize;
use serde_json::Value;

use crate::languages::{is_map_dir, is_nested_checkout, SKIP_DIRS};
use crate::safe_read;

/// Stop reading after this many files, so an accidental scope of a whole
/// drive's worth of source cannot freeze the window.
const MAX_FILES: usize = 40_000;
/// A file larger than this is skipped for text search: a bundle or a dump,
/// and the match in it would not be somewhere anybody wants to jump to.
const MAX_BYTES: u64 = 1_500_000;
/// Matches reported per file before moving on, so one huge file cannot use
/// up the whole result list.
const PER_FILE: usize = 12;
/// How long a search may run. Long enough for a big repository on a slow
/// disk, short enough that a stuck one says so instead of spinning.
const BUDGET: Duration = Duration::from_secs(6);
/// A line shown in a result is cut here; the match is kept in view.
const SNIPPET: usize = 160;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Mode {
    Text,
    Files,
}

impl Mode {
    pub fn parse(s: &str) -> Option<Mode> {
        match s {
            "text" => Some(Mode::Text),
            "files" => Some(Mode::Files),
            _ => None,
        }
    }
}

/// One match in a folder search.
#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Hit {
    /// Project-relative, forward slashes — the shape `open_in_editor` takes.
    pub path: String,
    /// 1-based. `None` for a file-name match.
    pub line: Option<u32>,
    /// The matching line, trimmed and cut around the match.
    pub text: Option<String>,
    /// Where the match starts within `text`, in characters, so the caller
    /// can highlight it without searching again.
    pub at: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct Results {
    pub hits: Vec<Hit>,
    pub files_searched: usize,
    /// The search stopped before it was done — the result list is a prefix.
    pub truncated: bool,
    /// Why, for the caller to say: `"limit"`, `"files"` or `"time"`.
    pub reason: Option<&'static str>,
    /// How many files had more matches than [`PER_FILE`] and were cut short.
    /// Not `truncated`: the walk went on, but the per-file list is a prefix,
    /// and a count that says "N matches" must not pass for the whole of it.
    pub capped_files: usize,
}

/// Lowercase for a case-insensitive comparison, **one character to one
/// character**.
///
/// `str::to_lowercase` is not length-preserving: `İ` (U+0130) becomes two
/// characters, so an offset found in the lowercased line pointed at the wrong
/// place in the original — the highlight was shifted for every `İ` before the
/// match. Mapping character by character, and keeping a character whose
/// lowercase is not exactly one character, keeps the two strings the same
/// shape. Everything else that lowercases (`Ä` to `ä`) is still found.
pub(crate) fn fold_chars(s: &str) -> String {
    // Pure ASCII is almost every source file, and `to_ascii_lowercase` is a
    // byte loop the compiler vectorises; the general path below measured about
    // six times slower on ordinary source, which is the whole text of every
    // file searched.
    if s.is_ascii() {
        return s.to_ascii_lowercase();
    }
    let mut out = String::with_capacity(s.len());
    for c in s.chars() {
        if c.is_ascii() {
            out.push(c.to_ascii_lowercase());
            continue;
        }
        let mut lower = c.to_lowercase();
        match (lower.next(), lower.next()) {
            (Some(one), None) => out.push(one),
            _ => out.push(c),
        }
    }
    out
}

/// `s` folded for comparison — borrowed as it is when case matters.
fn fold(s: &str, case_sensitive: bool) -> Cow<'_, str> {
    if case_sensitive {
        Cow::Borrowed(s)
    } else {
        Cow::Owned(fold_chars(s))
    }
}

/// `line` cut to [`SNIPPET`] characters with the match inside the window,
/// plus where the match starts within what is returned.
fn snippet(line: &str, match_char: usize, match_len: usize) -> (String, u32) {
    let trimmed = line.trim_start();
    let lead = line.chars().count() - trimmed.chars().count();
    let at = match_char.saturating_sub(lead);
    let chars: Vec<char> = trimmed.chars().collect();
    if chars.len() <= SNIPPET {
        return (trimmed.trim_end().to_string(), at as u32);
    }
    // Keep a little context before the match, so it is not flush left.
    let start = at
        .saturating_sub(40)
        .min(chars.len().saturating_sub(SNIPPET));
    let end = (start + SNIPPET).max((at + match_len).min(chars.len()));
    let mut out: String = chars[start..end.min(chars.len())].iter().collect();
    let mut shown_at = at - start;
    if start > 0 {
        out.insert(0, '…');
        shown_at += 1;
    }
    if end < chars.len() {
        out.push('…');
    }
    (out, shown_at as u32)
}

/// Search `scope` (inside `root`) for `query`.
///
/// `limit` bounds the number of hits. Results are sorted by path then line,
/// so the same search gives the same list.
pub fn run(
    root: &Path,
    scope: &Path,
    map_dir: &Path,
    query: &str,
    mode: Mode,
    case_sensitive: bool,
    limit: usize,
) -> Result<Results, String> {
    if !scope.is_dir() {
        return Err(format!("{} is not a folder", scope.display()));
    }
    let query = query.trim();
    if query.is_empty() {
        return Ok(Results::default());
    }

    let needle = fold(query, case_sensitive).into_owned();
    // For file names, every word has to be somewhere in the path: `lua init`
    // finds `lua/foo/init.lua`, which is how people type when they are
    // looking for a file.
    let words: Vec<String> = needle.split_whitespace().map(str::to_string).collect();

    let started = Instant::now();
    let mut out = Results::default();
    let mut stack = vec![scope.to_path_buf()];
    let mut visited = 0usize;

    'walk: while let Some(dir) = stack.pop() {
        let entries = match fs::read_dir(&dir) {
            Ok(e) => e,
            Err(_) => continue,
        };
        for entry in entries.flatten() {
            if started.elapsed() > BUDGET {
                out.truncated = true;
                out.reason = Some("time");
                break 'walk;
            }
            if visited >= MAX_FILES {
                out.truncated = true;
                out.reason = Some("files");
                break 'walk;
            }
            let ft = match entry.file_type() {
                Ok(t) => t,
                Err(_) => continue,
            };
            if ft.is_symlink() {
                continue;
            }
            let path = entry.path();
            let name = entry.file_name().to_string_lossy().to_string();

            if ft.is_dir() {
                if !SKIP_DIRS.contains(&name.as_str())
                    && !is_map_dir(&path, map_dir)
                    && !is_nested_checkout(&path)
                {
                    stack.push(path);
                }
                continue;
            }
            // A FIFO, socket or device is not a file to search, and opening
            // a FIFO that has no writer blocks the thread for good.
            if !ft.is_file() {
                continue;
            }

            visited += 1;
            let Ok(rel) = path.strip_prefix(root) else {
                continue;
            };
            let rel = crate::portable(rel);

            match mode {
                Mode::Files => {
                    let hay = fold(&rel, case_sensitive);
                    if !words.iter().all(|w| hay.contains(w.as_str())) {
                        continue;
                    }
                    out.hits.push(Hit {
                        path: rel,
                        line: None,
                        text: None,
                        at: None,
                    });
                }
                Mode::Text => {
                    let Some(text) = safe_read::read_text(&path, MAX_BYTES, true) else {
                        continue;
                    };
                    out.files_searched += 1;
                    // Folded once for the whole file, and the lines are only
                    // looked at when the needle is in it at all: almost no
                    // file contains it, and a string per line of every file
                    // was nearly all the work.
                    let folded = fold(&text, case_sensitive);
                    if !folded.contains(needle.as_str()) {
                        continue;
                    }
                    let mut in_file = 0usize;
                    // `fold_chars` keeps the shape of the text, so the two
                    // split into the same lines and an offset in one is an
                    // offset in the other.
                    for (i, (line, hay)) in text.lines().zip(folded.lines()).enumerate() {
                        let Some(byte) = hay.find(needle.as_str()) else {
                            continue;
                        };
                        if in_file >= PER_FILE {
                            out.capped_files += 1;
                            break;
                        }
                        let at = hay[..byte].chars().count();
                        let (shown, shown_at) = snippet(line, at, needle.chars().count());
                        out.hits.push(Hit {
                            path: rel.clone(),
                            line: Some(i as u32 + 1),
                            text: Some(shown),
                            at: Some(shown_at),
                        });
                        in_file += 1;
                    }
                }
            }

            // Text hits are in walk order and cannot be improved by walking
            // on, so the walk stops here. File names are ranked, and the best
            // match can be anywhere in the tree: those are collected whole
            // and cut after sorting (see below).
            if mode == Mode::Text && out.hits.len() >= limit {
                out.truncated = true;
                out.reason = Some("limit");
                break 'walk;
            }
        }
    }

    if mode == Mode::Files {
        // Name matches first, then shorter paths: the file called `init.lua`
        // beats `docs/notes/about-init-scripts.md` for the query `init`.
        let first = words.first().cloned().unwrap_or_default();
        out.files_searched = visited;
        // The key is built once per hit, not once per comparison: folding
        // allocates, and a sort compares each hit many times over.
        out.hits.sort_by_cached_key(|h| {
            let name = h.path.rsplit('/').next().unwrap_or(&h.path);
            let in_name = fold(name, case_sensitive).contains(first.as_str());
            (!in_name, h.path.len(), h.path.clone())
        });
        if out.hits.len() > limit {
            out.hits.truncate(limit);
            out.truncated = true;
            // A stop for time or file count says why it stopped; the limit is
            // only the reason when nothing else was.
            out.reason.get_or_insert("limit");
        }
    } else {
        out.hits
            .sort_by(|a, b| a.path.cmp(&b.path).then_with(|| a.line.cmp(&b.line)));
    }
    Ok(out)
}

// ------------------------------------------------------------------- view

/// One match inside the map's own data.
#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ViewHit {
    /// What it is: `module`, `namespace`, `file`, `function`, `symbol`,
    /// `type`, `doc`, `feature`, `binding`, `endpoint`, `marker`, `plugin`.
    pub kind: String,
    /// The thing's name.
    pub label: String,
    /// Which field matched and what it said, trimmed.
    pub detail: String,
    /// The map node this belongs to — where the page can be sent. `None` for
    /// things that have no node (documentation files, feature pages).
    pub node: Option<String>,
    /// The source file, for "open in editor". Project-relative.
    pub file: Option<String>,
    pub line: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ViewResults {
    pub hits: Vec<ViewHit>,
    pub truncated: bool,
    /// `false` when the project has no readable map: nothing to search.
    pub available: bool,
}

/// The first string leaf under `v` (skipping the keys in `skip`) that
/// contains `needle`, as `field: text`.
fn first_match(v: &Value, needle: &str, skip: &[&str], field: &str) -> Option<String> {
    match v {
        Value::String(s) => {
            // The first *line* that matches, cut around the match: a body
            // is paragraphs, and a hit that shows the whole of one is not a
            // result list any more.
            let line = s.lines().find(|l| fold_chars(l).contains(needle))?;
            let hay = fold_chars(line);
            let at = hay[..hay.find(needle)?].chars().count();
            let (shown, _) = snippet(line, at, needle.chars().count());
            Some(if field.is_empty() {
                shown
            } else {
                format!("{field}: {shown}")
            })
        }
        Value::Array(items) => items
            .iter()
            .find_map(|i| first_match(i, needle, skip, field)),
        Value::Object(map) => map.iter().find_map(|(k, val)| {
            if skip.contains(&k.as_str()) {
                return None;
            }
            first_match(val, needle, skip, k)
        }),
        _ => None,
    }
}

fn str_of<'a>(v: &'a Value, key: &str) -> Option<&'a str> {
    v.get(key).and_then(Value::as_str)
}

/// Fields that hold structure or code rather than something the page shows
/// as text. Searching `snippet` would find every `local` in a Lua tree.
const SKIP: &[&str] = &[
    "snippet",
    "shape",
    "children",
    "parent",
    "requires",
    "required_by",
    "requires_external",
    "calls_external",
    "stats",
    "depth",
];

/// The arrays on a node whose elements are separate things worth a result.
const ELEMENTS: &[(&str, &str)] = &[
    ("functions", "function"),
    ("symbols", "symbol"),
    ("types_detail", "type"),
    ("bindings", "binding"),
    ("endpoints", "endpoint"),
    ("markers", "marker"),
    ("plugins", "plugin"),
];

/// Search what the map shows. `map_dir` holds `module_map.json`.
pub fn view(map_dir: &Path, query: &str, limit: usize) -> Result<ViewResults, String> {
    let needle = fold_chars(query.trim());
    let path = map_dir.join("module_map.json");
    // Bounded and regular-file-only: the map lives in a repository somebody
    // else wrote, and it is read on every pause in typing.
    let Some(raw) = safe_read::read_text(&path, safe_read::MAP_JSON_MAX, false) else {
        return Ok(ViewResults::default());
    };
    let map: Value =
        serde_json::from_str(&raw).map_err(|e| format!("module_map.json is not JSON: {e}"))?;
    let mut out = ViewResults {
        available: true,
        ..Default::default()
    };
    if needle.is_empty() {
        return Ok(out);
    }

    let push = |out: &mut ViewResults, hit: ViewHit| -> bool {
        if out.hits.len() >= limit {
            out.truncated = true;
            return false;
        }
        out.hits.push(hit);
        true
    };

    if let Some(nodes) = map.get("nodes").and_then(Value::as_array) {
        for node in nodes {
            let id = str_of(node, "id").unwrap_or_default().to_string();
            let kind = str_of(node, "kind").unwrap_or("module").to_string();
            let label = str_of(node, "name")
                .or_else(|| str_of(node, "id"))
                .unwrap_or_default()
                .to_string();
            let file = str_of(node, "source")
                .or_else(|| str_of(node, "path"))
                .map(str::to_string);

            // The node itself: its own scalar fields, not its arrays.
            let own: Vec<(&str, &Value)> =
                ["name", "path", "module", "summary", "body", "language"]
                    .iter()
                    .filter_map(|k| node.get(*k).map(|v| (*k, v)))
                    .collect();
            let mut node_hit = None;
            for (k, v) in own {
                if let Some(d) = first_match(v, &needle, SKIP, k) {
                    node_hit = Some(d);
                    break;
                }
            }
            if let Some(detail) = node_hit {
                let keep_going = push(
                    &mut out,
                    ViewHit {
                        kind: kind.clone(),
                        label: label.clone(),
                        detail,
                        node: Some(id.clone()),
                        file: file.clone(),
                        line: None,
                    },
                );
                if !keep_going {
                    return Ok(out);
                }
            }

            for (key, what) in ELEMENTS {
                let Some(items) = node.get(*key).and_then(Value::as_array) else {
                    continue;
                };
                for item in items {
                    let Some(detail) = first_match(item, &needle, SKIP, "") else {
                        continue;
                    };
                    let name = item
                        .get("name")
                        .or_else(|| item.get("key"))
                        .and_then(Value::as_str)
                        .or_else(|| item.as_str())
                        .unwrap_or(&label)
                        .to_string();
                    let line = item.get("line").and_then(Value::as_u64).map(|l| l as u32);
                    let keep_going = push(
                        &mut out,
                        ViewHit {
                            kind: (*what).to_string(),
                            label: name,
                            detail,
                            node: Some(id.clone()),
                            file: file.clone(),
                            line,
                        },
                    );
                    if !keep_going {
                        return Ok(out);
                    }
                }
            }
        }
    }

    // Documentation files the map links, and the feature pages it renders.
    if let Some(files) = map.pointer("/docs/files").and_then(Value::as_array) {
        for f in files {
            let title = str_of(f, "title").unwrap_or_default();
            let p = str_of(f, "path").unwrap_or_default();
            let hay = fold_chars(&format!("{title} {p}"));
            if !hay.contains(&needle) {
                continue;
            }
            let keep_going = push(
                &mut out,
                ViewHit {
                    kind: "doc".into(),
                    label: title.to_string(),
                    detail: p.to_string(),
                    node: None,
                    file: Some(p.to_string()),
                    line: None,
                },
            );
            if !keep_going {
                return Ok(out);
            }
        }
    }
    if let Some(files) = map.pointer("/features/files").and_then(Value::as_array) {
        for f in files {
            let page = str_of(f, "path").unwrap_or_default();
            let Some(entries) = f.get("entries").and_then(Value::as_array) else {
                continue;
            };
            for e in entries {
                let Some(detail) = first_match(e, &needle, &["tab", "line"], "") else {
                    continue;
                };
                let keep_going = push(
                    &mut out,
                    ViewHit {
                        kind: "feature".into(),
                        label: str_of(e, "name").unwrap_or(page).to_string(),
                        detail,
                        node: None,
                        file: Some(page.to_string()),
                        line: e.get("line").and_then(Value::as_u64).map(|l| l as u32),
                    },
                );
                if !keep_going {
                    return Ok(out);
                }
            }
        }
    }

    Ok(out)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    fn tmp(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("docmap-search-{name}"));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    fn text(root: &Path, q: &str) -> Results {
        run(
            root,
            root,
            &root.join("docs/map"),
            q,
            Mode::Text,
            false,
            100,
        )
        .unwrap()
    }

    #[test]
    fn text_search_reports_path_line_and_the_line() {
        let root = tmp("text");
        fs::create_dir_all(root.join("lua")).unwrap();
        fs::write(root.join("lua/a.lua"), "local x = 1\nreturn Needle(x)\n").unwrap();
        let r = text(&root, "needle");
        assert_eq!(r.hits.len(), 1, "case-insensitive by default");
        assert_eq!(r.hits[0].path, "lua/a.lua");
        assert_eq!(r.hits[0].line, Some(2));
        assert_eq!(r.hits[0].text.as_deref(), Some("return Needle(x)"));
        assert_eq!(r.hits[0].at, Some(7));
    }

    #[test]
    fn case_sensitive_search_respects_case() {
        let root = tmp("case");
        fs::write(root.join("a.txt"), "Needle\n").unwrap();
        let r = run(
            &root,
            &root,
            &root.join("docs/map"),
            "needle",
            Mode::Text,
            true,
            10,
        )
        .unwrap();
        assert!(r.hits.is_empty());
    }

    #[test]
    fn skipped_folders_binaries_and_the_map_are_not_searched() {
        let root = tmp("skips");
        fs::create_dir_all(root.join("node_modules/p")).unwrap();
        fs::create_dir_all(root.join("docs/map")).unwrap();
        fs::write(root.join("node_modules/p/i.js"), "needle\n").unwrap();
        fs::write(root.join("docs/map/index.html"), "needle\n").unwrap();
        fs::write(root.join("blob.bin"), b"\0needle").unwrap();
        fs::write(root.join("ok.lua"), "needle\n").unwrap();
        let r = text(&root, "needle");
        let paths: Vec<&str> = r.hits.iter().map(|h| h.path.as_str()).collect();
        assert_eq!(paths, vec!["ok.lua"]);
    }

    #[test]
    fn one_file_cannot_use_up_the_whole_list() {
        let root = tmp("perfile");
        fs::write(root.join("big.txt"), "needle\n".repeat(100)).unwrap();
        let r = text(&root, "needle");
        assert_eq!(r.hits.len(), PER_FILE);
        assert_eq!(r.capped_files, 1, "the cut is reported, not silent");
    }

    #[test]
    fn file_search_ranks_every_match_before_cutting_to_the_limit() {
        // Twenty files under `config/` match the word through their folder;
        // the file actually called `config.lua` is one level further down.
        // The walk handles a directory's own files before it descends, so a
        // walk that stops at the limit sees only decoys: this fails against
        // the early break on every filesystem, whatever order it lists in.
        let root = tmp("files-rank");
        fs::create_dir_all(root.join("config/lua")).unwrap();
        for i in 0..20 {
            fs::write(root.join(format!("config/a{i}.txt")), "").unwrap();
        }
        fs::write(root.join("config/lua/config.lua"), "").unwrap();
        let r = run(
            &root,
            &root,
            &root.join("docs/map"),
            "config",
            Mode::Files,
            false,
            3,
        )
        .unwrap();
        assert_eq!(r.hits.len(), 3);
        assert_eq!(r.hits[0].path, "config/lua/config.lua");
        assert!(r.truncated);
        assert_eq!(r.reason, Some("limit"));
    }

    #[test]
    fn folding_ascii_and_non_ascii_text_keeps_the_shape() {
        assert_eq!(fold_chars("Hello WORLD"), "hello world");
        // One character in, one out, even where the lowercase is longer.
        assert_eq!(fold_chars("\u{130}A").chars().count(), 2);
        assert_eq!(fold_chars("ÄÖÜ"), "äöü");
    }

    #[test]
    fn the_highlight_survives_a_character_that_lowercases_to_two() {
        // U+0130 lowercases to two characters; folding the line used to push
        // every offset after it to the right.
        let root = tmp("fold-len");
        fs::write(
            root.join("a.txt"),
            "\u{130}\u{130}\u{130}\u{130}\u{130} needle here\n",
        )
        .unwrap();
        let r = text(&root, "needle");
        assert_eq!(r.hits.len(), 1);
        assert_eq!(r.hits[0].at, Some(6));
    }

    #[test]
    fn the_limit_stops_the_walk_and_says_so() {
        let root = tmp("limit");
        for i in 0..5 {
            fs::write(root.join(format!("f{i}.txt")), "needle\n").unwrap();
        }
        let r = run(
            &root,
            &root,
            &root.join("docs/map"),
            "needle",
            Mode::Text,
            false,
            3,
        )
        .unwrap();
        assert_eq!(r.hits.len(), 3);
        assert!(r.truncated);
        assert_eq!(r.reason, Some("limit"));
    }

    #[test]
    fn file_search_needs_every_word_and_prefers_the_name() {
        let root = tmp("files");
        fs::create_dir_all(root.join("lua/init")).unwrap();
        fs::create_dir_all(root.join("docs")).unwrap();
        fs::write(root.join("lua/init/x.lua"), "").unwrap();
        fs::write(root.join("lua/init.lua"), "").unwrap();
        fs::write(root.join("docs/about-init.md"), "").unwrap();
        let r = run(
            &root,
            &root,
            &root.join("docs/map"),
            "init",
            Mode::Files,
            false,
            50,
        )
        .unwrap();
        let paths: Vec<&str> = r.hits.iter().map(|h| h.path.as_str()).collect();
        assert_eq!(paths[0], "lua/init.lua", "the shortest name match first");
        assert_eq!(paths.len(), 3);

        let both = run(
            &root,
            &root,
            &root.join("docs/map"),
            "lua x",
            Mode::Files,
            false,
            50,
        )
        .unwrap();
        assert_eq!(both.hits.len(), 1, "every word must be in the path");
    }

    #[test]
    fn a_scope_inside_the_project_reports_project_relative_paths() {
        let root = tmp("scope");
        fs::create_dir_all(root.join("lua/sub")).unwrap();
        fs::write(root.join("lua/sub/a.lua"), "needle\n").unwrap();
        fs::write(root.join("top.lua"), "needle\n").unwrap();
        let r = run(
            &root,
            &root.join("lua"),
            &root.join("docs/map"),
            "needle",
            Mode::Text,
            false,
            10,
        )
        .unwrap();
        assert_eq!(r.hits.len(), 1);
        assert_eq!(r.hits[0].path, "lua/sub/a.lua");
    }

    #[test]
    fn a_long_line_is_cut_around_the_match() {
        let line = format!("{}needle{}", "a".repeat(300), "b".repeat(300));
        let (shown, at) = snippet(&line, 300, 6);
        assert!(shown.chars().count() <= SNIPPET + 2);
        let chars: Vec<char> = shown.chars().collect();
        let found: String = chars[at as usize..at as usize + 6].iter().collect();
        assert_eq!(found, "needle");
    }

    #[test]
    fn view_search_finds_names_summaries_and_function_fields() {
        let dir = tmp("view");
        let map = serde_json::json!({
            "nodes": [{
                "id": "lua/core/favorites.lua", "kind": "file", "name": "favorites.lua",
                "path": "lua/core/favorites.lua", "source": "lua/core/favorites.lua",
                "summary": "Manage favorites", "body": "",
                "functions": [{
                    "name": "M.toggle", "line": 10, "snippet": "local secret = 1",
                    "summary": "Flip the favorite flag",
                    "params": [{"name": "cmd", "desc": "the command line"}]
                }],
                "children": ["not searched"]
            }],
            "docs": {"files": [{"path": "docs/USAGE.md", "title": "Using it"}]},
            "features": {"files": []}
        });
        fs::write(dir.join("module_map.json"), map.to_string()).unwrap();

        let by_name = view(&dir, "FAVORITES", 50).unwrap();
        assert!(by_name.available);
        assert_eq!(by_name.hits[0].kind, "file");
        assert_eq!(
            by_name.hits[0].node.as_deref(),
            Some("lua/core/favorites.lua")
        );

        let by_param = view(&dir, "command line", 50).unwrap();
        assert_eq!(by_param.hits.len(), 1);
        assert_eq!(by_param.hits[0].kind, "function");
        assert_eq!(by_param.hits[0].label, "M.toggle");
        assert_eq!(by_param.hits[0].line, Some(10));

        assert!(
            view(&dir, "secret", 50).unwrap().hits.is_empty(),
            "code snippets are not what the page shows"
        );
        assert!(
            view(&dir, "not searched", 50).unwrap().hits.is_empty(),
            "structure is not content"
        );

        let doc = view(&dir, "using", 50).unwrap();
        assert_eq!(doc.hits[0].kind, "doc");
        assert_eq!(doc.hits[0].file.as_deref(), Some("docs/USAGE.md"));
    }

    #[test]
    fn view_search_without_a_map_is_unavailable_not_an_error() {
        let dir = tmp("view-none");
        let r = view(&dir, "x", 10).unwrap();
        assert!(!r.available);
        assert!(r.hits.is_empty());
    }
}
