//! What a project is made of, counted: files and lines per language, and how
//! many of those lines are code, comments, documentation, data or blank.
//!
//! A close cousin of [`crate::languages::scan`] and deliberately separate
//! from it. That walk answers "what is this written in" in a few
//! milliseconds by counting *file names*, and runs for every project the
//! moment it is picked. This one opens every file and counts its lines, which
//! is a different order of cost and is only done when somebody asks to see the
//! numbers.
//!
//! **What "comment" means here.** A line that is only a comment. A line with
//! code and a trailing comment is a code line — the comment is not counted a
//! second time. A line inside a block comment is a comment line. Doc
//! comments are comments; a Python docstring is *code*, because to a lexer
//! that does not run the language it is an expression statement, and
//! pretending to know otherwise would make the number look more careful than
//! it is. These are the conventional rules of `cloc`-style counters, and the
//! same simplification: a comment marker inside a string literal can fool it.
//!
//! **Documentation and data are not code.** Markdown, reStructuredText and
//! plain text are documentation; JSON, YAML, TOML and friends are data. For
//! both, every non-blank line is counted as *content* — there is no "comment"
//! to separate — and the totals keep the three kinds apart, because "this
//! project is 40 % prose" is a statement about the project that a single
//! line count would bury.

use std::collections::HashMap;
use std::fs;
use std::path::Path;
use std::time::{Duration, Instant};

use serde::Serialize;

use crate::languages::{is_map_dir, is_nested_checkout, SKIP_DIRS};
use crate::safe_read;

/// Same order of magnitude as the other walks, and for the same reason: a
/// tree that cannot be bounded can hang the window.
const MAX_FILES: usize = 40_000;

/// A file larger than this is counted as a file but its lines are not read —
/// it is a generated bundle or a data dump, and one such file would dominate
/// every line total while telling nobody anything about the project.
const MAX_BYTES: u64 = 2 * 1024 * 1024;

/// How long a count may run. There is no way to cancel it from the window, so
/// the walk has to end by itself: a tree of twenty thousand 1.9 MB JSON files
/// is about 38 GB of reads, and "Counting..." for minutes is not an answer.
const BUDGET: Duration = Duration::from_secs(20);

/// Total bytes read before the count stops and says it is a lower bound.
const MAX_READ: u64 = 1024 * 1024 * 1024;

/// What kind of thing a language is, for the totals.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum Kind {
    Code,
    Docs,
    Data,
}

/// How a language writes comments.
struct Comments {
    line: &'static [&'static str],
    block: Option<(&'static str, &'static str)>,
}

const C_LIKE: Comments = Comments {
    line: &["//"],
    block: Some(("/*", "*/")),
};
const HASH: Comments = Comments {
    line: &["#"],
    block: None,
};
const NONE: Comments = Comments {
    line: &[],
    block: None,
};

/// A recognised file: its display name, kind and comment syntax.
struct Lang {
    name: &'static str,
    kind: Kind,
    comments: &'static Comments,
}

const LUA: Comments = Comments {
    line: &["--"],
    block: Some(("--[[", "]]")),
};
const SQL: Comments = Comments {
    line: &["--"],
    block: Some(("/*", "*/")),
};
const MARKUP: Comments = Comments {
    line: &[],
    block: Some(("<!--", "-->")),
};
// `//` lines are not CSS, but SCSS, Sass and Less share this entry and use
// them; in plain CSS such a line is invalid and does not occur.
const CSS: Comments = Comments {
    line: &["//"],
    block: Some(("/*", "*/")),
};
const HASKELL: Comments = Comments {
    line: &["--"],
    block: Some(("{-", "-}")),
};
const OCAML: Comments = Comments {
    line: &[],
    block: Some(("(*", "*)")),
};
const SEMI: Comments = Comments {
    line: &[";"],
    block: None,
};
const PERCENT: Comments = Comments {
    line: &["%"],
    block: None,
};
const VIM: Comments = Comments {
    line: &["\""],
    block: None,
};
const PHP: Comments = Comments {
    line: &["//", "#"],
    block: Some(("/*", "*/")),
};
const POWERSHELL: Comments = Comments {
    line: &["#"],
    block: Some(("<#", "#>")),
};
const RUBY: Comments = Comments {
    line: &["#"],
    block: Some(("=begin", "=end")),
};
const JULIA: Comments = Comments {
    line: &["#"],
    block: Some(("#=", "=#")),
};
const ASM: Comments = Comments {
    line: &[";", "//", "#"],
    block: Some(("/*", "*/")),
};
const ZIG: Comments = Comments {
    line: &["//"],
    block: None,
};

