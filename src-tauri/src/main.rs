// docmap-desktop — a project list and a window, in front of maps that
// something else generated.
//
// The whole backend is deliberately small. This program does not analyse
// anything and does not render anything: `documentation.nvim`'s standalone
// binary produces the map, and the map is a self-contained HTML page that
// renders itself. What is left for Rust is the part neither can do — remember
// which projects exist, and answer where a project's map lives on disk.

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::fs;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};
use tauri::Manager;

/// One entry in the sidebar.
///
/// `map_dir` is stored rather than derived so a project whose map lives
/// somewhere other than `docs/map` is representable later without a
/// migration. `id` is the absolute root path: two projects are the same
/// project exactly when they are the same directory, which is a truth the
/// filesystem already owns and this program should not invent a second answer
/// for.
#[derive(Debug, Clone, Serialize, Deserialize)]
struct Project {
    id: String,
    name: String,
    root: String,
    map_dir: String,
}

/// Settings live beside the project list rather than in a second file: there
/// is one workspace, and splitting it would mean two things to keep in step.
///
/// `engine` is a path to `documentation.nvim`'s standalone binary. Not
/// bundled yet, and that is the open question this slice deliberately does
/// not answer — shipping it per platform is the better experience and the
/// larger release problem. Until then: found on `PATH`, or pointed at.
///
/// `grammars` is optional and decides fidelity, not success. With a
/// directory of compiled tree-sitter grammars the engine produces
/// function-level data; without one it still produces a complete module
/// tree and says so. Passing it through as `DOCMAP_TS_DIR` is the whole
/// integration.
///
/// `nvim_path`/`nvim_config_dir` back the spec-import feature: not every
/// machine has the same Neovim config in the same place, so both are
/// configurable the same way `engine`/`grammars` are, rather than assumed.
#[derive(Debug, Default, Serialize, Deserialize)]
struct Workspace {
    projects: Vec<Project>,
    #[serde(default)]
    engine: Option<String>,
    #[serde(default)]
    grammars: Option<String>,
    #[serde(default)]
    nvim_path: Option<String>,
    #[serde(default)]
    nvim_config_dir: Option<String>,
}

/// Where the project list lives.
///
/// `app_config_dir` rather than a file beside the executable: an installed
/// app has no business writing into Program Files, and a portable copy on a
/// USB stick should still find the same list on the same machine.
fn workspace_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_config_dir()
        .map_err(|e| format!("no config directory: {e}"))?;
    fs::create_dir_all(&dir).map_err(|e| format!("cannot create {}: {e}", dir.display()))?;
    Ok(dir.join("workspace.json"))
}

fn read_workspace(app: &tauri::AppHandle) -> Result<Workspace, String> {
    let path = workspace_path(app)?;
    match fs::read_to_string(&path) {
        Ok(body) => serde_json::from_str(&body)
            .map_err(|e| format!("{} is not readable as a workspace: {e}", path.display())),
        // A missing file is the first-run case, not an error. An empty
        // workspace is exactly what a first run should see.
        Err(ref e) if e.kind() == std::io::ErrorKind::NotFound => Ok(Workspace::default()),
        Err(e) => Err(format!("cannot read {}: {e}", path.display())),
    }
}

fn write_workspace(app: &tauri::AppHandle, ws: &Workspace) -> Result<(), String> {
    let path = workspace_path(app)?;
    let body = serde_json::to_string_pretty(ws).map_err(|e| format!("cannot serialise: {e}"))?;
    fs::write(&path, body).map_err(|e| format!("cannot write {}: {e}", path.display()))
}

#[tauri::command]
fn list_projects(app: tauri::AppHandle) -> Result<Vec<Project>, String> {
    Ok(read_workspace(&app)?.projects)
}

/// Add a directory to the workspace.
///
/// Does **not** require the project to have a map yet: reporting "no map here"
/// in the view is more useful than refusing to add the project, and
/// generating one is the next slice's job. What it does refuse is a path that
/// is not a directory, because that is a mistake rather than a state.
#[tauri::command]
fn add_project(app: tauri::AppHandle, root: String) -> Result<Vec<Project>, String> {
    let root_path = Path::new(&root);
    if !root_path.is_dir() {
        return Err(format!("{root} is not a directory"));
    }
    let canonical = fs::canonicalize(root_path)
        .map_err(|e| format!("cannot resolve {root}: {e}"))?
        .to_string_lossy()
        // Windows' canonicalize returns a \\?\ prefixed path; it is correct
        // and unreadable, and it leaks into every label and error message.
        .trim_start_matches(r"\\?\")
        .replace('\\', "/");

    let name = root_path
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| canonical.clone());

    let mut ws = read_workspace(&app)?;
    // Adding the same directory twice is a no-op rather than an error: the
    // user's intent ("I want this project in the list") is already satisfied,
    // and a dialog saying so would be noise.
    if !ws.projects.iter().any(|p| p.id == canonical) {
        ws.projects.push(Project {
            id: canonical.clone(),
            name,
            root: canonical.clone(),
            map_dir: format!("{canonical}/docs/map"),
        });
        ws.projects.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
        write_workspace(&app, &ws)?;
    }
    Ok(ws.projects)
}

