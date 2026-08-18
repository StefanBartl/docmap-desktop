//! What languages a directory is written in, counted before anything is
//! generated.
//!
//! ## Why this exists at all
//!
//! The engine reads Lua and JavaScript/TypeScript today, with Python, Rust,
//! Go and C planned (see `documentation.nvim`'s
//! `docs/ROADMAP/IDEAS/MULTILANG.md`). Until every language a user points at
//! is supported, the interesting failure is not an error — it is a map that
//! comes back thin, with nothing on screen saying why. A repository that is
//! two thirds Python produces a perfectly valid, nearly empty map, and the
//! app currently reports that as success.
//!
//! Counting file extensions answers that before the first generate, at the
//! moment the folder is picked, when the answer is still cheap. It is
//! deliberately **not** a parse: no grammar, no engine, no subprocess. A
//! count of what is on disk is enough to say "this is mostly Python", and
//! anything more precise would be the engine's job, which this program does
//! not do.
//!
//! ## What this module does not decide
//!
//! **Whether a language can be read.** That is the engine's fact, not this
//! program's, and duplicating it here would be exactly the drift the whole
//! ecosystem exists to detect — an app claiming Python is unsupported after
//! the engine grew a Python backend is a worse failure than saying nothing.
//! So this returns names and counts only; the Engine panel's own
//! `--capabilities` answer supplies support, and the two are joined in the
//! frontend where both are already in hand.
//!
//! The extension-to-name table below is a *naming* fact ("`.rs` files are
//! called Rust"), which does not rot the way a capability list does.

use std::collections::HashMap;
use std::fs;
use std::path::Path;

use serde::Serialize;

/// One language found in a tree, with how many files carried it.
///
/// `grammar` is the join key against the engine's own `--capabilities`
/// answer, and it is a tree-sitter grammar name rather than an engine
/// backend name on purpose. The engine calls its TypeScript backend `ts`;
/// nothing outside the engine knows that, and hardcoding it here would be
/// the capability duplication this module's header refuses. A grammar name
/// is a third-party vocabulary both sides already speak independently --
/// the same class of fact as the extension-to-name table, and it rots the
/// same way that one does, which is to say not at all.
///
/// `None` for a language with no tree-sitter grammar worth naming here. The
/// frontend renders that as unknown rather than unsupported.
#[derive(Debug, Clone, Serialize, PartialEq)]
pub struct LanguageCount {
    pub name: String,
    pub files: u32,
    pub grammar: Option<String>,
}

/// The whole verdict for one directory.
///
/// `truncated` matters more than it looks: a count taken from a partial walk
/// is still useful ("mostly Python" does not become false at 20 000 files),
/// but presenting it as complete when it is not would be the silent
/// degradation this ecosystem treats as its most expensive failure mode. The
/// frontend says so when this is set.
#[derive(Debug, Clone, Serialize, PartialEq)]
pub struct LanguageScan {
    pub languages: Vec<LanguageCount>,
    /// Files that matched a known extension. The denominator for shares —
    /// **not** the number of files in the tree, which would make every share
    /// a fraction of README files and lockfiles too.
    pub total: u32,
    pub truncated: bool,
}

/// Stop before a big tree turns a folder-picker click into a visible pause.
///
/// 20 000 is chosen against the shape of the answer rather than a benchmark:
/// the question is "what is this repository mostly written in", and no
/// realistic tree changes its answer between the first 20 000 source files
/// and the last one. A cap that is generous enough to never truncate a real
/// project would be a cap that does not protect against the pathological
/// case it exists for (a home directory picked by accident).
const MAX_FILES: usize = 20_000;

