//! A small HTTP server for one project's map, so the page's own `/api/*`
//! panels have something on the other end.
//!
//! # Why this exists
//!
//! The window used to load the map through Tauri's asset protocol
//! (`convertFileSrc`). That shows the page but answers no request: the
//! generated page fetches `/api/telemetry`, `/api/loaded`, `/api/checklist`,
//! `/api/commits`, `/api/commit/<sha>` and two snapshot-listing routes, and
//! nothing was listening. On Windows it was worse than silent —
//! `convertFileSrc` hands out `http://asset.localhost/…`, so the page's own
//! "is a server behind this origin" test said *yes*, fetched, got the asset
//! host's 404, and advised running `:DocMap serve`, which does not help and
//! may already have been running. That misleading message is what started
//! this.
//!
//! # What is Rust's half and what is not
//!
//! Transport only. Every answer comes from the engine
//! (`documentation.nvim`'s standalone binary) via `--api=<route>`, which is
//! the same `core/api.lua` the in-editor server answers from. The join logic
//! stays in Lua, owned once. Two hosts computing the same join separately is
//! how they would come to disagree about one project while both looked
//! healthy.
//!
//! # Security posture
//!
//! Deliberately the same three rules `documentation.nvim`'s own
//! `editor/serve.lua` enforces, because this is the same surface — a socket
//! and a subprocess — pointed at the same data:
//!
//! 1. **Bind `127.0.0.1`, never `0.0.0.0`.** A personal viewer on a personal
//!    machine; the network has no business reaching a local repository's
//!    source.
//! 2. **Whitelist the route before it reaches the subprocess.** A request
//!    path is otherwise argument injection into the engine. Fixed-name
//!    routes go through a literal list; `commit/<sha>` goes through
//!    `safe_sha`, the same `^[0-9a-f]{7,40}$` shape check
//!    `documentation.core.api.safe_sha` enforces on the Lua side. Both are
//!    whitelists, not escapes.
//! 3. **No path parameter can leave the map directory.** Static serving takes
//!    a bare filename; anything with a separator or a `..` is refused before
//!    it becomes a path.

use std::io::{BufRead, BufReader, Write};
use std::net::{Ipv4Addr, SocketAddr, TcpListener, TcpStream};
use std::path::PathBuf;
use std::sync::{Arc, Mutex};

/// Everything one running server answers for.
#[derive(Debug, Clone)]
pub struct ServeConfig {
    /// The project root, passed to the engine as its scan root.
    pub root: String,
    /// Where the generated page lives.
    pub map_dir: String,
    /// The engine binary. Without it the API routes cannot be answered at
    /// all, and the server says so rather than 404ing like a missing file.
    pub engine: Option<String>,
    pub grammars: Option<String>,
}

pub struct Server {
    pub port: u16,
    pub root: String,
}

/// The one running server, if any. There is one window and one selected
/// project, so a second server would only be a socket nobody reads.
static CURRENT: Mutex<Option<Server>> = Mutex::new(None);

/// Fixed-name routes the engine is allowed to be asked for. `commit/<sha>`
/// is not in here — see `handle`'s own dispatch — because its name carries
/// the sha, which cannot be a fixed list entry.
///
/// Mirrors `documentation.core.api`'s own `routes` table. Duplicated here on
/// purpose and kept short: this is the whitelist that stands between a
/// request path and a subprocess argument, and a whitelist that asks another
/// process what it should contain is not one.
const ROUTES: &[&str] = &[
    "telemetry",
    "telemetry/snapshots",
    "loaded",
    "loaded/snapshots",
    "checklist",
    "commits",
];

/// A commit-ish the caller supplied, or `None` if it is not one.
///
/// Mirrors `documentation.core.api.safe_sha` exactly (`^[0-9a-f]{7,40}$`) —
/// this is the second lock on the same door, checked here so an invalid sha
/// never even reaches the subprocess call, and again by the engine itself
/// once it does.
fn safe_sha(s: &str) -> bool {
    let n = s.len();
    // Lua's `%x` pattern class matches both cases, so this does too.
    (7..=40).contains(&n) && s.bytes().all(|b| b.is_ascii_hexdigit())
}

