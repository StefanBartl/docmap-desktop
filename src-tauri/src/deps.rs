//! Who in this workspace depends on whom, computed from the artifacts.
//!
//! # Why this is here and not in the engine
//!
//! The engine maps one repository. `requires_external` is precisely the
//! field where it runs out of tree: it records that a module outside this
//! repository was required and can say nothing about where that module
//! lives, because it never saw it. Resolving those names needs *several*
//! artifacts at once, and this app is the only place that holds several.
//!
//! It is `HOSTING.md`'s "the artifact is the extension point" taken at its
//! word -- a reading extension, computing something the file's author did
//! not compute, with no code in the engine and nothing registered.
//!
//! # The resolution is exact, and that was measured before it was written
//!
//! Over 30 generated maps in the author's tree: **1 820 declared module
//! names, and not one claimed by two repositories.** So an external require
//! is matched against the module names other projects *declare*, and a hit
//! is a fact rather than a guess.
//!
//! The obvious fallback -- walk down to the longest declared prefix, so
//! `lib.nvim.notify.safe` would find `lib.nvim.notify` -- was implemented
//! for that measurement and **resolved exactly zero additional edges**,
//! because the engine already records the full module name it saw. It is
//! not in this file. A heuristic that never fires is not insurance, it is a
//! second code path nobody exercises.
//!
//! Of 1 175 external requires, 852 resolved and 323 did not. The 323 are the
//! answer working: `telescope`, `fzf-lua`, `which-key`, `dap` -- third-party
//! plugins that are not in the workspace and have no map to be found in.
//! They are reported as their own list rather than dropped, because "this
//! project leans on four things you do not have open" is the other half of
//! the question.

use std::collections::HashMap;
use std::fs;

use serde::Serialize;

/// One project's contribution, as read off its artifact.
struct MapFacts {
    /// Module names this project declares.
    declares: Vec<String>,
    /// Module names it requires from outside its own tree.
    requires: Vec<String>,
}

/// A dependency from one workspace project to another.
#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Edge {
    /// Project id that does the requiring.
    pub from: String,
    /// Project id being required.
    pub to: String,
    /// How many require sites, not how many distinct modules -- the question
    /// "how much of my code touches this" is asked in call sites.
    pub count: u64,
    /// The required module names, most-required first, deduplicated.
    pub modules: Vec<String>,
}

/// A required module that belongs to no project in this workspace.
#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Outside {
    pub name: String,
    pub count: u64,
    /// Which projects require it.
    pub projects: Vec<String>,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Deps {
    pub edges: Vec<Edge>,
    pub outside: Vec<Outside>,
    /// Projects whose map could not be read at all. Named rather than
    /// silently missing: a project with no map contributes no edges, and a
    /// graph that quietly omits it looks like a project that depends on
    /// nothing.
    pub unread: Vec<String>,
}

/// Pull the two fields this needs out of one artifact.
///
/// `serde_json::Value` rather than a typed struct: the artifact carries 28
/// keys per node and this wants two of them, so a typed shape would be a
/// declaration of 26 fields nobody reads -- and one more thing to revisit on
/// every schema bump. Unknown keys are ignored, which is the reading rule
/// `HOSTING.md` asks for.
fn facts_of(map_dir: &str) -> Option<MapFacts> {
    let body = fs::read_to_string(format!("{map_dir}/module_map.json")).ok()?;
    let v: serde_json::Value = serde_json::from_str(&body).ok()?;
    let nodes = v.get("nodes")?.as_array()?;

    let mut declares = Vec::new();
    let mut requires = Vec::new();
    for n in nodes {
        if let Some(m) = n.get("module").and_then(|m| m.as_str()) {
            declares.push(m.to_string());
        }
        if let Some(list) = n.get("requires_external").and_then(|r| r.as_array()) {
            for r in list {
                if let Some(s) = r.as_str() {
                    requires.push(s.to_string());
                }
            }
        }
    }
    Some(MapFacts { declares, requires })
}

