// Preview-only Tauri bridge stub. NOT part of the app — used to look at the
// real markup and CSS in a browser. Data below is real: the language list is
// `lang_registry.report()` from documentation.nvim at 5d2b98d.
const LANGS = [
  {"grammar":"lua","name":"lua","grammar_loaded":true,"calls":true},
  {"grammar":"javascript","name":"js","grammar_loaded":false,"calls":true},
  {"grammar":"typescript","name":"ts","grammar_loaded":false,"calls":true},
  {"grammar":"tsx","name":"tsx","grammar_loaded":false,"calls":true},
  {"grammar":"zig","name":"zig","grammar_loaded":false,"calls":false},
  {"grammar":"java","name":"java","grammar_loaded":false,"calls":false},
  {"grammar":"c","name":"c","grammar_loaded":true,"calls":false},
  {"grammar":"cpp","name":"cpp","grammar_loaded":false,"calls":false},
  {"name":"asm","calls":false},
  {"grammar":"python","name":"python","grammar_loaded":false,"calls":false},
  {"grammar":"c_sharp","name":"csharp","grammar_loaded":false,"calls":false},
  {"grammar":"go","name":"go","grammar_loaded":false,"calls":false},
  {"grammar":"rust","name":"rust","grammar_loaded":true,"calls":false},
  {"grammar":"php","name":"php","grammar_loaded":false,"calls":false},
  {"grammar":"ruby","name":"ruby","grammar_loaded":false,"calls":false},
  {"grammar":"kotlin","name":"kotlin","grammar_loaded":false,"calls":false},
  {"grammar":"swift","name":"swift","grammar_loaded":false,"calls":false},
  {"grammar":"dart","name":"dart","grammar_loaded":false,"calls":false},
  {"grammar":"scala","name":"scala","grammar_loaded":false,"calls":false},
  {"grammar":"haskell","name":"haskell","grammar_loaded":false,"calls":false},
  {"grammar":"elixir","name":"elixir","grammar_loaded":false,"calls":false},
  {"grammar":"erlang","name":"erlang","grammar_loaded":false,"calls":false},
  {"grammar":"ocaml","name":"ocaml","grammar_loaded":false,"calls":false}
];

// The first two are the shapes this harness has always used: one ordinary
// project and one name long enough to find a layout that cannot hold it.
//
// The rest exist for the workspace overview, and their numbers are measured
// rather than invented -- `schema`, the module and file counts and the
// staleness below are what these repositories actually reported on
// 2026-08-21, when 27 of 30 generated maps in that tree were three artifact
// versions behind the engine. A preview of a ranked list is worth nothing if
// every row ranks the same, and a corpus where they legitimately differ is
// the thing that was hardest to imagine and easiest to read off a disk.
const PROJECTS = [
  { id: "p1", name: "documentation.nvim", root: "E:/repos/documentation.nvim",
    map_dir: "E:/repos/documentation.nvim/docs/map", exclude: [], languages: null },
  { id: "p2", name: "a-monorepo-with-a-very-long-name", root: "E:/repos/mono",
    map_dir: "E:/repos/mono/docs/map", exclude: ["vendor", "third_party/grpc"],
    languages: ["go", "python"] },
  { id: "p3", name: "lib.nvim", root: "E:/repos/lib.nvim",
    map_dir: "E:/repos/lib.nvim/docs/map", exclude: [], languages: null },
  { id: "p4", name: "sandbox.nvim", root: "E:/repos/sandbox.nvim",
    map_dir: "E:/repos/sandbox.nvim/docs/map", exclude: [], languages: null },
  { id: "p5", name: "runtime-analysis.nvim", root: "E:/repos/runtime-analysis.nvim",
    map_dir: "E:/repos/runtime-analysis.nvim/docs/map", exclude: [], languages: null },
  { id: "p6", name: "debugging.nvim", root: "E:/repos/debugging.nvim",
    map_dir: "E:/repos/debugging.nvim/docs/map", exclude: [], languages: null },
  { id: "p7", name: "docmap-desktop", root: "E:/repos/docmap-desktop",
    map_dir: "E:/repos/docmap-desktop/docs/map", exclude: [], languages: null },
  { id: "p8", name: "reposcope.nvim", root: "E:/repos/reposcope.nvim",
    map_dir: "E:/repos/reposcope.nvim/docs/map", exclude: [], languages: null }
];

