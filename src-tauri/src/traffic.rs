//! Reading `github_stats.nvim`'s traffic digest.
//!
//! **This app never talks to GitHub and never sees a token.** The plugin keeps
//! GitHub's traffic past the 14 days GitHub reports, and publishes one small
//! JSON file per repository (the *digest*) plus a pointer (`root.json`). This
//! module reads those files, read-only, and reports what it found as what it
//! is — the contract is `docs/FEATURES/DIGEST.md` in that plugin.
//!
//! The rules that shape everything below, each one a decision rather than a
//! convenience:
//!
//! * **Absent is not zero.** No digest, no `referrers`, a path outside the
//!   top 10: every one of those is *unknown*, and the outcome names which kind
//!   of unknown it is ([`Status`]) instead of collapsing them into an empty
//!   panel.
//! * **The files are untrusted text.** A referrer is whatever a website sent.
//!   Reads are capped ([`MAX_READ`]), numbers are clamped rather than trusted,
//!   a file that is not valid UTF-8 is decoded lossily, and nothing here can
//!   panic on what a file contains.
//! * **Never search the disk.** The digest directory is found through a fixed
//!   chain ([`locate`]): a folder the user chose, the pointer at the default
//!   place, the answer Neovim gave when asked. Nothing else.
//! * **The chosen folder is read by this process only.** It is not added to
//!   any Tauri fs scope; the webview never gets access to it.
//!
//! Template: `telemetry.rs`, which reads another plugin's on-disk data the same
//! way and reports "not known" rather than assuming.

use std::collections::HashMap;
use std::fs;
use std::io::Read;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use std::time::SystemTime;

use serde::{Deserialize, Deserializer, Serialize};

/// The digest schema this reader understands. A file with a higher one is
/// refused with its own message ([`Status::NewerSchema`]) rather than guessed
/// at: a field that changed meaning would otherwise show up as a wrong number.
pub const KNOWN_SCHEMA: u64 = 1;

/// Largest file that is read. A real digest is a few KB (400 days is about
/// 20); this is the bound on what a hand-edited or hostile file can cost.
pub const MAX_READ: u64 = 2 * 1024 * 1024;

/// Entries kept per list after parsing. The plugin writes at most `400`
/// daily days and GitHub's top 10; anything past these is not a digest.
const MAX_DAILY: usize = 5_000;
const MAX_TOP: usize = 50;

// ---------------------------------------------------------------- numbers

/// A count as a non-negative integer, whatever the file contained.
///
/// Negative, fractional, non-numeric and absurd values all land somewhere
/// sane instead of failing the whole file: a count is a display value, and
/// refusing a digest over one bad number would hide the other hundred good
/// ones. Nothing here does arithmetic on them; a reader that sums must
/// saturate.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize)]
pub struct Count(pub u64);

impl<'de> Deserialize<'de> for Count {
    fn deserialize<D: Deserializer<'de>>(d: D) -> Result<Self, D::Error> {
        let v = serde_json::Value::deserialize(d)?;
        Ok(Count(count_of(&v)))
    }
}

fn count_of(v: &serde_json::Value) -> u64 {
    match v {
        serde_json::Value::Number(n) => {
            if let Some(u) = n.as_u64() {
                u
            } else if let Some(f) = n.as_f64() {
                // `as u64` saturates: NaN and negatives become 0, huge
                // values become u64::MAX. All three are the wanted answer.
                if f.is_finite() && f > 0.0 {
                    f.floor() as u64
                } else {
                    0
                }
            } else {
                0
            }
        }
        _ => 0,
    }
}

// ----------------------------------------------------------------- digest

#[derive(Debug, Clone, Copy, Default, Deserialize, Serialize, PartialEq)]
#[serde(default)]
pub struct Window {
    pub count: Count,
    pub uniques: Count,
}

/// Sums over the last 7/30/90 **complete** days, and the trend.
///
/// `uniques` is the sum of the daily uniques, not distinct visitors — the
/// front end says "uniques", never "visitors". `trend` is a percent
/// (`12.5` is +12.5 %) and absent when neither window held data.
#[derive(Debug, Clone, Default, Deserialize, Serialize, PartialEq)]
#[serde(default)]
pub struct Metric {
    pub d7: Window,
    pub d30: Window,
    pub d90: Window,
    pub trend: Option<f64>,
}

/// `[date, count, uniques]`, as the plugin writes it. Serialised the same way.
#[derive(Debug, Clone, Deserialize, Serialize, PartialEq)]
pub struct DayPoint(pub String, pub Count, pub Count);

#[derive(Debug, Clone, Default, Deserialize, Serialize, PartialEq)]
#[serde(default)]
pub struct Daily {
    pub views: Vec<DayPoint>,
    pub clones: Vec<DayPoint>,
}

#[derive(Debug, Clone, Default, Deserialize, Serialize, PartialEq)]
#[serde(default)]
pub struct Referrer {
    pub referrer: String,
    pub count: Count,
    pub uniques: Count,
}

#[derive(Debug, Clone, Default, Deserialize, Serialize, PartialEq)]
#[serde(default)]
pub struct PathItem {
    pub path: String,
    pub title: Option<String>,
    pub count: Count,
    pub uniques: Count,
    /// `path` resolved to a project-relative file, by [`resolve_page_path`] —
    /// `skip_deserializing` because this is never the digest's own claim:
    /// the file is untrusted text, and this field exists to hold what *this*
    /// process verified, not what it was told.
    #[serde(skip_deserializing, default)]
    pub project_path: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize, Serialize, PartialEq)]
#[serde(default)]
pub struct Span {
    pub from: String,
    pub to: String,
}

/// One repository's digest, schema 1.
///
/// `referrers` and `paths` are `Option` on purpose: **absent means the plugin
/// has no snapshot** (unknown), `Some(vec![])` means GitHub reported none.
#[derive(Debug, Clone, Default, Deserialize, Serialize, PartialEq)]
#[serde(default)]
pub struct Digest {
    pub schema: u64,
    pub repo: String,
    pub generated: String,
    pub fetched: Option<String>,
    pub span: Option<Span>,
    pub views: Metric,
    pub clones: Metric,
    pub daily: Daily,
    pub referrers: Option<Vec<Referrer>>,
    pub paths: Option<Vec<PathItem>>,
}

/// Why a digest could not be used, kept apart because the UI words them
/// differently: one is a broken file, the other is a newer plugin.
#[derive(Debug, Clone, PartialEq)]
pub enum LoadError {
    /// Unreadable, too large, not JSON, or the wrong shape.
    Unreadable(String),
    /// `schema` is higher than [`KNOWN_SCHEMA`].
    Newer(u64),
}

/// Parse a digest from bytes. Never panics; the caller has already capped the
/// size.
pub fn parse(bytes: &[u8]) -> Result<Digest, LoadError> {
    // Lossy: the plugin clips strings by character, but a referrer is
    // whatever a website sent, and a stray invalid byte must not turn a whole
    // digest into "unreadable".
    let text = String::from_utf8_lossy(bytes);
    let value: serde_json::Value =
        serde_json::from_str(&text).map_err(|e| LoadError::Unreadable(format!("not JSON: {e}")))?;
    let schema = value
        .get("schema")
        .and_then(|s| s.as_u64())
        .ok_or_else(|| LoadError::Unreadable("no schema field".to_string()))?;
    // Checked before the structure is read: a newer schema may well have
    // changed a field's type, and "this plugin is newer than this app" is a
    // more useful thing to say than a serde type error.
    if schema > KNOWN_SCHEMA {
        return Err(LoadError::Newer(schema));
    }
    let mut digest: Digest = serde_json::from_value(value)
        .map_err(|e| LoadError::Unreadable(format!("unexpected shape: {e}")))?;
    digest.daily.views.truncate(MAX_DAILY);
    digest.daily.clones.truncate(MAX_DAILY);
    if let Some(list) = digest.referrers.as_mut() {
        list.truncate(MAX_TOP);
    }
    if let Some(list) = digest.paths.as_mut() {
        list.truncate(MAX_TOP);
    }
    Ok(digest)
}

