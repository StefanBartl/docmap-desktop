//! The engine contract this build of the app was checked against.
//!
//! `engine.lock` at the repository root names one commit of docmap.nvim,
//! the artifact schema that commit writes and the `/api/*` routes it answers.
//! CI holds the engine source at that commit and the rolling engine binary to
//! those lines (`tools/check-engine-lock.py`); this module carries the same
//! lines into the binary, so the window can say when the engine it finds on
//! *this* machine is not the one the app was checked against.
//!
//! Read at build time with `include_str!` rather than at run time: an
//! installed app has no repository next to it, and the answer is a fact about
//! the build, not about the machine. The comparison itself happens in the
//! window (`src/lib/contract.js`), next to the engine facts it is shown with.

use serde::{Deserialize, Serialize};

/// `engine.lock`, as it was when this binary was built.
const LOCK: &str = include_str!("../../engine.lock");

/// The parts of `engine.lock` the window needs.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Contract {
    /// The docmap.nvim commit the contract was taken from.
    pub commit: String,
    /// The artifact schema that commit writes.
    pub schema: u64,
    /// The routes that commit answers, sorted.
    pub routes: Vec<String>,
}

/// Parse the `key = value` lines of a lock file; `#` starts a comment line.
///
/// Strict on the three keys the window reads and silent on the rest (`repo`
/// is for the CI check). The Python check refuses everything else that can
/// be wrong with the file; this side only has to not invent a contract.
fn parse(text: &str) -> Result<Contract, String> {
    let mut commit = None;
    let mut schema = None;
    let mut routes = None;
    for line in text.lines().map(str::trim) {
        if line.is_empty() || line.starts_with('#') {
            continue;
        }
        let (key, value) = line
            .split_once('=')
            .ok_or_else(|| format!("not a 'key = value' line: {line}"))?;
        let value = value.trim();
        match key.trim() {
            "commit" => commit = Some(value.to_string()),
            "schema" => {
                schema = Some(
                    value
                        .parse::<u64>()
                        .map_err(|_| format!("schema is not a number: {value}"))?,
                )
            }
            "routes" => routes = Some(value.split_whitespace().map(String::from).collect()),
            _ => {}
        }
    }
    let commit: String = commit.ok_or("no commit line")?;
    if commit.len() != 40 || !commit.bytes().all(|b| b.is_ascii_hexdigit()) {
        return Err(format!("commit is not a full commit id: {commit}"));
    }
    let routes: Vec<String> = routes.ok_or("no routes line")?;
    if routes.is_empty() {
        return Err("routes is empty".to_string());
    }
    Ok(Contract {
        commit,
        schema: schema.ok_or("no schema line")?,
        routes,
    })
}

/// The contract of this build.
///
/// `None` only for a lock that does not parse, which the unit test below and
/// the CI check both make unreachable in a shipped binary; the window then
/// says nothing about the contract rather than inventing one.
pub fn pinned() -> Option<Contract> {
    parse(LOCK).ok()
}

#[cfg(test)]
mod tests {
    use super::*;

    const SHA: &str = "5fdb34c659ed9f93eb96dbe4f7341b5f8aebe683";

    #[test]
    fn the_lock_of_this_repository_parses() {
        let c = pinned().expect("engine.lock must parse");
        assert_eq!(c.commit.len(), 40);
        assert!(c.schema > 0);
        let mut sorted = c.routes.clone();
        sorted.sort();
        assert_eq!(c.routes, sorted, "routes are listed sorted");
    }

    #[test]
    fn a_lock_reads_into_its_three_parts() {
        let text = format!(
            "# comment\nrepo = https://x\ncommit = {SHA}\nschema = 6\nroutes = commits loaded/snapshots\n"
        );
        assert_eq!(
            parse(&text),
            Ok(Contract {
                commit: SHA.to_string(),
                schema: 6,
                routes: vec!["commits".into(), "loaded/snapshots".into()],
            })
        );
    }

    #[test]
    fn a_broken_lock_is_no_contract() {
        for text in [
            "schema = 6\nroutes = a\n".to_string(),
            format!("commit = {}\nschema = 6\nroutes = a\n", &SHA[..12]),
            format!("commit = {SHA}\nschema = six\nroutes = a\n"),
            format!("commit = {SHA}\nschema = 6\nroutes =\n"),
            format!("commit = {SHA}\nroutes = a\n"),
            format!("commit = {SHA}\nschema = 6\nroutes = a\nstray\n"),
        ] {
            assert!(parse(&text).is_err(), "accepted: {text:?}");
        }
    }
}