/// A request path segment is servable only if it is a bare filename.
///
/// An empty path means `index.html`; anything containing a separator or a
/// `..` is refused, so this cannot be walked out of the map directory.
fn safe_static_name(name: &str) -> Option<&str> {
    if name.is_empty() {
        return Some("index.html");
    }
    if name.contains('/') || name.contains('\\') || name.contains("..") {
        return None;
    }
    Some(name)
}

fn content_type(name: &str) -> &'static str {
    match name.rsplit('.').next().unwrap_or("") {
        "html" => "text/html; charset=utf-8",
        "json" => "application/json",
        "svg" => "image/svg+xml",
        "css" => "text/css",
        "js" => "text/javascript",
        "md" => "text/plain; charset=utf-8",
        _ => "application/octet-stream",
    }
}

fn respond(stream: &mut TcpStream, code: u16, ctype: &str, body: &[u8]) {
    let reason = match code {
        200 => "OK",
        400 => "Bad Request",
        404 => "Not Found",
        405 => "Method Not Allowed",
        _ => "Internal Server Error",
    };
    let head = format!(
        "HTTP/1.1 {code} {reason}\r\nContent-Type: {ctype}\r\nContent-Length: {}\r\n\
         Cache-Control: no-store\r\nConnection: close\r\n\r\n",
        body.len()
    );
    let _ = stream.write_all(head.as_bytes());
    let _ = stream.write_all(body);
    let _ = stream.flush();
}

fn respond_json_error(stream: &mut TcpStream, code: u16, message: &str) {
    let body = serde_json::json!({ "error": message }).to_string();
    respond(stream, code, "application/json", body.as_bytes());
}

#[cfg(windows)]
fn no_window(cmd: &mut std::process::Command) {
    use std::os::windows::process::CommandExt;
    const CREATE_NO_WINDOW: u32 = 0x0800_0000;
    cmd.creation_flags(CREATE_NO_WINDOW);
}

#[cfg(not(windows))]
fn no_window(_cmd: &mut std::process::Command) {}

/// Does this engine understand `--api=`?
///
/// **This check is not optional, and asking the obvious way would be
/// destructive.** An engine built before `--api=` existed treats it as an
/// ordinary argument and *generates the map* — writing into the user's
/// repository and exiting 0 with output that is not JSON. A panel that polls
/// would rewrite their `docs/map` on every fetch. Measured against the
/// shipped binary, not imagined.
///
/// `--capabilities` is safe against both versions precisely because it sits
/// in the root-argument position, which an older binary rejects with exit 2
/// before doing any work. So a failed probe means "too old" and "no API" at
/// once, which is the only thing this caller needs to distinguish.
fn engine_supports_api(engine: &str) -> bool {
    let mut cmd = std::process::Command::new(engine);
    cmd.arg("--capabilities");
    no_window(&mut cmd);
    let Ok(out) = cmd.output() else { return false };
    if !out.status.success() {
        return false;
    }
    serde_json::from_slice::<serde_json::Value>(&out.stdout)
        .ok()
        .and_then(|v| {
            v.get("capabilities")
                .and_then(|c| c.as_array())
                .map(|c| c.iter().any(|x| x.as_str() == Some("api")))
        })
        .unwrap_or(false)
}