/// Read a file, refusing anything over [`MAX_READ`].
///
/// The length check alone is not enough — a file can grow between the stat and
/// the read — so the read itself is bounded too.
fn read_capped(path: &Path) -> Result<Vec<u8>, String> {
    let file = fs::File::open(path).map_err(|e| format!("cannot open: {e}"))?;
    if let Ok(meta) = file.metadata() {
        if meta.len() > MAX_READ {
            return Err(format!("larger than {} MiB", MAX_READ / (1024 * 1024)));
        }
    }
    let mut buf = Vec::new();
    file.take(MAX_READ + 1)
        .read_to_end(&mut buf)
        .map_err(|e| format!("cannot read: {e}"))?;
    if buf.len() as u64 > MAX_READ {
        return Err(format!("larger than {} MiB", MAX_READ / (1024 * 1024)));
    }
    Ok(buf)
}

// ------------------------------------------------------------------ cache

struct Cached {
    mtime: Option<SystemTime>,
    len: u64,
    result: Arc<Result<Digest, LoadError>>,
}

static CACHE: Mutex<Option<HashMap<PathBuf, Cached>>> = Mutex::new(None);

/// Load a digest file, parsed once per `(path, mtime, length)`.
///
/// The plugin only rewrites a digest when its content changed, so the mtime is
/// a true change signal — that is what makes this cache correct, and why the
/// plugin's changed-only rule is part of its contract.
fn load(path: &Path) -> Arc<Result<Digest, LoadError>> {
    let meta = fs::metadata(path).ok();
    let key = (
        meta.as_ref().and_then(|m| m.modified().ok()),
        meta.as_ref().map(|m| m.len()).unwrap_or(0),
    );

    if let Ok(guard) = CACHE.lock() {
        if let Some(hit) = guard.as_ref().and_then(|c| c.get(path)) {
            if hit.mtime == key.0 && hit.len == key.1 {
                return Arc::clone(&hit.result);
            }
        }
    }

    let result = Arc::new(match read_capped(path) {
        Ok(bytes) => parse(&bytes),
        Err(e) => Err(LoadError::Unreadable(e)),
    });
    if let Ok(mut guard) = CACHE.lock() {
        guard.get_or_insert_with(HashMap::new).insert(
            path.to_path_buf(),
            Cached {
                mtime: key.0,
                len: key.1,
                result: Arc::clone(&result),
            },
        );
    }
    result
}

/// Drop every cached digest and every remembered repository. What a "look
/// again" button calls.
pub fn forget_all() {
    if let Ok(mut guard) = CACHE.lock() {
        *guard = None;
    }
    if let Ok(mut guard) = REPOS.lock() {
        *guard = None;
    }
}

// ------------------------------------------------------- project -> repo

/// `owner/name` of a GitHub remote URL, or `None`.
///
/// Three forms, and **host `github.com` only** — the digest is GitHub's, and
/// a project whose origin is anywhere else has no traffic to show (which is
/// `no_remote`, not an error):
///
/// * `https://github.com/owner/name[.git][/…]` (also `http`, `git`, `ssh`,
///   with or without `user@`, with or without a port)
/// * `git@github.com:owner/name[.git]`
///
/// The host is taken from after the last `@` of the authority, so
/// `https://github.com@evil.example/o/n` is *evil.example*, not GitHub, and
/// `github.com.evil.example` is not `github.com`.
pub fn parse_github_repo(url: &str) -> Option<String> {
    let url = url.trim();
    let path = if let Some(rest) = url.split_once("://").map(|(_, r)| r) {
        let (authority, path) = rest.split_once('/')?;
        let hostport = authority
            .rsplit_once('@')
            .map(|(_, h)| h)
            .unwrap_or(authority);
        let host = hostport.split(':').next().unwrap_or("");
        if !host.eq_ignore_ascii_case("github.com") {
            return None;
        }
        path
    } else {
        // scp-like: [user@]host:path
        let (authority, path) = url.split_once(':')?;
        let host = authority
            .rsplit_once('@')
            .map(|(_, h)| h)
            .unwrap_or(authority);
        if !host.eq_ignore_ascii_case("github.com") || path.starts_with('/') && path.len() < 2 {
            return None;
        }
        path
    };

    let mut parts = path.trim_start_matches('/').split('/');
    let owner = parts.next()?;
    let name = parts.next()?;
    let name = name.strip_suffix(".git").unwrap_or(name);
    if !valid_owner(owner) || !valid_repo_name(name) {
        return None;
    }
    Some(format!("{owner}/{name}"))
}

fn valid_owner(s: &str) -> bool {
    (1..=39).contains(&s.len())
        && !s.starts_with('-')
        && s.chars().all(|c| c.is_ascii_alphanumeric() || c == '-')
}

fn valid_repo_name(s: &str) -> bool {
    (1..=100).contains(&s.len())
        && s != "."
        && s != ".."
        && s.chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_' || c == '.')
}

/// Origin remembered per project root, so a list of thirty projects costs one
/// `git` process each **once**, never one per render.
static REPOS: Mutex<Option<HashMap<String, Option<String>>>> = Mutex::new(None);

/// Forget what is known about one project's origin (after it was edited).
pub fn forget(root: &str) {
    if let Ok(mut guard) = REPOS.lock() {
        if let Some(map) = guard.as_mut() {
            map.remove(&normalise_root(root));
        }
    }
}

fn normalise_root(root: &str) -> String {
    root.replace('\\', "/").trim_end_matches('/').to_string()
}

/// `git remote get-url origin` in `root`, as a GitHub `owner/name`.
fn origin_repo(root: &str) -> Option<String> {
    let mut cmd = std::process::Command::new("git");
    cmd.args(["-C", root, "remote", "get-url", "origin"]);
    // No prompts, ever: this runs in the background for every project.
    cmd.env("GIT_TERMINAL_PROMPT", "0");
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }
    let out = cmd.output().ok()?;
    if !out.status.success() {
        return None;
    }
    parse_github_repo(String::from_utf8_lossy(&out.stdout).lines().next()?)
}

/// The GitHub repository a project is, or `None`.
///
/// `repo_url` (a URL-imported project already carries one) is tried first and
/// costs no process; failing that, the project's `origin`, remembered per
/// root. "No GitHub remote" is remembered too — asking again would spawn the
/// same process for the same answer on every render.
pub fn repo_of(root: &str, repo_url: Option<&str>) -> Option<String> {
    if let Some(repo) = repo_url.and_then(parse_github_repo) {
        return Some(repo);
    }
    let key = normalise_root(root);
    if let Ok(guard) = REPOS.lock() {
        if let Some(hit) = guard.as_ref().and_then(|m| m.get(&key)) {
            return hit.clone();
        }
    }
    let found = origin_repo(root);
    if let Ok(mut guard) = REPOS.lock() {
        guard
            .get_or_insert_with(HashMap::new)
            .insert(key, found.clone());
    }
    found
}

// -------------------------------------------------------------- discovery

/// Where a digest directory was found, for the UI to say.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum Via {
    /// A folder the user chose.
    Setting,
    /// `root.json` at the default place.
    Root,
    /// The answer Neovim gave when asked.
    Asked,
}

/// What the discovery chain starts from.
#[derive(Debug, Clone, Default)]
pub struct Sources {
    /// A folder the user chose (`Workspace.traffic_dir`).
    pub explicit: Option<String>,
    /// The plugin's default data folder on this OS ([`default_data_dir`]).
    pub default_dir: Option<PathBuf>,
    /// What Neovim answered when asked (`Workspace.traffic_asked_dir`).
    pub asked: Option<String>,
}

