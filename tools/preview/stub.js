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

const PROJECTS = [
  { id: "p1", name: "documentation.nvim", root: "E:/repos/documentation.nvim",
    map_dir: "E:/repos/documentation.nvim/docs/map", exclude: [], languages: null },
  { id: "p2", name: "a-monorepo-with-a-very-long-name", root: "E:/repos/mono",
    map_dir: "E:/repos/mono/docs/map", exclude: ["vendor", "third_party/grpc"],
    languages: ["go", "python"] }
];

const SCOPES = {
  p1: { exclude: [], languages: null },
  p2: { exclude: ["vendor", "third_party/grpc"], languages: ["go", "python"] }
};

const R = {
  list_projects: () => PROJECTS,
  list_workspaces: () => [{ id: "default", name: "Default", current: true, projects: 2 }],
  engine_info: () => ({ path: "C:/tools/docmap.exe", from_path: false, bundled: false,
                        grammars: "C:/tools/docmap-grammars" }),
  engine_languages: () => ({ languages: LANGS, schema: 3,
                             build: { commit: "5d2b98d", committed_at: "2026-08-20", clean: true } }),
  nvim_info: () => ({ path: "C:/Program Files/Neovim/bin/nvim.exe", from_path: true,
                      config_dir: "C:/Users/bartl/AppData/Local/nvim", config_dir_from_default: true }),
  map_status: () => ({ exists: true, index_path: "E:/repos/documentation.nvim/docs/map/index.html",
                       modules: 142, files: 142, namespaces: 12, schema: 3 }),
  map_freshness: () => ({ has_map: true, stale: true, newest: "lua/documentation/core/scan.lua",
                          behind_secs: 7200, truncated: false }),
  scan_languages: (a) => (String(a.root).includes("mono")
    ? { total: 210, truncated: false, languages: [
        { name: "Go", files: 150, grammar: "go", backend: null },
        { name: "Python", files: 60, grammar: "python", backend: null }] }
    : { total: 160, truncated: false, languages: [
        { name: "Lua", files: 142, grammar: "lua", backend: null },
        { name: "JavaScript", files: 12, grammar: "javascript", backend: null },
        { name: "Rust", files: 6, grammar: "rust", backend: null }] }),
  project_scope_get: (a) => SCOPES[a.id] ?? { exclude: [], languages: null },
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
