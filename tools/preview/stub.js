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

// GitHub traffic. The numbers are illustrative; the *shapes* are what
// `traffic.rs` serialises (camelCase fields, snake_case status), and the mix of
// outcomes is the point: one project with fresh data, one whose data is old,
// one the plugin does not track, one with an unreadable digest, one from a
// newer plugin, and the rest with no GitHub remote — which show nothing.
const daysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString();
const metric = (d7, d30, d90, trend) => ({
  d7: { count: d7, uniques: Math.ceil(d7 * 0.6) },
  d30: { count: d30, uniques: Math.ceil(d30 * 0.6) },
  d90: { count: d90, uniques: Math.ceil(d90 * 0.6) },
  trend
});
const okInfo = (repo, fetchedDaysAgo, views, clones) => ({
  status: "ok", repo, message: null, dir: "C:/Users/bartl/AppData/Local/nvim-data/github_stats.nvim/digest",
  via: "root",
  summary: {
    generated: daysAgo(fetchedDaysAgo), fetched: daysAgo(fetchedDaysAgo),
    spanFrom: "2026-06-29", spanTo: "2026-09-23", views, clones, daysKept: 87,
    hasReferrers: true, hasPaths: true
  }
});
const TRAFFIC = {
  p1: okInfo("StefanBartl/documentation.nvim", 1, metric(41, 210, 655, 12.5), metric(19, 88, 300, -3)),
  p3: okInfo("StefanBartl/lib.nvim", 9, metric(2, 17, 60, null), metric(0, 4, 21, null)),
  p4: { status: "not_tracked", repo: "StefanBartl/sandbox.nvim", message: null, summary: null, dir: "x", via: "root" },
  p5: { status: "unreadable", repo: "StefanBartl/runtime-analysis.nvim", message: "not JSON: expected value at line 1 column 1", summary: null, dir: "x", via: "root" },
  p6: { status: "newer_schema", repo: "StefanBartl/debugging.nvim", message: "schema 2, this app understands up to 1", summary: null, dir: "x", via: "root" }
};
const trafficEntry = (id) => {
  const info = TRAFFIC[id] || { status: "no_remote" };
  const s = info.summary;
  return {
    id, status: info.status,
    views7: s ? s.views.d7.count : null, views30: s ? s.views.d30.count : null,
    clones30: s ? s.clones.d30.count : null, trend: s ? s.views.trend : null,
    fetched: s ? s.fetched : null
  };
};
// The detail dialog. Shapes are `traffic.rs`'s `Digest` verbatim -- unlike
// `Summary` above, `Digest`/`PathItem`/`Referrer` carry no `rename_all`, so
// every field here is the Rust name as-is (snake_case where it has one,
// `project_path` included). Two things worth previewing on purpose: a
// referrer name that looks like a markup injection (must render as inert
// text, never parsed), and a `paths` entry with `project_path: null` next
// to ones that resolved, so an unclickable row is visibly different from a
// clickable one.
const dailySeries = (days, base, amplitude) =>
  Array.from({ length: days }, (_, i) => {
    const iso = new Date(Date.now() - (days - 1 - i) * 86400000).toISOString().slice(0, 10);
    const v = Math.max(0, Math.round(base + amplitude * Math.sin(i / 6) + (i % 5) * 4));
    return [iso, v, Math.ceil(v * 0.6)];
  });
const TRAFFIC_DETAIL = {
  p1: {
    schema: 1,
    repo: "StefanBartl/documentation.nvim",
    generated: daysAgo(1),
    fetched: daysAgo(1),
    span: { from: "2026-06-29", to: "2026-09-23" },
    views: metric(41, 210, 655, 12.5),
    clones: metric(19, 88, 300, -3),
    daily: { views: dailySeries(87, 8, 30), clones: dailySeries(87, 3, 10) },
    referrers: [
      { referrer: "github.com", count: 120, uniques: 95 },
      { referrer: "google.com", count: 44, uniques: 40 },
      { referrer: "<img src=x onerror=alert(1)>", count: 3, uniques: 2 },
    ],
    paths: [
      { path: "/StefanBartl/documentation.nvim/blob/main/README.md", title: "README.md", count: 300, uniques: 210, project_path: "README.md" },
      { path: "/StefanBartl/documentation.nvim/blob/main/docs/USAGE.md", title: "docs/USAGE.md", count: 120, uniques: 88, project_path: "docs/USAGE.md" },
      { path: "/StefanBartl/documentation.nvim/blob/main/docs/deleted.md", title: "docs/deleted.md", count: 12, uniques: 9, project_path: null },
    ],
  },
  p3: {
    schema: 1,
    repo: "StefanBartl/lib.nvim",
    generated: daysAgo(9),
    fetched: daysAgo(9),
    span: { from: "2026-07-10", to: "2026-09-15" },
    views: metric(2, 17, 60, null),
    clones: metric(0, 4, 21, null),
    daily: { views: dailySeries(67, 1, 3), clones: [] },
    referrers: [],
    paths: null,
  },
};

const SURVEY = {
  explicit: null, asked: null, defaultDir: "C:/Users/bartl/AppData/Local/nvim-data/github_stats.nvim",
  attempts: [{ via: "root", dir: "C:/Users/bartl/AppData/Local/nvim-data/github_stats.nvim", ok: true, reason: null }],
  found: { via: "root", dir: "C:/Users/bartl/AppData/Local/nvim-data/github_stats.nvim/digest", repos: 6, newest: Math.floor(Date.now() / 1000) - 86400 }
};