/// Ask the engine for one route's JSON.
///
/// `param` is `standalone/docmap.lua`'s single `--snapshot=` flag, read by
/// whichever route asked for it as a snapshot name (telemetry/loaded) or a
/// commit count (commits) — the same one-flag-many-meanings shape
/// `core/api.lua`'s own `M.answer(name, opts, param)` already uses, kept
/// consistent on this side rather than inventing a second flag per route.
fn engine_api(cfg: &ServeConfig, route: &str, param: Option<&str>) -> Result<String, String> {
    let engine = cfg
        .engine
        .as_ref()
        .ok_or_else(|| "no docmap engine configured".to_string())?;

    if !engine_supports_api(engine) {
        return Err(format!(
            "{engine} is an older docmap engine without --api support. \
             Rebuild it from documentation.nvim, or point at a newer one."
        ));
    }

    let mut cmd = std::process::Command::new(engine);
    cmd.arg(&cfg.root).arg(format!("--api={route}"));
    if let Some(p) = param {
        cmd.arg(format!("--snapshot={p}"));
    }
    if let Some(g) = &cfg.grammars {
        cmd.env("DOCMAP_TS_DIR", g);
    }
    no_window(&mut cmd);

    let out = cmd
        .output()
        .map_err(|e| format!("could not run {engine}: {e}"))?;
    if !out.status.success() {
        return Err(format!(
            "engine exited {}: {}",
            out.status.code().unwrap_or(-1),
            String::from_utf8_lossy(&out.stderr).trim()
        ));
    }

    let body = String::from_utf8_lossy(&out.stdout).trim().to_string();
    // Parsed before it is passed on, even though it is forwarded verbatim:
    // the capability check above already rules out the engine that answers
    // an API request with a generation report, and this is the second lock
    // on that same door. Serving prose as `application/json` turns a
    // recognisable failure into a parse error inside the page.
    if serde_json::from_str::<serde_json::Value>(&body).is_err() {
        return Err(format!("engine did not answer {route} with JSON"));
    }
    Ok(body)
}

fn handle(cfg: &ServeConfig, stream: &mut TcpStream) {
    let mut reader = BufReader::new(match stream.try_clone() {
        Ok(s) => s,
        Err(_) => return,
    });
    let mut line = String::new();
    if reader.read_line(&mut line).is_err() {
        return;
    }

    let mut parts = line.split_whitespace();
    let method = parts.next().unwrap_or("");
    let target = parts.next().unwrap_or("/");
    if method != "GET" {
        return respond_json_error(stream, 405, "only GET is served");
    }

    let (path, query) = match target.split_once('?') {
        Some((p, q)) => (p, q),
        None => (target, ""),
    };

    // The page's own "is a docmap server behind this origin" probe. Answering
    // it is what stops the four server-backed panels from reporting the
    // misleading `:DocMap serve` advice described in this module's header.
    if path == "/api/ping" {
        return respond(
            stream,
            200,
            "application/json",
            br#"{"docmap":true}"#.as_slice(),
        );
    }

    if let Some(name) = path.strip_prefix("/api/") {
        // `commit/<sha>` first, same reason `core.api.answer` checks it
        // before its own fixed route table: the sha varies, so it cannot
        // be a `ROUTES` entry, and it needs its own validation rather than
        // falling through to the "no such endpoint" branch below.
        if let Some(sha) = name.strip_prefix("commit/") {
            if !safe_sha(sha) {
                return respond_json_error(stream, 400, "not a commit hash");
            }
            return match engine_api(cfg, name, None) {
                Ok(body) => respond(stream, 200, "application/json", body.as_bytes()),
                Err(e) => respond_json_error(stream, 500, &e),
            };
        }

        if !ROUTES.contains(&name) {
            // Deliberately not echoed back: refusing to repeat an
            // unvalidated value is free, and this is the input that would
            // otherwise reach a subprocess.
            return respond_json_error(stream, 404, "no such endpoint");
        }
        // `snapshot=` (telemetry/loaded) and `n=` (commits) never both
        // apply to the same route, mirroring `editor/serve.lua`'s own
        // `respond_api` — trying both and taking whichever is present
        // needs no per-route branch here either.
        let param = query
            .split('&')
            .find_map(|kv| kv.strip_prefix("snapshot="))
            .or_else(|| query.split('&').find_map(|kv| kv.strip_prefix("n=")));
        return match engine_api(cfg, name, param) {
            // Passed through verbatim: the engine already produced the exact
            // JSON the page expects, including its `available:false` +
            // `reason` shape for "nothing to show". Re-encoding it here would
            // add a second opinion about a contract that already has one.
            Ok(body) => respond(stream, 200, "application/json", body.as_bytes()),
            Err(e) => respond_json_error(stream, 500, &e),
        };
    }

    let requested = path.trim_start_matches('/');
    let Some(name) = safe_static_name(requested) else {
        return respond_json_error(stream, 400, "bad path");
    };
    let file = PathBuf::from(&cfg.map_dir).join(name);
    match std::fs::read(&file) {
        Ok(body) => respond(stream, 200, content_type(name), &body),
        Err(_) => respond_json_error(stream, 404, "not found"),
    }
}

