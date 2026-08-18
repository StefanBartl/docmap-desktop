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

// Both side-effect-free, so hoisting them above the `window.__TAURI__`
// guard below changes nothing about what that guard catches.
import { withBusyButton } from "./lib/busy-button.js";
import { mapStatus, invalidate } from "./lib/status-cache.js";
import {
  scanLanguages,
  invalidateLanguages,
  badgeText,
  summaryText,
  supportFor,
  engineLanguageText,
  engineVerdict,
} from "./lib/languages.js";

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
  genAll: document.getElementById("gen-all"),
  engine: document.getElementById("engine"),
  engineSummary: document.getElementById("engine-summary"),
  engineState: document.getElementById("engine-state"),
  pickEngine: document.getElementById("pick-engine"),
  pickGrammars: document.getElementById("pick-grammars"),
  nvim: document.getElementById("nvim"),
  nvimSummary: document.getElementById("nvim-summary"),
  nvimState: document.getElementById("nvim-state"),
  contextNote: document.getElementById("context-note"),
  pickNvim: document.getElementById("pick-nvim"),
  pickNvimConfig: document.getElementById("pick-nvim-config"),
  help: document.getElementById("help"),
};

let engine = { path: null, from_path: true, bundled: false, grammars: null };

// What the engine says it can read. `null` until the probe has answered
// once — distinct from `{ languages: null }`, which is a *completed* probe
// against an engine too old to have the field. Everything downstream treats
// the two the same way (say nothing about support), but conflating them
// here would make "not asked yet" unobservable.
let engineLangs = null;
let nvim = { path: null, from_path: true, config_dir: null, config_dir_from_default: true };

let projects = [];
let selectedId = null;

/** Last selection, so a restart lands where the last session left off. */
const LAST_KEY = "docmap.lastProject";

/** Text into an `innerHTML` string, since `showPlaceholder` takes markup.
 *
 * Language names come from a fixed table in Rust, so nothing hostile can
 * reach here today -- this exists so that stays true if the breakdown ever
 * carries a path or a filename, which the summary line is one small change
 * away from wanting to include. */
function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

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
  // Overlays the iframe specifically; nothing to explain about a panel
  // that is not even on screen.
  els.contextNote.hidden = true;
}

// =====================================================================
// Button help
//
// Every sidebar control carries a `data-help` sentence saying what it does.
// The distinctions are the reason it exists at all: Generate map and
// Generate all differ in *what they overwrite*, not in speed, and Locate…
// exists only for the case where PATH does not already answer — none of
// which a five-word label can carry.
//
// A native `title` would have been free, and was turned down for one
// reason: it never appears on keyboard focus, so exactly the controls a
// keyboard user reaches would be the only ones with no explanation. The
// texts themselves are lifted from `docs/USAGE.md` rather than reworded, so
// there is one description of each button rather than two that can drift.
//
// Same rules as the generated page's keyword card, so the two surfaces
// behave alike: a deliberate hover rather than a pointer crossing the
// button, Escape closes, and it never covers the control it describes.
// =====================================================================
const HELP_DWELL = 400;
let helpTimer = null;

function hideHelp() {
  if (helpTimer) {
    clearTimeout(helpTimer);
    helpTimer = null;
  }
  els.help.hidden = true;
}

function showHelp(el) {
  const text = el.dataset.help;
  if (!text) return;
  els.help.textContent = text;
  els.help.hidden = false;

  // Measured after it is in the DOM, then placed beside the control rather
  // than under it: the sidebar is narrow and a bubble below a button covers
  // the next one, which is the button the reader is most likely comparing
  // it against.
  const a = el.getBoundingClientRect();
  const r = els.help.getBoundingClientRect();
  const left = Math.min(a.right + 8, window.innerWidth - r.width - 8);
  const top = Math.max(8, Math.min(a.top, window.innerHeight - r.height - 8));
  els.help.style.left = left + "px";
  els.help.style.top = top + "px";
}

document.addEventListener("mouseover", (ev) => {
  const el = ev.target.closest && ev.target.closest("[data-help]");
  if (helpTimer) {
    clearTimeout(helpTimer);
    helpTimer = null;
  }
  if (el) {
    helpTimer = setTimeout(() => showHelp(el), HELP_DWELL);
  } else if (!els.help.hidden) {
    hideHelp();
  }
});