const R = {
  traffic_info: (a) => TRAFFIC[a.id] || { status: "no_remote", repo: null, message: null, summary: null, dir: null, via: null },
  traffic_list: (a) => (a.ids || []).map(trafficEntry),
  traffic_detail: (a) => TRAFFIC_DETAIL[a.id] || null,
  traffic_settings: () => SURVEY,
  traffic_set_dir: (a) => ({ ...SURVEY, explicit: a.path || null }),
  traffic_ask_neovim: () => SURVEY,
  traffic_set_hidden: () => null,
  traffic_refresh: () => null,
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
  // Measured, like everything else here: these are the real edges between
  // the projects listed above, on 2026-08-21. The single reverse edge
  // (lib.nvim requiring runtime-analysis.telemetry once) is in deliberately
  // -- a graph where every arrow points the same way hides whether the
  // layout can show one that does not.
  workspace_deps: () => ({
    edges: [
      { from: "p6", to: "p3", count: 57,
        modules: ["lib.nvim.notify", "lib.nvim.window", "lib.nvim.buf_win_tab.buffer_utils",
                  "lib.nvim.cache.memory"] },
      { from: "p1", to: "p3", count: 43,
        modules: ["lib.nvim.fs.read", "lib.nvim.safe_api", "lib.nvim.autocmd"] },
      { from: "p5", to: "p3", count: 43,
        modules: ["lib.nvim.notify", "lib.nvim.autocmd", "lib.nvim.cache.disk"] },
      { from: "p8", to: "p3", count: 30,
        modules: ["lib.nvim.cross.fs.expand_path", "lib.nvim.ui.kit",
                  "lib.nvim.cross.uv.spawn_capture"] },
      { from: "p4", to: "p3", count: 24,
        modules: ["lib.nvim.window", "lib.nvim.ui.kit", "lib.nvim.usercmd.composer"] },
      { from: "p3", to: "p5", count: 1, modules: ["runtime-analysis.telemetry"] }
    ],
    outside: [
      { name: "which-key", count: 21, projects: ["p1"] },
      { name: "telescope.actions", count: 19, projects: ["p1"] },
      { name: "fzf-lua", count: 19, projects: ["p8"] },
      { name: "telescope.actions.state", count: 18, projects: ["p1"] },
      { name: "telescope", count: 16, projects: ["p1"] },
      { name: "dap", count: 16, projects: ["p6"] },
      { name: "telescope.pickers", count: 15, projects: ["p1"] }
    ],
    unread: ["p7"]
  }),
  map_status: (a) => {
    const st = STATE[idForDir(a && a.mapDir)].st;
    return st
      ? { exists: true, index_path: "E:/repos/documentation.nvim/docs/map/index.html", ...st }
      : { exists: false, index_path: "" };
  },
  map_freshness: (a) => {
    const fr = STATE[(a && a.id) in STATE ? a.id : "p1"].fr;
    // camelCase, as `freshness.rs` serialises it (`#[serde(rename_all =
    // "camelCase")]`); the table above keeps the older snake_case spelling.
    return {
      hasMap: fr.has_map ?? true, stale: fr.stale ?? false, truncated: fr.truncated ?? false,
      newest: fr.newest ?? null, behindSecs: fr.behind_secs ?? null, generatedSecs: 100000,
    };
  },
  map_changes: (a) => ({
    files: [
      { path: "lua/lib/nvim/cross/fs/init.lua", afterSecs: 600 },
      { path: "lua/lib/nvim/window.lua", afterSecs: 7200 },
      { path: "README.md", afterSecs: 90000 },
    ],
    total: (a.id === "p2") ? 250 : 3,
    truncated: false,
  }),
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
  file_tree: () => ({ name: "root", children: [] }),
  // `pick-folder`'s dialog.open below always answers this path, so this is
  // the one shape worth previewing: not itself a repository, a mix of
  // already-added names (from PROJECTS, matched by name to exercise the
  // disabled-checkbox state), a plain new one, and one non-`.git` folder.
  inspect_folder: () => {
    const already = new Set(PROJECTS.map((p) => p.name));
    const names = ["documentation.nvim", "lib.nvim", "sandbox.nvim", "new-plugin.nvim", "notes"];
    return {
      isGit: false,
      subrepos: names.map((name) => ({
        name,
        path: `E:/repos/${name}`,
        isGit: name !== "notes",
        alreadyAdded: already.has(name)
      }))
    };
  },
  import_many: (a) => ({
    found: (a.roots || []).length,
    added: (a.roots || []).map((r) => ({
      id: r, name: r.split("/").pop(), root: r, map_dir: `${r}/docs/map`,
      exclude: [], languages: null
    })),
    already_present: 0,
    errors: []
  })
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
  // Always the same directory: enough to preview `inspect_folder`'s
  // checklist path (see `R.inspect_folder`) without a real filesystem.
  dialog: { open: async () => "E:/repos", save: async () => null },
  event: {
    listen: async (name, cb) => {
      (window.__stubListeners[name] ||= []).push(cb);
      return () => {};
    }
  }
};