fn lang_for(ext: &str) -> Option<Lang> {
    let code = |name, comments| {
        Some(Lang {
            name,
            kind: Kind::Code,
            comments,
        })
    };
    let docs = |name| {
        Some(Lang {
            name,
            kind: Kind::Docs,
            comments: &NONE,
        })
    };
    let data = |name| {
        Some(Lang {
            name,
            kind: Kind::Data,
            comments: &NONE,
        })
    };
    match ext {
        "lua" => code("Lua", &LUA),
        "js" | "mjs" | "cjs" => code("JavaScript", &C_LIKE),
        "jsx" => code("JSX", &C_LIKE),
        "ts" | "mts" | "cts" => code("TypeScript", &C_LIKE),
        "tsx" => code("TSX", &C_LIKE),
        "py" | "pyi" => code("Python", &HASH),
        "rs" => code("Rust", &C_LIKE),
        "go" => code("Go", &C_LIKE),
        "c" | "h" => code("C", &C_LIKE),
        "cc" | "cpp" | "cxx" | "hpp" | "hh" | "hxx" => code("C++", &C_LIKE),
        "cs" => code("C#", &C_LIKE),
        "java" => code("Java", &C_LIKE),
        "kt" | "kts" => code("Kotlin", &C_LIKE),
        "swift" => code("Swift", &C_LIKE),
        "m" | "mm" => code("Objective-C", &C_LIKE),
        "rb" => code("Ruby", &RUBY),
        "php" => code("PHP", &PHP),
        "pl" | "pm" => code("Perl", &HASH),
        "sh" | "bash" | "zsh" => code("Shell", &HASH),
        "ps1" | "psm1" => code("PowerShell", &POWERSHELL),
        "vim" => code("Vimscript", &VIM),
        "el" => code("Emacs Lisp", &SEMI),
        "ex" | "exs" => code("Elixir", &HASH),
        "erl" | "hrl" => code("Erlang", &PERCENT),
        "hs" => code("Haskell", &HASKELL),
        "ml" | "mli" => code("OCaml", &OCAML),
        "scala" | "sc" => code("Scala", &C_LIKE),
        "clj" | "cljs" | "cljc" => code("Clojure", &SEMI),
        "dart" => code("Dart", &C_LIKE),
        "zig" => code("Zig", &ZIG),
        "nim" => code("Nim", &HASH),
        "jl" => code("Julia", &JULIA),
        "r" => code("R", &HASH),
        "sql" => code("SQL", &SQL),
        "vue" => code("Vue", &MARKUP),
        "svelte" => code("Svelte", &MARKUP),
        "css" | "scss" | "sass" | "less" => code("CSS", &CSS),
        "html" | "htm" => code("HTML", &MARKUP),
        "s" | "asm" | "nasm" | "inc" => code("Assembly", &ASM),
        "md" | "markdown" | "mdx" => docs("Markdown"),
        "rst" => docs("reStructuredText"),
        "adoc" | "asciidoc" => docs("AsciiDoc"),
        "txt" => docs("Text"),
        "json" | "jsonc" | "json5" => data("JSON"),
        "yaml" | "yml" => data("YAML"),
        "toml" => data("TOML"),
        "ini" | "cfg" | "conf" => data("INI"),
        "xml" | "svg" => data("XML"),
        "csv" | "tsv" => data("CSV"),
        _ => None,
    }
}

/// Line counts for one file or a sum of several.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Lines {
    pub total: u64,
    pub code: u64,
    pub comment: u64,
    pub blank: u64,
}

impl Lines {
    fn add(&mut self, other: &Lines) {
        self.total += other.total;
        self.code += other.code;
        self.comment += other.comment;
        self.blank += other.blank;
    }
}

/// Classify the lines of one text.
///
/// For [`Kind::Docs`] and [`Kind::Data`] there is no comment syntax, so every
/// non-blank line lands in `code` — read it as "content". The caller keeps
/// the kinds apart.
fn count_lines(text: &str, comments: &Comments) -> Lines {
    let mut out = Lines::default();
    let mut in_block = false;
    // `trim` does not strip U+FEFF (it is not White_Space), so a BOM on the
    // first line made a comment or an empty line count as code.
    let text = text.strip_prefix('\u{FEFF}').unwrap_or(text);

    for raw in text.lines() {
        out.total += 1;
        let line = raw.trim();
        if line.is_empty() {
            out.blank += 1;
            continue;
        }

        if in_block {
            out.comment += 1;
            if let Some((_, end)) = comments.block {
                if line.contains(end) {
                    in_block = false;
                }
            }
            continue;
        }

        if let Some((start, end)) = comments.block {
            if let Some(after) = line.strip_prefix(start) {
                out.comment += 1;
                // A block that opens and closes on one line stays closed.
                // Looked for after the opener, so `/*/` is not mistaken for
                // both.
                if !after.contains(end) {
                    in_block = true;
                }
                continue;
            }
        }

        if comments.line.iter().any(|p| line.starts_with(p)) {
            out.comment += 1;
            continue;
        }

        out.code += 1;
    }
    out
}

