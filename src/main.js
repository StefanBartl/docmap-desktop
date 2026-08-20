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
import { t, setLocale, initialLocale, LOCALES, keys } from "./lib/i18n.js";
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
const { open, save } = window.__TAURI__.dialog;

const els = {
  sidebar: document.getElementById("sidebar"),
  list: document.getElementById("projects"),
  sort: document.getElementById("proj-sort"),
  detail: document.getElementById("proj-detail"),
  icon: document.getElementById("proj-icon"),
  counts: document.getElementById("proj-counts"),
  langs: document.getElementById("proj-langs"),
  schema: document.getElementById("proj-schema"),
  stale: document.getElementById("proj-stale"),
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
// Interface language
//
// I18N.md's phase I18N-4 and only that: this window's chrome. The generated
// map is a separate artifact with its own translation, which is why the
// language control says so in its own help text.
//
// Applied by walking `data-i18n*` attributes rather than by rebuilding the
// DOM: the markup keeps its English text as the in-file default, so a window
// whose script never runs is still readable — the same reason the fatal
// handler exists at all.
// =====================================================================
const LANG_KEY = "docmap.locale";

function applyLocale() {
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const text = t(el.dataset.i18n);
    if (!text) return;
    // `innerHTML` because several of these carry <strong>/<code> — the
    // catalog is this program's own source text, not user input, and the one
    // place user content reaches the UI (project names, gh's messages) goes
    // through textContent elsewhere.
    el.innerHTML = text;
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
    const text = t(el.dataset.i18nPlaceholder);
    if (text) el.placeholder = text;
  });
  // Help bubbles read `data-help`, so the catalog is projected onto it.
  document.querySelectorAll("[data-i18n-help]").forEach((el) => {
    const text = t(el.dataset.i18nHelp);
    if (text) el.dataset.help = text;
  });
  document.documentElement.lang = locale;
}

let locale = "en";
{
  let saved = null;
  try {
    saved = localStorage.getItem(LANG_KEY);
  } catch (e) {
    void e;
  }
  locale = setLocale(initialLocale(saved, navigator.language), {
    // Marks every fallback visibly, so an unfinished locale is countable
    // rather than merely embarrassing.
    debug: new URLSearchParams(location.search).get("i18n") === "debug",
  });

  const sel = document.getElementById("lang");
  LOCALES.forEach((l) => {
    const o = document.createElement("option");
    o.value = l.code;
    // Endonym, and set as text rather than through the catalog: a language
    // name is not a string to translate.
    o.textContent = l.label;
    sel.append(o);
  });
  sel.value = locale;
  sel.addEventListener("change", () => chooseLocale(sel.value));
  applyLocale();
}

// =====================================================================
// Theme
//
// Three states, and "system" is one of them: a two-way toggle can only ever
// leave a reader pinned to a choice they made once, with no way to hand the
// decision back to the OS. Nothing stamped on <html> means system; a
// `data-theme` attribute means they decided.
//
// Applied before anything else renders, and read from localStorage rather
// than from the workspace file: this is a property of *this machine's* eyes,
// not of the project list, and syncing it through workspace.json would carry
// one machine's lighting preference to another.
// =====================================================================
const THEME_KEY = "docmap.theme";

function applyTheme(choice) {
  if (choice === "light" || choice === "dark") {
    document.documentElement.setAttribute("data-theme", choice);
  } else {
    // Removed, not set to "system": the CSS keys off the attribute's
    // absence, so a third value would be a state the stylesheet never sees.
    document.documentElement.removeAttribute("data-theme");
  }
}

