# Übergabe — offene Arbeit am Desktop/Ökosystem

Arbeitsprotokoll für die Fortsetzung in einem neuen Chat. **Konvention:** ein
Punkt, der fertig *und gepusht* ist, wird hier gestrichen — nicht als
„erledigt" markiert stehengelassen, sonst wächst das Dokument, statt den
Rest zu zeigen. Was gebaut wurde und warum, steht danach im jeweiligen Repo
(`docs/ROADMAP/FEATURES/FEATURES.md`, `docs/FINISHED.md`), nicht hier.

## Stand

| Repo | Branch | HEAD | CI |
|---|---|---|---|
| `E:\repos\documentation.nvim` | main | `5e47094` | 5/5 grün |
| `E:\repos\runtime-analysis.nvim` | main | `42d1418` | 4/4 grün |
| `E:\repos\docmap-desktop` | main | `49ba4bb` | kein CI |

Installiert, dauerhaft:

| Pfad | Inhalt |
|---|---|
| `C:\tools\docmap.exe` | voll-fidele Engine, 1,74 MB, kann Lua + JS/TS/TSX |
| `C:\tools\docmap-grammars\` | `lua.dll`, `javascript.dll`, `typescript.dll`, `tsx.dll` |
| `C:\tools\docmap-libs\` | `lfs.a`, `lua_tree_sitter.a` — damit ein Engine-Rebuild nicht drei Repos neu klonen muss |

`DOCMAP_TS_DIR` ist als **Benutzervariable** gesetzt. Windows liest sie beim
Prozessstart: ein laufendes Neovim oder eine laufende App sieht sie erst nach
Neustart.

Engine neu bauen (aus `documentation.nvim`, unter PUC Lua 5.4, **nicht**
Neovim):

```
LUA_INCDIR=…/Lua/5.4/src  LUA_LIBA=…/Lua/5.4/src/liblua.a
DOCMAP_STATIC_LIBS=C:\tools\docmap-libs  CC=gcc
LUASTATIC=…/luarocks/…/luastatic/0.0.12-1/bin/luastatic
DOCMAP_TS_DIR=C:\tools\docmap-grammars
lua scripts/package.lua
```

`DOCMAP_TS_DIR` beim Bauen ist **nicht** optional — siehe
`documentation.nvim/docs/ROADMAP/V1_EXTENSION/PORTABILITY.md`, Abschnitt zur
Manifest-Closure: das Manifest wird *gemessen*, und es misst nur, was der
gemessene Lauf tatsächlich lud.

---

## Offen

### 1. Die App als vierter Host — eigener Server, Logik bleibt in Lua

**Entschieden** (2026-08-11, mit dem Nutzer): die App startet einen kleinen
HTTP-Server in Rust, der das Karten-Verzeichnis ausliefert **und** `/api/*`
beantwortet, indem er die Engine aufruft. Rust ist nur Transport; die
Join-Logik bleibt einmalig in Lua.

**Warum überhaupt:** die App lädt die Karte heute über Tauris
Asset-Protokoll (`convertFileSrc`, `src/main.js`) und bedient keinen einzigen
`/api/*`-Pfad. Ein `:DocMap serve` in Neovim ist ein *anderer* Server mit
einer *anderen* Kopie — es gibt keine Verbindung. Auf Windows liefert
`convertFileSrc` zudem `http://asset.localhost/…`, weshalb die Seite
`historyAvailable()` mit *true* beantwortet, dann ins Leere greift und rät,
man solle `:DocMap serve` ausführen — was schon geschehen war. Das ist die
konkrete Fehlermeldung, die diesen Punkt ausgelöst hat.

**Ein Weg ist versperrt:** die App kann nicht einfach `docmap serve` starten.
Die Standalone-Engine kennt kein `serve`; `editor/serve.lua` liegt in der
Editor-Hälfte, die die Layer-Regel bewusst aus dem Bundle hält.

**Gute Nachricht:** die Seite braucht **keine** Änderung. Sie ruft `/api/*`
bereits auf und funktioniert, sobald jemand antwortet. Und alle Joins
(`telemetry_join`, `loaded_diff`, `history`) liegen in `core/`, sind für die
Standalone-Engine also erreichbar.

**Aufgabe:**
- In `standalone/docmap.lua` einen Modus, der die JSON *einer* Route
  ausgibt (z. B. `--api=telemetry`, `--api=loaded&snapshot=…`,
  `--api=commits`). Vorbild ist `lua/documentation/editor/serve.lua` —
  dieselben Routen, dieselben „available:false + reason"-Antworten.
- Im Rust-Teil ein HTTP-Server auf `127.0.0.1` mit OS-vergebenem Port, der
  statische Dateien aus `docs/map` ausliefert und `/api/*` an die Engine
  weiterreicht.
- `iframe.src` auf diesen Server statt auf `convertFileSrc`.
- Bindung strikt auf `127.0.0.1` — die Begründung dafür steht in
  `editor/serve.lua`s eigenem Kopf und gilt hier unverändert.

**Regel des Nutzers, ausdrücklich:** Telemetry- und Loaded-Tab **immer
sichtbar** lassen. Daten zeigen wenn vorhanden, sonst der Hinweis, dass man
`runtime-analysis.nvim` in Neovim laufen lassen muss. Nicht ausgrauen, nicht
verstecken.

### 2. Aktions-Knöpfe in der App-Leiste, kontextabhängig

**Entschieden:** Knopf in der App-Oberfläche *außerhalb* des iframes; die
Seite meldet per `postMessage`, welches Panel offen ist, damit der Knopf zum
Kontext passt.

**Warum nicht in der Seite selbst:** ein Knopf *im* Panel der erzeugten Seite
kann keinen Prozess starten. Das ist dieselbe Kategorie, die
`docs/ECOSYSTEM.md` bereits als Absage führt („A browser page cannot
`pcall(require, …)` a Neovim plugin — not a gap, a category error").

**Gewünschte Aktionen:** „Telemetry jetzt erzeugen" beim Telemetry-Panel,
`:DocMap full` bei Hierarchy → Types. Setzt #1 voraus (ohne Host-Kanal gibt
es nichts, wohin die Seite melden könnte).

### 3. Neovim-Usrcmd: alle eingetragenen Projekte erzeugen

Ein Kommando, das alle in der Config aktivierten `documentation.nvim`-Projekte
`full` erzeugt, möglichst gleich mit RA-Telemetry (in der User-Config bereits
aktiviert).

**Befund zum Zuschnitt:** `lua/plugins/personal/source.lua` (nvim-Config) ist
*Policy in Lua* — Modus pro Repo (`disabled`/`dir`/`remote`). Aus Rust zu
parsen wäre spröde. Sauberer ist eine Exportfunktion in Neovim, die die
aktivierten Projekte als JSON ausgibt; #3 und #4 teilen sich dann dieselbe
Schnittstelle, statt zweimal dasselbe zu erraten.

### 4. Spec-Import in die App

Funktion in der App, die die Neovim-Installations-Spec liest, die dort
aktivierten `documentation.nvim`-Projekte ermittelt und gleich als Projekte
hinzufügt. Baut auf der JSON-Schnittstelle aus #3 auf.

### 6. Repo-URL-Import (Slice 3 der App-Roadmap)

`git clone` in ein Cache-Verzeichnis, dann Slice-2-Erzeugung. Bewusst
getrennt gehalten, weil Klonen eigene Fehlerfälle hat (Auth, Größe, Netz).
**Der Nutzer will das nach den Punkten oben angehen.**

### 7. Bundling der Engine

Binary + Grammatiken pro Plattform als Tauri-Sidecar. Bessere Erfahrung, aber
ein Release-Problem — eine Packaging-Frage, nichts Blockierendes.

---

## Blockiert / nicht vergessen

**Phase 4 (UI-Politur) in `documentation.nvim`** — Typografie-Skala (16
verschiedene `font-size`-Werte gemessen) und Zebra-Streifen. Beide brauchen
visuelle Prüfung; in dieser Umgebung gibt es **keine Screenshot-Fähigkeit**,
die Vorschau rendert nur statische Schnappschüsse. Aus demselben Grund sind
zwei bereits gebaute Dinge **nicht visuell geprüft**: das eingeklappte
Engine-Panel und das Kanten-Popup im Calls-Graph. Beide sind syntaktisch und
strukturell geprüft — jemand sollte sie an einem echten Fenster ansehen.

**Phase 6 (Hosted Web, echt)** — braucht ein Multi-Tenant-Trust-Modell, das
nirgends existiert. Die statische Hälfte ist erledigt.

---

## Arbeitsweise, die fortgesetzt werden sollte

**Messen statt vermuten.** Praktisch jeder wertvolle Befund kam daher, nicht
aus Code-Lesen: der Absturz bei `.tsx` (gefunden durch Ausführen gegen echten
Code, nachdem das Binary schon als fertig galt), die 43-vs-45-vs-46-Closure,
der `:DocMap serve`-Bug, die Telemetry-Fehldiagnose oben.

**Gates vor jedem Commit** (`nvim --headless -l scripts/ci.lua`): stylua,
luacheck, Tests, `gen_map --check`, `standalone`. Danach pushen und CI
abwarten.

**Ein Grammatiktest beweist die Grammatik, nur ein echter Scan beweist die
Pipeline.** Alle vier Grammatiken bestanden ihren Einzeltest, während die
Pipeline für JS/TS noch kaputt war.

**Stilles Degradieren ist die teuerste Fehlerart.** `DOCMAP_TS_DEBUG`, die
Fehleranzeige im App-Fenster, die „published copy"-Meldung und der
`standalone`-Gate, der einen unbrauchbaren Interpreter jetzt ehrlich
überspringt statt hart zu scheitern — alles dieselbe Korrektur.

**Backticks in Commit-Nachrichten**: nicht in doppelten Anführungszeichen an
`git commit -m` geben, bash führt sie als Befehl aus. Eine Nachrichtendatei
und `-F` benutzen.
