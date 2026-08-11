// The whole frontend: load the project list, show one project's map, switch.
//
// `convertFileSrc` is what makes the map viewable at all. The generated page
// is an ordinary file on disk, and a webview will not load `file://` into an
// iframe from an app-protocol page. Tauri's asset protocol exists for exactly
// this — it hands out a URL the webview will accept for a path the app is
// allowed to read (`assetProtocol.scope` in tauri.conf.json).

// A window that renders and then does nothing is the worst failure mode
// available here, and it is the one that happened: `window.__TAURI__` only
// exists when `app.withGlobalTauri` is set, so without it this module threw
// on its first line. The HTML and CSS still painted — a complete-looking
// sidebar with a button that ignored every click, and nothing anywhere
// saying why.
//
// So: say why, in the window. Every path below that can fail now ends up
// visible instead of in a console nobody has open.
function fatal(what, err) {
  const box = document.getElementById("placeholder");
  const frame = document.getElementById("map");
  if (frame) frame.hidden = true;
  if (!box) return;
  box.hidden = false;
  box.innerHTML = "<h2></h2><p></p><p class='detail'></p>";
  box.querySelector("h2").textContent = what;
  box.querySelector("p").textContent =
    "This is a bug in docmap-desktop, not in the project you opened.";
  box.querySelector(".detail").textContent = String(err);
}

window.addEventListener("error", (ev) => fatal("Something failed", ev.message));
window.addEventListener("unhandledrejection", (ev) => fatal("Something failed", ev.reason));

if (!window.__TAURI__) {
  // Reached when the page is opened outside the app, and when
  // `withGlobalTauri` is off. Naming both beats a TypeError three frames in.
  fatal(
    "Not running inside the app",
    "window.__TAURI__ is undefined. Either this page was opened directly in a " +
      "browser, or app.withGlobalTauri is not set in tauri.conf.json."
  );
  throw new Error("no tauri bridge");
}

const { invoke, convertFileSrc } = window.__TAURI__.core;
const { open } = window.__TAURI__.dialog;

const els = {
  list: document.getElementById("projects"),
  empty: document.getElementById("empty"),
  add: document.getElementById("add"),
  status: document.getElementById("status"),
  frame: document.getElementById("map"),
  placeholder: document.getElementById("placeholder"),
  gen: document.getElementById("gen"),
  engine: document.getElementById("engine"),
  engineSummary: document.getElementById("engine-summary"),
  engineState: document.getElementById("engine-state"),
  pickEngine: document.getElementById("pick-engine"),
  pickGrammars: document.getElementById("pick-grammars"),
};

let engine = { path: null, from_path: true, grammars: null };

let projects = [];
let selectedId = null;

/** Last selection, so a restart lands where the last session left off. */
const LAST_KEY = "docmap.lastProject";

function say(msg) {
  els.status.textContent = msg || "";
}

/** Show a message in the view area instead of a map. */
function showPlaceholder(title, body) {
  els.frame.hidden = true;
  els.frame.removeAttribute("src");
  els.placeholder.hidden = false;
  els.placeholder.innerHTML =
    "<h2></h2><p></p>";
  els.placeholder.querySelector("h2").textContent = title;
  els.placeholder.querySelector("p").innerHTML = body;
}

async function render() {
  els.list.innerHTML = "";
  els.empty.hidden = projects.length > 0;

  for (const p of projects) {
    const status = await invoke("map_status", { mapDir: p.map_dir });

    const li = document.createElement("li");
    li.className = "proj" + (p.id === selectedId ? " sel" : "");
    li.dataset.id = p.id;
    li.title = p.root;

    const nm = document.createElement("span");
    nm.className = "nm";
    nm.textContent = p.name;

    const meta = document.createElement("span");
    meta.className = "meta" + (status.exists ? "" : " nomap");
    // Counts rather than the path: two checkouts of the same plugin are told
    // apart by what is in them, and the full path is already the tooltip.
    meta.textContent = status.exists
      ? `${status.modules ?? "?"} modules · ${status.files ?? "?"} files`
      : "no map generated yet";

    li.append(nm, meta);
    li.addEventListener("click", () => select(p.id));
    els.list.append(li);
  }
}