/// The plugin's default folder: `stdpath("data")/github_stats.nvim`.
///
/// Only the *conventional* place, not a search: a Neovim run under another
/// `NVIM_APPNAME` puts it elsewhere, which is what asking Neovim is for.
pub fn default_data_dir() -> Option<PathBuf> {
    let base = if cfg!(windows) {
        std::env::var_os("LOCALAPPDATA").map(|d| Path::new(&d).join("nvim-data"))
    } else if let Some(xdg) = std::env::var_os("XDG_DATA_HOME").filter(|d| !d.is_empty()) {
        Some(Path::new(&xdg).join("nvim"))
    } else {
        std::env::var_os("HOME").map(|d| Path::new(&d).join(".local/share/nvim"))
    }?;
    Some(base.join("github_stats.nvim"))
}

/// A folder that qualifies, and what is in it.
#[derive(Debug, Clone)]
pub struct Found {
    /// The folder holding the `<owner_repo>.json` files.
    pub files_dir: PathBuf,
    /// `root.json`'s `repos` (repository → file stem), when a pointer was read.
    pub repos: Option<HashMap<String, String>>,
    /// How many digest files are there.
    pub count: usize,
    /// Newest modification time among them, unix seconds.
    pub newest: Option<u64>,
}

/// A file stem from `root.json` is used to build a path, so it is checked like
/// any other name from a file: no separators, no traversal.
fn safe_stem(stem: &str) -> bool {
    !stem.is_empty()
        && stem != "."
        && stem != ".."
        && stem
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || matches!(c, '-' | '_' | '.' | '%'))
}

fn count_files(dir: &Path) -> (usize, Option<u64>) {
    let mut n = 0;
    let mut newest: Option<u64> = None;
    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            // A stray `.tmp` (an interrupted atomic write) is not a digest.
            if path.extension().and_then(|e| e.to_str()) != Some("json") {
                continue;
            }
            // The pointer sits beside the digests when a data folder is
            // counted as a digest folder; it is not one.
            if path.file_name().and_then(|n| n.to_str()) == Some("root.json") {
                continue;
            }
            n += 1;
            let secs = entry
                .metadata()
                .and_then(|m| m.modified())
                .ok()
                .and_then(|t| t.duration_since(SystemTime::UNIX_EPOCH).ok())
                .map(|d| d.as_secs());
            if let Some(s) = secs {
                newest = Some(newest.map_or(s, |c| c.max(s)));
            }
        }
    }
    (n, newest)
}

/// Does `folder` qualify, and if so where are its digest files?
///
/// Accepts the three shapes a person might point at: the plugin's data folder
/// (has `root.json`), a `digest_dir` (has a `digest/` folder), or the
/// `digest/` folder itself. The `Err` is a sentence about what was missing.
pub fn probe(folder: &Path) -> Result<Found, String> {
    if !folder.is_dir() {
        return Err("not a folder".to_string());
    }

    let root_path = folder.join("root.json");
    let mut repos: Option<HashMap<String, String>> = None;
    let mut pointed: Option<PathBuf> = None;

    if root_path.is_file() {
        let bytes = read_capped(&root_path).map_err(|e| format!("root.json: {e}"))?;
        let value: serde_json::Value = serde_json::from_str(&String::from_utf8_lossy(&bytes))
            .map_err(|e| format!("root.json is not JSON: {e}"))?;
        if value.get("schema").and_then(|s| s.as_u64()).unwrap_or(0) > KNOWN_SCHEMA {
            return Err("root.json is newer than this app understands".to_string());
        }
        if let Some(dir) = value.get("digest_dir").and_then(|d| d.as_str()) {
            pointed = Some(PathBuf::from(dir));
        }
        // `repos` is omitted while empty, and an empty table encodes as `[]`
        // on the plugin's side — both mean "none", neither is an error.
        if let Some(map) = value.get("repos").and_then(|r| r.as_object()) {
            let mut out = HashMap::new();
            for (repo, stem) in map {
                if let Some(stem) = stem.as_str().filter(|s| safe_stem(s)) {
                    out.insert(repo.clone(), stem.to_string());
                }
            }
            repos = Some(out);
        }
    }

    let candidates = pointed
        .into_iter()
        .map(|d| d.join("digest"))
        .chain([folder.join("digest"), folder.to_path_buf()]);
    for files_dir in candidates {
        if !files_dir.is_dir() {
            continue;
        }
        let (count, newest) = count_files(&files_dir);
        // The folder itself is only a digest folder if it holds digests;
        // a `digest/` folder (even an empty one) is the plugin's own.
        if files_dir == folder && count == 0 {
            continue;
        }
        return Ok(Found {
            files_dir,
            repos,
            count,
            newest,
        });
    }

    Err(if root_path.is_file() {
        "root.json points to a folder with no digests".to_string()
    } else {
        "no root.json and no digest folder".to_string()
    })
}

/// One step of the chain, whether it qualified or not — so the Settings panel
/// can say what was looked at and why it was not used.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Attempt {
    pub via: Via,
    pub dir: String,
    pub ok: bool,
    pub reason: Option<String>,
}

/// The discovery chain, first hit wins. `None` means nothing was found — the
/// panel says so and names the folder button and "Ask Neovim". Never a search
/// of the disk.
pub fn locate(sources: &Sources) -> (Option<(Via, Found)>, Vec<Attempt>) {
    let mut steps: Vec<(Via, PathBuf)> = Vec::new();
    if let Some(dir) = sources.explicit.as_deref().filter(|d| !d.trim().is_empty()) {
        steps.push((Via::Setting, PathBuf::from(dir)));
    }
    if let Some(dir) = &sources.default_dir {
        steps.push((Via::Root, dir.clone()));
    }
    if let Some(dir) = sources.asked.as_deref().filter(|d| !d.trim().is_empty()) {
        steps.push((Via::Asked, PathBuf::from(dir)));
    }

    let mut attempts = Vec::new();
    let mut hit = None;
    for (via, dir) in steps {
        match probe(&dir) {
            Ok(found) => {
                attempts.push(Attempt {
                    via,
                    dir: crate::portable(&dir),
                    ok: true,
                    reason: None,
                });
                hit = Some((via, found));
                break;
            }
            Err(reason) => attempts.push(Attempt {
                via,
                dir: crate::portable(&dir),
                ok: false,
                reason: Some(reason),
            }),
        }
    }
    (hit, attempts)
}

/// The file name (without extension) a repository's digest is stored under:
/// `/` becomes `_`, every byte outside `[A-Za-z0-9._-]` becomes `%XX`. The
/// plugin's own rule; only used when there is no `root.json` to ask.
pub fn file_stem(repo: &str) -> String {
    let mut out = String::new();
    for b in repo.bytes() {
        match b {
            b'/' => out.push('_'),
            b if b.is_ascii_alphanumeric() || b == b'-' || b == b'.' || b == b'_' => {
                out.push(b as char)
            }
            b => out.push_str(&format!("%{b:02X}")),
        }
    }
    if out.is_empty() || out == "." || out == ".." {
        out = "_".to_string();
    }
    out
}

/// The digest file for `repo` in `found`, if there is one.
///
/// The stem comes from `root.json` when it lists the repository (compared
/// case-insensitively — GitHub names are), else from [`file_stem`]. The result
/// is always `files_dir/<safe stem>.json`, so nothing read from a file can
/// steer this outside that folder.
pub fn digest_file(found: &Found, repo: &str) -> Option<PathBuf> {
    let listed = found.repos.as_ref().and_then(|map| {
        map.iter()
            .find(|(name, _)| name.eq_ignore_ascii_case(repo))
            .map(|(_, stem)| stem.clone())
    });
    let stem = listed.unwrap_or_else(|| file_stem(repo));
    if !safe_stem(&stem) {
        return None;
    }
    let path = found.files_dir.join(format!("{stem}.json"));
    path.is_file().then_some(path)
}

// ---------------------------------------------------------------- outcome