/// Start serving `cfg`, returning the port.
///
/// Idempotent per project, and restarting when the project changes — the
/// same rule `editor/serve.lua` arrived at after a real bug: a server that
/// keeps answering for the previously selected repository does not look like
/// the wrong tree, it looks like a broken map.
pub fn start(cfg: ServeConfig) -> Result<u16, String> {
    let mut current = CURRENT.lock().map_err(|_| "server lock poisoned")?;
    if let Some(running) = current.as_ref() {
        if running.root == cfg.root {
            return Ok(running.port);
        }
    }

    // Port 0: the OS picks a free one. A hardcoded port would collide with
    // something eventually, and a retry loop looking for a free one is the
    // same thing done worse.
    let addr = SocketAddr::from((Ipv4Addr::LOCALHOST, 0));
    let listener = TcpListener::bind(addr).map_err(|e| format!("bind failed: {e}"))?;
    let port = listener
        .local_addr()
        .map_err(|e| format!("no local address: {e}"))?
        .port();

    let shared = Arc::new(cfg.clone());
    std::thread::spawn(move || {
        for stream in listener.incoming() {
            let Ok(mut stream) = stream else { continue };
            let cfg = Arc::clone(&shared);
            // One thread per connection: `Connection: close`, a handful of
            // requests per project, and an engine call that takes real time
            // and must not block the next request behind it.
            std::thread::spawn(move || handle(&cfg, &mut stream));
        }
    });

    *current = Some(Server {
        port,
        root: cfg.root.clone(),
    });
    Ok(port)
}

/// Where a served project's page lives.
pub fn url(port: u16) -> String {
    format!("http://127.0.0.1:{port}/")
}

#[cfg(test)]
mod tests {
    use super::safe_sha;

    // The one function here worth a real test even in a crate with no
    // CI: it is the whole security property standing between a request
    // path and a subprocess argument, and `documentation.core.api`'s own
    // `safe_sha`'s doc comment says exactly why that kind of function does
    // not get tested unless something actually exercises it — this is
    // that something, for the Rust half.
    #[test]
    fn accepts_real_shas() {
        assert!(safe_sha("abc1234"));
        assert!(safe_sha(&"a".repeat(40)));
        assert!(safe_sha("ABC1234"));
    }

    #[test]
    fn refuses_shapes_that_are_not_a_sha() {
        assert!(!safe_sha("abc123")); // 6 chars, one short of the 7 minimum
        assert!(!safe_sha(&"a".repeat(41))); // one over the 40 maximum
        assert!(!safe_sha("")); // empty
        assert!(!safe_sha("HEAD")); // a real revision, but not this route's shape
        assert!(!safe_sha("g1234567")); // 'g' is not a hex digit
    }

    #[test]
    fn refuses_injection_shaped_input() {
        // The exact class of value `safe_sha` exists to keep away from a
        // subprocess argument.
        assert!(!safe_sha("abc1234; rm -rf /"));
        assert!(!safe_sha("abc1234 --upload-pack=evil"));
        assert!(!safe_sha("abc1234\" & calc.exe & \""));
    }
}
