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

#[derive(Debug, Default, Serialize, Deserialize)]
struct Workspace {
    projects: Vec<Project>,
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

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            list_projects,
            add_project,
            remove_project,
            map_status
        ])
        .run(tauri::generate_context!())
        .expect("docmap-desktop failed to start");
}