/// Directories never descended into.
///
/// Two different reasons, deliberately in one list because the walk does not
/// care which applies:
///
/// * **Not the project's own code** — `node_modules`, `vendor`, `.venv`: a
///   tree with 40 000 dependency files is not "mostly TypeScript" because of
///   what its author wrote.
/// * **Generated output** — `target`, `dist`, `build`.
///
/// Two exclusions this list *cannot* express, both handled separately in
/// [`scan`]:
///
/// * **The map directory** is `docs/map`, a path rather than a name, and
///   skipping every directory called `map` would silently drop a real source
///   directory in some other project. Letting the act of generating a map
///   change the answer to "what is this project written in" would be absurd
///   on its face.
/// * **A checkout inside the checkout** has no fixed name at all — see
///   [`scan`]'s nested-repository rule, which was written after measuring
///   this walk against `documentation.nvim` and finding 306 of its 448 Lua
///   files were copies of itself under `.claude/worktrees/`.
const SKIP_DIRS: &[&str] = &[
    ".git",
    // Tooling state, never the project's own source. Listed by name as well
    // as caught by the nested-repository rule below, because the parts of it
    // that are *not* worktrees (settings, skills, agent definitions) are
    // still not what anyone means by "what is this project written in".
    ".claude",
    ".deps",
    ".direnv",
    "third_party",
    "bower_components",
    ".stack-work",
    ".dart_tool",
    ".hg",
    ".svn",
    ".jj",
    "node_modules",
    "vendor",
    "target",
    "dist",
    "build",
    "out",
    ".next",
    ".nuxt",
    ".svelte-kit",
    "__pycache__",
    ".venv",
    "venv",
    ".tox",
    ".mypy_cache",
    ".pytest_cache",
    ".ruff_cache",
    ".gradle",
    ".idea",
    ".vscode",
    ".cache",
    "coverage",
    ".terraform",
    "Pods",
    "DerivedData",
];

/// Extension (lowercase, no dot) to display name.
///
/// Broader than the engine can read on purpose — the whole point is to name
/// the languages it *cannot* read yet. Names are the conventional display
/// spelling ("C++", not "cpp"), because this string is shown to a person.
///
/// Related extensions collapse to one name where the distinction is not one a
/// reader is asking about (`.h` is C here; `.hpp` is C++), and stay apart
/// where it is (JavaScript vs. TypeScript, which are separate engine backends
/// and separate answers to "can this be mapped").
fn language_for(ext: &str) -> Option<(&'static str, Option<&'static str>)> {
    let (name, grammar) = match ext {
        "lua" => ("Lua", "lua"),
        "js" | "mjs" | "cjs" => ("JavaScript", "javascript"),
        "jsx" => ("JSX", "javascript"),
        "ts" | "mts" | "cts" => ("TypeScript", "typescript"),
        "tsx" => ("TSX", "tsx"),
        "py" | "pyi" => ("Python", "python"),
        "rs" => ("Rust", "rust"),
        "go" => ("Go", "go"),
        "c" | "h" => ("C", "c"),
        "cc" | "cpp" | "cxx" | "hpp" | "hh" | "hxx" => ("C++", "cpp"),
        "cs" => ("C#", "c_sharp"),
        "java" => ("Java", "java"),
        "kt" | "kts" => ("Kotlin", "kotlin"),
        "swift" => ("Swift", "swift"),
        "m" | "mm" => ("Objective-C", "objc"),
        "rb" => ("Ruby", "ruby"),
        "php" => ("PHP", "php"),
        "pl" | "pm" => ("Perl", "perl"),
        "sh" | "bash" | "zsh" => ("Shell", "bash"),
        "ps1" | "psm1" => ("PowerShell", "powershell"),
        "vim" => ("Vimscript", "vim"),
        "el" => ("Emacs Lisp", "elisp"),
        "ex" | "exs" => ("Elixir", "elixir"),
        "erl" | "hrl" => ("Erlang", "erlang"),
        "hs" => ("Haskell", "haskell"),
        "ml" | "mli" => ("OCaml", "ocaml"),
        "scala" | "sc" => ("Scala", "scala"),
        "clj" | "cljs" | "cljc" => ("Clojure", "clojure"),
        "dart" => ("Dart", "dart"),
        "zig" => ("Zig", "zig"),
        "nim" => ("Nim", "nim"),
        "jl" => ("Julia", "julia"),
        "r" => ("R", "r"),
        "sql" => ("SQL", "sql"),
        "vue" => ("Vue", "vue"),
        "svelte" => ("Svelte", "svelte"),
        "css" | "scss" | "sass" | "less" => ("CSS", "css"),
        "html" | "htm" => ("HTML", "html"),
        _ => return None,
    };
    Some((name, Some(grammar)))
}

