// The app's own interface language.
//
// This is `documentation.nvim/docs/ROADMAP/IDEAS/I18N.md`'s phase I18N-4,
// and only that phase: **the app's chrome, not the generated page.** The
// page is a different artifact with a different lifetime — roughly 85 % of
// that plan's total work — and translating it here would mean two catalogs
// for one product.
//
// Four rules from that plan, applied:
//
//   1. **The interface is translated; the subject never is.** Project names,
//      paths, language names, repository descriptions, `gh`'s own error text
//      and the engine's report are the user's content and stay verbatim in
//      every locale.
//   2. **A missing key falls back to English and says so.** `?i18n=debug`
//      marks fallbacks visibly, so a half-finished locale is measurable
//      rather than merely embarrassing. Never a blank, never a raw key.
//   3. **Locale names are endonyms.** `Deutsch`, not `German`.
//   4. **No case transforms on catalog output.** A CSS `text-transform` on a
//      translated label is the Turkish dotless-ı bug waiting to happen, so
//      the labels that used to rely on one carry their own casing.
//
// German is here because the author is a native speaker and can tell when it
// is wrong — the plan's bar for shipping a locale unmarked. Anything else
// needs someone who can do the same.

/** Catalogs. `en` is the source: every other locale translates *it*. */
const CATALOGS = {
  en: {
    "app.subtitle": "module maps, by project",
    "sidebar.add": "Add project…",
    "sidebar.generate": "Generate map",
    "sidebar.generateAll": "Generate all",
    "sidebar.empty":
      "No projects yet. <strong>Add project…</strong> points this at a repository; it does not have to have a map already.",
    "engine.label": "Engine",
    "engine.locate": "Locate…",
    "engine.grammars": "Grammars…",
    "nvim.label": "Neovim",
    "nvim.locate": "Locate nvim…",
    "nvim.locateConfig": "Locate config…",
    "prefs.theme.system": "Theme: system",
    "prefs.theme.light": "Theme: light",
    "prefs.theme.dark": "Theme: dark",
    "prefs.language": "Language",
    "view.nothing": "Nothing selected",
    "view.pickOne": "Pick a project on the left.",

    "add.title": "Add a project",
    "add.tab.folder": "Folder",
    "add.tab.nvim": "Neovim config",
    "add.tab.url": "URL",
    "add.folder.lead":
      "Any directory on this machine. It does not need a <code>docs/map</code> yet — if it has none and an engine is configured, one is generated straight away, because there is nothing to overwrite.",
    "add.folder.go": "Choose a folder…",
    "add.nvim.lead":
      "Reads the <strong>plugin specs your Neovim config declares</strong> and adds every plugin as its own project, cloning the ones that are not on this machine yet. It does not read anything else about the config, and it changes nothing in it.",
    "add.nvim.note":
      "Which <code>nvim</code> and which config directory it uses is what the sidebar's <strong>Neovim</strong> panel shows — open it if this fails.",
    "add.nvim.go": "Read the config…",
    "add.url.lead":
      "A repository URL, cloned shallow into this app's own cache and then added like any folder. Whatever a plain <code>git clone</code> of that URL needs on this machine is what runs here — this app holds no credentials of its own.",
    "add.url.go": "Clone",
    "add.url.placeholder": "https://github.com/owner/repo",
    "add.repos.load": "List my GitHub repositories",
    "add.repos.filter": "Filter…",
    "add.close": "Close",

    "help.add":
      "Add a project three ways: a folder on this machine, every plugin your Neovim config declares, or a repository URL — including a pick-list of your own GitHub repositories.",
    "help.generate":
      "Rebuild the selected project's map, overwriting what is there. Writes into that repository's docs/map.",
    "help.generateAll":
      "Rebuild every project in the list, one after another. The only button that writes to repositories you did not select — the label counts progress while it runs.",
    "menu.help.engine":
      "documentation.nvim's standalone binary — this app runs it, it does not replace it. The word beside the label is the verdict that decides whether generation works, and at what fidelity.",
    "help.engineLocate":
      "Point at documentation.nvim's standalone binary. Only needed when it is not on PATH — the line above says which one was found.",
    "help.grammars":
      "Point at a directory of compiled tree-sitter grammars. Decides fidelity, not success: without them you get a complete module tree and no per-function data.",
    "help.nvim":
      "Which nvim binary and which config directory the plugin-spec import reads. Only needed when either is somewhere unusual — most machines resolve both on their own.",
    "help.nvimLocate":
      "Point at the nvim binary used for importing plugin specs. Only needed when it is not on PATH.",
    "help.nvimConfig":
      "Point at the Neovim config directory to read plugin specs from, when it is not in the platform-conventional place.",
    "help.theme":
      "Light, dark, or whatever the operating system is set to. System is the default and stays choosable, so a choice made once can be handed back.",
    "help.language":
      "The language of this window. It does not change the generated map, which is a separate artifact with its own translation.",

    "repos.notInstalled":
      "GitHub CLI (gh) is not on PATH. Install it to pick from your repositories, or paste a URL above — that works either way.",
    "repos.notAuthenticated":
      "GitHub CLI is installed but not signed in. Run `gh auth login` once, then try again. Pasting a URL above works either way.",
    "repos.failed": "GitHub CLI could not list your repositories.",
    "repos.asking": "Asking gh…",
    "repos.none": "That account has no repositories.",
    // The menu bar. Keys are the item ids `src-tauri/src/menu.rs` builds
    // with, joined by string — `menu_labels_spec` asserts the two lists
    // match, because nothing else would notice an id renamed on one side.
    // Ellipses mean the same thing here as on the buttons: this opens
    // something rather than doing something.
    "menu.view": "View",
    "menu.view.theme": "Theme",
    // Three states: "system" is a choice, not the absence of one.
    "menu.view.theme.system": "System",
    "menu.view.theme.light": "Light",
    "menu.view.theme.dark": "Dark",
    // The submenu title is translated; the languages inside it are
    // endonyms and are never sent through the catalog.
    "menu.view.language": "Language",
    "menu.view.zoom_in": "Zoom in",
    "menu.view.zoom_out": "Zoom out",
    "menu.view.zoom_reset": "Actual size",
    "menu.view.sidebar": "Sidebar",
    "menu.file": "File",
    "menu.project": "Project",
    "menu.tools": "Tools",
    "menu.help": "Help",
    "menu.file.add": "Add project…",
    "menu.file.open_browser": "Open map in browser",
    "menu.file.reveal": "Reveal in file manager",
    // Worded so the distinction cannot be missed: this removes the entry,
    // never the repository.
    "menu.file.remove": "Remove from workspace",
    "menu.project.generate": "Generate map",
    "menu.project.generate_all": "Generate all",
    "menu.project.regenerate": "Regenerate and reload",
    "menu.tools.engine": "Locate engine…",
    "menu.tools.grammars": "Grammars…",
    "menu.tools.nvim": "Locate nvim…",
    "menu.tools.nvim_config": "Locate Neovim config…",
    "menu.help.usage": "Usage",
    "menu.help.engine": "What the engine is",
  },

  de: {
    "app.subtitle": "Modulkarten, pro Projekt",
    "sidebar.add": "Projekt hinzufügen…",
    "sidebar.generate": "Karte erzeugen",
    "sidebar.generateAll": "Alle erzeugen",
    "sidebar.empty":
      "Noch keine Projekte. <strong>Projekt hinzufügen…</strong> richtet das hier auf ein Repository; eine Karte muss es noch nicht haben.",
    "engine.label": "Engine",
    "engine.locate": "Suchen…",
    "engine.grammars": "Grammatiken…",
    "nvim.label": "Neovim",
    "nvim.locate": "nvim suchen…",
    "nvim.locateConfig": "Config suchen…",
    "prefs.theme.system": "Darstellung: System",
    "prefs.theme.light": "Darstellung: hell",
    "prefs.theme.dark": "Darstellung: dunkel",
    "prefs.language": "Sprache",
    "view.nothing": "Nichts ausgewählt",
    "view.pickOne": "Wähle links ein Projekt.",

    "add.title": "Projekt hinzufügen",
    "add.tab.folder": "Ordner",
    "add.tab.nvim": "Neovim-Config",
    "add.tab.url": "URL",
    "add.folder.lead":
      "Ein beliebiges Verzeichnis auf diesem Rechner. Es braucht noch kein <code>docs/map</code> — hat es keines und ist eine Engine eingerichtet, wird sofort eine Karte erzeugt, weil es nichts zu überschreiben gibt.",
    "add.folder.go": "Ordner wählen…",
    "add.nvim.lead":
      "Liest die <strong>Plugin-Specs, die deine Neovim-Config deklariert</strong>, und fügt jedes Plugin als eigenes Projekt hinzu; die noch nicht vorhandenen werden geklont. Sonst wird nichts an der Config gelesen und nichts verändert.",
    "add.nvim.note":
      "Welches <code>nvim</code> und welches Config-Verzeichnis dabei benutzt werden, zeigt das <strong>Neovim</strong>-Panel in der Seitenleiste — öffne es, wenn das hier scheitert.",
    "add.nvim.go": "Config lesen…",
    "add.url.lead":
      "Eine Repository-URL, flach in den eigenen Zwischenspeicher der App geklont und dann wie jeder Ordner hinzugefügt. Was ein einfaches <code>git clone</code> dieser URL auf diesem Rechner braucht, läuft auch hier — diese App hält keine eigenen Zugangsdaten.",
    "add.url.go": "Klonen",
    "add.url.placeholder": "https://github.com/besitzer/repo",
    "add.repos.load": "Meine GitHub-Repositories auflisten",
    "add.repos.filter": "Filtern…",
    "add.close": "Schließen",

    "help.add":
      "Ein Projekt auf drei Wegen hinzufügen: ein Ordner auf diesem Rechner, jedes Plugin, das deine Neovim-Config deklariert, oder eine Repository-URL — samt Auswahlliste deiner eigenen GitHub-Repositories.",
    "help.generate":
      "Die Karte des gewählten Projekts neu bauen und die vorhandene überschreiben. Schreibt in dessen docs/map.",
    "help.generateAll":
      "Jedes Projekt der Liste neu bauen, eines nach dem anderen. Der einzige Knopf, der auch in Repositories schreibt, die du nicht ausgewählt hast — die Beschriftung zählt den Fortschritt mit.",
    "menu.help.engine":
      "Das Standalone-Binary von documentation.nvim — diese App führt es aus, sie ersetzt es nicht. Das Wort neben der Beschriftung ist das Urteil darüber, ob und wie genau erzeugt werden kann.",
    "help.engineLocate":
      "Auf das Standalone-Binary von documentation.nvim zeigen. Nur nötig, wenn es nicht auf PATH liegt — die Zeile darüber sagt, welches gefunden wurde.",
    "help.grammars":
      "Auf ein Verzeichnis mit kompilierten tree-sitter-Grammatiken zeigen. Entscheidet die Genauigkeit, nicht den Erfolg: ohne sie bekommst du einen vollständigen Modulbaum ohne Funktionsdaten.",
    "help.nvim":
      "Welches nvim-Binary und welches Config-Verzeichnis der Plugin-Spec-Import liest. Nur nötig, wenn eines davon an einem ungewöhnlichen Ort liegt — die meisten Rechner lösen beides selbst auf.",
    "help.nvimLocate":
      "Auf das nvim-Binary zeigen, mit dem Plugin-Specs gelesen werden. Nur nötig, wenn es nicht auf PATH liegt.",
    "help.nvimConfig":
      "Auf das Neovim-Config-Verzeichnis zeigen, aus dem Plugin-Specs gelesen werden, wenn es nicht am plattformüblichen Ort liegt.",
    "help.theme":
      "Hell, dunkel, oder was das Betriebssystem eingestellt hat. System ist die Vorgabe und bleibt wählbar, damit eine einmal getroffene Wahl zurückgegeben werden kann.",
    "help.language":
      "Die Sprache dieses Fensters. Sie ändert nichts an der erzeugten Karte — die ist ein eigenes Artefakt mit eigener Übersetzung.",

    "repos.notInstalled":
      "Die GitHub-CLI (gh) liegt nicht auf PATH. Installiere sie, um aus deinen Repositories zu wählen — oder füge oben eine URL ein, das geht so oder so.",
    "repos.notAuthenticated":
      "Die GitHub-CLI ist installiert, aber nicht angemeldet. Einmal `gh auth login` ausführen, dann erneut versuchen. Eine URL oben einzufügen geht so oder so.",
    "repos.failed": "Die GitHub-CLI konnte deine Repositories nicht auflisten.",
    "repos.asking": "Frage gh…",
    "repos.none": "Dieses Konto hat keine Repositories.",
    "menu.view": "Ansicht",
    "menu.view.theme": "Darstellung",
    "menu.view.theme.system": "System",
    "menu.view.theme.light": "Hell",
    "menu.view.theme.dark": "Dunkel",
    "menu.view.language": "Sprache",
    "menu.view.zoom_in": "Vergrößern",
    "menu.view.zoom_out": "Verkleinern",
    "menu.view.zoom_reset": "Originalgröße",
    "menu.view.sidebar": "Seitenleiste",
    "menu.file": "Datei",
    "menu.project": "Projekt",
    "menu.tools": "Werkzeuge",
    "menu.help": "Hilfe",
    "menu.file.add": "Projekt hinzufügen…",
    "menu.file.open_browser": "Karte im Browser öffnen",
    "menu.file.reveal": "Im Explorer zeigen",
    "menu.file.remove": "Aus der Liste entfernen",
    "menu.project.generate": "Karte erzeugen",
    "menu.project.generate_all": "Alle erzeugen",
    "menu.project.regenerate": "Neu erzeugen und laden",
    "menu.tools.engine": "Engine suchen…",
    "menu.tools.grammars": "Grammatiken…",
    "menu.tools.nvim": "nvim suchen…",
    "menu.tools.nvim_config": "Neovim-Config suchen…",
    "menu.help.usage": "Bedienung",
    "menu.help.engine": "Was die Engine ist",
  },
};