{
  let saved = "system";
  try {
    saved = localStorage.getItem(THEME_KEY) || "system";
  } catch (e) {
    // A window that cannot remember the choice still honours it for this
    // session, which is strictly better than refusing to apply it.
    void e;
  }
  applyTheme(saved);
  const sel = document.getElementById("theme");
  sel.value = saved;
  // Through the same function the menu calls: one setter, so the select
  // and the checkmark can never end up describing different windows.
  sel.addEventListener("change", () => chooseTheme(sel.value));
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

// =====================================================================
// The project picker
//
// Was a list of rows; with thirty-three repositories the list *was* the
// sidebar. A `<select>` shows the one being looked at, and the detail that
// used to be on every row is shown for that one below it.
//
// What a list could do and this cannot is show every project's staleness at
// once. Sorting answers that instead — "which need regenerating" becomes one
// action rather than one glance.
// =====================================================================

const SORT_KEY = "docmap.sort";

/** Freshness per project id, so switching back does not re-walk a tree. */
const freshness = new Map();

let sortBy = "name";
try {
  sortBy = localStorage.getItem(SORT_KEY) || "name";
} catch (e) {
  void e;
}

/**
 * Projects in the chosen order.
 *
 * `added` is the workspace's own order and is therefore the identity sort —
 * it is offered because it is the only one that does not move when something
 * else changes, and a list that reorders itself while you are using it is one
 * you cannot build a habit with.
 */
function sortedProjects() {
  const list = projects.slice();
  if (sortBy === "name") {
    list.sort((a, b) => a.name.localeCompare(b.name));
  } else if (sortBy === "stale") {
    // Stale first, and within that the furthest behind first. A project
    // whose freshness has not been measured yet sorts as "not known to be
    // stale" rather than as fresh — it moves once the answer arrives.
    list.sort((a, b) => {
      const fa = freshness.get(a.id);
      const fb = freshness.get(b.id);
      const sa = fa && fa.stale ? (fa.behindSecs ?? 1) : 0;
      const sb = fb && fb.stale ? (fb.behindSecs ?? 1) : 0;
      if (sa !== sb) return sb - sa;
      return a.name.localeCompare(b.name);
    });
  } else if (sortBy === "generated") {
    // Oldest map first, because the question is "which have I left alone the
    // longest" — the same question staleness answers for a tree that moved,
    // and the one it cannot answer for a tree that did not: a repository
    // nobody has touched stays un-stale forever however old its map is.
    //
    // A project with no map sorts first. That is an ordering decision and
    // deliberately not a verdict — §3's rule that absent is not behind still
    // holds, and the mark still says so. Never generated is simply the
    // extreme end of the question this order asks.
    list.sort((a, b) => {
      const fa = freshness.get(a.id);
      const fb = freshness.get(b.id);
      const age = (f) => (f && f.hasMap ? (f.generatedSecs ?? 0) : Infinity);
      const aa = age(fa);
      const ab = age(fb);
      if (aa !== ab) return ab - aa;
      return a.name.localeCompare(b.name);
    });
  }
  return list;
}

/**
 * Measure every project that has not been measured yet.
 *
 * Sorting by staleness reads `freshness`, and `freshness` is filled in as
 * projects are selected — so before this existed, choosing that order on a
 * fresh window sorted by a map with one entry in it and quietly produced
 * alphabetical order. A sort control that appears to work and does not is
 * worse than one that takes a moment.
 *
 * Sequential rather than all at once: each call is a directory walk, and
 * thirty-three of them in parallel is thirty-three filesystem walks
 * competing for the same disk.
 */
async function measureAll() {
  const pending = projects.filter((p) => !freshness.has(p.id));
  if (!pending.length) return;
  els.sort.disabled = true;
  try {
    for (const p of pending) {
      try {
        freshness.set(p.id, await invoke("map_freshness", { id: p.id }));
      } catch (e) {
        // Not knowing is not the same as fresh, but it is the only thing
        // this can do about a project it cannot read. It stays unmeasured
        // and sorts with the ones that are not behind.
        void e;
      }
    }
  } finally {
    els.sort.disabled = false;
  }
}

async function render() {
  const previous = els.list.value;
  els.list.innerHTML = "";
  els.empty.hidden = projects.length > 0;
  els.list.hidden = projects.length === 0;
  els.sort.hidden = projects.length < 2;

  for (const p of sortedProjects()) {
    const o = document.createElement("option");
    o.value = p.id;
    // A mark inside the option, because the closed control shows exactly one
    // line and this is the one thing worth carrying into it.
    const f = freshness.get(p.id);
    o.textContent = (f && f.stale ? "• " : "") + p.name;
    els.list.append(o);
  }

  els.list.value = selectedId ?? previous ?? "";
  renderDetail();
}

/** What the row used to carry, for the selected project only. */
async function renderDetail() {
  const p = projects.find((x) => x.id === selectedId);
  els.detail.hidden = !p;
  if (!p) return;

  const status = await mapStatus(invoke, p.map_dir);
  renderIcon(p.id);
  renderCounts(status);
  // The two counts the artifact does not carry are asked for when the page
  // *reports itself*, not here: at this point the frame has not been
  // pointed at this project's map yet, so a question would go to whatever
  // was showing before — or to nothing at all.

  // A different question from "are the sources newer": this one is about
  // the *engine*, and regenerating is the answer to both.
  const older = schemaNote(status);
  els.schema.textContent = older || "";
  els.schema.hidden = !older;

  // Not awaited with the above: this walks the project directory, and
  // blocking the sidebar on a filesystem walk would trade a rendered panel
  // for a blank one.
  scanLanguages(invoke, p.root, p.map_dir)
    .then((scan) => {
      const text = badgeText(scan);
      if (!text) return;
      els.langs.textContent = text;
      els.langs.title = summaryText(scan, supportFor(scan, engineLangs));
      els.langs.hidden = false;
    })
    .catch(() => {
      // An unreadable directory costs its language line and nothing else.
    });

  refreshFreshness(p.id);
}

/**
 * Ask whether the map has fallen behind, and say so.
 *
 * Worded as what it measures. `freshness.rs` compares modification times, so
 * this can say *sources are newer* and must not say *the map is wrong* — a
 * file saved without an edit in it counts here and would not change a byte
 * of the artifact.
 */
/**
 * The map's own counts, in the sidebar, as links.
 *
 * They sat top-right inside the page, which is the wrong place for them:
 * somebody choosing between projects is looking at the sidebar, and the
 * header only exists once you are already in the map you chose.
 *
 * **They stay links.** Each count was an anchor into the view it names, and
 * moving the text without the navigation would leave five decorative
 * numbers. Navigation is by the frame's URL — the same mechanism the theme
 * uses, and the reason the page's inbound channel takes no instructions.
 *
 * Two sources, because no single one has all five. `modules`, `namespaces`
 * and `files` come from `module_map.json`, which the app reads directly.
 * `errors` and `warnings` do not exist in the artifact at all — findings are
 * computed at render time — so those come from asking the page, and arrive a
 * moment later. The line renders with what it has and fills in the rest.
 */
const COUNT_LINKS = [
  { key: "modules", tab: "index", iview: "modules" },
  { key: "namespaces", tab: "index", iview: "modules" },
  { key: "files", tab: "index", iview: "functions" },
  { key: "errors", tab: null },
  { key: "warnings", tab: null },
];

/** What the page last told us, per project id. */
const pageCounts = new Map();

function renderCounts(status) {
  els.counts.innerHTML = "";
  if (!status.exists) {
    els.counts.textContent = t("detail.nomap");
    els.counts.classList.add("nomap");
    return;
  }
  els.counts.classList.remove("nomap");

  const asked = pageCounts.get(selectedId) || {};
  const have = {
    modules: status.modules,
    namespaces: status.namespaces,
    files: status.files,
    errors: asked.errors,
    warnings: asked.warnings,
  };

  let first = true;
  for (const spec of COUNT_LINKS) {
    const n = have[spec.key];
    // Absent, not zero: errors and warnings are unknown until the page
    // answers, and showing "0 errors" before knowing would be a claim.
    if (n === undefined || n === null) continue;
    if (!first) els.counts.append(document.createTextNode(" · "));
    first = false;

    const label = n + " " + t("count." + spec.key);
    if (!spec.tab) {
      // Findings have no view of their own to jump to; the page's own
      // disclosure at its foot is not addressable by hash.
      const span = document.createElement("span");
      span.textContent = label;
      if (n > 0) span.className = "count-bad";
      els.counts.append(span);
      continue;
    }
    const a = document.createElement("a");
    a.href = "#";
    a.textContent = label;
    a.addEventListener("click", (ev) => {
      ev.preventDefault();
      gotoMap({ tab: spec.tab, iview: spec.iview });
    });
    els.counts.append(a);
  }
}

/**
 * Send the map to a view, by navigating the frame.
 *
 * Costs a reload, and that is the deliberate price of the page taking no
 * instructions: a host that could tell an embedded page what to do is a
 * different kind of program than one that can only ask it questions.
 */
function gotoMap(state) {
  if (!mapBase) return;
  const parts = Object.keys(state)
    .filter((k) => state[k])
    .map((k) => k + "=" + encodeURIComponent(state[k]));
  mapTab = null;
  const url = mapUrl(mapBase).split("#")[0] + "#" + parts.join("&");
  els.frame.src = url;
  watchMapLoad(url);
}

/**
 * Show the project's own icon, if it has one.
 *
 * Hidden until the file has actually decoded: an `<img>` whose `src` fails
 * leaves a broken-image glyph, which is worse than the nothing most
 * repositories correctly get.
 */
async function renderIcon(id) {
  els.icon.hidden = true;
  els.icon.removeAttribute("src");
  try {
    const path = await invoke("project_icon", { id });
    if (!path || id !== selectedId) return;
    els.icon.onload = () => {
      if (id === selectedId) els.icon.hidden = false;
    };
    els.icon.onerror = () => {
      els.icon.hidden = true;
    };
    els.icon.title = path;
    els.icon.src = convertFileSrc(path);
  } catch (e) {
    // A project whose icon cannot be looked for is a project without one.
    void e;
  }
}

/** Ask the page for the two counts the artifact does not carry. */
async function askCounts(id) {
  const reply = await askMap("counts", 4000);
  if (!reply || !reply.ok || id !== selectedId) return;
  pageCounts.set(id, reply);
  const status = await mapStatus(invoke, projects.find((p) => p.id === id).map_dir);
  renderCounts(status);
}

/**
 * Say when a map was written by an older engine than the one installed.
 *
 * This is the failure that cost an evening: the theme fix shipped, the app
 * had it, and the map on disk did not — because a generated page is baked
 * at generation time and the engine that baked it was older. From the
 * outside that is indistinguishable from a broken feature.
 *
 * Both halves are now readable: the engine reports the schema it writes,
 * and the artifact carries the schema it was written with. An engine that
 * reports nothing is simply older than the field, and then this says
 * nothing rather than guessing — the comparison needs both sides.
 */
function schemaNote(status) {
  const engineSchema = engineLangs && engineLangs.schema;
  if (!engineSchema || !status.exists) return null;
  // A map with no schema at all predates the field, which is strictly
  // older than any engine that reports one.
  const mapSchema = status.schema ?? 0;
  if (mapSchema >= engineSchema) return null;
  return t("detail.oldSchema")
    .replace("{map}", mapSchema || "?")
    .replace("{engine}", engineSchema);
}

async function refreshFreshness(id) {
  els.stale.hidden = true;
  try {
    const f = await invoke("map_freshness", { id });
    freshness.set(id, f);
    if (id !== selectedId) return;
    if (!f.hasMap || !f.stale) return;
    els.stale.textContent = t("detail.stale") + (f.newest ? " — " + f.newest : "");
    els.stale.title = t("detail.staleWhy");
    els.stale.hidden = false;
    // The mark in the list, now that the answer is known.
    const option = [...els.list.options].find((o) => o.value === id);
    if (option && !option.textContent.startsWith("• ")) {
      option.textContent = "• " + option.textContent;
    }
  } catch (e) {
    // Not knowing whether a map is behind is not a reason to say it is.
    void e;
  }
}

els.list.addEventListener("change", () => select(els.list.value));

els.sort.value = sortBy;
els.sort.addEventListener("change", async () => {
  sortBy = els.sort.value;
  try {
    localStorage.setItem(SORT_KEY, sortBy);
  } catch (e) {
    void e;
  }
  // The answer has to exist before it can be ordered by.
  // Both orders read `freshness`, which is otherwise filled in only as
  // projects are selected — so both have to wait for the walk, or the sort
  // silently falls back to alphabetical on a fresh window.
  if (sortBy === "stale" || sortBy === "generated") await measureAll();
  render();
});

async function select(id) {
  selectedId = id;
  syncMenu();
  titleFor(projects.find((x) => x.id === id));
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
      t("ph.nomap.title"),
      (engine.path ? t("ph.nomap.generate") : t("ph.nomap.noengine")) +
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
  mapBase = served ?? convertFileSrc(status.index_path);
  mapTab = null;
  const url = mapUrl(mapBase);
  els.frame.src = url;
  watchMapLoad(url);
  // The path alone. The module count is already on the project row in the
  // list and again in the map's own header — three copies of one number, and
  // this was the third.
  say(p.root);
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

// A `<select>` answers Arrow, Home, End, Enter and type-ahead itself, in
// whatever way the platform does — which is more than the roving-tabindex
// handler that used to be here did, and none of it has to be kept correct.
//
// `Delete` is the one key it does not answer. It lives on File → Remove
// from workspace, which also names what it removes; a bare Delete key over
// a list of repositories was always the more frightening of the two.
els.list.addEventListener("keydown", (ev) => {
  if (ev.key === "Delete" && els.list.value) {
    ev.preventDefault();
    removeProject(els.list.value);
  }
});

/// Drop a project from the workspace. Never touches the repository — the
/// menu label says so, and this is what it does.
///
/// Extracted from the Delete-key handler when the menu grew an item for
/// it: two callers, one behaviour.
async function removeProject(id) {
  try {
    const list = await invoke("remove_project", { id });
    if (selectedId === id) {
      selectedId = null;
      showPlaceholder(t("ph.none.title"), t("ph.none.body"));
      syncMenu();
      titleFor(null);
    }
    await refresh(list);
  } catch (e) {
    say(String(e));
  }
}

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

async function generateFor(id, full = false) {
  const p = projects.find((x) => x.id === id);
  if (!p) return;

  // Replace the view while it runs: leaving the previous project's map on
  // screen during a rebuild is the same "wrong panel's data" problem the
  // generated page itself had to fix in its own fetch-backed panels.
  showPlaceholder(
    t("ph.generating.title"),
    t("ph.generating.body").replace("{root}", escapeHtml(p.root))
  );
  say("Generating " + p.name);

  // `restoreDisabled: false`: whether this button ends up enabled depends on
  // engine and selection state, not on the run having finished, so the
  // trailing `renderEngine()` keeps owning that.
  try {
    await withBusyButton(
      els.gen,
      "Generating…",
      async () => {
        const res = await invoke("generate", { root: p.root, full });
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
            t("ph.failed.title"),
            t("ph.failed.body").replace("{code}", String(res.code))
          );
          appendLog(log || "(no output)", true);
          // The one failure this app can explain better than the engine
          // can. `--full` is offered unconditionally, so the missing tool
          // is a normal outcome rather than a broken install, and saying
          // so in the placeholder beats leaving it to be found in the log.
          if (full && /lua-language-server/.test(log)) {
            showPlaceholder(t("ph.failed.title"), t("gen.full.needsLuals"));
          }
          say("Failed: " + p.name);
        }
      },
      { restoreDisabled: false }
    );
  } catch (e) {
    showPlaceholder(t("ph.enginefail.title"), escapeHtml(String(e)));
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
/**
 * Generate every project in the workspace.
 *
 * No longer a sidebar button. `docs/MENUBAR.md`'s rule is that the sidebar
 * keeps exactly one command rather than a mirror of the menu, and this is
 * the rare one — it writes into repositories you did not select, which is
 * also why its wording never gets shortened.
 *
 * The progress used to be the button's own label. It is the status bar's
 * now, which is a better home for it anyway: a bar that reports on the
 * whole window is where a job spanning every project belongs, and it does
 * not disappear when the sidebar is collapsed.
 */
async function generateAll(only) {
  if (!engine.path || projects.length === 0) return;

  const list = only ? projects.filter((p) => only.has(p.id)) : projects.slice();
  if (list.length === 0) return;
  const failed = [];
  let ok = 0;

  els.gen.disabled = true;
  showPlaceholder(
    t("ph.genall.title"),
    t("ph.genall.body").replace("{n}", String(list.length))
  );

  for (let i = 0; i < list.length; i++) {
    const p = list[i];
    say(
      t("gen.all.progress")
        .replace("{n}", String(i + 1))
        .replace("{total}", String(list.length))
        .replace("{name}", p.name)
    );
    try {
      const res = await invoke("generate", { root: p.root, full: false });
      if (res.ok) {
        invalidate(p.map_dir);
        invalidateLanguages(p.root);
        // The map just moved; the cached verdict about it is now a claim
        // about a file that no longer exists in that state.
        freshness.delete(p.id);
        ok++;
      } else {
        failed.push(p.name);
      }
    } catch (e) {
      // One unreachable project must not abandon the rest — the report at
      // the end names which ones failed.
      void e;
      failed.push(p.name);
    }
  }

  await refresh();
  if (selectedId) await select(selectedId);
  renderEngine();
  say(
    failed.length
      ? ok + " generated, " + failed.length + " failed: " + failed.join(", ")
      : ok + " project(s) generated"
  );
}

/**
 * Generate only the projects whose maps have fallen behind.
 *
 * The staleness mark has been on screen since §6 with no command that acts
 * on it, which is the gap this closes: the answer to "four of these are out
 * of date" should not be four selections and four presses.
 *
 * The verdict is asked for fresh rather than read out of the cache. The
 * cache only holds projects that have been *looked at*, so acting on it
 * would quietly skip everything the reader has not opened — which is most
 * of what this command exists for.
 */
/**
 * Ask the engine whether the map would come out different, and write nothing.
 *
 * **The staleness mark and this answer different questions**, and the wording
 * below is the whole point of having both. The mark compares modification
 * times: it says "something was touched since this was written", and a file
 * saved without an edit in it counts. This runs the analysis and compares the
 * output byte for byte, which is the only thing that settles it — and it is
 * why the mark's own tooltip has always pointed at a command that did not
 * exist yet.
 *
 * The engine's report is shown verbatim, the same as generation's. It already
 * says what it found, and summarising it here would be this window inventing
 * a second opinion about a tree it did not read.
 */
async function checkMap(id) {
  const p = projects.find((x) => x.id === id);
  if (!p) return;

  showPlaceholder(
    t("ph.check.title"),
    t("ph.check.body").replace("{root}", escapeHtml(p.root))
  );
  say(t("check.running"));

  let res;
  try {
    res = await invoke("check_map", { root: p.root });
  } catch (e) {
    say(t("check.failed").replace("{error}", String(e)));
    appendLog(String(e), true);
    return;
  }

  const log = [res.stdout, res.stderr].filter(Boolean).join("\n").trim();
  // `--lenient` makes the exit code mean staleness and nothing else, so this
  // reads one bit rather than sniffing the engine's prose for a sentence that
  // is free to be reworded — see `check_map` in `main.rs`.
  say(res.current ? t("check.current") : t("check.stale"));
  appendLog(log || "(no output)", !res.current);
}

async function generateStale() {
  if (!engine.path || projects.length === 0) return;
  say(t("gen.stale.checking"));

  const stale = new Set();
  for (const p of projects) {
    try {
      const f = await invoke("map_freshness", { id: p.id });
      freshness.set(p.id, f);
      if (f.stale) stale.add(p.id);
    } catch (e) {
      // A project that cannot be measured is not evidence that it is
      // stale. Left alone, and named at the end by not being counted.
      void e;
    }
  }

  if (stale.size === 0) {
    say(t("gen.stale.none"));
    return;
  }
  await generateAll(stale);
}

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
    // **Requalified once start/stop landed.** This used to end "nothing here
    // can generate it", which stopped being true: collection can be switched
    // on from Settings. The half that stays true is the one that matters —
    // this app cannot run somebody's plugin code, so it shows what was
    // collected elsewhere. A note that overstates what the window cannot do
    // is the same failure as one that overstates what it can.
    return t("note.telemetry");
  }
  if (ctx.tab === "hierarchy" && ctx.view === "types") {
    return t("note.types");
  }
  return null;
}