async function select(id) {
  selectedId = id;
  try {
    localStorage.setItem(LAST_KEY, id);
  } catch (e) {
    // A workspace that cannot remember the last selection still works.
    void e;
  }

  const p = projects.find((x) => x.id === id);
  await render();
  if (!p) return;

  const status = await invoke("map_status", { mapDir: p.map_dir });
  if (!status.exists) {
    showPlaceholder(
      "No map in this project yet",
      engine.path
        ? "Press <strong>Generate map</strong> to build one."
        : "Locate the engine in the sidebar first — it is " +
          "<code>documentation.nvim</code>'s standalone binary."
    );
    say(p.root);
    renderEngine();
    return;
  }

  els.placeholder.hidden = true;
  els.frame.hidden = false;
  els.frame.src = convertFileSrc(status.index_path);
  say(`${p.root} · ${status.modules ?? "?"} modules`);
  renderEngine();
}

async function refresh(next) {
  projects = next ?? (await invoke("list_projects"));
  await render();
}

els.add.addEventListener("click", async () => {
  try {
    const dir = await open({ directory: true, multiple: false, title: "Add project" });
    if (!dir) return;
    await refresh(await invoke("add_project", { root: dir }));
    say(`Added ${dir}`);
  } catch (e) {
    // Inside the try on purpose: `open` itself rejects when the dialog
    // permission is missing from capabilities/, and that used to look
    // identical to a button that was not wired up at all.
    say(String(e));
    fatal("Could not add a project", e);
  }
});

// Roving tabindex over the list: one tab stop on the container, arrows
// within it. Same reasoning as the generated page's own long lists — a
// project list should not put one press per project between the button
// above it and the content.
els.list.tabIndex = 0;
els.list.addEventListener("keydown", (ev) => {
  const items = [...els.list.querySelectorAll(".proj")];
  if (!items.length) return;
  const cur = document.activeElement.closest?.(".proj") ?? null;
  const i = cur ? items.indexOf(cur) : -1;

  const focus = (el) => {
    if (!el) return;
    el.tabIndex = -1;
    el.focus();
  };

  if (ev.key === "ArrowDown") {
    ev.preventDefault();
    focus(items[i < 0 ? 0 : Math.min(i + 1, items.length - 1)]);
  } else if (ev.key === "ArrowUp") {
    ev.preventDefault();
    focus(items[i <= 0 ? 0 : i - 1]);
  } else if (ev.key === "Home") {
    ev.preventDefault();
    focus(items[0]);
  } else if (ev.key === "End") {
    ev.preventDefault();
    focus(items[items.length - 1]);
  } else if ((ev.key === "Enter" || ev.key === " ") && cur) {
    ev.preventDefault();
    select(cur.dataset.id);
  } else if (ev.key === "Delete" && cur) {
    ev.preventDefault();
    const id = cur.dataset.id;
    invoke("remove_project", { id })
      .then((list) => {
        if (selectedId === id) {
          selectedId = null;
          showPlaceholder("Nothing selected", "Pick a project on the left.");
        }
        return refresh(list);
      })
      .catch((e) => say(String(e)));
  }
});

// ------------------------------------------------------------- engine

function shortPath(p) {
  // Enough to recognise, not enough to wrap three lines in a 260px sidebar.
  const parts = String(p).split("/");
  return parts.length <= 3 ? p : ".../" + parts.slice(-2).join("/");
}

