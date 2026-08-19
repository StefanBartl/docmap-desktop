//! Reading `runtime-analysis.nvim`'s telemetry cache, and switching
//! collection on or off.
//!
//! **This app cannot produce telemetry and never will.** The counts come from
//! wrapping functions inside a running Neovim that is executing the plugin's
//! own code; a one-shot engine run has nothing to wrap. What it *can* do is
//! read what has been collected, and flip the persistent switch that decides
//! whether the next session collects at all — and that second half is real
//! rather than a workaround: `telemetry/toggle.lua` keeps the flag on disk,
//! global, deliberately readable before any instance loads, precisely so a
//! decision taken outside a session survives into the next one.
//!
//! So "start telemetry for this project" means exactly one thing here, and
//! the UI has to say it: **from the next Neovim session onward.**
//!
//! Two shapes of stored data, and they answer different questions:
//!
//! * `telemetry/<ns>.json` — one cumulative record, merged into on every
//!   flush. There is no "before and after" in it: a second measurement is
//!   added to the first.
//! * `telemetry/<ns>/snapshots/<name>.json` — deliberate captures, written
//!   once and never merged into. These are the comparable points, and they
//!   exist only where someone ran `:RATelemetry snapshot`. Never automatic,
//!   by explicit design in that plugin: an unexpected snapshot is a worse
//!   failure than a missing one once retention starts evicting.
//!
//! The namespace is a **plugin name**, not a docmap project id. They line up
//! for a project that is a plugin registering telemetry, and for nothing
//! else — so `known` below is reported rather than assumed, and the UI says
//! "no telemetry for this project" instead of showing an empty panel.

use std::fs;
use std::path::{Path, PathBuf};

use serde::Serialize;

/// Where `runtime-analysis.nvim` keeps it, under Neovim's own cache root.
pub fn dir(cache_root: &str) -> PathBuf {
    Path::new(cache_root)
        .join("runtime-analysis.nvim")
        .join("cache")
        .join("telemetry")
}

#[derive(Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct Info {
    /// Whether the telemetry cache directory exists at all. `false` means
    /// the plugin has never run here — a different thing from "this project
    /// has no data", and the UI says so differently.
    pub installed: bool,
    /// Whether a record exists for this namespace.
    pub known: bool,
    /// Collection is switched off for this namespace, persistently.
    pub disabled: bool,
    /// Sessions counted into the cumulative record.
    pub sessions: u64,
    /// Days the cumulative record has buckets for, ascending.
    pub days: Vec<String>,
    /// Deliberate captures, newest first.
    pub snapshots: Vec<Snapshot>,
    /// The directory read, so a reader who expected data somewhere else can
    /// see where this actually looked.
    pub path: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Snapshot {
    pub name: String,
    /// Unix seconds, from the file's own modification time — the record
    /// inside carries `started_at`, which is when *collection* began, not
    /// when the capture was taken.
    pub taken_at: u64,
    pub sessions: u64,
}

/// `cache.disk` wraps everything it writes as `{ "data": …, "saved_at": … }`.
/// Reading the envelope rather than assuming the payload is at the top level
/// is the difference between 42 sessions and none.
fn payload(path: &Path) -> Option<serde_json::Value> {
    let body = fs::read_to_string(path).ok()?;
    let v: serde_json::Value = serde_json::from_str(&body).ok()?;
    v.get("data").cloned().or(Some(v))
}

fn sessions_of(v: &serde_json::Value) -> u64 {
    v.get("sessions").and_then(|n| n.as_u64()).unwrap_or(0)
}