#[tauri::command]
fn remove_project(app: tauri::AppHandle, id: String) -> Result<Vec<Project>, String> {
    let mut ws = read_workspace(&app)?;
    ws.projects.retain(|p| p.id != id);
    write_workspace(&app, &ws)?;
    Ok(ws.projects)
}

/// Where cloned repositories land. A subdirectory of the same app-config
/// directory `workspace.json` lives in, not the system temp dir: a clone
/// this app made is something to keep and reopen, not scratch space.
fn repos_cache_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_config_dir()
        .map_err(|e| format!("no config directory: {e}"))?
        .join("repos");
    fs::create_dir_all(&dir).map_err(|e| format!("cannot create {}: {e}", dir.display()))?;
    Ok(dir)
}

/// The directory name a clone of `url` should land in: the URL's last path
/// segment, minus a trailing `.git`. Not validated beyond that — git itself
/// is the authority on whether `url` is actually clonable.
fn repo_dir_name(url: &str) -> Option<String> {
    let trimmed = url.trim_end_matches('/');
    let last = trimmed.rsplit(['/', ':']).next()?;
    let name = last.strip_suffix(".git").unwrap_or(last);
    if name.is_empty() { None } else { Some(name.to_string()) }
}

/// Clone a repository into the cache directory and add it as a project.
///
/// `git clone` via a plain subprocess, the same way `generate` and
/// `import_from_nvim_config` shell out to their own subprocess: this
/// program does not speak git itself, and does not touch credentials
/// either — whatever authentication the URL needs (an HTTPS credential
/// helper, an SSH agent) is exactly what a user's own `git clone` in a
/// terminal would use, unchanged. A failure surfaces git's own stderr
/// rather than a guess at what went wrong.
///
/// `--depth 1`: this app only ever reads a project's current working tree
/// (map generation, `add_project`), never its history, and a shallow clone
/// is materially smaller — the "Größe" failure mode this feature was kept
/// separate from folder-adding specifically to isolate.
///
/// Cloning into an already-populated destination is a no-op, same
/// reasoning as `add_project`'s own duplicate check: re-entering a URL
/// that was already imported should not be an error.
#[tauri::command]
async fn import_from_url(app: tauri::AppHandle, url: String) -> Result<Vec<Project>, String> {
    let name = repo_dir_name(&url).ok_or_else(|| format!("could not derive a folder name from {url}"))?;
    let dest = repos_cache_dir(&app)?.join(&name);

    if dest.is_dir() {
        return add_project(app, dest.to_string_lossy().replace('\\', "/"));
    }

    let dest_str = dest.to_string_lossy().replace('\\', "/");
    let url_owned = url.clone();
    let dest_for_cleanup = dest.clone();
    let out = tauri::async_runtime::spawn_blocking(move || {
        let mut cmd = std::process::Command::new("git");
        cmd.args(["clone", "--depth", "1", &url_owned, &dest_str]);
        #[cfg(windows)]
        {
            use std::os::windows::process::CommandExt;
            const CREATE_NO_WINDOW: u32 = 0x0800_0000;
            cmd.creation_flags(CREATE_NO_WINDOW);
        }
        cmd.output().map_err(|e| format!("could not run git: {e}"))
    })
    .await
    .map_err(|e| format!("clone task failed: {e}"))??;

    if !out.status.success() {
        // A partial clone would otherwise permanently occupy `dest`, so
        // every retry after a failure would hit "directory already exists"
        // instead of trying again.
        let _ = fs::remove_dir_all(&dest_for_cleanup);
        return Err(format!("git clone failed: {}", String::from_utf8_lossy(&out.stderr).trim()));
    }

    add_project(app, dest.to_string_lossy().replace('\\', "/"))
}

/// What the view needs to know before it tries to show anything.
#[derive(Debug, Serialize)]
struct MapStatus {
    exists: bool,
    index_path: String,
    /// Present only when the map exists — the counts the sidebar shows so a
    /// project is identifiable without opening it.
    modules: Option<u64>,
    files: Option<u64>,
}