function renderEngine() {
  const e = els.engineState;
  const s = els.engineSummary;
  if (!engine.path) {
    e.className = "engine-state missing";
    e.textContent =
      "Not found. This is documentation.nvim's standalone binary — put it on PATH, or Locate… it.";
    s.textContent = "not found";
  } else {
    e.className = "engine-state";
    e.textContent =
      shortPath(engine.path) +
      (engine.from_path ? " (found on PATH)" : "") +
      (engine.grammars
        ? " · grammars: " + shortPath(engine.grammars)
        : " · no grammars — module tree only, no per-function data");
    // Fidelity, not the path: with the engine on PATH the path never
    // changes and is not worth a line, while "will this run produce
    // per-function data" is the one thing that differs run to run.
    s.textContent = engine.grammars ? "ready" : "no grammars";
  }
  s.className = "engine-summary" + (engine.path ? "" : " missing");
  e.title = engine.path
    ? engine.path + (engine.grammars ? "\ngrammars: " + engine.grammars : "")
    : "";

  // Escalate, never collapse. A missing engine is the one state worth
  // opening the panel for on its own; forcing it *shut* when things are
  // fine would slam it closed under the user the moment `set_grammars`
  // re-renders — right after they opened it to press that button.
  if (!engine.path) {
    els.engine.open = true;
  }

  els.gen.disabled = !engine.path || !selectedId;
}

async function loadEngine() {
  engine = await invoke("engine_info");
  renderEngine();
}

els.pickEngine.addEventListener("click", async () => {
  try {
    const file = await open({ multiple: false, title: "Locate the docmap engine" });
    if (!file) return;
    engine = await invoke("set_engine", { path: file });
    renderEngine();
    say("Engine set");
  } catch (e) {
    say(String(e));
  }
});

els.pickGrammars.addEventListener("click", async () => {
  try {
    const dir = await open({ directory: true, multiple: false, title: "Tree-sitter grammars" });
    if (!dir) return;
    engine = await invoke("set_grammars", { path: dir });
    renderEngine();
    say("Grammars set");
  } catch (e) {
    say(String(e));
  }
});

// ---------------------------------------------------------- generation

async function generateFor(id) {
  const p = projects.find((x) => x.id === id);
  if (!p) return;

  els.gen.disabled = true;
  const label = els.gen.textContent;
  els.gen.textContent = "Generating…";
  // Replace the view while it runs: leaving the previous project's map on
  // screen during a rebuild is the same "wrong panel's data" problem the
  // generated page itself had to fix in its own fetch-backed panels.
  showPlaceholder("Generating…", "Running the engine over <code>" + p.root + "</code>.");
  say("Generating " + p.name);

  try {
    const res = await invoke("generate", { root: p.root });
    // The engine reports on stdout even when it succeeds, and its report is
    // the useful part — counts, coverage, findings. Show it either way.
    const log = [res.stdout, res.stderr].filter(Boolean).join("\n").trim();
    if (res.ok) {
      await refresh();
      await select(id);
      if (log) appendLog(log, false);
      say("Generated " + p.name);
    } else {
      showPlaceholder(
        "Generation failed",
        "The engine exited with code " + res.code + "."
      );
      appendLog(log || "(no output)", true);
      say("Failed: " + p.name);
    }
  } catch (e) {
    showPlaceholder("Could not run the engine", String(e));
    say(String(e));
  } finally {
    els.gen.textContent = label;
    renderEngine();
  }
}

/** Put the engine's own words under whatever is on screen. */
function appendLog(text, bad) {
  const host = els.placeholder.hidden ? null : els.placeholder;
  if (!host) return;
  const pre = document.createElement("div");
  pre.className = "gen-log" + (bad ? " bad" : "");
  pre.textContent = text;
  host.appendChild(pre);
}

els.gen.addEventListener("click", () => selectedId && generateFor(selectedId));

(async function start() {
  try {
    await loadEngine();
    await refresh();
    const last = localStorage.getItem(LAST_KEY);
    if (last && projects.some((p) => p.id === last)) await select(last);
  } catch (e) {
    say(String(e));
  }
})();