/// Read everything known about one namespace.
pub fn info(cache_root: &str, namespace: &str) -> Info {
    let root = dir(cache_root);
    let mut out = Info {
        path: crate::portable(&root),
        installed: root.is_dir(),
        ..Default::default()
    };
    if !out.installed {
        return out;
    }

    // The control file is global and lists only what is switched *off*, so
    // its absence means "nothing disabled", not "nothing known".
    if let Some(ctl) = payload(&root.join("_control.json")) {
        out.disabled = ctl
            .get("disabled")
            .and_then(|d| d.get(namespace))
            .and_then(|b| b.as_bool())
            .unwrap_or(false);
    }

    let record = root.join(format!("{namespace}.json"));
    if let Some(data) = payload(&record) {
        out.known = true;
        out.sessions = sessions_of(&data);
        if let Some(days) = data.get("days").and_then(|d| d.as_object()) {
            out.days = days.keys().cloned().collect();
            out.days.sort();
        }
    }

    let snaps = root.join(namespace).join("snapshots");
    if let Ok(entries) = fs::read_dir(&snaps) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.extension().and_then(|e| e.to_str()) != Some("json") {
                continue;
            }
            let name = match path.file_stem().and_then(|s| s.to_str()) {
                Some(n) => n.to_string(),
                None => continue,
            };
            let taken_at = entry
                .metadata()
                .and_then(|m| m.modified())
                .ok()
                .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                .map(|d| d.as_secs())
                .unwrap_or(0);
            let sessions = payload(&path).map(|v| sessions_of(&v)).unwrap_or(0);
            out.snapshots.push(Snapshot {
                name,
                taken_at,
                sessions,
            });
        }
    }
    // Newest first, the same order `store.list_snapshots` returns.
    out.snapshots.sort_by(|a, b| b.taken_at.cmp(&a.taken_at));

    out
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;

    fn tmp(name: &str) -> PathBuf {
        let d = std::env::temp_dir().join(format!("docmap-tel-{name}"));
        let _ = fs::remove_dir_all(&d);
        fs::create_dir_all(&d).unwrap();
        d
    }

    fn write(path: &Path, body: &str) {
        fs::create_dir_all(path.parent().unwrap()).unwrap();
        fs::File::create(path)
            .unwrap()
            .write_all(body.as_bytes())
            .unwrap();
    }

    #[test]
    fn nothing_installed_is_its_own_answer() {
        // Distinct from "this project has no data": the plugin has never run
        // on this machine, and telling someone their project is untracked
        // when the tracker is absent sends them looking in the wrong place.
        let root = tmp("absent");
        let i = info(root.to_str().unwrap(), "cmdlog.nvim");
        assert!(!i.installed);
        assert!(!i.known);
    }

    #[test]
    fn the_cache_envelope_is_unwrapped() {
        // `cache.disk` writes `{ "data": …, "saved_at": … }`. Reading the top
        // level instead reports every namespace as having zero sessions,
        // which looks exactly like a project nobody has measured.
        let root = tmp("envelope");
        let tel = dir(root.to_str().unwrap());
        write(
            &tel.join("cmdlog.nvim.json"),
            r#"{"data":{"sessions":42,"days":{"2026-08-19":{},"2026-08-16":{}}},"saved_at":1}"#,
        );
        let i = info(root.to_str().unwrap(), "cmdlog.nvim");
        assert!(i.known);
        assert_eq!(i.sessions, 42);
        assert_eq!(i.days, vec!["2026-08-16", "2026-08-19"]);
    }

    #[test]
    fn a_disabled_namespace_is_reported_and_others_are_not() {
        let root = tmp("control");
        let tel = dir(root.to_str().unwrap());
        write(&tel.join("cmdlog.nvim.json"), r#"{"data":{"sessions":1}}"#);
        write(&tel.join("dap.nvim.json"), r#"{"data":{"sessions":1}}"#);
        write(
            &tel.join("_control.json"),
            r#"{"data":{"disabled":{"cmdlog.nvim":true}},"saved_at":1}"#,
        );
        assert!(info(root.to_str().unwrap(), "cmdlog.nvim").disabled);
        assert!(!info(root.to_str().unwrap(), "dap.nvim").disabled);
    }

    #[test]
    fn snapshots_are_listed_newest_first() {
        let root = tmp("snaps");
        let tel = dir(root.to_str().unwrap());
        write(&tel.join("cmdlog.nvim.json"), r#"{"data":{"sessions":9}}"#);
        let snaps = tel.join("cmdlog.nvim").join("snapshots");
        write(&snaps.join("before.json"), r#"{"data":{"sessions":3}}"#);
        write(&snaps.join("after.json"), r#"{"data":{"sessions":7}}"#);

        let older = std::time::UNIX_EPOCH + std::time::Duration::from_secs(1_700_000_000);
        fs::File::options()
            .write(true)
            .open(snaps.join("before.json"))
            .unwrap()
            .set_modified(older)
            .unwrap();

        let i = info(root.to_str().unwrap(), "cmdlog.nvim");
        assert_eq!(i.snapshots.len(), 2);
        assert_eq!(i.snapshots[0].name, "after");
        assert_eq!(i.snapshots[1].name, "before");
        assert_eq!(i.snapshots[1].sessions, 3);
    }

    #[test]
    fn an_empty_snapshot_directory_is_not_an_error() {
        // The common case, and the one that has to produce a sentence rather
        // than a blank: the directory is created when a namespace is first
        // written, and stays empty until someone runs `:RATelemetry
        // snapshot`.
        let root = tmp("emptysnaps");
        let tel = dir(root.to_str().unwrap());
        write(&tel.join("cmdlog.nvim.json"), r#"{"data":{"sessions":9}}"#);
        fs::create_dir_all(tel.join("cmdlog.nvim").join("snapshots")).unwrap();
        let i = info(root.to_str().unwrap(), "cmdlog.nvim");
        assert!(i.known);
        assert!(i.snapshots.is_empty());
    }
}