window.addEventListener("message", (ev) => {
  const data = ev.data;
  if (!data || data.source !== "docmap") return;

  // The page asking for something, rather than reporting where it is. Its
  // one request today is opening a file in an editor; the path is
  // repo-relative because that is what the artifact stores, and it is
  // resolved and bounds-checked in Rust rather than trusted here.
  if (data.kind === "open-file" && data.path && selectedId) {
    invoke("open_in_editor", {
      id: selectedId,
      path: data.path,
      line: data.line ?? null,
    }).catch((e) => say(String(e)));
    return;
  }

  // The page ran. Whatever else this message says, it is the evidence the
  // blank-pane watchdog is waiting for.
  const wasLoading = !mapLoaded;
  mapLoaded = true;
  if (mapWatch) {
    clearTimeout(mapWatch);
    mapWatch = null;
  }
  // First message from this page: it is up, so it can be asked things.
  if (wasLoading && selectedId) askCounts(selectedId);
  if (data.tab) mapTab = data.tab;
  const note = contextNoteFor(data);
  els.contextNote.innerHTML = note || "";
  els.contextNote.hidden = !note;
});

(async function start() {
  try {
    await loadEngine();
    await loadNvim();
    await refresh();
    // The dashboard decides for itself whether it is worth showing: one
    // workspace is not a choice. When it does show, the last selection is
    // not restored — it belongs to whichever workspace is picked, and
    // restoring it first would flash a project from the old one.
    const chose = await maybeOpenWorkspaces();
    if (chose) return;
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
  not_installed: "repos.notInstalled",
  not_authenticated: "repos.notAuthenticated",
  failed: "repos.failed",
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
      : t("repos.none");
  } else if (repos) {
    addbox.repoState.textContent = `${shown.length} of ${repos.length} repositories — click one to clone it.`;
  }
}

addbox.loadRepos.addEventListener("click", async () => {
  addbox.repoState.textContent = t("repos.asking");
  addbox.loadRepos.disabled = true;
  try {
    const res = await invoke("list_github_repos");
    if (res.problem) {
      repos = null;
      addbox.repoList.hidden = true;
      addbox.repoFilter.hidden = true;
      // `gh`'s own message, appended rather than replaced: the sentence
      // above says what to do, and gh's says what happened.
      // gh's own message is appended verbatim and never translated: it is
      // someone else's output, and the sentence before it is the part this
      // program is responsible for.
      addbox.repoState.textContent =
        t(REPO_PROBLEMS[res.problem] || REPO_PROBLEMS.failed) +
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


// =====================================================================
// View state the menu has to show, not just act on
//
// Theme, language, zoom and sidebar visibility are all properties of *this
// machine* rather than of the project list — `localStorage`, not
// `workspace.json`, for the same reason the theme has always been there: a
// window's lighting and text size do not travel with a repository.
//
// The menu shows them as checkmarks, which means every one of them has to
// tell the menu when it changes. Changing a setting from the sidebar and
// leaving the menu claiming the old value is worse than having no checkmark
// at all.
// =====================================================================

const ZOOM_KEY = "docmap.zoom";
const SIDEBAR_KEY = "docmap.sidebar";
const ZOOM_STEPS = [0.67, 0.75, 0.8, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2];

let zoom = 1;
let sidebarShown = true;

/** Nearest step to the current factor, so repeated presses always move. */
function zoomStep(direction) {
  const i = ZOOM_STEPS.reduce(
    (best, v, n) => (Math.abs(v - zoom) < Math.abs(ZOOM_STEPS[best] - zoom) ? n : best),
    0
  );
  const next = Math.min(Math.max(i + direction, 0), ZOOM_STEPS.length - 1);
  return ZOOM_STEPS[next];
}

async function applyZoom(factor) {
  try {
    // Rust clamps and answers with what it actually set, so the value kept
    // here is the window's, not the request's — otherwise pressing zoom-out
    // at the floor would keep decrementing a number nothing honours, and the
    // first four presses back up would do nothing visible.
    zoom = await invoke("set_zoom", { factor });
    localStorage.setItem(ZOOM_KEY, String(zoom));
  } catch (e) {
    say(String(e));
  }
}

function applySidebar(shown) {
  sidebarShown = shown;
  els.sidebar.hidden = !shown;
  try {
    localStorage.setItem(SIDEBAR_KEY, shown ? "1" : "0");
  } catch (e) {
    void e;
  }
}

// The map frame's URL, without the theme. Kept so a theme change can
// rebuild it: the page is a separate document at a separate origin, so the
// `data-theme` this window stamps on itself never crosses -- which is why
// choosing dark used to leave the map white. It reads `?theme=` instead.
let mapBase = null;

// The panel the page last reported through its one-way channel. A theme
// change reloads the frame, and landing back on Tree after having been in
// Notes would be the fix costing more than the bug.
let mapTab = null;

/** `base` with the theme, and the panel to land on, appended. */
function mapUrl(base) {
  const theme = currentTheme();
  let url = base;
  if (theme === "light" || theme === "dark") {
    url += (url.includes("?") ? "&" : "?") + "theme=" + theme;
  }
  // `tab` only. The page deliberately posts a coarse context and not its
  // whole state, so this restores the panel and nothing finer -- which is
  // the part a reader would notice losing.
  if (mapTab) url += "#tab=" + encodeURIComponent(mapTab);
  return url;
}

/**
 * Watch the frame until the page proves it loaded, and say so if it never
 * does.
 *
 * Reported from the installed build: after a regenerate the main pane went
 * white. It could not be reproduced here — the harness reloads correctly,
 * the local server sends `Cache-Control: no-store` so a stale copy is not
 * it, and the frame ends up visible with a src set. So rather than guess at
 * a cause, this removes the *silence*: a pane that stays blank now says it
 * stayed blank, and names the URL it was asked for.
 *
 * Liveness comes from the page's own outbound message, which it posts once
 * on load. That is proof it ran, where `onload` only proves the browser
 * fetched something.
 */
let mapWatch = null;

function watchMapLoad(url) {
  if (mapWatch) clearTimeout(mapWatch);
  mapLoaded = false;
  mapWatch = setTimeout(() => {
    mapWatch = null;
    if (mapLoaded || els.frame.hidden) return;
    showPlaceholder(
      t("map.blank.title"),
      t("map.blank.body") + '<br><span class="detail">' + escapeHtml(url) + "</span>"
    );
  }, 8000);
}

let mapLoaded = false;

/** Reload the map with the current theme, if one is showing. */
function retheme() {
  if (mapBase) els.frame.src = mapUrl(mapBase);
}

function currentTheme() {
  return document.documentElement.getAttribute("data-theme") || "system";
}

/** What the menu needs in order to draw its checkmarks. */
function viewState() {
  return {
    theme: currentTheme(),
    locale,
    // Endonyms, straight from the catalog's own list — the menu never
    // translates a language name.
    locales: LOCALES.map((l) => ({ code: l.code, label: l.label })),
    files: filesOpen,
    sidebar: sidebarShown,
  };
}

{
  let savedZoom = 1;
  let savedSidebar = "1";
  try {
    savedZoom = Number(localStorage.getItem(ZOOM_KEY)) || 1;
    savedSidebar = localStorage.getItem(SIDEBAR_KEY) ?? "1";
  } catch (e) {
    void e;
  }
  applySidebar(savedSidebar !== "0");
  if (savedZoom !== 1) applyZoom(savedZoom);
}


// =====================================================================
// Feedback
//
// Builds a prefilled GitHub form and opens it; the writer reads it there
// and submits it themselves. `src-tauri/src/feedback.rs` carries the two
// reasons — this app holds no credentials, and filing to a public tracker
// is publishing, which is not something a dialog should do on someone's
// behalf while they are looking at a Send button.
//
// The environment block is opt-in and shown verbatim before anything opens,
// because it is the one part of the report the writer did not type.
// =====================================================================

const fb = {
  box: document.getElementById("fbbox"),
  topic: document.getElementById("fb-topic"),
  repo: document.getElementById("fb-repo"),
  subject: document.getElementById("fb-subject"),
  body: document.getElementById("fb-body"),
  attach: document.getElementById("fb-attach"),
  env: document.getElementById("fb-env"),
  problem: document.getElementById("fb-problem"),
  go: document.getElementById("fb-go"),
};

let aboutInfo = null;

/** The attached block, exactly as it will be sent. Never translated: it is
 *  read by whoever triages the report, not by the person writing it. */
function envBlock() {
  if (!aboutInfo) return "";
  const lines = [
    "docmap-desktop " + aboutInfo.appVersion,
    aboutInfo.os + " / " + aboutInfo.arch,
    "engine: " + (aboutInfo.enginePath || "not configured"),
    "grammars: " + (aboutInfo.grammars || "none"),
    "interface: " + locale,
  ];
  return lines.join("\n");
}

function renderEnv() {
  // Nothing to attach is a real state —  can fail, and a report
  // is still worth filing without it. The whole row goes away rather than
  // leaving a ticked checkbox above an empty box, which would claim
  // something is being attached when nothing is.
  const text = envBlock();
  fb.env.textContent = text;
  fb.env.hidden = !fb.attach.checked || !text;
  fb.attach.closest(".fb-check").hidden = !text;
}

async function openFeedback() {
  fb.problem.hidden = true;
  if (!aboutInfo) {
    try {
      aboutInfo = await invoke("about_info");
    } catch (e) {
      // A report without the version block is still worth filing.
      void e;
    }
  }
  renderEnv();
  fb.box.showModal();
  fb.subject.focus();
}

fb.attach.addEventListener("change", renderEnv);

fb.go.addEventListener("click", async () => {
  const subject = fb.subject.value.trim();
  if (!subject) {
    fb.problem.textContent = t("fb.needsSubject");
    fb.problem.hidden = false;
    fb.subject.focus();
    return;
  }
  const parts = [fb.body.value.trim()];
  if (fb.attach.checked && aboutInfo) {
    parts.push("---", envBlock());
  }
  try {
    await invoke("open_feedback", {
      repo: fb.repo.value,
      topic: fb.topic.value,
      title: subject,
      body: parts.filter(Boolean).join("\n\n"),
    });
    fb.box.close();
  } catch (e) {
    fb.problem.textContent = String(e);
    fb.problem.hidden = false;
  }
});


// =====================================================================
// Telemetry
//
// This window cannot produce any, and says so rather than implying it
// could: the counts come from wrapping functions inside a running Neovim
// that is executing the plugin's own code. What it can do is read what was
// collected and flip the persistent switch that decides whether the next
// session collects — which is a real capability rather than a workaround,
// because `runtime-analysis.nvim` keeps that flag on disk precisely so a
// decision taken outside a session survives into the next one.
//
// So every wording here carries "from the next session". A switch that
// says "on" and means "on tomorrow" is the kind of half-truth this window
// keeps removing from itself.
// =====================================================================

const tel = {
  state: document.getElementById("tel-state"),
  toggle: document.getElementById("tel-toggle"),
  snapsLabel: document.getElementById("tel-snaps-label"),
  snaps: document.getElementById("tel-snaps"),
};

/** The namespace for a project: a telemetry namespace is a plugin name. */
function telemetryNamespace(project) {
  return project ? project.name : null;
}

function fill(text, vars) {
  return Object.keys(vars).reduce((s, k) => s.replace("{" + k + "}", vars[k]), text);
}

async function renderTelemetry() {
  const p = projects.find((x) => x.id === selectedId);
  const ns = telemetryNamespace(p);
  tel.toggle.hidden = true;
  tel.snaps.hidden = true;
  tel.snapsLabel.hidden = true;
  if (!ns) {
    tel.state.textContent = "";
    return;
  }

  let info;
  try {
    info = await invoke("telemetry_info", { namespace: ns });
  } catch (e) {
    void e;
    tel.state.textContent = t("tel.failed");
    return;
  }

  // Three states that look alike and are not: the tracker was never here,
  // the tracker is here but has never seen this project, and it has.
  if (!info.installed) {
    tel.state.textContent = t("tel.absent");
    return;
  }
  if (!info.known) {
    tel.state.textContent = fill(t("tel.unknown"), { name: ns });
    return;
  }

  tel.state.textContent = fill(t(info.disabled ? "tel.off" : "tel.on"), {
    sessions: info.sessions,
    days: info.days.length,
  });
  tel.toggle.textContent = t(info.disabled ? "tel.enable" : "tel.disable");
  tel.toggle.hidden = false;
  tel.toggle.dataset.ns = ns;
  tel.toggle.dataset.enable = info.disabled ? "1" : "";

  tel.snapsLabel.hidden = false;
  if (!info.snapshots.length) {
    // The actionable sentence, not a blank. An empty list here is the normal
    // state — snapshots are never automatic — and without saying so it reads
    // as a feature that does not work.
    tel.snapsLabel.innerHTML = t("tel.snaps.none");
    return;
  }
  tel.snapsLabel.textContent = t("tel.snaps");
  tel.snaps.innerHTML = "";
  info.snapshots.forEach((s) => {
    const li = document.createElement("li");
    const when = new Date(s.takenAt * 1000);
    // Through the catalog: the last version built this line by
    // concatenation and left "session(s)" in English inside a German
    // dialog. `toLocaleString` already follows the reader's locale.
    li.textContent = fill(t("tel.snapItem"), {
      name: s.name,
      when: when.toLocaleString(),
      sessions: s.sessions,
    });
    tel.snaps.append(li);
  });
  tel.snaps.hidden = false;
}

tel.toggle.addEventListener("click", async () => {
  const ns = tel.toggle.dataset.ns;
  if (!ns) return;
  tel.toggle.disabled = true;
  try {
    await invoke("set_telemetry", { namespace: ns, enabled: !!tel.toggle.dataset.enable });
    await renderTelemetry();
  } catch (e) {
    tel.state.textContent = String(e);
  } finally {
    tel.toggle.disabled = false;
  }
});


// =====================================================================
// Asking the map a question
//
// The map is a cross-origin document: this window cannot read into it. The
// page answers a fixed, tiny set of questions about itself and takes no
// instructions — see `core/render/html.lua`'s own note on why that shape
// was chosen over a command channel.
//
// One asker, promise-shaped, with a timeout. A page that is still loading,
// or one generated before the channel existed, simply never answers — and
// "never answers" has to become a sentence rather than a spinner that stays
// forever.
// =====================================================================

let askId = 0;
const pending = new Map();

window.addEventListener("message", (ev) => {
  const d = ev.data;
  if (!d || d.source !== "docmap" || d.replyTo === undefined) return;
  const waiting = pending.get(d.replyTo);
  if (!waiting) return;
  pending.delete(d.replyTo);
  waiting(d);
});

/** Ask the map something. Resolves with its answer, or `null` on silence. */
function askMap(ask, timeoutMs = 2000) {
  const frame = els.frame.contentWindow;
  if (!frame) return Promise.resolve(null);
  const id = ++askId;
  return new Promise((resolve) => {
    pending.set(id, resolve);
    setTimeout(() => {
      if (pending.delete(id)) resolve(null);
    }, timeoutMs);
    // `"*"` as the target: the frame's origin is the local server's, which
    // changes port per run. The message carries nothing secret — it is a
    // question, and the page answers only to the origin that asked.
    frame.postMessage({ source: "docmap-host", id, ask }, "*");
  });
}

/**
 * Save the diagram the map is currently showing.
 *
 * Three outcomes, and each says which: there is no diagram on this tab, the
 * page never answered, or a file was written where the reader chose.
 */
async function exportCurrentView() {
  const reply = await askMap("export-svg");
  if (!reply) {
    say(t("export.silent"));
    return;
  }
  if (!reply.ok) {
    say(t("export.none"));
    return;
  }
  const path = await save({
    defaultPath: reply.name,
    filters: [{ name: "SVG", extensions: ["svg"] }],
  });
  // A cancelled dialog is a decision, not a failure: nothing is said about
  // it, because the reader already knows what they did.
  if (!path) return;
  try {
    await invoke("save_text", { path, contents: reply.data });
    say(t("export.done").replace("{name}", path));
  } catch (e) {
    say(String(e));
  }
}


// =====================================================================
// The repository as it is on disk
//
// Beside the map rather than inside it. The map is a snapshot of one
// generation and deliberately shows only modules; this is what is actually
// there, read now — and it is read by this program because this program is
// the one that can also open a file when asked.
//
// One directory per call. A monorepo is tens of thousands of files and a
// reader opens a dozen folders, so walking everything to draw one level is
// work nobody asked for and a window that stalls.
// =====================================================================

let filesOpen = false;
let filesPath = "";

function formatSize(n) {
  if (n === null || n === undefined) return "";
  if (n < 1024) return n + " B";
  if (n < 1024 * 1024) return Math.round(n / 1024) + " KB";
  return (n / (1024 * 1024)).toFixed(1) + " MB";
}

async function renderFiles() {
  if (!filesOpen || !selectedId) return;
  const crumb = document.getElementById("files-crumb");
  const list = document.getElementById("files-list");

  let listing;
  try {
    listing = await invoke("file_tree", { id: selectedId, sub: filesPath });
  } catch (e) {
    list.innerHTML = "";
    crumb.textContent = "";
    const li = document.createElement("li");
    li.className = "files-msg";
    li.textContent = String(e);
    list.append(li);
    return;
  }

  // Breadcrumb: the project name, then every segment of the current path.
  crumb.innerHTML = "";
  const project = projects.find((p) => p.id === selectedId);
  const segments = filesPath ? filesPath.split("/") : [];
  const crumbButton = (label, target) => {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = label;
    b.addEventListener("click", () => {
      filesPath = target;
      renderFiles();
    });
    return b;
  };
  crumb.append(crumbButton(project ? project.name : "/", ""));
  segments.forEach((seg, i) => {
    crumb.append(document.createTextNode(" / "));
    if (i === segments.length - 1) {
      const here = document.createElement("span");
      here.className = "here";
      here.textContent = seg;
      crumb.append(here);
      return;
    }
    crumb.append(crumbButton(seg, segments.slice(0, i + 1).join("/")));
  });

  list.innerHTML = "";
  if (filesPath) {
    const up = document.createElement("li");
    const b = document.createElement("button");
    b.type = "button";
    b.className = "files-row up";
    b.textContent = "..";
    b.addEventListener("click", () => {
      filesPath = filesPath.split("/").slice(0, -1).join("/");
      renderFiles();
    });
    up.append(b);
    list.append(up);
  }

  if (!listing.entries.length) {
    const li = document.createElement("li");
    li.className = "files-msg";
    li.textContent = t("files.empty");
    list.append(li);
    return;
  }

  listing.entries.forEach((e) => {
    const li = document.createElement("li");
    const row = document.createElement("button");
    row.type = "button";
    row.className = "files-row" + (e.isDir ? " dir" : "");

    const name = document.createElement("span");
    name.className = "n";
    name.textContent = e.name;
    row.append(name);

    // Why the map ignores this folder, said here rather than left to be
    // wondered about. Both are true statements about the disk: the folder is
    // there, and nothing under it is in the map.
    if (e.nestedRepo || e.skipped) {
      const why = document.createElement("span");
      why.className = "why";
      why.textContent = t(e.nestedRepo ? "files.nested" : "files.skipped");
      row.append(why);
    }

    const meta = document.createElement("span");
    meta.className = "m";
    meta.textContent = e.isDir ? "" : formatSize(e.size);
    row.append(meta);

    row.addEventListener("click", () => {
      if (e.isDir) {
        filesPath = e.path;
        renderFiles();
        return;
      }
      // A file opens where files open — the editor setting decides which,
      // and an empty setting means the desktop's own association.
      invoke("open_in_editor", { id: selectedId, path: e.path, line: null }).catch((err) =>
        say(String(err))
      );
    });

    li.append(row);
    list.append(li);
  });
}

/** Show the filetree instead of the map, or the other way back. */
function setFiles(on) {
  filesOpen = on;
  document.getElementById("files").hidden = !on;
  // The map keeps its src: coming back should not cost a reload of a
  // two-megabyte page that has not changed.
  els.frame.hidden = on || !mapBase;
  els.placeholder.hidden = on || !!mapBase;
  if (on) {
    filesPath = "";
    renderFiles();
  }
  syncMenu();
}


// =====================================================================
// Workspaces
//
// A workspace is a set of projects and nothing else. Theme, language, zoom
// and the engine paths stay properties of this machine — carrying them per
// workspace would change somebody's lighting when they switch project sets,
// which is not what switching project sets is for.
//
// **When the dashboard appears** is a decision rather than a setting:
// whenever there is more than one workspace. Somebody with a single
// workspace never sees it, which is what a "don't show again" checkbox buys
// — without a setting to find. The checkbox exists anyway, for the reader
// who has several and still wants to land in the last one.
//
// An earlier version of this comment also claimed "on a first run", which
// the code below never did and should not: a first run has exactly one
// workspace, and a chooser with one row is the click in front of the thing
// you wanted that the rule above exists to avoid. Corrected here rather
// than implemented, because the comment was the part that was wrong.
// =====================================================================

const WS_SKIP_KEY = "docmap.skipWorkspaceDashboard";

/**
 * The workspace the app is in, and how many exist.
 *
 * Kept here rather than asked for at each use: the window title needs both
 * on every project change, and a title is not worth a round trip.
 */
let activeWorkspace = null;
let workspaceCount = 1;

const ws = {
  box: document.getElementById("wsbox"),
  list: document.getElementById("ws-list"),
  name: document.getElementById("ws-new"),
  create: document.getElementById("ws-create"),
  problem: document.getElementById("ws-problem"),
  skip: document.getElementById("ws-skip"),
};

function wsSkipped() {
  try {
    return localStorage.getItem(WS_SKIP_KEY) === "1";
  } catch (e) {
    void e;
    return false;
  }
}

async function renderWorkspaces() {
  let entries;
  try {
    entries = await invoke("list_workspaces");
  } catch (e) {
    ws.problem.textContent = String(e);
    ws.problem.hidden = false;
    return [];
  }
  activeWorkspace = (entries.find((w) => w.active) || {}).name || null;
  workspaceCount = entries.length;
  ws.list.innerHTML = "";
  entries.forEach((w) => {
    const li = document.createElement("li");
    li.className = "ws-row" + (w.active ? " active" : "");

    const open = document.createElement("button");
    open.type = "button";
    open.className = "ws-open";
    const n = document.createElement("span");
    n.className = "n";
    n.textContent = w.name;
    const c = document.createElement("span");
    c.className = "c";
    c.textContent = fill(t("ws.count"), { n: w.projects });
    open.append(n, c);
    open.addEventListener("click", () => useWorkspace(w.name));
    li.append(open);

    const ren = document.createElement("button");
    ren.type = "button";
    ren.className = "ws-act";
    ren.textContent = t("ws.rename");
    ren.addEventListener("click", async () => {
      const to = prompt(t("ws.rename.prompt"), w.name);
      if (!to || to === w.name) return;
      try {
        await invoke("rename_workspace", { from: w.name, to });
        await renderWorkspaces();
      } catch (e) {
        ws.problem.textContent = String(e);
        ws.problem.hidden = false;
      }
    });

    const del = document.createElement("button");
    del.type = "button";
    del.className = "ws-act";
    del.textContent = t("ws.delete");
    del.addEventListener("click", async () => {
      // The wording has to survive being misread: this removes a list, never
      // a repository — the same promise "Remove from workspace" makes, one
      // scale up.
      if (!confirm(fill(t("ws.delete.confirm"), { name: w.name }))) return;
      try {
        await invoke("delete_workspace", { name: w.name });
        await renderWorkspaces();
      } catch (e) {
        ws.problem.textContent = String(e);
        ws.problem.hidden = false;
      }
    });

    li.append(ren, del);
    ws.list.append(li);
  });
  return entries;
}

/** Switch to a workspace and close the dashboard. */
async function useWorkspace(name) {
  ws.problem.hidden = true;
  try {
    const list = await invoke("switch_workspace", { name });
    activeWorkspace = name;
    // Nothing from the old workspace may survive the switch: a selection
    // pointing at a project this workspace does not contain would leave the
    // sidebar naming one thing and the map showing another.
    selectedId = null;
    mapBase = null;
    freshness.clear();
    pageCounts.clear();
    showPlaceholder(t("ph.none.title"), t("ph.none.body"));
    await refresh(list);
    // Re-listed because switching can *create*: the count in the title
    // would otherwise be one behind the workspace you are now in.
    await renderWorkspaces();
    titleFor(null);
    ws.box.close();
  } catch (e) {
    ws.problem.textContent = String(e);
    ws.problem.hidden = false;
  }
}

ws.create.addEventListener("click", () => {
  const name = ws.name.value.trim();
  if (!name) return;
  ws.name.value = "";
  useWorkspace(name);
});

ws.skip.addEventListener("change", () => {
  try {
    localStorage.setItem(WS_SKIP_KEY, ws.skip.checked ? "1" : "0");
  } catch (e) {
    void e;
  }
});

async function openWorkspaces() {
  ws.problem.hidden = true;
  ws.skip.checked = wsSkipped();
  await renderWorkspaces();
  ws.box.showModal();
}

/**
 * Show the dashboard at startup, or do not.
 *
 * Returns whether it was shown, so the caller knows whether a project list
 * is already on screen or is about to be chosen.
 */
async function maybeOpenWorkspaces() {
  // Listed even when the dashboard is skipped: the window title needs to
  // know which workspace this is and how many there are, and skipping the
  // *dashboard* is not skipping the fact.
  const entries = await renderWorkspaces();
  if (wsSkipped()) return false;
  // One workspace is not a choice, and a chooser with one row is a click in
  // front of the thing you wanted.
  if (entries.length < 2) return false;
  ws.skip.checked = false;
  ws.box.showModal();
  return true;
}

// =====================================================================
// The menu bar
//
// `src-tauri/src/menu.rs` owns the structure — which items exist, their
// order, their accelerators. This owns the strings, because they are
// translations and the catalog next door is already the one place those
// live, with a spec that fails when a locale is short a key.
//
// Every item calls the same function its sidebar button calls. Two ways to
// reach one implementation, never two implementations: `docs/MENUBAR.md`'s
// last "what I would not build" entry is exactly this, and it is the reason
// the sidebar keeps one button rather than a mirror of the menu.
// =====================================================================

/** Item id → what it does. Keys must match `menu.rs`; `menu.test.js` checks. */
const MENU_ACTIONS = {
  "menu.file.add": () => els.add.click(),
  "menu.file.open_browser": async () => {
    if (!selectedId) return;
    try {
      await invoke("open_map_in_browser", { id: selectedId });
    } catch (e) {
      say(String(e));
    }
  },
  "menu.file.export": () => exportCurrentView(),
  "menu.file.reveal": async () => {
    if (!selectedId) return;
    try {
      await invoke("reveal_project", { id: selectedId });
    } catch (e) {
      say(String(e));
    }
  },
  "menu.file.copy_path": async () => {
    const p = projects.find((x) => x.id === selectedId);
    if (!p) return;
    try {
      // The webview's own clipboard rather than a plugin: the text is a
      // path this process already handed the page, so nothing new crosses
      // the boundary and there is no second capability to grant.
      await navigator.clipboard.writeText(p.root);
      say(fill(t("copy.path.done"), { path: p.root }));
    } catch (e) {
      say(String(e));
    }
  },
  "menu.file.remove": () => selectedId && removeProject(selectedId),
  "menu.file.workspaces": () => openWorkspaces(),
  "menu.file.settings": () => openPrefs(),
  "menu.project.scope": () => selectedId && openScope(),
  "menu.project.generate": () => selectedId && generateFor(selectedId),
  "menu.project.generate_all": () => generateAll(),
  "menu.project.generate_stale": () => generateStale(),
  "menu.project.check": () => selectedId && checkMap(selectedId),
  "menu.project.generate_full": () => selectedId && generateFor(selectedId, true),
  "menu.project.regenerate": async () => {
    if (!selectedId) return;
    await generateFor(selectedId);
    await select(selectedId);
  },
  "menu.view.theme.system": () => chooseTheme("system"),
  "menu.view.theme.light": () => chooseTheme("light"),
  "menu.view.theme.dark": () => chooseTheme("dark"),
  "menu.view.zoom_in": async () => {
    await applyZoom(zoomStep(1));
    syncMenu();
  },
  "menu.view.zoom_out": async () => {
    await applyZoom(zoomStep(-1));
    syncMenu();
  },
  "menu.view.zoom_reset": async () => {
    await applyZoom(1);
    syncMenu();
  },
  "menu.view.files": () => setFiles(!filesOpen),
  "menu.view.sidebar": () => {
    applySidebar(!sidebarShown);
    syncMenu();
  },
  "menu.help.feedback": () => openFeedback(),
  "menu.help.settings_folder": async () => {
    try {
      await invoke("reveal_settings");
    } catch (e) {
      say(String(e));
    }
  },
  "menu.help.about": () => openAbout(),
  "menu.help.usage": () => openDocs("usage"),
  "menu.help.engine": () => openDocs("engine"),
};

/**
 * Name the window after the selected project.
 *
 * The heading in the sidebar is the application; the title bar is the
 * subject. Before this they both read `docmap`, one directly above the
 * other.
 *
 * The project name is never translated and never escaped away — it is the
 * subject, and the interface is the only thing the catalog speaks for.
 */
function titleFor(project) {
  // The workspace is named only when there is more than one, which is the
  // only time the answer is news. `<project> — <workspace> — docmap` is a
  // long title to carry for somebody who will never have a second one.
  const parts = [];
  if (project) parts.push(project.name);
  if (workspaceCount > 1 && activeWorkspace) parts.push(activeWorkspace);
  parts.push("docmap");
  invoke("set_window_title", { title: parts.join(" — ") }).catch((e) => void e);
}

/** Must match `menu::LOCALE_ID`. */
const LOCALE_ITEM = "menu.view.lang:";

/**
 * Change the theme from either surface.
 *
 * The sidebar select is updated too, rather than left showing the old
 * value: two controls for one setting is already a compromise, and two
 * controls disagreeing about it is a bug.
 */
function chooseTheme(choice) {
  applyTheme(choice);
  try {
    localStorage.setItem(THEME_KEY, choice);
  } catch (e) {
    void e;
  }
  document.getElementById("theme").value = choice;
  retheme();
  syncMenu();
}

/** The same, for the interface language. */
function chooseLocale(code) {
  locale = setLocale(code);
  try {
    localStorage.setItem(LANG_KEY, locale);
  } catch (e) {
    void e;
  }
  document.getElementById("lang").value = locale;
  applyLocale();
  syncMenu();
}


/* ---------------------------------------------------- per-project settings

   Two questions the engine can be asked about scope, and nothing else:
   which languages to read here, and which paths to leave out. Both live on
   the project rather than on this machine — see `scopebox`'s own comment in
   `index.html` — and both are passed to the engine on the Rust side, looked
   up by root, so `Generate`, `Generate all` and `Check exactly` honour them
   without each remembering to.

   Read on open and written on Save, rather than live: this is a form, and a
   form that writes on every keystroke turns a half-typed path into a stored
   setting. */

/** The project the dialog is currently editing, so Save cannot follow a
    selection change made behind the modal. */
let scopeProject = null;

/**
 * Render the language checkboxes.
 *
 * Built from `engine_languages()` — the engine's own capability handshake —
 * rather than from a list here. A list here would be a twenty-fourth backend
 * away from lying, and it would also have nothing to say about grammars.
 *
 * **The three grammar states stay three.** `grammar_loaded: false` means a
 * backend that wants a grammar and has none: a complete module tree and no
 * function-level data. `null` means a backend that needs no parser at all,
 * which is full fidelity rather than a degradation — assembly is the one.
 * Collapsing them would report a healthy backend as broken, which is exactly
 * what the engine keeps them apart to prevent.
 *
 * When the engine cannot be asked, the list is replaced by the sentence
 * saying so. An empty list of checkboxes would read as "this engine supports
 * no languages", which is a different and much worse claim.
 *
 * @param {string[]|null} chosen Names ticked, or null for "all of them".
 */
function renderScopeLanguages(chosen) {
  const list = document.getElementById("scope-langs");
  list.textContent = "";
  const known = engineLangs && engineLangs.languages;
  if (!known || known.length === 0) {
    const li = document.createElement("li");
    li.textContent = t("scope.languages.unknown");
    li.className = "scope-hint";
    list.appendChild(li);
    return;
  }
  const picked = new Set(chosen || []);
  for (const lang of known) {
    const li = document.createElement("li");
    const label = document.createElement("label");
    const box = document.createElement("input");
    box.type = "checkbox";
    box.value = lang.name;
    box.checked = picked.has(lang.name);
    const name = document.createElement("code");
    name.textContent = lang.name;
    label.appendChild(box);
    label.appendChild(name);
    li.appendChild(label);

    let hint = null;
    if (lang.grammar_loaded === false) {
      hint = t("scope.languages.nogrammar");
    } else if (lang.grammar_loaded === null || lang.grammar_loaded === undefined) {
      hint = t("scope.languages.nogrammarneeded");
    }
    if (hint) {
      const span = document.createElement("span");
      span.className = "scope-hint";
      span.textContent = hint;
      li.appendChild(span);
    }
    list.appendChild(li);
  }
}

/** Open the per-project settings dialog for the selected project. */
async function openScope() {
  const p = projects.find((x) => x.id === selectedId);
  if (!p) return;
  scopeProject = p;

  const lead = document.getElementById("scope-lead");
  // `innerHTML` because the sentence carries a `<strong>` around the project
  // name, and the name is the one substituted value — escaped, because a
  // directory name is not this program's text. Same rule the placeholder
  // bodies follow.
  lead.innerHTML = fill(t("scope.lead"), { name: escapeHtml(p.name) });

  const problem = document.getElementById("scope-problem");
  problem.hidden = true;
  problem.textContent = "";

  let scope = { exclude: [], languages: null };
  try {
    scope = await invoke("project_scope_get", { id: p.id });
  } catch (e) {
    void e;
  }
  document.getElementById("scope-exclude").value = (scope.exclude || []).join("\n");
  renderScopeLanguages(scope.languages);
  document.getElementById("scopebox").showModal();
}

document.getElementById("scope-save").addEventListener("click", async () => {
  if (!scopeProject) return;
  const boxes = [...document.querySelectorAll("#scope-langs input:checked")];
  const exclude = document
    .getElementById("scope-exclude")
    .value.split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  try {
    await invoke("project_scope_set", {
      id: scopeProject.id,
      exclude,
      // Nothing ticked is `null`, not `[]`: the two mean the same thing to
      // the engine, and one spelling means the dialog can un-tick everything
      // without inventing a third state that reads as "an empty map, please".
      languages: boxes.length > 0 ? boxes.map((b) => b.value) : null,
    });
    say(fill(t("scope.saved"), { name: scopeProject.name }));
    document.getElementById("scopebox").close();
  } catch (e) {
    const problem = document.getElementById("scope-problem");
    problem.textContent = fill(t("scope.failed"), { error: String(e) });
    problem.hidden = false;
  }
});

/* A folder picker beside the textarea, because the paths are
   repository-relative and typing one by hand is where the typo lives. The
   picker returns an absolute path; the only thing this has to do is refuse a
   directory outside the project rather than storing a path that can never
   match. */
document.getElementById("scope-add").addEventListener("click", async () => {
  if (!scopeProject) return;
  const problem = document.getElementById("scope-problem");
  try {
    const dir = await open({
      directory: true,
      multiple: false,
      defaultPath: scopeProject.root,
      title: t("scope.add"),
    });
    if (!dir) return;
    // `split`/`join` rather than a regex: the pattern would be a backslash
    // class inside a literal, which is the one place this file has had to be
    // escaped three deep. Two plain string operations say the same thing and
    // cannot be misread.
    const slash = (s) => s.split("\\").join("/").replace(/\/+$/, "");
    const root = slash(scopeProject.root);
    const picked = slash(String(dir));
    if (picked === root || picked.indexOf(root + "/") !== 0) {
      problem.textContent = fill(t("scope.outside"), { path: picked });
      problem.hidden = false;
      return;
    }
    const rel = picked.slice(root.length + 1);
    const field = document.getElementById("scope-exclude");
    const lines = field.value.split("\n").map((l) => l.trim()).filter(Boolean);
    if (!lines.includes(rel)) {
      lines.push(rel);
    }
    field.value = lines.join("\n");
    problem.hidden = true;
  } catch (e) {
    problem.textContent = fill(t("scope.failed"), { error: String(e) });
    problem.hidden = false;
  }
});

/**
 * Open Settings.
 *
 * The engine and Neovim state is copied in when it opens rather than kept
 * in step continuously: the dialog is modal, so the sidebar's own copy is
 * behind it and the two are never on screen together — and a path being
 * pointed at is exactly what someone wants to read while they point at a
 * different one.
 */
function openPrefs() {
  document.getElementById("prefs-engine-state").textContent =
    els.engineState.textContent;
  // Read on open rather than kept in sync: it is a text field nothing else
  // writes.
  invoke("editor_command", { set: null })
    .then((cmd) => {
      document.getElementById("editor-cmd").value = cmd || "";
    })
    .catch((e) => void e);
  document.getElementById("prefs-nvim-state").textContent =
    els.nvimState.textContent;
  // Asked when the dialog opens rather than kept live: reading it walks a
  // directory, and nothing changes it while the dialog is shut.
  renderTelemetry();
  document.getElementById("prefsbox").showModal();
}

/**
 * The versions, as text somebody can paste.
 *
 * Never translated. This block is read by whoever triages the report, not
 * by the person writing it — the same rule the feedback dialog's
 * environment block follows.
 *
 * `dirty` is carried through rather than dropped: a binary built from a
 * modified tree has a commit that does not describe it, and a bug report
 * quoting that commit sends the reader to the wrong diff.
 */
function aboutFacts() {
  const lines = [];
  if (aboutInfo) {
    lines.push("docmap-desktop " + aboutInfo.appVersion);
    lines.push(aboutInfo.os + " / " + aboutInfo.arch);
  }
  lines.push("engine: " + (engine.path || t("about.engineNone")));
  if (engineLangs && engineLangs.schema !== null && engineLangs.schema !== undefined) {
    lines.push("schema: " + engineLangs.schema);
  }
  const b = engineLangs && engineLangs.build;
  if (b && b.commit) {
    lines.push(
      "build: " + b.commit + (b.committedAt ? " (" + b.committedAt + ")" : "")
    );
    if (b.dirty) lines.push("  " + t("about.dirty"));
  } else {
    lines.push("build: " + t("about.buildNone"));
  }
  lines.push("grammars: " + (engine.grammars || "none"));
  lines.push("interface: " + locale);
  return lines.join("\n");
}

async function openAbout() {
  if (!aboutInfo) {
    try {
      aboutInfo = await invoke("about_info");
    } catch (e) {
      void e;
    }
  }
  document.getElementById("about-facts").textContent = aboutFacts();
  document.getElementById("aboutbox").showModal();
}

document.getElementById("about-copy").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(aboutFacts());
    say(t("about.copied"));
  } catch (e) {
    // A clipboard the window is not allowed to touch is not a reason to
    // lose the text: it is already on screen and selectable.
    say(String(e));
  }
});

document.getElementById("editor-cmd").addEventListener("change", (ev) => {
  invoke("editor_command", { set: ev.target.value }).catch((e) => say(String(e)));
});

async function openDocs(page) {
  try {
    await invoke("open_docs", { page });
  } catch (e) {
    say(String(e));
  }
}

/**
 * Hand Rust the labels and the enable state, and let it rebuild the menu.
 *
 * Called after the locale is settled, on every language change, and on every
 * selection change — the items that act on a project are greyed when there
 * is none, which is the one thing the sidebar's disabled Generate button
 * never explained.
 */
async function syncMenu() {
  const labels = {};
  for (const key of keys()) {
    if (key.startsWith("menu.")) labels[key] = t(key);
  }
  try {
    await invoke("set_menu", {
      labels,
      hasProject: Boolean(selectedId),
      state: viewState(),
    });
  } catch (e) {
    // Surfaced rather than swallowed: a window with no menu is a window
    // missing half its commands, and silence here would look like a menu
    // bar that is simply slow.
    say("Menu: " + String(e));
  }
}

// =====================================================================
// The per-project context menu
//
// Right-click on the detail block under the picker. Not on the picker
// itself: a `<select>` answers a right-click with the platform's own menu,
// and fighting a native control over the one thing it is for is a losing
// argument. The detail block is where the selected project is named, which
// is what these commands act on.
//
// Every item calls the same function its menu-bar twin calls — the third
// surface for one implementation, and still no second copy of any of them.
// =====================================================================

const projmenu = document.getElementById("projmenu");

/** Same ids as the menu bar, so the labels come from the same catalog keys. */
const PROJECT_CONTEXT = [
  "menu.project.generate",
  "menu.project.regenerate",
  "sep",
  "menu.file.open_browser",
  "menu.file.reveal",
  "menu.file.copy_path",
  "sep",
  "menu.file.remove",
];

function closeProjMenu() {
  projmenu.hidden = true;
}

function openProjMenu(x, y) {
  if (!selectedId) return;
  projmenu.innerHTML = "";
  PROJECT_CONTEXT.forEach((id) => {
    if (id === "sep") {
      const li = document.createElement("li");
      li.className = "sep";
      li.setAttribute("role", "separator");
      projmenu.append(li);
      return;
    }
    const li = document.createElement("li");
    li.setAttribute("role", "none");
    const b = document.createElement("button");
    b.type = "button";
    b.setAttribute("role", "menuitem");
    b.textContent = t(id);
    b.addEventListener("click", () => {
      closeProjMenu();
      const run = MENU_ACTIONS[id];
      if (run) run();
    });
    li.append(b);
    projmenu.append(li);
  });

  // Shown before measuring: a hidden element has no size, so flipping it
  // away from the edges has to happen after it is on screen.
  projmenu.hidden = false;
  projmenu.style.left = "0px";
  projmenu.style.top = "0px";
  const r = projmenu.getBoundingClientRect();
  const left = Math.min(x, window.innerWidth - r.width - 6);
  const top = Math.min(y, window.innerHeight - r.height - 6);
  projmenu.style.left = Math.max(6, left) + "px";
  projmenu.style.top = Math.max(6, top) + "px";
  const first = projmenu.querySelector("button");
  if (first) first.focus();
}

els.detail.addEventListener("contextmenu", (ev) => {
  if (!selectedId) return;
  ev.preventDefault();
  openProjMenu(ev.clientX, ev.clientY);
});

// Closing, by every route someone would expect: a click anywhere else,
// Escape, a scroll, and the window losing focus. The map is an iframe and
// swallows clicks that never reach this document, so its own pointer events
// are not one of the routes — which is why the window `blur` is.
document.addEventListener("click", (ev) => {
  if (!projmenu.hidden && !projmenu.contains(ev.target)) closeProjMenu();
});
document.addEventListener("keydown", (ev) => {
  if (ev.key === "Escape" && !projmenu.hidden) {
    closeProjMenu();
    els.detail.focus?.();
  }
});
window.addEventListener("blur", closeProjMenu);
window.addEventListener("resize", closeProjMenu);

{
  const { listen } = window.__TAURI__.event;
  listen("menu", (ev) => {
    // The language items are built from the locale list rather than from
    // `menu.rs`, so their ids carry the code after a colon and cannot be
    // table entries.
    if (ev.payload.startsWith(LOCALE_ITEM)) {
      chooseLocale(ev.payload.slice(LOCALE_ITEM.length));
      return;
    }
    const run = MENU_ACTIONS[ev.payload];
    if (run) run();
  });
  syncMenu();
}