// Keyboard parity — the whole reason this is not a `title`.
document.addEventListener("focusin", (ev) => {
  const el = ev.target.closest && ev.target.closest("[data-help]");
  if (el) showHelp(el);
  else hideHelp();
});
document.addEventListener("focusout", hideHelp);
document.addEventListener("keydown", (ev) => {
  if (ev.key === "Escape") hideHelp();
});
// A bubble positioned against a rectangle that has since moved is worse
// than none.
window.addEventListener("resize", hideHelp);
window.addEventListener("scroll", hideHelp, true);

async function render() {
  els.list.innerHTML = "";
  els.empty.hidden = projects.length > 0;

  for (const p of projects) {
    const status = await mapStatus(invoke, p.map_dir);

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

    // Which languages, filled in after the row is already on screen.
    //
    // Not awaited with the two above: this one walks the project directory,
    // and blocking the whole list on a filesystem walk per project would
    // trade a rendered sidebar for a blank one. A row that gains a language
    // line a moment later is strictly better than a list that appears late.
    const langs = document.createElement("span");
    langs.className = "meta langs";
    langs.hidden = true;

    scanLanguages(invoke, p.root, p.map_dir)
      .then((scan) => {
        const text = badgeText(scan);
        if (!text) return;
        langs.textContent = text;
        // The full breakdown on the element itself rather than a fourth
        // line: depth on demand, no extra chrome in the list.
        langs.title = summaryText(scan, supportFor(scan, engineLangs));
        langs.hidden = false;
      })
      .catch(() => {
        // An unreadable directory costs its own language line and nothing
        // else -- the project is still selectable, and map_status has its
        // own error path for the parts that matter more.
      });

    li.append(nm, meta, langs);
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

  // The outgoing page's last-reported panel would otherwise linger on
  // screen for the instant before the new one loads and posts its own —
  // a note about the *previous* project's panel, shown over the next
  // one's map.
  els.contextNote.hidden = true;

  const p = projects.find((x) => x.id === id);
  await render();
  if (!p) return;

  const status = await mapStatus(invoke, p.map_dir);
  if (!status.exists) {
    // What is in this tree, on the one screen whose entire subject is that
    // there is nothing to show yet. Appended rather than replacing the
    // instruction: which button to press is still the more urgent half.
    let langLine = "";
    try {
      const scan = await scanLanguages(invoke, p.root, p.map_dir);
      langLine = summaryText(scan, supportFor(scan, engineLangs));
    } catch (e) {
      void e;
    }

    showPlaceholder(
      "No map in this project yet",
      (engine.path
        ? "Press <strong>Generate map</strong> to build one."
        : "Locate the engine in the sidebar first — it is " +
          "<code>documentation.nvim</code>'s standalone binary.") +
        (langLine ? `<br><span class="detail">${escapeHtml(langLine)}</span>` : "")
    );
    say(p.root);
    renderEngine();
    return;
  }

  // Over HTTP, not convertFileSrc. The page is the same either way; what
  // differs is that a real origin can answer the page's own /api/* fetches,
  // so the Telemetry and Loaded panels show data instead of advising a
  // `:DocMap serve` that would not have helped. If the server cannot start,
  // fall back to the asset protocol rather than showing nothing: a readable
  // map with two panels that report "no host" beats a blank window.
  els.placeholder.hidden = true;
  els.frame.hidden = false;
  let served = null;
  try {
    served = await invoke("serve_project", { id });
  } catch (e) {
    say(String(e));
  }
  els.frame.src = served ?? convertFileSrc(status.index_path);
  say(`${p.root} · ${status.modules ?? "?"} modules`);
  renderEngine();
}

async function refresh(next) {
  projects = next ?? (await invoke("list_projects"));
  await render();
  syncActions();
}

/// Generate straight after adding — but only when there is nothing to lose.
///
/// A project with no map yet opens on an empty view, which is useless and
/// makes the reader press a button whose outcome was never in doubt. One
/// with a map already is a different case: generation writes into
/// `docs/map` **inside the user's repository**, so regenerating unasked
/// would produce git changes they did not request, on a tree they may have
/// added just to look at. That one shows what is already there and leaves
/// the button to them.
async function autoGenerate(p) {
  if (!engine.path) return;
  const status = await mapStatus(invoke, p.map_dir);
  if (status.exists) {
    await select(p.id);
    return;
  }

  // Say what this tree is written in *before* generating it.
  //
  // The engine reads Lua and JS/TS today. Point it at a repository that is
  // two thirds Python and it returns a perfectly valid, nearly empty map --
  // success by every signal this app has, and useless. That news costs
  // nothing here and costs a scan plus a blank view at every later point,
  // which is the whole argument for putting it at this moment specifically.
  try {
    const scan = await scanLanguages(invoke, p.root, p.map_dir);
    const line = summaryText(scan, supportFor(scan, engineLangs));
    if (line) say(`${p.name} — ${line}`);
  } catch (e) {
    // Never a reason not to generate: this is context for the result, not a
    // precondition of producing one.
    void e;
  }

  await generateFor(p.id);
}


/// A prompt rather than a real input field: this app has no text-entry UI
/// anywhere yet, and a one-off URL is exactly the case a native prompt
/// exists for — no framework, on purpose, same reasoning as the rest of
/// this file's own header comment.

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
    s.textContent = engineVerdict(engine, engineLangs);
  } else {
    e.className = "engine-state";
    e.textContent =
      shortPath(engine.path) +
      (engine.bundled ? " (bundled)" : engine.from_path ? " (found on PATH)" : "") +
      (engine.grammars
        ? " · grammars: " + shortPath(engine.grammars)
        : " · no grammars — module tree only, no per-function data");
    // Fidelity, not the path: with the engine on PATH the path never
    // changes and is not worth a line, while "will this run produce
    // per-function data" is the one thing that differs run to run.
    //
    // Asked of the engine rather than inferred from the grammars directory
    // -- see `engineVerdict` for the failure that inference had: a
    // directory holding one grammar out of four read "ready".
    s.textContent = engineVerdict(engine, engineLangs);

    // Which languages, on the line below the path. Inside the panel, which
    // is collapsed by default -- the summary above still carries the
    // verdict that decides whether generation works at all, and this is the
    // detail behind it, not a second headline.
    if (engineLangs) {
      e.textContent += "\nreads: " + engineLanguageText(engineLangs);
    }
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

  syncActions();
}