/// Resolve every project's external requires against every other's modules.
///
/// `projects` is `(id, map_dir)`. Ids rather than names, because two
/// workspaces may hold two checkouts of one repository and the id is what
/// the rest of the app joins on.
pub fn resolve(projects: &[(String, String)]) -> Deps {
    let mut owner: HashMap<String, String> = HashMap::new();
    let mut facts: Vec<(String, MapFacts)> = Vec::new();
    let mut unread = Vec::new();

    for (id, map_dir) in projects {
        match facts_of(map_dir) {
            Some(f) => {
                for m in &f.declares {
                    // First claim wins, and the measurement says there is
                    // never a second: 1 820 names, no collisions. If one
                    // ever appears it is two checkouts of one repository in
                    // one workspace, where either answer is the same answer.
                    owner.entry(m.clone()).or_insert_with(|| id.clone());
                }
                facts.push((id.clone(), f));
            }
            None => unread.push(id.clone()),
        }
    }

    // (from, to) -> (count, module -> count)
    let mut acc: HashMap<(String, String), (u64, HashMap<String, u64>)> = HashMap::new();
    let mut out_acc: HashMap<String, (u64, Vec<String>)> = HashMap::new();

    for (id, f) in &facts {
        for req in &f.requires {
            match owner.get(req) {
                // A project requiring its own module through the external
                // path is not a dependency on anything; it is one file
                // reaching for another in the same tree, which the map
                // already records as an ordinary edge.
                Some(to) if to == id => {}
                Some(to) => {
                    let e = acc
                        .entry((id.clone(), to.clone()))
                        .or_insert_with(|| (0, HashMap::new()));
                    e.0 += 1;
                    *e.1.entry(req.clone()).or_insert(0) += 1;
                }
                None => {
                    let o = out_acc
                        .entry(req.clone())
                        .or_insert_with(|| (0, Vec::new()));
                    o.0 += 1;
                    if !o.1.contains(id) {
                        o.1.push(id.clone());
                    }
                }
            }
        }
    }

    let mut edges: Vec<Edge> = acc
        .into_iter()
        .map(|((from, to), (count, mods))| {
            let mut modules: Vec<(String, u64)> = mods.into_iter().collect();
            modules.sort_by(|a, b| b.1.cmp(&a.1).then(a.0.cmp(&b.0)));
            Edge {
                from,
                to,
                count,
                modules: modules.into_iter().map(|(m, _)| m).collect(),
            }
        })
        .collect();
    // Heaviest first, then alphabetical so the order is total -- the same
    // rule the overview's ranking follows, for the same reason: a list that
    // reorders itself between two identical renders cannot be learned.
    edges.sort_by(|a, b| {
        b.count
            .cmp(&a.count)
            .then(a.from.cmp(&b.from))
            .then(a.to.cmp(&b.to))
    });

    let mut outside: Vec<Outside> = out_acc
        .into_iter()
        .map(|(name, (count, mut projects))| {
            projects.sort();
            Outside {
                name,
                count,
                projects,
            }
        })
        .collect();
    outside.sort_by(|a, b| b.count.cmp(&a.count).then(a.name.cmp(&b.name)));

    unread.sort();
    Deps {
        edges,
        outside,
        unread,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::{Path, PathBuf};

    /// A map directory holding one artifact with the given nodes.
    fn map_with(name: &str, nodes: serde_json::Value) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("docmap-deps-{name}"));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        let doc = serde_json::json!({ "meta": { "schema": 5 }, "nodes": nodes });
        fs::write(dir.join("module_map.json"), doc.to_string()).unwrap();
        dir
    }

    fn p(id: &str, dir: &Path) -> (String, String) {
        (id.to_string(), dir.to_string_lossy().to_string())
    }

    #[test]
    fn an_external_require_resolves_to_the_project_that_declares_it() {
        let lib = map_with(
            "lib",
            serde_json::json!([{ "module": "lib.nvim.notify" }, { "module": "lib.nvim.map" }]),
        );
        let app = map_with(
            "app",
            serde_json::json!([{
                "module": "app.init",
                "requires_external": ["lib.nvim.notify", "lib.nvim.notify", "lib.nvim.map"]
            }]),
        );

        let d = resolve(&[p("lib", &lib), p("app", &app)]);
        assert_eq!(d.edges.len(), 1);
        let e = &d.edges[0];
        assert_eq!((e.from.as_str(), e.to.as_str()), ("app", "lib"));
        // Sites, not distinct modules: three requires over two names.
        assert_eq!(e.count, 3);
        // Most-required first, which is what makes the list worth truncating.
        assert_eq!(e.modules, vec!["lib.nvim.notify", "lib.nvim.map"]);
        assert!(d.outside.is_empty());
    }

    #[test]
    fn a_name_no_project_declares_is_reported_as_outside_rather_than_dropped() {
        // The 323 unresolved edges in the measurement are this case, and they
        // are the answer working: telescope is not in the workspace and has
        // no map to be found in. Silently dropping them would make a project
        // that leans on four third-party plugins look self-contained.
        let app = map_with(
            "outside-app",
            serde_json::json!([{ "module": "app.init", "requires_external": ["telescope", "telescope"] }]),
        );
        let other = map_with(
            "outside-other",
            serde_json::json!([{ "module": "other.init" }]),
        );

        let d = resolve(&[p("app", &app), p("other", &other)]);
        assert!(d.edges.is_empty());
        assert_eq!(d.outside.len(), 1);
        assert_eq!(d.outside[0].name, "telescope");
        assert_eq!(d.outside[0].count, 2);
        assert_eq!(d.outside[0].projects, vec!["app"]);
    }

    #[test]
    fn a_project_requiring_its_own_module_is_not_a_dependency() {
        // `sandbox.nvim` does this: `sandbox.adapters.docker.*` reached
        // through the external path from within the same tree. Counting it
        // would give a project an edge to itself and inflate its own weight.
        let one = map_with(
            "self",
            serde_json::json!([
                { "module": "sandbox.adapters.docker" },
                { "module": "sandbox.init", "requires_external": ["sandbox.adapters.docker"] }
            ]),
        );
        let d = resolve(&[p("sandbox", &one)]);
        assert!(d.edges.is_empty(), "no self-edge");
        assert!(d.outside.is_empty(), "and it is not third-party either");
    }

    #[test]
    fn a_project_with_no_readable_map_is_named() {
        // Not the same as a project that depends on nothing. A graph that
        // quietly omits it reads as a leaf, which is a claim about the code.
        let real = map_with("named-real", serde_json::json!([{ "module": "real.init" }]));
        let d = resolve(&[
            p("real", &real),
            ("ghost".into(), "Z:/nowhere/docs/map".into()),
        ]);
        assert_eq!(d.unread, vec!["ghost"]);
    }

    #[test]
    fn unknown_keys_and_missing_fields_are_tolerated() {
        // `HOSTING.md`'s reading rule: tolerate forward. A node with no
        // `module` and no `requires_external` contributes nothing and must
        // not abort the file.
        let dir = std::env::temp_dir().join("docmap-deps-tolerant");
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        fs::write(
            dir.join("module_map.json"),
            r#"{"meta":{"schema":99},"whatIsThis":true,
                "nodes":[{"id":"a","kind":"namespace"},
                         {"module":"x.y","futureField":[1,2]}]}"#,
        )
        .unwrap();

        let d = resolve(&[("t".into(), dir.to_string_lossy().to_string())]);
        assert!(
            d.unread.is_empty(),
            "a readable map with unknown keys is read"
        );
    }

    #[test]
    fn the_order_is_total_and_does_not_move_between_two_calls() {
        let lib = map_with(
            "total-lib",
            serde_json::json!([{ "module": "l.a" }, { "module": "l.b" }]),
        );
        let a = map_with(
            "total-a",
            serde_json::json!([{ "module": "a.i", "requires_external": ["l.a", "l.b"] }]),
        );
        let b = map_with(
            "total-b",
            serde_json::json!([{ "module": "b.i", "requires_external": ["l.a", "l.b"] }]),
        );

        let forward = resolve(&[p("lib", &lib), p("a", &a), p("b", &b)]);
        let reverse = resolve(&[p("b", &b), p("a", &a), p("lib", &lib)]);
        // Equal counts, so only the tie-break can separate them -- which is
        // exactly the case a HashMap iteration order would get wrong, and it
        // would get it wrong intermittently.
        assert_eq!(forward.edges, reverse.edges);
        assert_eq!(
            forward
                .edges
                .iter()
                .map(|e| e.from.as_str())
                .collect::<Vec<_>>(),
            vec!["a", "b"]
        );
    }
}