/** Locale names in their own language — never translated into the current one. */
export const LOCALES = [
  { code: "en", label: "English" },
  { code: "de", label: "Deutsch" },
];

let active = "en";
let debug = false;

/** The locale to start in: a saved choice, else the OS, else English. */
export function initialLocale(saved, navigatorLanguage) {
  if (saved && CATALOGS[saved]) return saved;
  const base = String(navigatorLanguage || "").slice(0, 2).toLowerCase();
  return CATALOGS[base] ? base : "en";
}

export function setLocale(code, options) {
  active = CATALOGS[code] ? code : "en";
  if (options && typeof options.debug === "boolean") debug = options.debug;
  return active;
}

export function locale() {
  return active;
}

/**
 * One string.
 *
 * A missing key falls back to English rather than to a blank or to the key
 * itself — a locale at 60 % should read as unfinished English, not as a
 * broken window. `?i18n=debug` prefixes fallbacks so the gap is countable.
 */
export function t(key) {
  const here = CATALOGS[active] || CATALOGS.en;
  if (Object.prototype.hasOwnProperty.call(here, key)) return here[key];
  const en = CATALOGS.en[key];
  if (en === undefined) return debug ? "‹missing:" + key + "›" : "";
  return debug ? "‹en› " + en : en;
}

/** Every key the source catalog defines — what a completeness check counts. */
export function keys() {
  return Object.keys(CATALOGS.en);
}

/** A locale's own keys, for the same check. */
export function keysOf(code) {
  return Object.keys(CATALOGS[code] || {});
}