/** Both generate buttons depend on the engine; only one also needs a
    selection. Shared so the two can never disagree about whether the engine
    is usable. */
function syncActions() {
  els.gen.disabled = !engine.path || !selectedId;
  els.genAll.disabled = !engine.path || projects.length === 0;
}

async function loadEngine() {
  engine = await invoke("engine_info");

  probeEngineLanguages();
  renderEngine();
}

/// Ask the engine which languages it reads, and repaint when it answers.
///
/// Not awaited by its callers, and a failure is swallowed: the language list
/// is context, never a precondition. A machine with no engine at all still
/// renders the panel, which then says the more important thing -- that there
/// is no engine.
///
/// Re-run after `set_engine` and `set_grammars` because both change the
/// answer: a different binary has different backends, and a grammars
/// directory is precisely what turns `grammar_loaded` from false to true.
/// This is also why the engine side refuses to cache its own probe.
function probeEngineLanguages() {
  invoke("engine_languages")
    .then((res) => {
      engineLangs = res;
      renderEngine();
      void render();
    })
    .catch(() => {
      engineLangs = null;
    });
}

els.pickEngine.addEventListener("click", async () => {
  try {
    const file = await open({ multiple: false, title: "Locate the docmap engine" });
    if (!file) return;
    engine = await invoke("set_engine", { path: file });
    probeEngineLanguages();
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
    probeEngineLanguages();
    renderEngine();
    say("Grammars set");
  } catch (e) {
    say(String(e));
  }
});

// -------------------------------------------------------------- neovim

function renderNvim() {
  const e = els.nvimState;
  const s = els.nvimSummary;
  if (!nvim.path || !nvim.config_dir) {
    e.className = "engine-state missing";
    e.textContent = !nvim.path
      ? "nvim not found. Put it on PATH, or Locate… it."
      : "No Neovim config directory found. Locate… it.";
    s.textContent = "not found";
  } else {
    e.className = "engine-state";
    e.textContent =
      shortPath(nvim.path) +
      (nvim.from_path ? " (found on PATH)" : "") +
      " · config: " +
      shortPath(nvim.config_dir) +
      (nvim.config_dir_from_default ? " (default location)" : "");
    s.textContent = "ready";
  }
  s.className = "engine-summary" + (nvim.path && nvim.config_dir ? "" : " missing");
  e.title = [nvim.path, nvim.config_dir].filter(Boolean).join("\n");

  // Same escalate-never-collapse rule as the engine panel.
  if (!nvim.path || !nvim.config_dir) {
    els.nvim.open = true;
  }
}