/// What a project's traffic is, as one of a fixed set of answers. Each is
/// shown as what it is — none is dressed up as an empty panel or a zero.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum Status {
    /// A digest was read.
    Ok,
    /// The repository is known, a digest folder was found, and the plugin has
    /// no digest for this repository.
    NotTracked,
    /// The project has no GitHub remote. Nothing is shown, and it is not an
    /// error.
    NoRemote,
    /// No digest folder could be found at all — the plugin is absent, has
    /// never run here, or is somewhere this app was not told about.
    NoDigest,
    /// The digest file exists and could not be used.
    Unreadable,
    /// The digest is newer than this app understands.
    NewerSchema,
    /// The project was opted out in this app.
    Disabled,
}

/// The parts of a digest the sidebar and the project list need. The daily
/// series, referrers and paths are for the detail dialog and are read
/// separately ([`detail`]).
#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Summary {
    pub generated: String,
    pub fetched: Option<String>,
    pub span_from: Option<String>,
    pub span_to: Option<String>,
    pub views: Metric,
    pub clones: Metric,
    /// How many days of daily values the digest holds (the longer series).
    pub days_kept: usize,
    pub has_referrers: bool,
    pub has_paths: bool,
}

fn summarise(d: &Digest) -> Summary {
    Summary {
        generated: d.generated.clone(),
        fetched: d.fetched.clone(),
        span_from: d.span.as_ref().map(|s| s.from.clone()),
        span_to: d.span.as_ref().map(|s| s.to.clone()),
        views: d.views.clone(),
        clones: d.clones.clone(),
        days_kept: d.daily.views.len().max(d.daily.clones.len()),
        has_referrers: d.referrers.is_some(),
        has_paths: d.paths.is_some(),
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Info {
    pub status: Status,
    /// `owner/name`, when the project resolved to one.
    pub repo: Option<String>,
    /// For `unreadable` and `newer_schema`: what is wrong, verbatim.
    pub message: Option<String>,
    pub summary: Option<Summary>,
    /// The digest folder that was read, and how it was found.
    pub dir: Option<String>,
    pub via: Option<Via>,
}

impl Info {
    fn bare(status: Status, repo: Option<String>) -> Info {
        Info {
            status,
            repo,
            message: None,
            summary: None,
            dir: None,
            via: None,
        }
    }
}

/// Everything known about one project's traffic. Pure of the app: the caller
/// resolves `repo` ([`repo_of`]) and the opt-out, so this is testable with
/// nothing but a temp folder.
///
/// The order is the order of the answers' cost: an opted-out project reads
/// nothing, a project with no GitHub remote reads nothing.
pub fn info_for(repo: Option<&str>, hidden: bool, sources: &Sources) -> Info {
    if hidden {
        return Info::bare(Status::Disabled, None);
    }
    let Some(repo) = repo else {
        return Info::bare(Status::NoRemote, None);
    };
    let repo = repo.to_string();

    let (hit, _) = locate(sources);
    let Some((via, found)) = hit else {
        return Info::bare(Status::NoDigest, Some(repo));
    };
    let dir = crate::portable(&found.files_dir);

    let mut info = Info::bare(Status::NotTracked, Some(repo.clone()));
    info.dir = Some(dir);
    info.via = Some(via);

    let Some(path) = digest_file(&found, &repo) else {
        return info;
    };
    match &*load(&path) {
        Ok(digest) => {
            // Two names can share a file stem (`/` and a literal `_` both
            // become `_`), and the file says which repository it holds.
            if !digest.repo.is_empty() && !digest.repo.eq_ignore_ascii_case(&repo) {
                return info;
            }
            info.status = Status::Ok;
            info.summary = Some(summarise(digest));
        }
        Err(LoadError::Newer(n)) => {
            info.status = Status::NewerSchema;
            info.message = Some(format!(
                "schema {n}, this app understands up to {KNOWN_SCHEMA}"
            ));
        }
        Err(LoadError::Unreadable(reason)) => {
            info.status = Status::Unreadable;
            info.message = Some(reason.clone());
        }
    }
    info
}

/// The whole digest, for the detail dialog: the daily series, referrers and
/// paths. `None` unless the project has a readable digest.
pub fn detail(repo: Option<&str>, hidden: bool, sources: &Sources) -> Option<Digest> {
    if hidden {
        return None;
    }
    let (hit, _) = locate(sources);
    let (_, found) = hit?;
    let path = digest_file(&found, repo?)?;
    match &*load(&path) {
        Ok(d) => Some(d.clone()),
        Err(_) => None,
    }
}

/// A "top pages" entry's GitHub path (`/owner/repo/blob/<ref>/<file>`)
/// resolved to a path relative to the project root — `None` if it cannot be
/// trusted to stay inside the project. The frontend hands the result straight
/// to `open_in_editor`, which repeats the same canonicalize-then-contain
/// check on its own; this one exists so a badge is offered only when that
/// later check would actually succeed, not to replace it.
///
/// The `<ref>` component is assumed to carry no `/` of its own — a branch
/// name that does leaves the entry unresolved rather than guessed at, which
/// is the safe failure here: the row stays plain text instead of jumping
/// somewhere wrong.
pub fn resolve_page_path(
    github_path: &str,
    digest_repo: &str,
    project_root: &Path,
) -> Option<String> {
    if digest_repo.is_empty() {
        return None;
    }
    let prefix = format!("/{digest_repo}/blob/");
    let rest = github_path.strip_prefix(&prefix)?;
    let (_branch, file_path) = rest.split_once('/')?;
    // Pre-validated before it ever touches the filesystem: a `..`, a
    // backslash, a leading `/` or a drive letter each mean something
    // different than "a repo-relative path" to `Path::join`, which is
    // exactly the gap `fs::canonicalize` closes below for everything else.
    if file_path.is_empty()
        || file_path.contains("..")
        || file_path.contains('\\')
        || file_path.starts_with('/')
        || has_drive_letter(file_path)
    {
        return None;
    }
    let root = fs::canonicalize(project_root).ok()?;
    let target = fs::canonicalize(root.join(file_path)).ok()?;
    if !target.starts_with(&root) {
        return None;
    }
    Some(file_path.to_string())
}

/// `C:`-style prefix at the front of a path some other file supplied. Not a
/// Windows-only concern: a digest can be read on any OS the plugin wrote it
/// on, and `Path::join` treats a "prefix but no root" component as license to
/// replace the base it was joined onto, on the platform that recognises one.
fn has_drive_letter(s: &str) -> bool {
    let mut chars = s.chars();
    matches!(chars.next(), Some(c) if c.is_ascii_alphabetic()) && chars.next() == Some(':')
}

/// One project's row for the project list: the numbers the sort order and the
/// column need, nothing else.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListEntry {
    pub id: String,
    pub status: Status,
    pub views7: Option<u64>,
    pub views30: Option<u64>,
    pub clones30: Option<u64>,
    pub trend: Option<f64>,
    pub fetched: Option<String>,
}

pub fn list_entry(id: &str, info: &Info) -> ListEntry {
    let s = info.summary.as_ref();
    ListEntry {
        id: id.to_string(),
        status: info.status,
        views7: s.map(|s| s.views.d7.count.0),
        views30: s.map(|s| s.views.d30.count.0),
        clones30: s.map(|s| s.clones.d30.count.0),
        trend: s.and_then(|s| s.views.trend),
        fetched: s.and_then(|s| s.fetched.clone().or_else(|| Some(s.generated.clone()))),
    }
}

/// What the Settings panel shows: what was chosen, what was asked, and what
/// the chain found or why it found nothing.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Survey {
    pub explicit: Option<String>,
    pub asked: Option<String>,
    pub default_dir: Option<String>,
    pub attempts: Vec<Attempt>,
    pub found: Option<SurveyFound>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SurveyFound {
    pub via: Via,
    pub dir: String,
    pub repos: usize,
    /// Unix seconds of the newest digest file's last change.
    pub newest: Option<u64>,
}

pub fn survey(sources: &Sources) -> Survey {
    let (hit, attempts) = locate(sources);
    Survey {
        explicit: sources.explicit.clone(),
        asked: sources.asked.clone(),
        default_dir: sources.default_dir.as_deref().map(crate::portable),
        attempts,
        found: hit.map(|(via, f)| SurveyFound {
            via,
            dir: crate::portable(&f.files_dir),
            repos: f.repos.as_ref().map(|r| r.len()).unwrap_or(f.count),
            newest: f.newest,
        }),
    }
}

/// Pull Neovim's answer out of what a headless run printed.
///
/// Markers rather than "the last line": a config that prints anything at
/// startup would otherwise be read as a path.
pub fn parse_asked(stdout: &str) -> Result<String, String> {
    if let Some(dir) = between(stdout, "<<docmap-traffic-dir:", ":>>") {
        let dir = dir.trim();
        if dir.is_empty() {
            return Err("Neovim answered with an empty path".to_string());
        }
        return Ok(dir.replace('\\', "/"));
    }
    if let Some(err) = between(stdout, "<<docmap-traffic-err:", ":>>") {
        return Err(format!(
            "github_stats.nvim could not be loaded in Neovim: {}",
            err.trim()
        ));
    }
    Err("Neovim did not answer".to_string())
}

fn between<'a>(s: &'a str, open: &str, close: &str) -> Option<&'a str> {
    let start = s.find(open)? + open.len();
    let end = s[start..].find(close)? + start;
    Some(&s[start..end])
}