/// One language's share of a tree.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LangStats {
    pub name: String,
    pub kind: Kind,
    pub files: u64,
    pub lines: Lines,
    pub bytes: u64,
}

/// One of the longest files, for "where is the bulk".
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Largest {
    pub path: String,
    pub lines: u64,
}

/// The totals of one [`Kind`].
#[derive(Debug, Clone, Copy, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct KindTotals {
    pub files: u64,
    pub lines: Lines,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Stats {
    pub languages: Vec<LangStats>,
    pub code: KindTotals,
    pub docs: KindTotals,
    pub data: KindTotals,
    /// Files with no recognised extension or too large to read: counted, not
    /// measured.
    pub other: KindTotals,
    pub files: u64,
    pub bytes: u64,
    pub largest: Vec<Largest>,
    /// The walk stopped at a cap (files, bytes read or time), so every number
    /// is a lower bound.
    pub truncated: bool,
}

/// Count `root`. `map_dir` is skipped, for the reason every walk here skips it.
pub fn collect(root: &Path, map_dir: &Path) -> Result<Stats, String> {
    if !root.is_dir() {
        return Err(format!("{} is not a directory", root.display()));
    }

    let mut by_lang: HashMap<&'static str, LangStats> = HashMap::new();
    let mut other = KindTotals::default();
    let mut files = 0u64;
    let mut bytes = 0u64;
    let mut largest: Vec<Largest> = Vec::new();
    let mut visited = 0usize;
    let mut read_total = 0u64;
    let started = Instant::now();
    let mut truncated = false;
    let mut stack = vec![root.to_path_buf()];

    while let Some(dir) = stack.pop() {
        // Per directory as well as per file: a tree of empty directories
        // never reaches the file cap.
        if started.elapsed() > BUDGET {
            truncated = true;
            break;
        }
        let entries = match fs::read_dir(&dir) {
            Ok(e) => e,
            Err(_) => continue,
        };
        for entry in entries.flatten() {
            if visited >= MAX_FILES || read_total >= MAX_READ || started.elapsed() > BUDGET {
                truncated = true;
                break;
            }
            let ft = match entry.file_type() {
                Ok(t) => t,
                Err(_) => continue,
            };
            // Symlinks are never followed: a link back up the tree is a cycle.
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

            // Sockets, FIFOs and devices are not files to count, and
            // opening a FIFO with no writer blocks forever.
            if !ft.is_file() {
                continue;
            }
            visited += 1;
            files += 1;
            let size = entry.metadata().map(|m| m.len()).unwrap_or(0);
            bytes += size;

            let lang = name
                .rsplit_once('.')
                .map(|(_, e)| e.to_lowercase())
                .and_then(|e| lang_for(&e));

            let Some(lang) = lang else {
                other.files += 1;
                continue;
            };
            if size > MAX_BYTES {
                other.files += 1;
                continue;
            }
            read_total += size;
            let Some(text) = safe_read::read_text(&path, MAX_BYTES, true) else {
                other.files += 1;
                continue;
            };

            let lines = count_lines(&text, lang.comments);
            let slot = by_lang.entry(lang.name).or_insert(LangStats {
                name: lang.name.to_string(),
                kind: lang.kind,
                files: 0,
                lines: Lines::default(),
                bytes: 0,
            });
            slot.files += 1;
            slot.lines.add(&lines);
            slot.bytes += size;

            if lang.kind == Kind::Code {
                if let Ok(rel) = path.strip_prefix(root) {
                    largest.push(Largest {
                        path: crate::portable(rel),
                        lines: lines.total,
                    });
                }
            }
        }
        if truncated {
            break;
        }
    }

    let mut languages: Vec<LangStats> = by_lang.into_values().collect();
    // Most lines first; the tie-break on name keeps equal counts from
    // swapping places between renders (a `HashMap` has no order to rely on).
    languages.sort_by(|a, b| {
        b.lines
            .total
            .cmp(&a.lines.total)
            .then_with(|| a.name.cmp(&b.name))
    });

    let mut code = KindTotals::default();
    let mut docs = KindTotals::default();
    let mut data = KindTotals::default();
    for l in &languages {
        let slot = match l.kind {
            Kind::Code => &mut code,
            Kind::Docs => &mut docs,
            Kind::Data => &mut data,
        };
        slot.files += l.files;
        slot.lines.add(&l.lines);
    }

    largest.sort_by(|a, b| b.lines.cmp(&a.lines).then_with(|| a.path.cmp(&b.path)));
    largest.truncate(8);

    Ok(Stats {
        languages,
        code,
        docs,
        data,
        other,
        files,
        bytes,
        largest,
        truncated,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    fn tmp(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("docmap-stats-{name}"));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn lua_lines_are_split_into_code_comment_and_blank() {
        let text = "-- header\nlocal x = 1 -- trailing\n\n--[[ block\nstill block\n]]\nreturn x\n";
        let n = count_lines(text, &LUA);
        assert_eq!(n.total, 7);
        assert_eq!(n.comment, 4, "header + three lines of block");
        assert_eq!(n.blank, 1);
        assert_eq!(n.code, 2, "a trailing comment does not make a comment line");
    }

    #[test]
    fn a_block_comment_that_closes_on_its_own_line_stays_closed() {
        let n = count_lines("/* one liner */\nlet a = 1;\n", &C_LIKE);
        assert_eq!(n.comment, 1);
        assert_eq!(n.code, 1);
    }

    #[test]
    fn docs_and_data_have_no_comments_only_content_and_blanks() {
        let n = count_lines("# Title\n\ntext\n", &NONE);
        assert_eq!((n.code, n.comment, n.blank), (2, 0, 1));
    }

    #[test]
    fn the_kinds_are_totalled_apart() {
        let root = tmp("kinds");
        fs::write(root.join("a.lua"), "-- c\nreturn 1\n").unwrap();
        fs::write(root.join("README.md"), "# T\n\nbody\n").unwrap();
        fs::write(root.join("x.json"), "{}\n").unwrap();
        fs::write(root.join("blob.bin"), [0u8, 1, 2]).unwrap();
        let s = collect(&root, &root.join("docs/map")).unwrap();
        assert_eq!(s.files, 4);
        assert_eq!(s.code.lines.code, 1);
        assert_eq!(s.code.lines.comment, 1);
        assert_eq!(s.docs.lines.code, 2, "non-blank doc lines");
        assert_eq!(s.data.lines.total, 1);
        assert_eq!(s.other.files, 1, "the binary is counted, not measured");
        assert!(s.languages.iter().any(|l| l.name == "Lua"));
        assert_eq!(s.languages[0].name, "Markdown", "most lines first");
    }

    #[test]
    fn a_byte_order_mark_does_not_turn_the_first_line_into_code() {
        let n = count_lines("\u{FEFF}// header\nlet a = 1;\n", &C_LIKE);
        assert_eq!((n.comment, n.code), (1, 1));
        let blank = count_lines("\u{FEFF}\nlet a = 1;\n", &C_LIKE);
        assert_eq!((blank.blank, blank.code), (1, 1));
    }

    #[test]
    fn scss_and_less_line_comments_are_comments() {
        let n = count_lines("// note\na { b: c; }\n", &CSS);
        assert_eq!((n.comment, n.code), (1, 1));
    }

    #[test]
    fn xml_comments_are_content_like_every_other_data_line() {
        // Data has no comment syntax here, so the totals add up: every
        // non-blank data line is content.
        let n = count_lines("<!-- c -->\n<a/>\n", &NONE);
        assert_eq!((n.comment, n.code), (0, 2));
    }

    #[test]
    fn skipped_directories_and_the_map_do_not_count() {
        let root = tmp("skips");
        fs::create_dir_all(root.join("node_modules/p")).unwrap();
        fs::create_dir_all(root.join("docs/map")).unwrap();
        fs::write(root.join("node_modules/p/i.js"), "x\n").unwrap();
        fs::write(root.join("docs/map/index.html"), "<p>\n").unwrap();
        fs::write(root.join("a.lua"), "return 1\n").unwrap();
        let s = collect(&root, &root.join("docs/map")).unwrap();
        assert_eq!(s.files, 1);
    }

    #[test]
    fn the_longest_code_files_are_listed_longest_first() {
        let root = tmp("largest");
        fs::write(root.join("short.lua"), "a\n").unwrap();
        fs::write(root.join("long.lua"), "a\nb\nc\n").unwrap();
        fs::write(root.join("NOTES.md"), "1\n2\n3\n4\n5\n").unwrap();
        let s = collect(&root, &root.join("docs/map")).unwrap();
        let names: Vec<&str> = s.largest.iter().map(|l| l.path.as_str()).collect();
        assert_eq!(names, vec!["long.lua", "short.lua"], "docs are not code");
    }
}