async function loadNvim() {
  nvim = await invoke("nvim_info");
  renderNvim();
}

els.pickNvim.addEventListener("click", async () => {
  try {
    const file = await open({ multiple: false, title: "Locate the nvim binary" });
    if (!file) return;
    nvim = await invoke("set_nvim_path", { path: file });
    renderNvim();
    say("nvim set");
  } catch (e) {
    say(String(e));
  }
});

els.pickNvimConfig.addEventListener("click", async () => {
  try {
    const dir = await open({ directory: true, multiple: false, title: "Locate the Neovim config directory" });
    if (!dir) return;
    nvim = await invoke("set_nvim_config_dir", { path: dir });
    renderNvim();
    say("Neovim config directory set");
  } catch (e) {
    say(String(e));
  }
});

/// Import every enabled, locally-checked-out personal plugin from the
/// user's Neovim config as a project. A real `nvim --headless` run, same
/// order of latency as one `generate` call, so it gets the same
/// placeholder-while-running treatment rather than a silent freeze.

// ---------------------------------------------------------- generation

async function generateFor(id) {
  const p = projects.find((x) => x.id === id);
  if (!p) return;

  // Replace the view while it runs: leaving the previous project's map on
  // screen during a rebuild is the same "wrong panel's data" problem the
  // generated page itself had to fix in its own fetch-backed panels.
  showPlaceholder("Generating…", "Running the engine over <code>" + p.root + "</code>.");
  say("Generating " + p.name);

  // `restoreDisabled: false`: whether this button ends up enabled depends on
  // engine and selection state, not on the run having finished, so the
  // trailing `renderEngine()` keeps owning that.
  try {
    await withBusyButton(
      els.gen,
      "Generating…",
      async () => {
        const res = await invoke("generate", { root: p.root });
        // The engine reports on stdout even when it succeeds, and its report
        // is the useful part — counts, coverage, findings. Show it either way.
        const log = [res.stdout, res.stderr].filter(Boolean).join("\n").trim();
        if (res.ok) {
          invalidate(p.map_dir);
          invalidateLanguages(p.root);
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
      },
      { restoreDisabled: false }
    );
  } catch (e) {
    showPlaceholder("Could not run the engine", String(e));
    say(String(e));
  } finally {
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

/// Regenerate every project, one after another.
///
/// **Sequential on purpose.** Each run is a separate engine process doing
/// CPU-bound parsing; starting a dozen at once would finish no sooner and
/// would make the machine unusable while it happened. The counter in the
/// button is there because the honest alternative to a progress indication
/// on a minutes-long job is a window that looks hung.
///
/// Unlike `autoGenerate` this *does* overwrite existing maps, and that is
/// the point rather than an oversight: pressing a button named "Generate
/// all" is the explicit request that the automatic path deliberately is
/// not.
els.genAll.addEventListener("click", async () => {
  if (!engine.path || projects.length === 0) return;

  const list = projects.slice();
  const label = els.genAll.textContent;
  const failed = [];
  let ok = 0;

  els.genAll.disabled = true;
  els.gen.disabled = true;
  showPlaceholder("Generating all projects", "Running the engine over " + list.length + " project(s).");

  for (let i = 0; i < list.length; i++) {
    const p = list[i];
    els.genAll.textContent = "Generating " + (i + 1) + "/" + list.length + "…";
    say("Generating " + p.name + " (" + (i + 1) + "/" + list.length + ")");
    try {
      const res = await invoke("generate", { root: p.root });
      if (res.ok) {
        invalidate(p.map_dir);
        invalidateLanguages(p.root);
        ok++;
      } else {
        failed.push(p.name);
      }
    } catch (e) {
      // One unreachable project must not abandon the rest — the report at
      // the end names which ones failed.
      failed.push(p.name);
    }
  }

  els.genAll.textContent = label;
  await refresh();
  if (selectedId) await select(selectedId);
  renderEngine();
  say(
    failed.length
      ? ok + " generated, " + failed.length + " failed: " + failed.join(", ")
      : ok + " project(s) generated"
  );
});

// -------------------------------------------------------- context note

/// What the loaded page reports (documentation.nvim, `core/render/html.lua`'s
/// embedded `postContext()`) when the reader switches panels: `{ source: "docmap",
/// tab, atool, view }`. Two of those combinations ask for something this
/// app's engine cannot do at all, regardless of configuration -- not
/// "not set up yet" the way a missing engine path is:
///
///   * Telemetry needs a live Neovim session actually running the code
///     under `runtime-analysis.nvim`; nothing this app runs can make
///     that data exist.
///   * Hierarchy -> Types needs `lua-language-server` via `vim.system`,
///     which the standalone engine has no equivalent of (measured:
///     `standalone/vim_shim.lua` has no `vim.fn.executable`, which
///     `documentation.nvim`'s own `core/luals.lua` calls first).
///
/// So this is a note explaining why, not a button that would fail --
/// the same "say why, don't silently fail" rule `no grammars` and
/// "older engine without --api" already follow elsewhere in this
/// sidebar. `null` for every other panel: most of them need no
/// explanation at all.
function contextNoteFor(ctx) {
  if (ctx.tab === "analysis" && ctx.atool === "telemetry") {
    return (
      "Telemetry data comes from a live Neovim session running " +
      "<code>runtime-analysis.nvim</code>. This app only displays what has " +
      "already been collected there — nothing here can generate it."
    );
  }
  if (ctx.tab === "hierarchy" && ctx.view === "types") {
    return (
      "Type data comes from <code>lua-language-server</code> " +
      "(<code>:DocMap full</code>, inside Neovim). The standalone engine " +
      "this app runs has no equivalent of that and cannot produce it."
    );
  }
  return null;
}

window.addEventListener("message", (ev) => {
  const data = ev.data;
  if (!data || data.source !== "docmap") return;
  const note = contextNoteFor(data);
  els.contextNote.innerHTML = note || "";
  els.contextNote.hidden = !note;
});

(async function start() {
  try {
    await loadEngine();
    await loadNvim();
    await refresh();
    const last = localStorage.getItem(LAST_KEY);
    if (last && projects.some((p) => p.id === last)) await select(last);
  } catch (e) {
    say(String(e));
  }
})();

// =====================================================================
// Add a project — one door, three ways
//
// Folder, Neovim config and URL were three sidebar buttons. They are three
// answers to one question ("where is the project"), and a sidebar that lists
// them separately makes the reader compare three labels before doing the
// thing they came to do. Tabs rather than a wizard: alternatives, not steps.
//
// Every action below is the same command the old buttons called. Nothing
// about adding, importing or cloning changed — only how they are reached.
// =====================================================================
const addbox = {
  el: document.getElementById("addbox"),
  tabs: [...document.querySelectorAll(".addbox-tab")],
  panes: [...document.querySelectorAll(".addbox-pane")],
  url: document.getElementById("url-input"),
  loadRepos: document.getElementById("load-repos"),
  repoFilter: document.getElementById("repo-filter"),
  repoState: document.getElementById("repo-state"),
  repoList: document.getElementById("repo-list"),
};

/** Repositories as last listed, so filtering never re-runs the network call. */
let repos = null;

function showPane(id) {
  addbox.tabs.forEach((t) => t.classList.toggle("on", t.dataset.pane === id));
  addbox.panes.forEach((p) => p.classList.toggle("on", p.id === id));
}

addbox.tabs.forEach((tab) => {
  tab.addEventListener("click", () => showPane(tab.dataset.pane));
});

els.add.addEventListener("click", () => {
  showPane("pane-folder");
  addbox.el.showModal();
});

/** Close, then run `fn` — the dialog must not sit over the result. */
async function closeThen(fn) {
  addbox.el.close();
  try {
    await fn();
  } catch (e) {
    // The same surface every other failure in this window uses. A dialog
    // action that fails silently is worse here than elsewhere: the reader
    // just asked for something specific.
    say(String(e));
  }
}

document.getElementById("pick-folder").addEventListener("click", () =>
  closeThen(async () => {
    const dir = await open({ directory: true, multiple: false, title: "Add project" });
    if (!dir) return;
    const before = new Set(projects.map((x) => x.id));
    await refresh(await invoke("add_project", { root: dir }));
    say(`Added ${dir}`);
    const added = projects.find((x) => !before.has(x.id));
    if (added) await autoGenerate(added);
  })
);

document.getElementById("run-nvim-import").addEventListener("click", () =>
  closeThen(async () => {
    say("Reading the Neovim config…");
    const res = await invoke("import_from_nvim_config");
    await refresh();
    say(
      res.added.length +
        " of " +
        res.found +
        " project(s) were added."
    );
  })
);

/** Clone whatever the URL field holds. Shared by the button and the list. */
async function cloneUrl(url) {
  if (!url) return;
  await closeThen(async () => {
    say(`Cloning ${url}…`);
    await refresh(await invoke("import_from_url", { url }));
    say(`Added ${url}`);
  });
}

document
  .getElementById("run-url-import")
  .addEventListener("click", () => cloneUrl(addbox.url.value.trim()));
addbox.url.addEventListener("keydown", (ev) => {
  if (ev.key === "Enter") {
    ev.preventDefault();
    cloneUrl(addbox.url.value.trim());
  }
});

// ---------------------------------------------------------------------
// The GitHub pick-list
//
// Opt-in, never on open: listing repositories is a network call against
// someone's account. Delegated to `gh`, so this program never holds a
// credential — see `src-tauri/src/github.rs`.
// ---------------------------------------------------------------------

/** What to say for each way the listing can fail to produce a list. */
const REPO_PROBLEMS = {
  not_installed:
    "GitHub CLI (gh) is not on PATH. Install it to pick from your repositories, " +
    "or paste a URL above — that works either way.",
  not_authenticated:
    "GitHub CLI is installed but not signed in. Run `gh auth login` once, " +
    "then try again. Pasting a URL above works either way.",
  failed: "GitHub CLI could not list your repositories.",
};

function renderRepos() {
  const q = (addbox.repoFilter.value || "").toLowerCase().trim();
  const shown = (repos || []).filter(
    (r) =>
      !q ||
      r.name_with_owner.toLowerCase().includes(q) ||
      (r.description || "").toLowerCase().includes(q)
  );

  addbox.repoList.innerHTML = "";
  shown.forEach((r) => {
    const li = document.createElement("li");
    li.className = "repo";

    const name = document.createElement("span");
    name.className = "repo-name";
    name.textContent = r.name_with_owner;

    const meta = document.createElement("span");
    meta.className = "repo-meta";
    // GitHub's own primary-language guess, labelled as theirs rather than
    // presented as this app's answer — `scan_languages` counts a local tree
    // itself, and conflating the two would make one look as measured as the
    // other.
    meta.textContent = [r.is_private ? "private" : null, r.language]
      .filter(Boolean)
      .join(" · ");

    li.append(name, meta);
    if (r.description) {
      const d = document.createElement("span");
      d.className = "repo-desc";
      d.textContent = r.description;
      li.append(d);
    }

    li.addEventListener("click", () => cloneUrl(r.url));
    addbox.repoList.append(li);
  });

  addbox.repoList.hidden = shown.length === 0;
  if (repos && shown.length === 0) {
    addbox.repoState.textContent = q
      ? `No repository matches “${q}”.`
      : "That account has no repositories.";
  } else if (repos) {
    addbox.repoState.textContent = `${shown.length} of ${repos.length} repositories — click one to clone it.`;
  }
}

addbox.loadRepos.addEventListener("click", async () => {
  addbox.repoState.textContent = "Asking gh…";
  addbox.loadRepos.disabled = true;
  try {
    const res = await invoke("list_github_repos");
    if (res.problem) {
      repos = null;
      addbox.repoList.hidden = true;
      addbox.repoFilter.hidden = true;
      // `gh`'s own message, appended rather than replaced: the sentence
      // above says what to do, and gh's says what happened.
      addbox.repoState.textContent =
        (REPO_PROBLEMS[res.problem] || REPO_PROBLEMS.failed) +
        (res.message ? " — " + res.message : "");
      return;
    }
    repos = res.repos;
    addbox.repoFilter.hidden = false;
    renderRepos();
  } catch (e) {
    addbox.repoState.textContent = String(e);
  } finally {
    addbox.loadRepos.disabled = false;
  }
});

addbox.repoFilter.addEventListener("input", renderRepos);

