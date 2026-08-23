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
    "picker.none": "Pick a project…",
    "picker.overview": "All projects",
    "view.nothing": "Nothing selected",
    "view.pickOne": "Pick a project on the left.",

    "add.title": "Add a project",
    "add.tab.folder": "Folder",
    "add.tab.nvim": "Neovim config",
    "add.tab.url": "URL",
    "add.folder.lead":
      "Any folder on this machine. It does not need a <code>docs/map</code> yet — if it has none and an engine is set up, we build one right away, because there is nothing to overwrite.",
    "add.folder.go": "Choose a folder…",
    "add.nvim.lead":
      "Reads the <strong>plugin specs your Neovim config declares</strong> and adds every plugin as its own project, cloning the ones you do not have yet. It reads nothing else about your config, and changes nothing in it.",
    "add.nvim.note":
      "Which <code>nvim</code> and which config directory it uses is what the sidebar's <strong>Neovim</strong> panel shows — open it if this fails.",
    "add.nvim.go": "Read the config…",
    "add.url.lead":
      "A repository URL. We clone it shallow into this app's own cache and then add it like any folder. Whatever a plain <code>git clone</code> of that URL needs on this machine is what runs here — this app keeps no credentials of its own.",
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
      "documentation.nvim's standalone binary — this app runs it, it does not replace it. The word beside the label tells you whether it was found, and how much detail it can read.",
    "help.engineLocate":
      "Point at documentation.nvim's standalone binary. You only need this if you want a different one than the app already uses — the line above says which that is.",
    "help.grammars":
      "Point at a folder of compiled tree-sitter grammars. This decides how much detail you get, not whether it works: without them you still get the full module tree, just no per-function data.",
    "help.nvim":
      "Which nvim binary and which config folder the plugin-spec import reads. You only need this if one of them sits somewhere unusual — most machines find both on their own.",
    "help.nvimLocate":
      "Point at the nvim binary used for importing plugin specs. You only need this if it is not on your PATH.",
    "help.nvimConfig":
      "Point at the Neovim config folder to read plugin specs from, if yours is not in the usual place for this platform.",
    "help.theme":
      "Light, dark, or whatever your operating system is set to. System is the default and stays available, so you can always hand the choice back.",
    "help.language":
      "The language of this window. It does not change the generated map, which is a separate artifact with its own translation.",
    "help.scopeSource":
      "Which folder or folders the engine reads code from, relative to the project. Leave it empty and it finds them itself, which is right almost always — set it for a repository that keeps two languages in two places, or sources somewhere unusual.",
    "help.scopeOutDir":
      "Where the map is written inside the project, relative to its folder. Empty means docs/map. Change it and this window follows the map to its new home.",
    "help.scopeRepoUrl":
      "The repository's address online. It is what the “view source” links in the generated page point at — without it the page works and simply has no links out.",
    "help.scopeBranch":
      "Which branch those source links point at. Empty means main.",
    "help.scopeFull":
      "Always use the fuller, slower generation for this project. It needs lua-language-server installed and only adds anything to a Lua project.",

    "repos.notInstalled":
      "The GitHub CLI (gh) is not on your PATH. Install it to pick from your own repositories — or paste a URL above, which works either way.",
    "repos.notAuthenticated":
      "The GitHub CLI is installed but not signed in. Run `gh auth login` once and try again — or paste a URL above, which works either way.",
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
    // Named for the question rather than the field, the same way "stale"
    // became "Needs regenerating": nobody sorts by a timestamp, they sort
    // by "which have I left alone the longest".
    "sort.generated": "Least recently generated",
    "sort.added": "Added",
    "help.sort": "Which order the project list is in. <strong>Needs regenerating</strong> puts the ones whose sources have changed since their map was built at the top; <strong>Least recently generated</strong> asks the other question — which have been left alone longest, including the ones nobody has touched.",
    "detail.nomap": "no map generated yet",
    "count.modules": "modules",
    "count.namespaces": "namespaces",
    "count.files": "files",
    "count.errors": "errors",
    "count.warnings": "warnings",
    "detail.stale": "sources are newer than the map",
    "detail.oldSchema": "written by an older engine (schema {map}, this one writes {engine}) — generate it again to get what the engine can do now",
    "detail.staleWhy": "We compare modification times, which is quick but only approximate — a file you saved without changing anything counts too. Generating again is the only way to know for sure.",
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
    "files.untracked": "not in git",
    "files.ignored": "ignored by git — but still mapped",
    "menu.help.feedback": "Send feedback…",
    "menu.help.about": "About docmap",
    "about.lead": "A window in front of the maps <strong>documentation.nvim</strong> generates.",
    "about.copy": "Copy for a bug report",
    "about.copied": "Copied.",
    "about.engineNone": "no engine configured",
    "about.dirty": "built from a modified working tree, so the commit does not describe this build exactly",
    "about.buildNone": "no build stamp — started from a source checkout, or built before stamping existed",
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
      "Below is exactly what will be sent along. It helps with almost every report, and it is easy to forget.",
    "fb.go": "Open on GitHub…",
    "fb.needsSubject": "A short title, please — a report without one is the one nobody opens.",
    "menu.file": "File",
    "menu.project": "Project",
    "menu.help": "Help",
    "menu.file.add": "Add project…",
    "menu.file.settings": "Settings…",
    "menu.file.workspaces": "Workspaces…",
    "ws.title": "Workspaces",
    "ws.lead": "Each workspace is its own list of projects. Your settings — theme, language, paths — belong to this machine and apply in all of them.",
    "ws.count": "{n} project(s)",
    "ws.rename": "Rename",
    "ws.rename.prompt": "New name for this workspace",
    "ws.delete": "Delete",
    "ws.delete.confirm": "Delete the workspace {name}? That removes the list only — every repository in it stays exactly where it is.",
    "ws.new.placeholder": "New workspace…",
    "ws.create": "Create",
    "ws.skip": "Don't show this again — open the last workspace",
    "prefs.title": "Settings",
    "prefs.appearance": "Appearance",
    "prefs.theme": "Theme",
    "prefs.behaviour": "Behaviour",
    "prefs.sort": "Order projects by",
    "prefs.startDashboard": "Start with the workspace overview",
    "help.startDashboard":
      "Whether opening the app shows the list of all your projects first, or goes straight back to the one you had open. You can switch this from the overview itself too.",
    "prefs.engine": "Engine",
    "prefs.engine.note": "The engine is <strong>documentation.nvim's standalone binary</strong> — this app runs it, it does not replace it. You normally do not need to set anything: the app brings its own along and uses that. Point at another one only if you want yours instead.",
    "prefs.telemetry": "Telemetry",
    "prefs.telemetry.note": "Collected by <strong>runtime-analysis.nvim</strong> inside Neovim, per plugin. Switching it here takes effect from your next Neovim session — your plugin does not run in this window.",
    // The notes shown over a panel the engine here cannot fill. Catalogued
    // 2026-08-19 with the placeholders, for the same reason and by the same
    // test: they were built as English literals inside `contextNoteFor`,
    // where nothing walking `data-i18n` attributes would ever find them.
    "note.telemetry":
      "Telemetry is collected by <code>runtime-analysis.nvim</code> inside a running Neovim session. This app can switch collection on for your next session — <strong>Settings → Telemetry</strong> — but it cannot run your plugin, so it only shows what was collected there.",
    "note.types":
      "Type data comes from <code>lua-language-server</code> (<code>:DocMap full</code>, inside Neovim). The standalone engine this app runs has no equivalent, so it cannot produce it.",
    "note.calls":
      "This panel is empty because the engine cannot extract calls for this project's languages yet — not because the project has no calls. Five of its language backends produce a call graph; the rest do not, and nothing about those languages makes it impossible.",
    "tel.absent": "runtime-analysis.nvim has never written a cache on this machine.",
    "tel.unknown": "No telemetry for {name}. A namespace is a plugin name, so you will only see data for a project that registers telemetry under its own.",
    "tel.on": "Collecting — {sessions} session(s), {days} day(s) recorded.",
    "tel.off": "Switched off. {sessions} session(s) already recorded are kept.",
    "tel.enable": "Switch on for the next session",
    "tel.disable": "Switch off from the next session",
    "tel.snaps": "Snapshots, newest first",
    "tel.snapItem": "{name} — {when} · {sessions} session(s)",
    "tel.snaps.none": "No snapshots yet. They are only taken by <code>:RATelemetry snapshot &lt;name&gt;</code> — never automatically, so nothing you meant to keep gets cleaned away.",
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
    "export.none": "There is nothing to export here — this view does not draw a diagram. Switch to Hierarchy, which does.",
    // The view-area placeholders. Catalogued as a set rather than one at a
    // time: `showPlaceholder` was called from eight places with English
    // literals, so a German window showed a translated sentence under an
    // untranslated heading. Half the set would have kept exactly that.
    "ph.none.title": "Nothing selected",
    "ph.none.body": "Pick a project on the left.",
    "ph.nomap.title": "No map in this project yet",
    "ph.nomap.generate": "Press <strong>Generate map</strong> to build one.",
    "ph.nomap.noengine":
      "Find the engine in the sidebar first — that is <code>documentation.nvim</code>'s standalone binary.",
    "ph.generating.title": "Generating…",
    "ph.generating.body": "Running the engine over <code>{root}</code>.",
    "deps.summary.none": "Nothing here depends on anything else here",
    "deps.summary.some": "What depends on what — {n} of these are used by others",
    "deps.usedBy.one": "used by one project",
    "deps.usedBy": "used by {n} projects",
    "deps.sites.one": "in one place",
    "deps.sites": "in {n} places",
    "deps.modules": "most used: {list}",
    "deps.outside.one": "From outside the workspace: {list} — and one more.",
    "deps.outside": "From outside the workspace: {list} — and {n} more.",
    "deps.outside.all": "From outside the workspace: {list}.",
    "deps.unread.one": "One map could not be read, so nothing here speaks for it.",
    "deps.unread": "{n} maps could not be read, so nothing here speaks for them.",
    "ov.title": "Your projects",
    "ov.empty": "Nothing here yet. <strong>Add project…</strong> points this at a repository — it does not need a map already.",
    "ov.headline.allGood": "All {total} look fine.",
    "ov.headline.needs": "{n} of {total} could use a look.",
    "ov.headline.measuring": "Checking {n} more…",
    "ov.pick": "Pick one to open its map.",
    "ov.state.noMap": "no map yet",
    "ov.state.behind": "made by an older engine",
    "ov.state.stale": "changed since it was made",
    "ov.state.stale.for": "changed since it was made, {ago} ago",
    "ov.state.ok": "up to date",
    "ov.state.unknown": "checking…",
    "ov.state.maybe": "nothing found, though not everything was checked",
    "ov.counts": "{modules} module(s) · {files} file(s)",
    "ov.genBehind.one": "Remake the older one",
    "ov.genBehind": "Remake the {n} older ones",
    "ov.ago.min.one": "a minute",
    "ov.ago.min": "{n} minutes",
    "ov.ago.hour.one": "an hour",
    "ov.ago.hour": "{n} hours",
    "ov.ago.day.one": "a day",
    "ov.ago.day": "{n} days",
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
    "menu.project.scope": "Project settings…",
    "scope.title": "Project settings",
    "scope.lead": "These settings apply to <strong>{name}</strong> only. The ones that apply to every project live under File → Settings.",
    "scope.languages": "Languages",
    "scope.languages.note": "You normally do not need anything here — with nothing ticked, the engine reads <strong>every language it knows</strong>. Tick a few only if you want to narrow it down on purpose.",
    "scope.languages.unknown": "We could not ask the engine which languages it reads. You can point at one under File → Settings — or just leave this empty, and it will read everything.",
    "scope.languages.nogrammar": "no grammar — module tree only",
    "scope.languages.nogrammarneeded": "needs no grammar",
    "scope.exclude": "Excluded paths",
    "scope.exclude.note": "Folders to skip when the map is built — one per line, relative to the project folder. Everything underneath is skipped with it. You do not need to list vendored or generated folders like <code>node_modules</code>, <code>target</code> or <code>dist</code>: those are left out anyway.",
    "scope.exclude.placeholder": "src/generated\nthird_party",
    "scope.add": "Add folder…",
    "scope.save": "Save",
    "scope.saved": "Saved. The next generation for {name} uses these.",
    "scope.failed": "Could not save the project settings: {error}",
    "scope.layout": "Layout",
    "scope.layout.note":
      "Where this repository keeps its code and its map. Leave both empty to let the engine decide — it finds the sources itself and writes to <code>docs/map</code>, which is right for almost every project.",
    "scope.source": "Sources",
    "scope.source.placeholder": "lua, src",
    "scope.outdir": "Map directory",
    "scope.outdir.placeholder": "docs/map",
    "scope.links": "Source links",
    "scope.links.note":
      "What the <em>view source</em> links in the generated page point at. Without a URL the page still works and simply has no links out — which is the difference people notice between a map made here and one made by the same engine in CI.",
    "scope.repourl": "Repository URL",
    "scope.repourl.placeholder": "https://github.com/user/repo",
    "scope.branch": "Branch",
    "scope.branch.placeholder": "main",
    "scope.generate": "Generating",
    "scope.full": "Always generate this project fully",
    "scope.full.note":
      "Adds the <code>lua-language-server</code> enrichment behind the Types panel. It needs that tool installed, takes longer, and gains a non-Lua project nothing — so it is a choice per project, not a setting for this machine.",

    // The diagnosis behind "no grammar for …". Four sentences rather than
    // one with holes in it: "the directory holds other things", "it holds
    // nothing", "it is gone" and "there is none" each have a different next
    // step, and a single string with an optional clause would blur them.
    // `{example}` is a grammar name the engine actually asked for, so the
    // file name in the sentence is one that would work rather than an
    // invented illustration.
    "grammars.diag.dir":
      "The engine reads grammars from <code>{dir}</code>, which currently holds {have}. Each one is a shared library named after its grammar — <code>{example}.dll</code>, <code>.so</code> or <code>.dylib</code>.",
    "grammars.diag.empty":
      "The engine reads grammars from <code>{dir}</code>, and that folder is empty right now. Each one is a shared library named after its grammar — <code>{example}.dll</code>, <code>.so</code> or <code>.dylib</code>.",
    "grammars.diag.gone":
      "The grammars folder you set, <code>{dir}</code>, is not there any more. Point at another one with <strong>Grammars…</strong> in Settings.",
    "grammars.diag.none":
      "No grammars folder is set, and this build does not bring one along. You can point at one with <strong>Grammars…</strong> in Settings.",
    "scope.outside": "{path} is not inside this project, so it cannot be excluded from it.",
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
    "picker.none": "Projekt wählen…",
    "picker.overview": "Alle Projekte",
    "view.nothing": "Nichts ausgewählt",
    "view.pickOne": "Wähle links ein Projekt.",

    "add.title": "Projekt hinzufügen",
    "add.tab.folder": "Ordner",
    "add.tab.nvim": "Neovim-Config",
    "add.tab.url": "URL",
    "add.folder.lead":
      "Ein beliebiger Ordner auf diesem Rechner. Er braucht noch kein <code>docs/map</code> — wenn keines da ist und eine Engine bereitsteht, erzeugen wir die Karte gleich, weil es nichts zu überschreiben gibt.",
    "add.folder.go": "Ordner wählen…",
    "add.nvim.lead":
      "Liest die <strong>Plugin-Specs, die deine Neovim-Config deklariert</strong>, und legt jedes Plugin als eigenes Projekt an; was du noch nicht hast, wird geklont. Sonst wird nichts aus deiner Config gelesen und nichts daran verändert.",
    "add.nvim.note":
      "Welches <code>nvim</code> und welches Config-Verzeichnis dabei benutzt werden, zeigt das <strong>Neovim</strong>-Panel in der Seitenleiste — öffne es, wenn das hier scheitert.",
    "add.nvim.go": "Config lesen…",
    "add.url.lead":
      "Eine Repository-URL. Wir klonen sie flach in den Zwischenspeicher der App und legen sie dann an wie jeden Ordner. Was ein einfaches <code>git clone</code> dieser URL auf deinem Rechner braucht, läuft auch hier — eigene Zugangsdaten hält diese App nicht.",
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
      "Das Standalone-Binary von documentation.nvim — diese App führt es aus, sie ersetzt es nicht. Das Wort daneben sagt dir, ob sie gefunden wurde und wie viel Detail sie lesen kann.",
    "help.engineLocate":
      "Auf das Standalone-Binary von documentation.nvim zeigen. Brauchst du nur, wenn du eine andere als die bereits benutzte willst — welche das ist, sagt die Zeile darüber.",
    "help.grammars":
      "Auf einen Ordner mit kompilierten tree-sitter-Grammatiken zeigen. Das entscheidet, wie viel Detail du bekommst — nicht, ob es funktioniert: ohne sie bekommst du weiterhin die vollständige Modulübersicht, nur eben nichts auf Funktionsebene.",
    "help.nvim":
      "Welches nvim-Binary und welchen Config-Ordner der Plugin-Spec-Import liest. Brauchst du nur, wenn eines davon an einem ungewöhnlichen Ort liegt — die meisten Rechner finden beides von allein.",
    "help.nvimLocate":
      "Auf das nvim-Binary zeigen, mit dem Plugin-Specs gelesen werden. Brauchst du nur, wenn es nicht auf deinem PATH liegt.",
    "help.nvimConfig":
      "Auf den Neovim-Config-Ordner zeigen, aus dem Plugin-Specs gelesen werden — falls deiner nicht am plattformüblichen Ort liegt.",
    "help.theme":
      "Hell, dunkel, oder was dein Betriebssystem eingestellt hat. System ist die Vorgabe und bleibt wählbar — du kannst die Wahl also jederzeit wieder abgeben.",
    "help.language":
      "Die Sprache dieses Fensters. Sie ändert nichts an der erzeugten Karte — die ist ein eigenes Artefakt mit eigener Übersetzung.",
    "help.scopeSource":
      "Aus welchem Ordner oder welchen Ordnern die Engine hier Code liest, relativ zum Projekt. Lass es leer, dann findet sie sie selbst — das ist fast immer richtig. Setze es für ein Repository mit zwei Sprachen an zwei Orten oder mit Quellen an einer ungewöhnlichen Stelle.",
    "help.scopeOutDir":
      "Wohin die Karte im Projekt geschrieben wird, relativ zum Projektordner. Leer bedeutet docs/map. Änderst du es, folgt dieses Fenster der Karte an den neuen Ort.",
    "help.scopeRepoUrl":
      "Die Online-Adresse des Repositorys. Darauf zeigen die „Quelltext“-Links in der erzeugten Seite — ohne sie funktioniert die Seite und hat einfach keine Links nach draußen.",
    "help.scopeBranch":
      "Auf welchen Branch diese Quelltext-Links zeigen. Leer bedeutet main.",
    "help.scopeFull":
      "Für dieses Projekt immer die vollständigere, langsamere Erzeugung verwenden. Sie braucht lua-language-server und bringt nur einem Lua-Projekt etwas.",

    "repos.notInstalled":
      "Die GitHub-CLI (gh) liegt nicht auf deinem PATH. Installiere sie, um aus deinen eigenen Repositories zu wählen — oder füge oben eine URL ein, das geht so oder so.",
    "repos.notAuthenticated":
      "Die GitHub-CLI ist installiert, aber nicht angemeldet. Melde dich einmal mit `gh auth login` an und versuch es erneut — oder füge oben eine URL ein, das geht so oder so.",
    "repos.failed": "Die GitHub-CLI konnte deine Repositories nicht auflisten.",
    "repos.asking": "Frage gh…",
    "repos.none": "Dieses Konto hat keine Repositories.",
    "sort.name": "Name",
    "sort.stale": "Neu zu erzeugen",
    "sort.generated": "Am längsten nicht erzeugt",
    "sort.added": "Hinzugefügt",
    "help.sort": "In welcher Reihenfolge die Projektliste steht. <strong>Neu zu erzeugen</strong> stellt die nach oben, deren Quellen sich seit der Karte geändert haben; <strong>Am längsten nicht erzeugt</strong> stellt die andere Frage — welche am längsten unangetastet sind, auch die, die niemand angefasst hat.",
    "detail.nomap": "noch keine Karte erzeugt",
    "count.modules": "Module",
    "count.namespaces": "Namespaces",
    "count.files": "Dateien",
    "count.errors": "Fehler",
    "count.warnings": "Warnungen",
    "detail.stale": "Quellen sind neuer als die Karte",
    "detail.oldSchema": "von einer älteren Engine geschrieben (Schema {map}, aktuell {engine}) — erzeuge sie neu, dann bekommst du, was die Engine inzwischen kann",
    "detail.staleWhy": "Wir vergleichen die Änderungszeiten. Das geht schnell, ist aber nur ungefähr — eine Datei, die du ohne Änderung gespeichert hast, zählt mit. Sicher weißt du es erst, wenn du neu erzeugst.",
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
    "files.untracked": "nicht in git",
    "files.ignored": "von git ignoriert — trotzdem in der Karte",
    "menu.help.feedback": "Feedback senden…",
    "menu.help.about": "Über docmap",
    "about.lead": "Ein Fenster vor den Karten, die <strong>documentation.nvim</strong> erzeugt.",
    "about.copy": "Für einen Fehlerbericht kopieren",
    "about.copied": "Kopiert.",
    "about.engineNone": "keine Engine konfiguriert",
    "about.dirty": "aus einem geänderten Arbeitsstand gebaut — der Commit beschreibt dieses Programm also nicht genau",
    "about.buildNone": "kein Build-Stempel — aus einem Quell-Checkout gestartet, oder gebaut, bevor es den Stempel gab",
    "fb.title": "Feedback senden",
    "fb.lead":
      "Das öffnet einen vorausgefüllten Bericht auf GitHub in deinem Browser. Von hier wird nichts gesendet — du liest ihn dort und schickst ihn selbst ab, angemeldet als du.",
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
      "Unten siehst du genau, was mitgeschickt wird. Das hilft bei fast jedem Bericht — und geht leicht vergessen.",
    "fb.go": "Auf GitHub öffnen…",
    "fb.needsSubject": "Bitte noch einen kurzen Titel — ohne den geht ein Bericht leicht unter.",
    "menu.file": "Datei",
    "menu.project": "Projekt",
    "menu.help": "Hilfe",
    "menu.file.add": "Projekt hinzufügen…",
    "menu.file.settings": "Einstellungen…",
    "menu.file.workspaces": "Arbeitsbereiche…",
    "ws.title": "Arbeitsbereiche",
    "ws.lead": "Jeder Arbeitsbereich ist eine eigene Projektliste. Deine Einstellungen — Darstellung, Sprache, Pfade — gehören zu diesem Rechner und gelten überall.",
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
    "prefs.behaviour": "Verhalten",
    "prefs.sort": "Projekte sortieren nach",
    "prefs.startDashboard": "Mit der Workspace-Übersicht starten",
    "help.startDashboard":
      "Ob beim Öffnen der App zuerst die Liste aller Projekte erscheint oder direkt wieder das zuletzt geöffnete. Du kannst das auch in der Übersicht selbst umstellen.",
    "prefs.engine": "Engine",
    "prefs.engine.note": "Die Engine ist <strong>das Standalone-Binary von documentation.nvim</strong> — diese App führt es aus, sie ersetzt es nicht. Normalerweise musst du hier nichts einstellen: die App bringt ihre eigene mit und benutzt sie. Zeig nur dann auf eine andere, wenn du deine eigene benutzen willst.",
    "prefs.telemetry": "Telemetry",
    "prefs.telemetry.note": "Erhoben von <strong>runtime-analysis.nvim</strong> in Neovim, pro Plugin. Wenn du es hier umschaltest, gilt das ab deiner nächsten Neovim-Sitzung — in diesem Fenster läuft dein Plugin nicht.",
    "note.telemetry":
      "Telemetry erhebt <code>runtime-analysis.nvim</code> in einer laufenden Neovim-Sitzung. Diese App kann die Erhebung für deine nächste Sitzung einschalten — <strong>Einstellungen → Telemetry</strong> —, aber sie kann dein Plugin nicht ausführen und zeigt daher nur, was dort erhoben wurde.",
    "note.types":
      "Typdaten kommen von <code>lua-language-server</code> (<code>:DocMap full</code>, in Neovim). Die eigenständige Engine, die diese App ausführt, hat dafür keine Entsprechung und kann sie deshalb nicht erzeugen.",
    "note.calls":
      "Dieses Panel ist leer, weil die Engine für die Sprachen dieses Projekts noch keine Aufrufe auslesen kann — nicht, weil das Projekt keine hätte. Fünf ihrer Sprach-Backends erzeugen einen Aufrufgraphen, die übrigen noch nicht — unmöglich ist es bei keiner davon.",
    "tel.absent": "runtime-analysis.nvim hat auf diesem Rechner noch nie einen Cache geschrieben.",
    "tel.unknown": "Keine Telemetry für {name}. Ein Namespace ist ein Plugin-Name — du siehst hier also nur Daten für ein Projekt, das sich unter seinem eigenen registriert.",
    "tel.on": "Erhebt — {sessions} Sitzung(en), {days} Tag(e) aufgezeichnet.",
    "tel.off": "Abgeschaltet. Die {sessions} bereits aufgezeichneten Sitzung(en) bleiben erhalten.",
    "tel.enable": "Ab der nächsten Sitzung einschalten",
    "tel.disable": "Ab der nächsten Sitzung abschalten",
    "tel.snaps": "Snapshots, neueste zuerst",
    "tel.snapItem": "{name} — {when} · {sessions} Sitzung(en)",
    "tel.snaps.none": "Noch keine Snapshots. Die legt nur <code>:RATelemetry snapshot &lt;name&gt;</code> an — nie automatisch, damit nichts weggeräumt wird, das du behalten wolltest.",
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
    "export.none": "Hier gibt es nichts zu exportieren — diese Ansicht zeichnet kein Diagramm. Wechsle auf Hierarchy, dort gibt es eines.",
    "ph.none.title": "Nichts ausgewählt",
    "ph.none.body": "Wähle links ein Projekt.",
    "ph.nomap.title": "Noch keine Karte in diesem Projekt",
    "ph.nomap.generate": "Mit <strong>Karte erzeugen</strong> eine anlegen.",
    "ph.nomap.noengine":
      "Suche zuerst die Engine in der Seitenleiste — das ist das eigenständige Binary von <code>documentation.nvim</code>.",
    "ph.generating.title": "Wird erzeugt…",
    "ph.generating.body": "Die Engine läuft über <code>{root}</code>.",
    "deps.summary.none": "Hier hängt nichts an etwas anderem von hier",
    "deps.summary.some": "Was hängt woran — {n} davon werden von anderen benutzt",
    "deps.usedBy.one": "wird von einem Projekt benutzt",
    "deps.usedBy": "wird von {n} Projekten benutzt",
    "deps.sites.one": "an einer Stelle",
    "deps.sites": "an {n} Stellen",
    "deps.modules": "am meisten: {list}",
    "deps.outside.one": "Von außerhalb des Workspace: {list} — und eines weiter.",
    "deps.outside": "Von außerhalb des Workspace: {list} — und {n} weitere.",
    "deps.outside.all": "Von außerhalb des Workspace: {list}.",
    "deps.unread.one": "Eine Karte ließ sich nicht lesen, für die spricht hier also nichts.",
    "deps.unread": "{n} Karten ließen sich nicht lesen, für die spricht hier also nichts.",
    "ov.title": "Deine Projekte",
    "ov.empty": "Hier ist noch nichts. <strong>Projekt hinzufügen…</strong> zeigt auf ein Repository — eine Karte braucht es dafür noch nicht.",
    "ov.headline.allGood": "Alle {total} sehen gut aus.",
    "ov.headline.needs": "{n} von {total} könnten einen Blick vertragen.",
    "ov.headline.measuring": "Prüfe noch {n} …",
    "ov.pick": "Klick eines an, um seine Karte zu öffnen.",
    "ov.state.noMap": "noch keine Karte",
    "ov.state.behind": "von einer älteren Engine erstellt",
    "ov.state.stale": "seither geändert",
    "ov.state.stale.for": "seit der Erstellung geändert, vor {ago}",
    "ov.state.ok": "aktuell",
    "ov.state.unknown": "wird geprüft …",
    "ov.state.maybe": "nichts gefunden, es wurde aber nicht alles geprüft",
    "ov.counts": "{modules} Modul(e) · {files} Datei(en)",
    "ov.genBehind.one": "Die ältere neu erstellen",
    "ov.genBehind": "Die {n} älteren neu erstellen",
    "ov.ago.min.one": "einer Minute",
    "ov.ago.min": "{n} Minuten",
    "ov.ago.hour.one": "einer Stunde",
    "ov.ago.hour": "{n} Stunden",
    "ov.ago.day.one": "einem Tag",
    "ov.ago.day": "{n} Tagen",
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
    "menu.project.scope": "Projekteinstellungen…",
    "scope.title": "Projekteinstellungen",
    "scope.lead": "Diese Einstellungen gelten nur für <strong>{name}</strong>. Was für alle deine Projekte gilt, findest du unter Datei → Einstellungen.",
    "scope.languages": "Sprachen",
    "scope.languages.note": "Hier musst du normalerweise nichts tun — ohne Häkchen liest die Engine <strong>alle Sprachen, die sie kann</strong>. Hake nur an, wenn du sie bewusst einschränken willst.",
    "scope.languages.unknown": "Wir konnten die Engine nicht fragen, welche Sprachen sie liest. Du kannst unter Datei → Einstellungen eine auswählen — oder das hier einfach leer lassen, dann wird alles gelesen.",
    "scope.languages.nogrammar": "ohne Grammatik — nur die Modulübersicht",
    "scope.languages.nogrammarneeded": "braucht keine Grammatik",
    "scope.exclude": "Ausgeschlossene Pfade",
    "scope.exclude.note": "Ordner, die beim Erzeugen übersprungen werden sollen — einer pro Zeile, relativ zum Projektordner. Alles darunter wird mit übersprungen. Um Fremd- und Generatordner wie <code>node_modules</code>, <code>target</code> oder <code>dist</code> musst du dich nicht kümmern, die bleiben ohnehin außen vor.",
    "scope.exclude.placeholder": "src/generated\nthird_party",
    "scope.add": "Ordner hinzufügen…",
    "scope.save": "Speichern",
    "scope.saved": "Gespeichert. Die nächste Erzeugung für {name} benutzt diese Einstellungen.",
    "scope.failed": "Die Projekteinstellungen konnten nicht gespeichert werden: {error}",
    "scope.layout": "Aufbau",
    "scope.layout.note":
      "Wo dieses Repository seinen Code und seine Karte hat. Lass beides leer, dann entscheidet die Engine — sie findet die Quellen selbst und schreibt nach <code>docs/map</code>, was für fast jedes Projekt richtig ist.",
    "scope.source": "Quellen",
    "scope.source.placeholder": "lua, src",
    "scope.outdir": "Kartenordner",
    "scope.outdir.placeholder": "docs/map",
    "scope.links": "Quelltext-Links",
    "scope.links.note":
      "Worauf die <em>Quelltext</em>-Links in der erzeugten Seite zeigen. Ohne URL funktioniert die Seite weiterhin und hat einfach keine Links nach draußen — genau der Unterschied, der zwischen einer hier erzeugten Karte und einer aus der CI auffällt.",
    "scope.repourl": "Repository-URL",
    "scope.repourl.placeholder": "https://github.com/benutzer/repo",
    "scope.branch": "Branch",
    "scope.branch.placeholder": "main",
    "scope.generate": "Erzeugen",
    "scope.full": "Dieses Projekt immer vollständig erzeugen",
    "scope.full.note":
      "Ergänzt die <code>lua-language-server</code>-Anreicherung hinter dem Typen-Panel. Sie braucht dieses Werkzeug installiert, dauert länger und bringt einem Nicht-Lua-Projekt nichts — deshalb ist es eine Entscheidung pro Projekt und keine Einstellung für diesen Rechner.",

    "grammars.diag.dir":
      "Die Engine liest Grammatiken aus <code>{dir}</code>, dort liegen gerade {have}. Jede ist eine Shared Library, benannt nach ihrer Grammatik — <code>{example}.dll</code>, <code>.so</code> oder <code>.dylib</code>.",
    "grammars.diag.empty":
      "Die Engine liest Grammatiken aus <code>{dir}</code>, und dieser Ordner ist gerade leer. Jede ist eine Shared Library, benannt nach ihrer Grammatik — <code>{example}.dll</code>, <code>.so</code> oder <code>.dylib</code>.",
    "grammars.diag.gone":
      "Den eingestellten Grammatik-Ordner <code>{dir}</code> gibt es nicht mehr. Zeig mit <strong>Grammatiken…</strong> in den Einstellungen auf einen anderen.",
    "grammars.diag.none":
      "Es ist kein Grammatik-Ordner eingestellt, und dieser Build bringt keinen mit. Du kannst mit <strong>Grammatiken…</strong> in den Einstellungen auf einen zeigen.",
    "scope.outside": "{path} liegt nicht in diesem Projekt und kann daher nicht daraus ausgeschlossen werden.",
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
