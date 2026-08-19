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
    "sidebar.add": "Add project…",
    "sidebar.generate": "Generate map",
    "sidebar.empty":
      "No projects yet. <strong>Add project…</strong> points this at a repository; it does not have to have a map already.",
    "engine.label": "Engine",
    "engine.locate": "Locate…",
    "engine.grammars": "Grammars…",
    "nvim.label": "Neovim",
    "nvim.locate": "Locate nvim…",
    "nvim.locateConfig": "Locate config…",
    "prefs.theme.system": "System",
    "prefs.theme.light": "Light",
    "prefs.theme.dark": "Dark",
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
    "sort.name": "Name",
    "sort.stale": "Needs regenerating",
    "sort.added": "Added",
    "help.sort": "Which order the project list is in. <strong>Needs regenerating</strong> puts the ones whose sources have changed since their map was built at the top.",
    "detail.nomap": "no map generated yet",
    "count.modules": "modules",
    "count.namespaces": "namespaces",
    "count.files": "files",
    "count.errors": "errors",
    "count.warnings": "warnings",
    "detail.stale": "sources are newer than the map",
    "detail.oldSchema": "written by an older engine (schema {map}, this one writes {engine}) — regenerate to get what it can do now",
    "detail.staleWhy": "Compared by modification time, which is cheap and approximate: a file saved without an edit in it counts. Generating again is the only thing that says for certain.",
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
    "menu.view.files": "Files on disk",
    "files.empty": "This folder is empty.",
    "files.skipped": "not scanned",
    "files.nested": "its own repository — not scanned",
    "menu.help.feedback": "Send feedback…",
    "menu.help.about": "About docmap",
    "about.lead": "A window in front of the maps <strong>documentation.nvim</strong> generates.",
    "about.copy": "Copy for a bug report",
    "about.copied": "Copied.",
    "about.engineNone": "no engine configured",
    "about.dirty": "built from a modified tree — the commit does not describe this binary",
    "about.buildNone": "no build stamp — run from a source checkout, or built before stamping existed",
    "fb.title": "Send feedback",
    "fb.lead":
      "This opens a prefilled report on GitHub in your browser. Nothing is sent from here — you read it there and press Submit yourself, signed in as you.",
    "fb.topic": "Topic",
    "fb.topic.feature": "Feature request",
    "fb.topic.bug": "Something is broken",
    "fb.topic.question": "Question",
    "fb.topic.docs": "Documentation",
    "fb.topic.other": "Something else",
    "fb.repo": "About",
    "fb.repo.desktop": "This window (docmap-desktop)",
    "fb.repo.engine": "The engine and the generated map (documentation.nvim)",
    "fb.subject": "Summary",
    "fb.subject.placeholder": "One line: what happened, or what is missing",
    "fb.body": "Details",
    "fb.body.placeholder":
      "What you did, what you expected, what happened instead. For a feature request: what you were trying to get done.",
    "fb.attach": "Attach version and platform",
    "fb.attach.note":
      "Shown below exactly as it will be sent. Almost every report needs it, and almost nobody remembers to include it.",
    "fb.go": "Open on GitHub…",
    "fb.needsSubject": "A one-line summary, at least — an untitled report is the one nobody opens.",
    "menu.file": "File",
    "menu.project": "Project",
    "menu.help": "Help",
    "menu.file.add": "Add project…",
    "menu.file.settings": "Settings…",
    "menu.file.workspaces": "Workspaces…",
    "ws.title": "Workspaces",
    "ws.lead": "Each workspace is its own set of projects. Settings — theme, language, engine paths — belong to this machine and are shared by all of them.",
    "ws.count": "{n} project(s)",
    "ws.rename": "Rename",
    "ws.rename.prompt": "New name for this workspace",
    "ws.delete": "Delete",
    "ws.delete.confirm": "Delete the workspace {name}? This removes the list only — every repository in it stays exactly where it is.",
    "ws.new.placeholder": "New workspace…",
    "ws.create": "Create",
    "ws.skip": "Don't show this again — open the last workspace",
    "prefs.title": "Settings",
    "prefs.appearance": "Appearance",
    "prefs.theme": "Theme",
    "prefs.engine": "Engine",
    "prefs.engine.note": "The engine is <strong>documentation.nvim's standalone binary</strong> — this app runs it, it does not replace it. Where it is on PATH there is nothing to do here, ever.",
    "prefs.telemetry": "Telemetry",
    "prefs.telemetry.note": "Collected by <strong>runtime-analysis.nvim</strong> inside Neovim, per plugin. Switching it here takes effect from the next Neovim session — nothing in this window runs your plugin.",
    "tel.absent": "runtime-analysis.nvim has never written a cache on this machine.",
    "tel.unknown": "No telemetry for {name}. A namespace is a plugin name, so this only applies to a project that registers telemetry under its own.",
    "tel.on": "Collecting — {sessions} session(s), {days} day(s) recorded.",
    "tel.off": "Switched off. {sessions} session(s) already recorded are kept.",
    "tel.enable": "Switch on for the next session",
    "tel.disable": "Switch off from the next session",
    "tel.snaps": "Snapshots, newest first",
    "tel.snapItem": "{name} — {when} · {sessions} session(s)",
    "tel.snaps.none": "No snapshots. They are only taken by <code>:RATelemetry snapshot &lt;name&gt;</code> — never automatically, so that retention never evicts one nobody meant to take.",
    "tel.failed": "Could not read the telemetry cache.",
    "prefs.editor": "Editor",
    "prefs.editor.note": "What <strong>Open in editor</strong> runs, from the map's own right-click menu. <code>{file}</code> and <code>{line}</code> are substituted. Leave it empty to hand the file to whatever your desktop opens it with.",
    "prefs.editor.placeholder": "code -g {file}:{line}",
    "prefs.nvim": "Neovim",
    "prefs.nvim.note": "Only needed to import plugin specs from a Neovim config. Most machines resolve both of these on their own.",
    "menu.file.open_browser": "Open map in browser",
    "menu.file.reveal": "Reveal in file manager",
    "menu.file.copy_path": "Copy project path",
    "copy.path.done": "Copied: {path}",
    "menu.file.export": "Export current view…",
    "export.none": "Nothing to export: the current view has no diagram. Hierarchy draws one.",
    // The view-area placeholders. Catalogued as a set rather than one at a
    // time: `showPlaceholder` was called from eight places with English
    // literals, so a German window showed a translated sentence under an
    // untranslated heading. Half the set would have kept exactly that.
    "ph.none.title": "Nothing selected",
    "ph.none.body": "Pick a project on the left.",
    "ph.nomap.title": "No map in this project yet",
    "ph.nomap.generate": "Press <strong>Generate map</strong> to build one.",
    "ph.nomap.noengine":
      "Locate the engine in the sidebar first — it is <code>documentation.nvim</code>'s standalone binary.",
    "ph.generating.title": "Generating…",
    "ph.generating.body": "Running the engine over <code>{root}</code>.",
    "ph.genall.title": "Generating all projects",
    "ph.genall.body": "Running the engine over {n} project(s).",
    "ph.failed.title": "Generation failed",
    "ph.failed.body": "The engine exited with code {code}.",
    "ph.enginefail.title": "Could not run the engine",
    "map.blank.title": "The map did not load",
    "map.blank.body": "The page was asked for and never reported itself. Generating again usually fixes it; if it does not, the address below is what was requested.",
    "export.silent": "The map did not answer. It may still be loading.",
    "export.done": "Saved {name}",
    // Worded so the distinction cannot be missed: this removes the entry,
    // never the repository.
    "menu.file.remove": "Remove from workspace",
    "menu.project.generate": "Generate map",
    "menu.project.generate_all": "Generate all",
    // Named by what it acts on rather than by "all": the point is that it
    // skips the ones that are already current.
    "menu.project.generate_stale": "Generate the out-of-date ones",
    "menu.project.check": "Check exactly",
    // The staleness mark compares modification times; this runs the analysis
    // and compares the output. Worded as the difference, because a reader
    // who has both needs to know which one just answered them.
    "check.running": "Asking the engine whether the map would come out different…",
    "check.current": "The map is exactly current — regenerating would change nothing.",
    "check.stale": "The map would come out different. Regenerate to settle it.",
    "check.failed": "The check could not run: {error}",
    "ph.check.title": "Checking the map",
    "ph.check.body": "Running the engine over <code>{root}</code> without writing anything.",
    "gen.stale.checking": "Checking which maps have fallen behind…",
    "gen.stale.none": "Every map is current — nothing to generate.",
    "menu.project.regenerate": "Regenerate and reload",
    "menu.project.generate_full": "Generate map (full)",
    "gen.full.needsLuals": "Full generation needs lua-language-server on PATH. The map was not written; the ordinary Generate map still works and is complete apart from the type detail.",
    "gen.all.progress": "Generating {n} of {total} — {name}",
    "menu.help.usage": "Usage",
    "menu.help.engine": "What the engine is",
    "menu.help.settings_folder": "Open the settings folder",
  },

  de: {
    "sidebar.add": "Projekt hinzufügen…",
    "sidebar.generate": "Karte erzeugen",
    "sidebar.empty":
      "Noch keine Projekte. <strong>Projekt hinzufügen…</strong> richtet das hier auf ein Repository; eine Karte muss es noch nicht haben.",
    "engine.label": "Engine",
    "engine.locate": "Suchen…",
    "engine.grammars": "Grammatiken…",
    "nvim.label": "Neovim",
    "nvim.locate": "nvim suchen…",
    "nvim.locateConfig": "Config suchen…",
    "prefs.theme.system": "System",
    "prefs.theme.light": "Hell",
    "prefs.theme.dark": "Dunkel",
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
    "sort.name": "Name",
    "sort.stale": "Neu zu erzeugen",
    "sort.added": "Hinzugefügt",
    "help.sort": "In welcher Reihenfolge die Projektliste steht. <strong>Neu zu erzeugen</strong> stellt die nach oben, deren Quellen sich seit der Karte geändert haben.",
    "detail.nomap": "noch keine Karte erzeugt",
    "count.modules": "Module",
    "count.namespaces": "Namespaces",
    "count.files": "Dateien",
    "count.errors": "Fehler",
    "count.warnings": "Warnungen",
    "detail.stale": "Quellen sind neuer als die Karte",
    "detail.oldSchema": "von einer älteren Engine geschrieben (Schema {map}, diese schreibt {engine}) — neu erzeugen, um zu bekommen, was sie inzwischen kann",
    "detail.staleWhy": "Verglichen über den Änderungszeitpunkt — billig und ungefähr: eine Datei, die ohne Änderung gespeichert wurde, zählt mit. Sicher weiß man es erst nach dem Neuerzeugen.",
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
    "menu.view.files": "Dateien auf der Platte",
    "files.empty": "Dieser Ordner ist leer.",
    "files.skipped": "nicht gescannt",
    "files.nested": "eigenes Repository — nicht gescannt",
    "menu.help.feedback": "Feedback senden…",
    "menu.help.about": "Über docmap",
    "about.lead": "Ein Fenster vor den Karten, die <strong>documentation.nvim</strong> erzeugt.",
    "about.copy": "Für einen Fehlerbericht kopieren",
    "about.copied": "Kopiert.",
    "about.engineNone": "keine Engine konfiguriert",
    "about.dirty": "aus einem geänderten Baum gebaut — der Commit beschreibt dieses Binary nicht",
    "about.buildNone": "kein Build-Stempel — aus einem Quell-Checkout gestartet, oder gebaut bevor es den Stempel gab",
    "fb.title": "Feedback senden",
    "fb.lead":
      "Das öffnet einen vorausgefüllten Bericht auf GitHub im Browser. Von hier wird nichts gesendet — du liest ihn dort und schickst ihn selbst ab, angemeldet als du.",
    "fb.topic": "Thema",
    "fb.topic.feature": "Featurewunsch",
    "fb.topic.bug": "Etwas ist kaputt",
    "fb.topic.question": "Frage",
    "fb.topic.docs": "Dokumentation",
    "fb.topic.other": "Sonstiges",
    "fb.repo": "Betrifft",
    "fb.repo.desktop": "Dieses Fenster (docmap-desktop)",
    "fb.repo.engine": "Engine und erzeugte Karte (documentation.nvim)",
    "fb.subject": "Kurzfassung",
    "fb.subject.placeholder": "Eine Zeile: was passiert ist, oder was fehlt",
    "fb.body": "Details",
    "fb.body.placeholder":
      "Was du getan hast, was du erwartet hast, was stattdessen passiert ist. Bei einem Featurewunsch: was du eigentlich erreichen wolltest.",
    "fb.attach": "Version und Plattform anhängen",
    "fb.attach.note":
      "Unten steht genau das, was mitgeschickt wird. Fast jeder Bericht braucht es, und fast niemand denkt daran.",
    "fb.go": "Auf GitHub öffnen…",
    "fb.needsSubject": "Wenigstens eine Kurzfassung — einen Bericht ohne Titel öffnet niemand.",
    "menu.file": "Datei",
    "menu.project": "Projekt",
    "menu.help": "Hilfe",
    "menu.file.add": "Projekt hinzufügen…",
    "menu.file.settings": "Einstellungen…",
    "menu.file.workspaces": "Arbeitsbereiche…",
    "ws.title": "Arbeitsbereiche",
    "ws.lead": "Jeder Arbeitsbereich ist eine eigene Menge von Projekten. Einstellungen — Darstellung, Sprache, Engine-Pfade — gehören zu diesem Rechner und gelten für alle.",
    "ws.count": "{n} Projekt(e)",
    "ws.rename": "Umbenennen",
    "ws.rename.prompt": "Neuer Name für diesen Arbeitsbereich",
    "ws.delete": "Löschen",
    "ws.delete.confirm": "Arbeitsbereich {name} löschen? Das entfernt nur die Liste — jedes Repository darin bleibt genau da, wo es ist.",
    "ws.new.placeholder": "Neuer Arbeitsbereich…",
    "ws.create": "Anlegen",
    "ws.skip": "Nicht mehr zeigen — den letzten Arbeitsbereich öffnen",
    "prefs.title": "Einstellungen",
    "prefs.appearance": "Darstellung",
    "prefs.theme": "Darstellung",
    "prefs.engine": "Engine",
    "prefs.engine.note": "Die Engine ist <strong>das Standalone-Binary von documentation.nvim</strong> — diese App führt es aus, sie ersetzt es nicht. Liegt es auf PATH, gibt es hier nie etwas zu tun.",
    "prefs.telemetry": "Telemetry",
    "prefs.telemetry.note": "Wird von <strong>runtime-analysis.nvim</strong> in Neovim erhoben, pro Plugin. Ein Umschalten hier wirkt ab der nächsten Neovim-Sitzung — in diesem Fenster läuft dein Plugin nicht.",
    "tel.absent": "runtime-analysis.nvim hat auf diesem Rechner noch nie einen Cache geschrieben.",
    "tel.unknown": "Keine Telemetry für {name}. Ein Namespace ist ein Plugin-Name — das gilt also nur für ein Projekt, das sich unter seinem eigenen registriert.",
    "tel.on": "Erhebt — {sessions} Sitzung(en), {days} Tag(e) aufgezeichnet.",
    "tel.off": "Abgeschaltet. Die {sessions} bereits aufgezeichneten Sitzung(en) bleiben erhalten.",
    "tel.enable": "Ab der nächsten Sitzung einschalten",
    "tel.disable": "Ab der nächsten Sitzung abschalten",
    "tel.snaps": "Snapshots, neueste zuerst",
    "tel.snapItem": "{name} — {when} · {sessions} Sitzung(en)",
    "tel.snaps.none": "Keine Snapshots. Die legt nur <code>:RATelemetry snapshot &lt;name&gt;</code> an — nie automatisch, damit die Retention keinen verdrängt, den niemand nehmen wollte.",
    "tel.failed": "Der Telemetry-Cache konnte nicht gelesen werden.",
    "prefs.editor": "Editor",
    "prefs.editor.note": "Was <strong>Im Editor öffnen</strong> ausführt, aus dem Rechtsklick-Menü der Karte. <code>{file}</code> und <code>{line}</code> werden ersetzt. Leer lassen, um die Datei dem zu übergeben, womit dein System sie öffnet.",
    "prefs.editor.placeholder": "code -g {file}:{line}",
    "prefs.nvim": "Neovim",
    "prefs.nvim.note": "Wird nur gebraucht, um Plugin-Specs aus einer Neovim-Config zu importieren. Die meisten Rechner finden beides von selbst.",
    "menu.file.open_browser": "Karte im Browser öffnen",
    "menu.file.reveal": "Im Explorer zeigen",
    "menu.file.copy_path": "Projektpfad kopieren",
    "copy.path.done": "Kopiert: {path}",
    "menu.file.export": "Aktuelle Ansicht exportieren…",
    "export.none": "Nichts zu exportieren: die aktuelle Ansicht hat kein Diagramm. Hierarchy zeichnet eines.",
    "ph.none.title": "Nichts ausgewählt",
    "ph.none.body": "Wähle links ein Projekt.",
    "ph.nomap.title": "Noch keine Karte in diesem Projekt",
    "ph.nomap.generate": "Mit <strong>Karte erzeugen</strong> eine anlegen.",
    "ph.nomap.noengine":
      "Zuerst die Engine in der Seitenleiste suchen — sie ist das eigenständige Binary von <code>documentation.nvim</code>.",
    "ph.generating.title": "Wird erzeugt…",
    "ph.generating.body": "Die Engine läuft über <code>{root}</code>.",
    "ph.genall.title": "Alle Projekte werden erzeugt",
    "ph.genall.body": "Die Engine läuft über {n} Projekt(e).",
    "ph.failed.title": "Erzeugung fehlgeschlagen",
    "ph.failed.body": "Die Engine endete mit Code {code}.",
    "ph.enginefail.title": "Die Engine ließ sich nicht starten",
    "map.blank.title": "Die Karte wurde nicht geladen",
    "map.blank.body": "Die Seite wurde angefordert und hat sich nie gemeldet. Neu erzeugen hilft meist; wenn nicht, steht unten die angeforderte Adresse.",
    "export.silent": "Die Karte hat nicht geantwortet. Vielleicht lädt sie noch.",
    "export.done": "{name} gespeichert",
    "menu.file.remove": "Aus der Liste entfernen",
    "menu.project.generate": "Karte erzeugen",
    "menu.project.generate_all": "Alle erzeugen",
    "menu.project.generate_stale": "Die veralteten erzeugen",
    "menu.project.check": "Genau prüfen",
    "check.running": "Frage die Engine, ob die Karte anders herauskäme…",
    "check.current": "Die Karte ist exakt aktuell — neu erzeugen würde nichts ändern.",
    "check.stale": "Die Karte käme anders heraus. Neu erzeugen klärt es.",
    "check.failed": "Die Prüfung konnte nicht laufen: {error}",
    "ph.check.title": "Karte wird geprüft",
    "ph.check.body": "Die Engine läuft über <code>{root}</code>, ohne etwas zu schreiben.",
    "gen.stale.checking": "Prüfe, welche Karten zurückliegen…",
    "gen.stale.none": "Jede Karte ist aktuell — nichts zu erzeugen.",
    "menu.project.regenerate": "Neu erzeugen und laden",
    "menu.project.generate_full": "Karte erzeugen (full)",
    "gen.full.needsLuals": "Für die volle Erzeugung muss lua-language-server auf PATH liegen. Es wurde nichts geschrieben; das normale Karte erzeugen funktioniert weiter und ist bis auf die Typdetails vollständig.",
    "gen.all.progress": "Erzeuge {n} von {total} — {name}",
    "menu.help.usage": "Bedienung",
    "menu.help.engine": "Was die Engine ist",
    "menu.help.settings_folder": "Einstellungsordner öffnen",
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