/// Is this directory its own repository, rather than part of the one being
/// counted?
///
/// Found by measurement, not by reasoning: scanning `documentation.nvim`
/// reported 448 Lua files where `lua/` holds 98, and 306 of the difference
/// were full copies of the repository living under `.claude/worktrees/`.
/// A name list cannot catch that in general -- the next such directory will
/// be called something else -- but git already answers the question, and it
/// answers it for vendored submodule checkouts and stray clones too.
///
/// `.git` is tested for existence rather than for being a directory on
/// purpose: in a worktree and in a submodule it is a *file* pointing at the
/// real git directory elsewhere, which is precisely the case that matters
/// most here.
///
/// The root being scanned is never subjected to this -- the walk starts
/// inside it -- so a normal repository is not skipped by its own `.git`.
fn is_nested_checkout(dir: &Path) -> bool {
    dir.join(".git").exists()
}

/// Count source files by language under `root`.
///
/// `map_dir` is the project's generated-map directory, skipped wholesale for
/// the reason [`SKIP_DIRS`] explains. `None` falls back to the conventional
/// `docs/map` under `root` — the same default `add_project` writes into a new
/// `Project`, so a folder being previewed before it is added gets the same
/// treatment as one already in the list.
///
/// Iterative rather than recursive, and symlinks are never followed: a
/// symlink back up the tree is a cycle, and a cycle in a recursive walk is a
/// stack overflow rather than a slow answer.
pub fn scan(root: &Path, map_dir: Option<&Path>) -> Result<LanguageScan, String> {
    if !root.is_dir() {
        return Err(format!("{} is not a directory", root.display()));
    }

    // Compared as an owned path rather than by string: the caller's `map_dir`
    // arrives from the workspace with forward slashes even on Windows (see
    // `add_project`'s normalisation), and `PathBuf` comparison handles that
    // where a `==` on the two strings would not.
    let skip_map = map_dir
        .map(|p| p.to_path_buf())
        .unwrap_or_else(|| root.join("docs").join("map"));

    let mut counts: HashMap<&'static str, (u32, Option<&'static str>)> = HashMap::new();
    let mut visited = 0usize;
    let mut truncated = false;
    let mut stack = vec![root.to_path_buf()];

    while let Some(dir) = stack.pop() {
        // An unreadable subdirectory is not a reason to fail the whole scan.
        // A permission-denied node_modules two levels down should cost its own
        // contents, not the answer for everything above it.
        let entries = match fs::read_dir(&dir) {
            Ok(e) => e,
            Err(_) => continue,
        };

        for entry in entries.flatten() {
            if visited >= MAX_FILES {
                truncated = true;
                break;
            }

            // `file_type` rather than `metadata`: it does not follow symlinks,
            // which is what makes the cycle guarantee above true.
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
                if !SKIP_DIRS.contains(&name.as_str())
                    && path != skip_map
                    && !is_nested_checkout(&path)
                {
                    stack.push(path);
                }
                continue;
            }

            visited += 1;
            let ext = match name.rsplit_once('.') {
                Some((_, ext)) if !ext.is_empty() => ext.to_lowercase(),
                _ => continue,
            };
            if let Some((lang, grammar)) = language_for(&ext) {
                let slot = counts.entry(lang).or_insert((0, grammar));
                slot.0 += 1;
            }
        }

        if truncated {
            break;
        }
    }

    let total: u32 = counts.values().map(|(n, _)| n).sum();
    let mut languages: Vec<LanguageCount> = counts
        .into_iter()
        .map(|(name, (files, grammar))| LanguageCount {
            name: name.to_string(),
            files,
            grammar: grammar.map(str::to_string),
        })
        .collect();

    // Descending by count, then by name — the tie-break is what keeps this
    // deterministic. A `HashMap` iterates in an arbitrary order that can
    // differ between runs of the same binary, and two languages with equal
    // counts swapping places between renders would look like a bug.
    languages.sort_by(|a, b| b.files.cmp(&a.files).then_with(|| a.name.cmp(&b.name)));

    Ok(LanguageScan {
        languages,
        total,
        truncated,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    /// One expected row. Spelling the grammar out at every call site rather
    /// than deriving it from `language_for` -- a test that computed the
    /// expected value the same way the code does would pass with the join
    /// key wrong, which is the one thing these assertions exist to catch.
    fn lc(name: &str, files: u32, grammar: &str) -> LanguageCount {
        LanguageCount {
            name: name.into(),
            files,
            grammar: Some(grammar.into()),
        }
    }

    /// A throwaway tree under the OS temp dir. Named per test so two tests
    /// running in parallel (which `cargo test` does by default) cannot see
    /// each other's files.
    fn tree(name: &str, files: &[&str]) -> std::path::PathBuf {
        let root = std::env::temp_dir().join(format!("docmap-langs-{name}"));
        let _ = fs::remove_dir_all(&root);
        for rel in files {
            let path = root.join(rel);
            fs::create_dir_all(path.parent().unwrap()).unwrap();
            fs::write(&path, "").unwrap();
        }
        fs::create_dir_all(&root).unwrap();
        root
    }

    #[test]
    fn counts_by_language_and_ranks_by_count() {
        let root = tree(
            "rank",
            &["a.py", "b.py", "c.py", "d.rs", "e.rs", "f.lua"],
        );
        let scan = scan(&root, None).unwrap();
        assert_eq!(
            scan.languages,
            vec![
                lc("Python", 3, "python"),
                lc("Rust", 2, "rust"),
                lc("Lua", 1, "lua"),
            ]
        );
        assert_eq!(scan.total, 6);
        assert!(!scan.truncated);
    }

    #[test]
    fn equal_counts_break_the_tie_by_name_so_the_order_is_stable() {
        let root = tree("tie", &["a.go", "b.rs"]);
        let first = scan(&root, None).unwrap();
        let second = scan(&root, None).unwrap();
        assert_eq!(first, second);
        assert_eq!(first.languages[0].name, "Go");
    }

    #[test]
    fn skips_dependency_and_generated_directories() {
        let root = tree(
            "skip",
            &[
                "src/main.rs",
                "node_modules/dep/index.js",
                "target/debug/thing.rs",
                "docs/map/index.html",
                ".git/hooks/pre-commit.sh",
            ],
        );
        let scan = scan(&root, None).unwrap();
        // Only `src/main.rs` survives: the three dependency/generated trees
        // are skipped by name, and `docs/map` by the separate path check --
        // its 1.5 MB index.html would otherwise make every mapped project
        // partly "HTML" the moment it was generated.
        assert_eq!(
            scan.languages,
            vec![lc("Rust", 1, "rust")]
        );
    }

    #[test]
    fn an_explicit_map_dir_is_skipped_instead_of_the_conventional_one() {
        let root = tree(
            "mapdir",
            &["a.lua", "docs/map/index.html", "elsewhere/index.html"],
        );
        // Told the map lives in `elsewhere`, the walk must skip that and stop
        // skipping `docs/map` -- otherwise a project configured away from the
        // convention silently gets both wrong.
        let scan = scan(&root, Some(&root.join("elsewhere"))).unwrap();
        assert_eq!(
            scan.languages,
            vec![
                lc("HTML", 1, "html"),
                lc("Lua", 1, "lua"),
            ]
        );
    }

    #[test]
    fn a_directory_that_is_its_own_checkout_is_not_counted() {
        let root = tree(
            "nested",
            &["a.lua", "worktrees/copy/b.lua", "worktrees/copy/c.lua"],
        );
        // A git worktree marks itself with a `.git` *file*, not a directory --
        // the case this rule exists for. Without it, a repository with two
        // worktrees under it reports three times its own size.
        fs::write(root.join("worktrees/copy/.git"), "gitdir: /elsewhere").unwrap();

        let scan = scan(&root, None).unwrap();
        assert_eq!(
            scan.languages,
            vec![lc("Lua", 1, "lua")]
        );
    }

    #[test]
    fn files_without_an_extension_or_with_an_unknown_one_are_not_counted() {
        let root = tree("unknown", &["Makefile", "LICENSE", "notes.txt", "a.lua"]);
        let scan = scan(&root, None).unwrap();
        assert_eq!(scan.total, 1);
        assert_eq!(scan.languages[0].name, "Lua");
    }

    #[test]
    fn extensions_are_matched_case_insensitively() {
        let root = tree("case", &["A.LUA", "b.Py"]);
        let scan = scan(&root, None).unwrap();
        assert_eq!(scan.total, 2);
    }

    #[test]
    fn a_path_that_is_not_a_directory_is_an_error_not_an_empty_result() {
        let root = tree("notdir", &["a.lua"]);
        assert!(scan(&root.join("a.lua"), None).is_err());
    }
}