/// Does this project have a generated map, and what is in it?
///
/// Reads `module_map.json` rather than parsing the HTML: the JSON is the
/// artifact with a stated contract (`meta.counts`), the HTML is a rendering
/// of it. Reading the rendering to recover the data it was rendered from is
/// the kind of shortcut that breaks the first time the page changes.
#[tauri::command]
fn map_status(map_dir: String) -> MapStatus {
    let index = format!("{map_dir}/index.html");
    let exists = Path::new(&index).is_file();
    let mut modules = None;
    let mut files = None;

    if exists {
        if let Ok(body) = fs::read_to_string(format!("{map_dir}/module_map.json")) {
            if let Ok(v) = serde_json::from_str::<serde_json::Value>(&body) {
                let counts = &v["meta"]["counts"];
                modules = counts["module"].as_u64();
                files = counts["file"].as_u64();
            }
        }
    }

    MapStatus { exists, index_path: index, modules, files }
}

/// Look for the engine on `PATH`, the way a shell would.
///
/// Written out rather than shelling to `where`/`which`: one fewer subprocess,
/// and the answer is a path this program then has to hold anyway.
fn engine_on_path() -> Option<String> {
    let names: &[&str] = if cfg!(windows) {
        &["docmap.exe", "docmap"]
    } else {
        &["docmap"]
    };
    let path = std::env::var_os("PATH")?;
    for dir in std::env::split_paths(&path) {
        for name in names {
            let candidate = dir.join(name);
            if candidate.is_file() {
                return Some(candidate.to_string_lossy().replace('\\', "/"));
            }
        }
    }
    None
}

#[derive(Debug, Serialize)]
struct EngineInfo {
    /// The configured path, or one found on PATH, or none.
    path: Option<String>,
    /// True when it came from PATH rather than from a setting — worth showing,
    /// because it explains why it might disappear on another machine.
    from_path: bool,
    grammars: Option<String>,
}

#[tauri::command]
fn engine_info(app: tauri::AppHandle) -> Result<EngineInfo, String> {
    let ws = read_workspace(&app)?;
    if let Some(p) = ws.engine.clone() {
        if Path::new(&p).is_file() {
            return Ok(EngineInfo { path: Some(p), from_path: false, grammars: ws.grammars });
        }
        // A configured path that no longer exists is worse than none: it
        // would fail at generation time with a confusing OS error. Fall
        // through to detection and let the caller see `from_path`.
    }
    Ok(EngineInfo { path: engine_on_path(), from_path: true, grammars: ws.grammars })
}

#[tauri::command]
fn set_engine(app: tauri::AppHandle, path: Option<String>) -> Result<EngineInfo, String> {
    let mut ws = read_workspace(&app)?;
    if let Some(ref p) = path {
        if !Path::new(p).is_file() {
            return Err(format!("{p} is not a file"));
        }
    }
    ws.engine = path;
    write_workspace(&app, &ws)?;
    engine_info(app)
}

#[tauri::command]
fn set_grammars(app: tauri::AppHandle, path: Option<String>) -> Result<EngineInfo, String> {
    let mut ws = read_workspace(&app)?;
    if let Some(ref p) = path {
        if !Path::new(p).is_dir() {
            return Err(format!("{p} is not a directory"));
        }
    }
    ws.grammars = path;
    write_workspace(&app, &ws)?;
    engine_info(app)
}

/// Look for `nvim` on `PATH`, the same way `engine_on_path` looks for the
/// docmap engine.
fn nvim_on_path() -> Option<String> {
    let names: &[&str] = if cfg!(windows) { &["nvim.exe", "nvim"] } else { &["nvim"] };
    let path = std::env::var_os("PATH")?;
    for dir in std::env::split_paths(&path) {
        for name in names {
            let candidate = dir.join(name);
            if candidate.is_file() {
                return Some(candidate.to_string_lossy().replace('\\', "/"));
            }
        }
    }
    None
}

/// The one place Neovim itself would look by default on this OS — not a
/// search, just the conventional location, so a first run usually needs no
/// manual configuration at all. Only returned when it actually exists;
/// a configured path always wins over this guess.
fn default_nvim_config_dir() -> Option<String> {
    let guess = if cfg!(windows) {
        std::env::var_os("LOCALAPPDATA").map(|d| Path::new(&d).join("nvim"))
    } else {
        std::env::var_os("HOME").map(|d| Path::new(&d).join(".config/nvim"))
    }?;
    if guess.is_dir() {
        Some(guess.to_string_lossy().replace('\\', "/"))
    } else {
        None
    }
}