/** Per-project `map_status` and `map_freshness`, keyed by id. */
const STATE = {
  p1: { st: { modules: 5, files: 120, namespaces: 6, schema: 5 }, fr: { stale: false } },
  p2: { st: { modules: 142, files: 210, namespaces: 12, schema: 3 },
        fr: { stale: true, behind_secs: 7200, newest: "services/api/main.go", truncated: true } },
  p3: { st: { modules: 124, files: 124, namespaces: 24, schema: 2 },
        fr: { stale: true, behind_secs: 432000, newest: "lua/lib/nvim/cross/fs/separators/normalize/init.lua" } },
  p4: { st: { modules: 3, files: 263, namespaces: 43, schema: 2 },
        fr: { stale: true, behind_secs: 207360, newest: ".gitignore" } },
  p5: { st: { modules: 3, files: 35, namespaces: 2, schema: 5 }, fr: { stale: false } },
  p6: { st: { modules: 8, files: 21, namespaces: 7, schema: 3 },
        fr: { stale: true, behind_secs: 3600, newest: "lua/debugging/init.lua" } },
  p7: { st: null, fr: { has_map: false } },
  p8: { st: { modules: 5, files: 96, namespaces: 26, schema: 2 },
        fr: { stale: true, behind_secs: 216000, newest: "doc/reposcope.txt" } }
};

/** The id whose `map_dir` this is -- `map_status` is asked by directory. */
function idForDir(dir) {
  const hit = PROJECTS.find((p) => p.map_dir === dir);
  return hit ? hit.id : "p1";
}

let ACTIVE = "Default";
const WORKSPACES = [{ name: "Default", projects: 8 }, { name: "Work", projects: 2 }];

const SCOPES = {
  p1: { exclude: [], languages: null },
  p2: { exclude: ["vendor", "third_party/grpc"], languages: ["go", "python"] }
};

const R = {
  list_projects: () => PROJECTS,
  list_workspaces: () => WORKSPACES.map((w) => ({ ...w, active: w.name === ACTIVE })),
  switch_workspace: (a) => {
    ACTIVE = a.name;
    if (!WORKSPACES.some((w) => w.name === ACTIVE)) WORKSPACES.push({ name: ACTIVE, projects: 0 });
    return PROJECTS;
  },
  engine_info: () => ({ path: "C:/tools/docmap.exe", from_path: false, bundled: false,
                        grammars: "C:/tools/docmap-grammars" }),
  engine_languages: () => ({ languages: LANGS, schema: 3,
                             build: { commit: "5d2b98d", committed_at: "2026-08-20", clean: true } }),
  nvim_info: () => ({ path: "C:/Program Files/Neovim/bin/nvim.exe", from_path: true,
                      config_dir: "C:/Users/bartl/AppData/Local/nvim", config_dir_from_default: true }),
  map_status: (a) => {
    const st = STATE[idForDir(a && a.mapDir)].st;
    return st
      ? { exists: true, index_path: "E:/repos/documentation.nvim/docs/map/index.html", ...st }
      : { exists: false, index_path: "" };
  },
  map_freshness: (a) => {
    const fr = STATE[(a && a.id) in STATE ? a.id : "p1"].fr;
    return { has_map: true, stale: false, truncated: false, ...fr };
  },
  scan_languages: (a) => (String(a.root).includes("mono")
    ? { total: 210, truncated: false, languages: [
        { name: "Go", files: 150, grammar: "go", backend: null },
        { name: "Python", files: 60, grammar: "python", backend: null }] }
    : { total: 160, truncated: false, languages: [
        { name: "Lua", files: 142, grammar: "lua", backend: null },
        { name: "JavaScript", files: 12, grammar: "javascript", backend: null },
        { name: "Rust", files: 6, grammar: "rust", backend: null }] }),
  project_scope_get: (a) => SCOPES[a.id] ?? { exclude: [], languages: null },
  grammar_dir: () => ({
    dir: "C:/tools/docmap-grammars",
    from_setting: true,
    exists: true,
    files: ["javascript.dll", "lua.dll", "tsx.dll", "typescript.dll"],
    more: 0
  }),
  project_scope_set: () => null,
  telemetry_info: () => ({ enabled: false }),
  about_info: () => ({ app: "docmap-desktop", version: "0.1.0" }),
  project_icon: () => null,
  editor_command: () => "nvim",
  file_tree: () => ({ name: "root", children: [] })
};

window.__stubListeners = {};
window.__stubEmit = (name, payload) => {
  for (const cb of window.__stubListeners[name] || []) cb({ payload });
};
window.__TAURI__ = {
  core: {
    invoke: async (cmd, args) => {
      if (R[cmd]) return R[cmd](args || {});
      console.warn("[stub] unhandled command:", cmd, args);
      return null;
    },
    convertFileSrc: (p) => p
  },
  dialog: { open: async () => null, save: async () => null },
  event: {
    listen: async (name, cb) => {
      (window.__stubListeners[name] ||= []).push(cb);
      return () => {};
    }
  }
};
