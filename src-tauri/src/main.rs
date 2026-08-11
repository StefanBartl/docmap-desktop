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
#[derive(Debug, Default, Serialize, Deserialize)]
struct Workspace {
    projects: Vec<Project>,
    #[serde(default)]
    engine: Option<String>,
    #[serde(default)]
    grammars: Option<String>,
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
            map_status,
            engine_info,
            set_engine,
            set_grammars,
            generate
        ])
        .run(tauri::generate_context!())
        .expect("docmap-desktop failed to start");
}