#[derive(Debug, Serialize)]
struct NvimInfo {
    /// The configured `nvim` binary, or one found on PATH, or none.
    path: Option<String>,
    from_path: bool,
    /// The configured Neovim config directory, or the platform default if
    /// that default actually exists on disk, or none.
    config_dir: Option<String>,
    config_dir_from_default: bool,
}

#[tauri::command]
fn nvim_info(app: tauri::AppHandle) -> Result<NvimInfo, String> {
    let ws = read_workspace(&app)?;

    let (path, from_path) = match ws.nvim_path.clone() {
        Some(p) if Path::new(&p).is_file() => (Some(p), false),
        // A configured path that no longer exists falls back to detection,
        // same reasoning as `engine_info`.
        _ => (nvim_on_path(), true),
    };

    let (config_dir, config_dir_from_default) = match ws.nvim_config_dir.clone() {
        Some(p) if Path::new(&p).is_dir() => (Some(p), false),
        _ => (default_nvim_config_dir(), true),
    };

    Ok(NvimInfo { path, from_path, config_dir, config_dir_from_default })
}

#[tauri::command]
fn set_nvim_path(app: tauri::AppHandle, path: Option<String>) -> Result<NvimInfo, String> {
    let mut ws = read_workspace(&app)?;
    if let Some(ref p) = path {
        if !Path::new(p).is_file() {
            return Err(format!("{p} is not a file"));
        }
    }
    ws.nvim_path = path;
    write_workspace(&app, &ws)?;
    nvim_info(app)
}

#[tauri::command]
fn set_nvim_config_dir(app: tauri::AppHandle, path: Option<String>) -> Result<NvimInfo, String> {
    let mut ws = read_workspace(&app)?;
    if let Some(ref p) = path {
        if !Path::new(p).is_dir() {
            return Err(format!("{p} is not a directory"));
        }
    }
    ws.nvim_config_dir = path;
    write_workspace(&app, &ws)?;
    nvim_info(app)
}

/// One entry in `scripts/docmap_projects.lua`'s own JSON contract (nvim
/// config repo) — see that script's header for the full shape guarantee.
#[derive(Debug, Deserialize)]
struct NvimProjectEntry {
    name: String,
    #[allow(dead_code)]
    repo: String,
    dir: String,
}

#[derive(Debug, Serialize)]
struct ImportResult {
    /// How many entries the Neovim export returned, before dedup.
    found: usize,
    /// Newly added projects only — not ones that were already present.
    added: Vec<Project>,
    already_present: usize,
    /// One line per entry that failed to add, name-prefixed.
    errors: Vec<String>,
}