/// The Lua one-liner Neovim is asked. `require` rather than a probe of the
/// top-level module: `github_stats` loads its dashboard at module load, which
/// needs `ui.nvim`, and would answer "not installed" for someone who has the
/// plugin but not its UI dependency. `github_stats.digest` needs neither, and
/// answers even before `setup()` has run.
pub const ASK_LUA: &str = "lua local ok, d = pcall(function() return require('github_stats.digest').digest_dir() end); io.write(ok and ('\\n<<docmap-traffic-dir:' .. d .. ':>>\\n') or ('\\n<<docmap-traffic-err:' .. tostring(d) .. ':>>\\n'))";

// ------------------------------------------------------------------ tests

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;

    fn tmp(name: &str) -> PathBuf {
        let d = std::env::temp_dir().join(format!("docmap-traffic-{name}"));
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

    const DIGEST: &str = r#"{
      "schema": 1, "repo": "owner/alpha",
      "generated": "2026-09-28T07:03:09Z", "fetched": "2026-09-27T20:37:37Z",
      "span": {"from": "2026-06-29", "to": "2026-09-23"},
      "views":  {"d7": {"count": 4, "uniques": 3}, "d30": {"count": 55, "uniques": 30},
                 "d90": {"count": 120, "uniques": 70}, "trend": 12.5},
      "clones": {"d7": {"count": 9, "uniques": 5}, "d30": {"count": 90, "uniques": 40},
                 "d90": {"count": 300, "uniques": 100}, "trend": -3.0},
      "daily": {"views": [["2026-09-22", 2, 2], ["2026-09-23", 1, 1]],
                "clones": [["2026-09-22", 27, 14]]},
      "referrers": [{"referrer": "google.com", "count": 9, "uniques": 5}],
      "paths": [{"path": "/owner/alpha/blob/main/docs/X.md", "title": "docs/X.md", "count": 7, "uniques": 3}]
    }"#;

    /// A plugin data folder with a digest for `owner/alpha` and a pointer.
    fn data_dir(name: &str) -> PathBuf {
        let root = tmp(name);
        write(&root.join("digest/owner_alpha.json"), DIGEST);
        write(
            &root.join("root.json"),
            &format!(
                r#"{{"schema":1,"digest_dir":"{}","repos":{{"owner/alpha":"owner_alpha"}}}}"#,
                root.to_string_lossy().replace('\\', "/")
            ),
        );
        root
    }

    fn sources_for(dir: &Path) -> Sources {
        Sources {
            explicit: Some(dir.to_string_lossy().to_string()),
            ..Default::default()
        }
    }

    // ------------------------------------------------------- repo parsing

    #[test]
    fn the_three_github_url_forms_resolve() {
        for url in [
            "https://github.com/StefanBartl/docmap-desktop",
            "https://github.com/StefanBartl/docmap-desktop.git",
            "https://github.com/StefanBartl/docmap-desktop/",
            "https://github.com/StefanBartl/docmap-desktop/blob/main/README.md",
            "http://github.com/StefanBartl/docmap-desktop",
            "git@github.com:StefanBartl/docmap-desktop.git",
            "git@github.com:StefanBartl/docmap-desktop",
            "ssh://git@github.com/StefanBartl/docmap-desktop.git",
            "ssh://git@github.com:22/StefanBartl/docmap-desktop.git",
            "https://token@github.com/StefanBartl/docmap-desktop.git",
            "HTTPS://GitHub.com/StefanBartl/docmap-desktop",
        ] {
            assert_eq!(
                parse_github_repo(url).as_deref(),
                Some("StefanBartl/docmap-desktop"),
                "{url}"
            );
        }
    }

    #[test]
    fn other_hosts_and_host_tricks_are_not_github() {
        for url in [
            "https://gitlab.com/o/n",
            "git@gitlab.com:o/n.git",
            "https://github.com.evil.example/o/n",
            "https://evilgithub.com/o/n",
            // userinfo trick: the host is what follows the last `@`
            "https://github.com@evil.example/o/n",
            "https://github.com:secret@evil.example/o/n",
            "ssh://git@bitbucket.org/o/n.git",
            "/local/path/to/repo",
            "C:\\repos\\thing",
            "",
            "github.com/o/n",
        ] {
            assert_eq!(parse_github_repo(url), None, "{url}");
        }
    }

    #[test]
    fn malformed_owner_and_repo_are_refused() {
        for url in [
            "https://github.com/o",
            "https://github.com/",
            "https://github.com/-bad/n",
            "https://github.com/o/..",
            "https://github.com/o/.",
            "https://github.com/o w/n",
            "https://github.com/o/n%2f..",
            "https://github.com/o/<script>",
            "git@github.com:/",
        ] {
            assert_eq!(parse_github_repo(url), None, "{url}");
        }
    }

    #[test]
    fn repo_url_wins_and_costs_no_process() {
        // A root that is not a directory at all: if `repo_of` spawned git it
        // would come back empty. It answers from the URL alone.
        let repo = repo_of("Z:/definitely/not/here", Some("https://github.com/o/n"));
        assert_eq!(repo.as_deref(), Some("o/n"));
    }

    #[test]
    fn a_non_github_repo_url_falls_through_to_the_origin() {
        // No such directory: the fall-through finds nothing, which is the
        // point — the gitlab URL did not answer for it.
        let repo = repo_of("Z:/definitely/not/here-2", Some("https://gitlab.com/o/n"));
        assert_eq!(repo, None);
    }

    #[test]
    fn the_origin_of_a_real_repository_is_read_once_and_remembered() {
        let dir = tmp("origin");
        let git = |args: &[&str]| {
            std::process::Command::new("git")
                .arg("-C")
                .arg(&dir)
                .args(args)
                .output()
                .ok()
        };
        if git(&["init", "-q"]).map(|o| o.status.success()) != Some(true) {
            return; // no git here; the parsing above is what carries the logic
        }
        git(&["remote", "add", "origin", "git@github.com:acme/widgets.git"]);

        let root = dir.to_string_lossy().to_string();
        assert_eq!(repo_of(&root, None).as_deref(), Some("acme/widgets"));

        // Changed behind the app's back: the remembered answer is what the
        // next call sees, until the project is edited or "look again" runs.
        git(&[
            "remote",
            "set-url",
            "origin",
            "https://github.com/acme/renamed",
        ]);
        assert_eq!(repo_of(&root, None).as_deref(), Some("acme/widgets"));
        forget(&root);
        assert_eq!(repo_of(&root, None).as_deref(), Some("acme/renamed"));
    }

    #[test]
    fn a_repository_without_a_github_origin_is_no_remote_and_remembered_as_such() {
        let dir = tmp("no-origin");
        let ok = std::process::Command::new("git")
            .arg("-C")
            .arg(&dir)
            .args(["init", "-q"])
            .output()
            .map(|o| o.status.success())
            .unwrap_or(false);
        if !ok {
            return;
        }
        assert_eq!(repo_of(&dir.to_string_lossy(), None), None);
    }

    // ------------------------------------------------------------ parsing

    #[test]
    fn a_real_digest_parses() {
        let d = parse(DIGEST.as_bytes()).unwrap();
        assert_eq!(d.repo, "owner/alpha");
        assert_eq!(d.views.d30.count, Count(55));
        assert_eq!(d.views.trend, Some(12.5));
        assert_eq!(d.clones.trend, Some(-3.0));
        assert_eq!(d.daily.views.len(), 2);
        assert_eq!(
            d.daily.views[0],
            DayPoint("2026-09-22".into(), Count(2), Count(2))
        );
        assert_eq!(d.referrers.as_ref().unwrap().len(), 1);
        assert_eq!(
            d.paths.as_ref().unwrap()[0].title.as_deref(),
            Some("docs/X.md")
        );
    }

    #[test]
    fn a_newer_schema_is_refused_by_name_even_when_its_shape_changed() {
        // `views` became a string in schema 2: read as schema 1 that is a type
        // error, and the honest message is "newer", not "unexpected shape".
        let body = r#"{"schema": 2, "repo": "o/n", "views": "restructured"}"#;
        assert_eq!(parse(body.as_bytes()), Err(LoadError::Newer(2)));
    }

    #[test]
    fn missing_or_wrong_schema_is_unreadable_not_a_panic() {
        assert!(matches!(parse(b"{}"), Err(LoadError::Unreadable(_))));
        assert!(matches!(parse(b"[]"), Err(LoadError::Unreadable(_))));
        assert!(matches!(
            parse(b"{\"schema\": \"one\"}"),
            Err(LoadError::Unreadable(_))
        ));
        assert!(matches!(
            parse(b"not json at all"),
            Err(LoadError::Unreadable(_))
        ));
        assert!(matches!(parse(b""), Err(LoadError::Unreadable(_))));
        assert!(matches!(
            parse(b"\xff\xfe\x00"),
            Err(LoadError::Unreadable(_))
        ));
    }

    #[test]
    fn a_malformed_file_of_the_right_schema_is_unreadable() {
        let body = r#"{"schema": 1, "repo": "o/n", "referrers": "nope"}"#;
        assert!(matches!(
            parse(body.as_bytes()),
            Err(LoadError::Unreadable(_))
        ));
    }

    #[test]
    fn numbers_are_clamped_never_trusted() {
        let body = r#"{"schema": 1, "repo": "o/n",
          "views": {"d7": {"count": -5, "uniques": 2.9},
                    "d30": {"count": 18446744073709551615, "uniques": 1e30},
                    "d90": {"count": "many", "uniques": null}}}"#;
        let d = parse(body.as_bytes()).unwrap();
        assert_eq!(d.views.d7.count, Count(0), "negative");
        assert_eq!(d.views.d7.uniques, Count(2), "fractional");
        assert_eq!(
            d.views.d30.count,
            Count(u64::MAX),
            "the largest u64 survives"
        );
        assert_eq!(d.views.d30.uniques, Count(u64::MAX), "beyond u64 saturates");
        assert_eq!(d.views.d90.count, Count(0), "a string");
        assert_eq!(d.views.d90.uniques, Count(0), "null");
    }

    #[test]
    fn absent_and_empty_referrers_are_different_answers() {
        let none = parse(br#"{"schema": 1, "repo": "o/n"}"#).unwrap();
        assert!(none.referrers.is_none(), "no snapshot: unknown");
        let empty = parse(br#"{"schema": 1, "repo": "o/n", "referrers": []}"#).unwrap();
        assert_eq!(
            empty.referrers,
            Some(vec![]),
            "a snapshot with none: GitHub said none"
        );
    }

    #[test]
    fn lists_are_bounded_after_parsing() {
        let many: Vec<String> = (0..(MAX_TOP + 25))
            .map(|i| format!(r#"{{"referrer":"r{i}","count":1,"uniques":1}}"#))
            .collect();
        let body = format!(
            r#"{{"schema":1,"repo":"o/n","referrers":[{}]}}"#,
            many.join(",")
        );
        let d = parse(body.as_bytes()).unwrap();
        assert_eq!(d.referrers.unwrap().len(), MAX_TOP);
    }

    #[test]
    fn invalid_utf8_inside_a_string_does_not_lose_the_digest() {
        let mut body = br#"{"schema":1,"repo":"o/n","referrers":[{"referrer":"bad"#.to_vec();
        body.push(0xff);
        body.extend_from_slice(br#"","count":1,"uniques":1}]}"#);
        let d = parse(&body).unwrap();
        assert!(d.referrers.unwrap()[0].referrer.starts_with("bad"));
    }

    #[test]
    fn a_hostile_referrer_is_kept_as_inert_text() {
        // The Rust side does not sanitise (it cannot know the sink); it keeps
        // the bytes exactly and the front end renders them as text.
        let body = r#"{"schema":1,"repo":"o/n","referrers":[
            {"referrer":"<img src=x onerror=alert(1)>","count":1,"uniques":1}]}"#;
        let d = parse(body.as_bytes()).unwrap();
        assert_eq!(
            d.referrers.unwrap()[0].referrer,
            "<img src=x onerror=alert(1)>"
        );
    }

    // -------------------------------------------------------- reading files

    #[test]
    fn a_file_over_the_cap_is_refused_with_a_message() {
        let dir = tmp("big");
        let path = dir.join("big.json");
        let f = fs::File::create(&path).unwrap();
        f.set_len(MAX_READ + 1).unwrap();
        assert!(read_capped(&path).unwrap_err().contains("larger than"));
        // Exactly at the cap is fine.
        let f = fs::OpenOptions::new().write(true).open(&path).unwrap();
        f.set_len(MAX_READ).unwrap();
        assert!(read_capped(&path).is_ok());
    }

    #[test]
    fn an_oversized_digest_reports_unreadable_not_a_crash() {
        let root = data_dir("oversized");
        let f = fs::OpenOptions::new()
            .write(true)
            .open(root.join("digest/owner_alpha.json"))
            .unwrap();
        f.set_len(3 * 1024 * 1024).unwrap();

        let info = info_for(Some("owner/alpha"), false, &sources_for(&root));
        assert_eq!(info.status, Status::Unreadable);
        assert!(info.message.unwrap().contains("larger than"));
    }

    #[test]
    fn the_cache_notices_a_changed_file() {
        let root = data_dir("cache");
        let s = sources_for(&root);
        let first = info_for(Some("owner/alpha"), false, &s);
        assert_eq!(first.summary.unwrap().views.d30.count, Count(55));

        let changed = DIGEST.replace(r#""d30": {"count": 55,"#, r#""d30": {"count": 7777,"#);
        assert_ne!(changed, DIGEST);
        write(&root.join("digest/owner_alpha.json"), &changed);
        let second = info_for(Some("owner/alpha"), false, &s);
        assert_eq!(second.summary.unwrap().views.d30.count, Count(7777));
    }

    // ------------------------------------------------------------ outcomes

    #[test]
    fn a_digest_is_ok_and_names_where_it_was_found() {
        let root = data_dir("ok");
        let info = info_for(Some("owner/alpha"), false, &sources_for(&root));
        assert_eq!(info.status, Status::Ok);
        assert_eq!(info.via, Some(Via::Setting));
        assert!(info.dir.unwrap().ends_with("/digest"));
        let s = info.summary.unwrap();
        assert_eq!(s.views.d7.count, Count(4));
        assert_eq!(s.clones.d90.count, Count(300));
        assert_eq!(s.span_from.as_deref(), Some("2026-06-29"));
        assert_eq!(s.days_kept, 2);
        assert!(s.has_referrers && s.has_paths);
    }

    #[test]
    fn repo_names_match_case_insensitively() {
        let root = data_dir("case");
        let info = info_for(Some("Owner/Alpha"), false, &sources_for(&root));
        assert_eq!(info.status, Status::Ok);
    }

    #[test]
    fn a_project_without_a_github_remote_is_no_remote() {
        let root = data_dir("no-remote");
        let info = info_for(None, false, &sources_for(&root));
        assert_eq!(info.status, Status::NoRemote);
        assert!(info.summary.is_none() && info.message.is_none() && info.dir.is_none());
    }

    #[test]
    fn a_matched_repository_the_plugin_does_not_track_is_not_tracked() {
        let root = data_dir("untracked");
        let info = info_for(Some("owner/beta"), false, &sources_for(&root));
        assert_eq!(info.status, Status::NotTracked);
        assert_eq!(info.repo.as_deref(), Some("owner/beta"));
        assert!(info.dir.is_some(), "it says where it looked");
    }

    #[test]
    fn nothing_found_anywhere_is_no_digest_and_never_a_search() {
        let empty = tmp("nothing");
        let info = info_for(
            Some("owner/alpha"),
            false,
            &Sources {
                default_dir: Some(empty.join("nope")),
                ..Default::default()
            },
        );
        assert_eq!(info.status, Status::NoDigest);
        assert_eq!(info.repo.as_deref(), Some("owner/alpha"));
    }

    #[test]
    fn an_opted_out_project_reads_nothing() {
        // Sources that would find a digest — the opt-out answers first.
        let root = data_dir("hidden");
        let info = info_for(Some("owner/alpha"), true, &sources_for(&root));
        assert_eq!(info.status, Status::Disabled);
        assert!(info.summary.is_none() && info.dir.is_none() && info.repo.is_none());
        assert!(detail(Some("owner/alpha"), true, &sources_for(&root)).is_none());
    }

    #[test]
    fn a_digest_from_a_newer_plugin_says_so() {
        let root = data_dir("newer");
        write(
            &root.join("digest/owner_alpha.json"),
            r#"{"schema": 9, "repo": "owner/alpha", "views": []}"#,
        );
        let info = info_for(Some("owner/alpha"), false, &sources_for(&root));
        assert_eq!(info.status, Status::NewerSchema);
        assert!(info.message.unwrap().contains("schema 9"));
    }

    #[test]
    fn a_malformed_digest_is_unreadable_with_a_reason() {
        let root = data_dir("malformed");
        write(&root.join("digest/owner_alpha.json"), "{ this is not json");
        let info = info_for(Some("owner/alpha"), false, &sources_for(&root));
        assert_eq!(info.status, Status::Unreadable);
        assert!(info.message.unwrap().contains("not JSON"));
    }

    #[test]
    fn a_file_that_holds_another_repository_is_not_this_ones_digest() {
        // `a/b_c` and `a_b/c` share a stem; the file says which one it is.
        let root = data_dir("collision");
        let info = info_for(Some("owner/alpha"), false, &sources_for(&root));
        assert_eq!(info.status, Status::Ok);
        write(
            &root.join("digest/owner_alpha.json"),
            &DIGEST.replace(r#""repo": "owner/alpha""#, r#""repo": "owner_alpha/x""#),
        );
        let other = info_for(Some("owner/alpha"), false, &sources_for(&root));
        assert_eq!(other.status, Status::NotTracked);
    }

    #[test]
    fn the_list_entry_carries_only_what_the_sort_needs() {
        let root = data_dir("list");
        let info = info_for(Some("owner/alpha"), false, &sources_for(&root));
        let e = list_entry("p1", &info);
        assert_eq!(e.status, Status::Ok);
        assert_eq!(e.views7, Some(4));
        assert_eq!(e.views30, Some(55));
        assert_eq!(e.clones30, Some(90));
        assert_eq!(e.trend, Some(12.5));
        assert_eq!(e.fetched.as_deref(), Some("2026-09-27T20:37:37Z"));

        let none = list_entry("p2", &info_for(None, false, &sources_for(&root)));
        assert_eq!(none.status, Status::NoRemote);
        assert_eq!(none.views30, None);
    }

    #[test]
    fn the_detail_is_the_whole_digest() {
        let root = data_dir("detail");
        let d = detail(Some("owner/alpha"), false, &sources_for(&root)).unwrap();
        assert_eq!(d.daily.clones.len(), 1);
        assert!(detail(Some("owner/beta"), false, &sources_for(&root)).is_none());
        assert!(detail(None, false, &sources_for(&root)).is_none());
    }

    // ------------------------------------------------- resolving top pages

    #[test]
    fn a_top_page_resolves_to_a_project_relative_path() {
        let root = tmp("resolve-ok");
        write(&root.join("docs/X.md"), "content");
        assert_eq!(
            resolve_page_path("/owner/alpha/blob/main/docs/X.md", "owner/alpha", &root),
            Some("docs/X.md".to_string())
        );
        // A branch name is one path segment, not zero: nothing after `blob/`
        // but the branch itself is not a file either.
        assert_eq!(
            resolve_page_path("/owner/alpha/blob/main", "owner/alpha", &root),
            None
        );
    }

    #[test]
    fn a_top_page_path_cannot_leave_the_project() {
        let root = tmp("resolve-traversal");
        write(&root.join("docs/X.md"), "content");
        write(&root.join("../resolve-traversal-secret.txt"), "secret");

        for (name, github_path) in [
            (
                "dot-dot",
                "/owner/alpha/blob/main/../resolve-traversal-secret.txt",
            ),
            ("dot-dot-backslash", "/owner/alpha/blob/main/..\\secret.txt"),
            ("drive-relative", "/owner/alpha/blob/main/C:evil.txt"),
            (
                "drive-absolute-backslash",
                "/owner/alpha/blob/main/C:\\evil.txt",
            ),
            // A double slash after the branch is what makes the *file* part
            // itself rooted, as opposed to the whole GitHub path (which is
            // always rooted).
            ("leading-slash", "/owner/alpha/blob/main//etc/passwd"),
            // Never decoded, so this is just a literal, nonexistent
            // directory name — rejected by not resolving, same as any other
            // entry that does not exist, not by special-casing `%2e%2e`.
            (
                "url-encoded-dot-dot",
                "/owner/alpha/blob/main/%2e%2e/docs/X.md",
            ),
            ("no-file-after-branch", "/owner/alpha/blob/main/"),
            ("does-not-exist", "/owner/alpha/blob/main/docs/missing.md"),
            ("wrong-repo", "/owner/beta/blob/main/docs/X.md"),
        ] {
            assert_eq!(
                resolve_page_path(github_path, "owner/alpha", &root),
                None,
                "{name}: {github_path}"
            );
        }
    }

    #[test]
    fn a_top_page_with_no_repo_to_match_against_is_unresolved() {
        let root = tmp("resolve-no-repo");
        write(&root.join("docs/X.md"), "content");
        assert_eq!(
            resolve_page_path("/owner/alpha/blob/main/docs/X.md", "", &root),
            None
        );
    }

    // ----------------------------------------------------------- discovery

    #[test]
    fn a_folder_can_be_the_data_folder_the_digest_dir_or_the_digest_folder() {
        let root = data_dir("shapes");
        // The plugin's data folder: has root.json.
        assert_eq!(probe(&root).unwrap().count, 1);
        // A digest_dir: has digest/, no root.json.
        let bare = tmp("shapes-bare");
        write(&bare.join("digest/owner_alpha.json"), DIGEST);
        assert_eq!(probe(&bare).unwrap().count, 1);
        // The digest folder itself.
        assert_eq!(probe(&bare.join("digest")).unwrap().count, 1);
    }

    #[test]
    fn a_folder_that_does_not_qualify_says_why() {
        assert!(probe(&tmp("shapes-empty"))
            .unwrap_err()
            .contains("no root.json"));
        assert_eq!(
            probe(&tmp("shapes-empty").join("missing")).unwrap_err(),
            "not a folder"
        );

        let pointed = tmp("shapes-pointed-nowhere");
        write(
            &pointed.join("root.json"),
            r#"{"schema":1,"digest_dir":"Z:/no/such/place","repos":{}}"#,
        );
        assert!(probe(&pointed).unwrap_err().contains("no digests"));
    }

    #[test]
    fn root_json_is_followed_to_an_overridden_digest_dir() {
        // The plugin's `digest_dir` was overridden: root.json at the default
        // place points at it, and that is found with no setting at all.
        let default = tmp("override-default");
        let elsewhere = tmp("override-elsewhere");
        write(&elsewhere.join("digest/owner_alpha.json"), DIGEST);
        write(
            &default.join("root.json"),
            &format!(
                r#"{{"schema":1,"digest_dir":"{}","repos":{{"owner/alpha":"owner_alpha"}}}}"#,
                elsewhere.to_string_lossy().replace('\\', "/")
            ),
        );
        let s = Sources {
            default_dir: Some(default),
            ..Default::default()
        };
        let info = info_for(Some("owner/alpha"), false, &s);
        assert_eq!(info.status, Status::Ok);
        assert_eq!(info.via, Some(Via::Root));
    }

    #[test]
    fn the_chain_prefers_the_setting_then_the_default_then_the_answer() {
        let setting = data_dir("chain-setting");
        let default = data_dir("chain-default");
        let asked = data_dir("chain-asked");
        let s = |explicit: Option<&Path>, default: Option<&Path>, asked: Option<&Path>| Sources {
            explicit: explicit.map(|p| p.to_string_lossy().to_string()),
            default_dir: default.map(Path::to_path_buf),
            asked: asked.map(|p| p.to_string_lossy().to_string()),
        };
        let via = |src: &Sources| locate(src).0.map(|(v, _)| v);

        assert_eq!(
            via(&s(Some(&setting), Some(&default), Some(&asked))),
            Some(Via::Setting)
        );
        assert_eq!(via(&s(None, Some(&default), Some(&asked))), Some(Via::Root));
        assert_eq!(via(&s(None, None, Some(&asked))), Some(Via::Asked));
        assert_eq!(via(&s(None, None, None)), None);

        // A setting that does not qualify does not block the rest of the
        // chain, and shows up in the attempts as what it was.
        let broken = tmp("chain-broken");
        let (hit, attempts) = locate(&s(Some(&broken), Some(&default), None));
        assert_eq!(hit.map(|(v, _)| v), Some(Via::Root));
        assert_eq!(attempts.len(), 2);
        assert!(!attempts[0].ok && attempts[0].reason.is_some());
        assert!(attempts[1].ok);
    }

    #[test]
    fn an_empty_root_json_repos_table_in_either_encoding_is_not_an_error() {
        for body in [
            r#"{"schema":1,"digest_dir":"","repos":[]}"#,
            r#"{"schema":1}"#,
            r#"{"schema":1,"repos":{}}"#,
        ] {
            let root = tmp("empty-repos");
            write(&root.join("digest/owner_alpha.json"), DIGEST);
            write(&root.join("root.json"), body);
            let found = probe(&root).unwrap();
            assert_eq!(found.count, 1, "{body}");
            // With no listing the stem is derived, and the digest is found.
            assert!(digest_file(&found, "owner/alpha").is_some(), "{body}");
        }
    }

    #[test]
    fn a_newer_root_json_is_refused() {
        let root = tmp("root-newer");
        write(&root.join("digest/owner_alpha.json"), DIGEST);
        write(&root.join("root.json"), r#"{"schema":7}"#);
        assert!(probe(&root).unwrap_err().contains("newer"));
    }

    #[test]
    fn stray_temp_files_are_not_digests() {
        let root = tmp("tmpfiles");
        write(&root.join("digest/owner_alpha.json"), DIGEST);
        write(&root.join("digest/owner_beta.json.tmp"), "{");
        assert_eq!(probe(&root).unwrap().count, 1);
    }

    #[test]
    fn a_stem_from_root_json_cannot_leave_the_digest_folder() {
        let root = tmp("traversal");
        write(&root.join("digest/owner_alpha.json"), DIGEST);
        write(&root.join("secret.json"), DIGEST);
        for stem in [
            "../secret",
            "..\\secret",
            "..",
            ".",
            "a/b",
            "C:evil",
            "/etc/passwd",
            "a b",
            "",
        ] {
            let body = format!(
                r#"{{"schema":1,"repos":{{"owner/alpha":{}}}}}"#,
                serde_json::Value::String(stem.to_string())
            );
            write(&root.join("root.json"), &body);
            let found = probe(&root).unwrap();
            // The bad stem is dropped at read time; the repository falls back
            // to the derived name, which is a file inside the folder.
            let path = digest_file(&found, "owner/alpha").expect(stem);
            assert_eq!(path.parent().unwrap(), found.files_dir, "{stem}");
            assert_eq!(path.file_name().unwrap(), "owner_alpha.json", "{stem}");
        }
    }

    #[test]
    fn the_derived_file_stem_follows_the_plugins_rule() {
        assert_eq!(file_stem("owner/alpha"), "owner_alpha");
        assert_eq!(file_stem("a/b:c"), "a_b%3Ac");
        assert_eq!(file_stem("a/b_c"), "a_b_c");
        assert_eq!(file_stem("o/n.nvim"), "o_n.nvim");
        assert_eq!(file_stem(".."), "_");
        assert_eq!(file_stem(""), "_");
        assert_eq!(file_stem("o/ä"), "o_%C3%A4");
    }

    #[test]
    fn the_survey_reports_what_was_looked_at() {
        let root = data_dir("survey");
        let sv = survey(&Sources {
            explicit: Some(root.to_string_lossy().to_string()),
            default_dir: Some(tmp("survey-default").join("nope")),
            ..Default::default()
        });
        let found = sv.found.unwrap();
        assert_eq!(found.via, Via::Setting);
        assert_eq!(found.repos, 1);
        assert!(found.newest.is_some());
        assert_eq!(sv.attempts.len(), 1, "stops at the first hit");

        let none = survey(&Sources {
            default_dir: Some(tmp("survey-none").join("nope")),
            ..Default::default()
        });
        assert!(none.found.is_none());
        assert_eq!(none.attempts.len(), 1);
        assert!(!none.attempts[0].ok);
    }

    // -------------------------------------------------------- asking nvim

    #[test]
    fn neovims_answer_is_read_between_markers_and_ignores_startup_noise() {
        let out = "some config printed this\n\n<<docmap-traffic-dir:C:\\Users\\me\\AppData\\Local\\nvim-data\\github_stats.nvim:>>\n";
        assert_eq!(
            parse_asked(out).unwrap(),
            "C:/Users/me/AppData/Local/nvim-data/github_stats.nvim"
        );
    }

    #[test]
    fn neovims_failure_and_silence_are_told_apart() {
        let err = parse_asked("\n<<docmap-traffic-err:module 'github_stats.digest' not found:>>\n")
            .unwrap_err();
        assert!(err.contains("could not be loaded") && err.contains("not found"));
        assert_eq!(
            parse_asked("nothing useful").unwrap_err(),
            "Neovim did not answer"
        );
        assert!(parse_asked("<<docmap-traffic-dir: :>>")
            .unwrap_err()
            .contains("empty"));
    }

    #[test]
    fn the_question_asks_the_ui_free_module() {
        assert!(ASK_LUA.contains("require('github_stats.digest')"));
        assert!(!ASK_LUA.contains("require('github_stats')"));
    }
}