/// Import every enabled, locally-checked-out personal plugin from the
/// user's Neovim configuration.
///
/// Delegates entirely to `plugins.personal.export.projects()` (nvim config,
/// `lua/plugins/personal/export.lua`) via the headless entry point
/// `scripts/docmap_projects.lua` — this program never parses
/// `source.lua`'s own policy table itself, which would be brittle in a way
/// neither side should have to maintain. Must invoke with `-c "luafile
/// ..." -c "qa"`, not `-l`: measured, not assumed — `-l` is a bare
/// Lua-script runner that skips `init.lua` and lazy.nvim's bootstrap
/// entirely, so it cannot see this config's real, fully-resolved plugin
/// policy. See that script's own header for the full story.
///
/// `async` + `spawn_blocking`, same reasoning as `generate`: a real Neovim
/// startup takes real time, and a command that blocks freezes the window
/// it was invoked from.
#[tauri::command]
async fn import_from_nvim_config(app: tauri::AppHandle) -> Result<ImportResult, String> {
    let info = nvim_info(app.clone())?;
    let nvim_path = info.path.ok_or_else(|| {
        "No nvim binary configured. Put it on PATH, or point at it in the sidebar.".to_string()
    })?;
    let config_dir = info.config_dir.ok_or_else(|| {
        "No Neovim config directory configured, and none found at the default location."
            .to_string()
    })?;

    // Absolute path to the script rather than a relative one plus a
    // matching cwd: one fewer thing that can silently point at the wrong
    // directory.
    let script = format!("{config_dir}/scripts/docmap_projects.lua");
    if !Path::new(&script).is_file() {
        return Err(format!(
            "{script} does not exist. It ships with the nvim config's own \
             plugins.personal.export -- see that repo's docs/HANDOVER.md."
        ));
    }

    let out = tauri::async_runtime::spawn_blocking(move || {
        let mut cmd = std::process::Command::new(&nvim_path);
        cmd.args(["--headless", "-c", &format!("luafile {script}"), "-c", "qa"]);
        #[cfg(windows)]
        {
            use std::os::windows::process::CommandExt;
            const CREATE_NO_WINDOW: u32 = 0x0800_0000;
            cmd.creation_flags(CREATE_NO_WINDOW);
        }
        cmd.output().map_err(|e| format!("could not run {nvim_path}: {e}"))
    })
    .await
    .map_err(|e| format!("import task failed: {e}"))??;

    if !out.status.success() {
        return Err(format!(
            "nvim exited with code {}: {}",
            out.status.code().unwrap_or(-1),
            String::from_utf8_lossy(&out.stderr).trim()
        ));
    }

    let stdout = String::from_utf8_lossy(&out.stdout);
    let found: Vec<NvimProjectEntry> = serde_json::from_str(stdout.trim()).map_err(|e| {
        format!("could not parse nvim's output as JSON: {e}\noutput was: {stdout}")
    })?;

    let existing_ids: std::collections::HashSet<String> =
        read_workspace(&app)?.projects.iter().map(|p| p.id.clone()).collect();
    let mut seen_ids = existing_ids;
    let mut added = Vec::new();
    let mut already_present = 0usize;
    let mut errors = Vec::new();

    for entry in &found {
        match add_project(app.clone(), entry.dir.clone()) {
            Ok(projects) => {
                // Identify the one just added by which id is new, not by
                // matching `entry.dir` against `root`: the Rust side
                // normalises separators, so the string that went in is not
                // always the string that comes back.
                match projects.iter().find(|p| !seen_ids.contains(&p.id)) {
                    Some(proj) => {
                        seen_ids.insert(proj.id.clone());
                        added.push(proj.clone());
                    }
                    None => already_present += 1,
                }
            }
            Err(e) => errors.push(format!("{}: {e}", entry.name)),
        }
    }

    Ok(ImportResult { found: found.len(), added, already_present, errors })
}

#[derive(Debug, Serialize)]
struct GenerateResult {
    ok: bool,
    code: i32,
    stdout: String,
    stderr: String,
}

/// Run the engine over one project.
///
/// `async` plus `spawn_blocking`, not a plain synchronous command: this takes
/// seconds on a large tree, and a Tauri command that blocks freezes the
/// window it was invoked from. A viewer that stops repainting while it works
/// looks broken in exactly the way the work is meant to prevent.
///
/// Output is returned whole rather than streamed. The engine's own report is
/// a dozen lines at the end, not a running log, so streaming would add a
/// channel and a subscription for something that arrives at once anyway.
#[tauri::command]
async fn generate(app: tauri::AppHandle, root: String) -> Result<GenerateResult, String> {
    let info = engine_info(app)?;
    let engine = info.path.ok_or_else(|| {
        "No docmap engine configured. It is documentation.nvim's standalone binary —          put it on PATH, or point at it in the sidebar."
            .to_string()
    })?;

    tauri::async_runtime::spawn_blocking(move || {
        let mut cmd = std::process::Command::new(&engine);
        // Just the root: the engine detects `source` itself, verified against
        // three unrelated repositories. Passing a guess would be worse than
        // letting it look.
        cmd.arg(&root);
        if let Some(g) = info.grammars {
            cmd.env("DOCMAP_TS_DIR", g);
        }
        #[cfg(windows)]
        {
            // Without this a console window flashes up on every generation.
            use std::os::windows::process::CommandExt;
            const CREATE_NO_WINDOW: u32 = 0x0800_0000;
            cmd.creation_flags(CREATE_NO_WINDOW);
        }
        let out = cmd
            .output()
            .map_err(|e| format!("could not run {engine}: {e}"))?;
        Ok(GenerateResult {
            ok: out.status.success(),
            code: out.status.code().unwrap_or(-1),
            stdout: String::from_utf8_lossy(&out.stdout).to_string(),
            stderr: String::from_utf8_lossy(&out.stderr).to_string(),
        })
    })
    .await
    .map_err(|e| format!("generation task failed: {e}"))?
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            list_projects,
            add_project,
            remove_project,
            import_from_url,
            map_status,
            engine_info,
            set_engine,
            set_grammars,
            generate,
            nvim_info,
            set_nvim_path,
            set_nvim_config_dir,
            import_from_nvim_config
        ])
        .run(tauri::generate_context!())
        .expect("docmap-desktop failed to start");
}
