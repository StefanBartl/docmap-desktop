# Übergabe — offene Arbeit am Desktop/Ökosystem

Arbeitsprotokoll für die Fortsetzung in einem neuen Chat. **Konvention:** ein
Punkt, der fertig *und gepusht* ist, wird hier gestrichen — nicht als
„erledigt" markiert stehengelassen, sonst wächst das Dokument, statt den
Rest zu zeigen. Was gebaut wurde und warum, steht danach im jeweiligen Repo
(`docs/ROADMAP/FEATURES/FEATURES.md`, `docs/FINISHED.md`), nicht hier.

## Stand

| Repo | Branch | HEAD | CI |
|---|---|---|---|
| `E:\repos\documentation.nvim` | main | `99c19e4` | grün |
| `E:\repos\runtime-analysis.nvim` | main | `42d1418` | 4/4 grün |
| `E:\repos\docmap-desktop` | main | `d372953` | kein CI |
| `C:\Users\bartl\AppData\Local\nvim` (persönliche Config) | main | `8e9280f` | kein CI |

Installiert, dauerhaft:

| Pfad | Inhalt |
|---|---|
| `C:\tools\docmap.exe` | voll-fidele Engine, 1,74 MB, kann Lua + JS/TS/TSX — **veraltet, siehe unten** |
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

### 1a. Engine neu bauen — blockiert alles, was #1 gebaut hat

Der Server ist gebaut und die Lua-Seite auch (`docmap-desktop` `d372953`,
`documentation.nvim` `39765ac`+`99c19e4`). Was fehlt, ist die **Binary**:
`C:\tools\docmap.exe` stammt von *vor* `--api=` und kennt den Modus nicht.

**Nicht ungefährlich, gemessen:** eine alte Engine lehnt `--api=telemetry`
nicht ab — sie behandelt es als gewöhnliches Argument und **erzeugt die
Karte neu**, schreibt also ins Repository des Aufrufers und endet mit
Exit 0 und Nicht-JSON. Genau das ist beim ersten Test passiert und hat die
committete Karte von `documentation.nvim` überschrieben.

Deshalb prüft die App die Engine jetzt vorher mit `docmap --capabilities`
(Flag in *Root*-Position — das lehnt eine alte Binary mit Exit 2 ab, bevor
sie irgendetwas tut; gegen die installierte verifiziert). Bis zum Rebuild
verhält sich die App also korrekt statt destruktiv: Telemetry- und
Loaded-Panel melden „ältere Engine ohne --api", nichts wird überschrieben.

**Aufgabe:** Engine mit dem Rebuild-Befehl oben neu bauen und
`C:\tools\docmap.exe` ersetzen. Danach ist #1 wirklich fertig und die
beiden Panels zeigen echte Daten (die Routen selbst sind gegen echte
Telemetry geprüft: 158 gejointe Zeilen für `documentation.nvim` selbst).

**Auf dieser Maschine nicht prüfbar:** es gibt kein PUC Lua 5.4 auf PATH,
deshalb wurde das `standalone`-Gate in `scripts/ci.lua` bei jedem Lauf
*übersprungen* und der gebündelte Pfad ist nur begründet und geprobt, nicht
ausgeführt. `scripts/bundle_manifest.lua` hat dafür eine dritte Probe
bekommen (den `--api=`-Modus), weil das Manifest gemessen wird und ein
Scan-Lauf `core/api`, `core/artifact` und `core/loaded_diff` nie lädt —
ohne diese Probe stirbt die neue Binary beim ersten Telemetry-Abruf mit
„module not found".

**Regel des Nutzers, weiterhin gültig:** Telemetry- und Loaded-Tab **immer
sichtbar** lassen. Daten zeigen wenn vorhanden, sonst der Hinweis, dass man
`runtime-analysis.nvim` in Neovim laufen lassen muss. Nicht ausgrauen, nicht
verstecken.

### 1b. Die git-gestützten Routen fehlen noch

`core/api.lua` beantwortet heute `telemetry`, `telemetry/snapshots`,
`loaded`, `loaded/snapshots`. Die drei git-gestützten Routen der History-
und Checklist-Panels (`commits`, `commit/<sha>`, `checklist`) liegen noch
ausschließlich in `editor/serve.lua`, weil sie einen Subprozess brauchen und
`standalone/vim_shim.lua` kein `vim.system` hat. Der saubere Schnitt dafür
ist absehbar: `core/api` bekommt die Git-Funktion als Parameter, jeder Host
reicht seine eigene herein (`vim.system` im Editor, `io.popen` im
Standalone). Die Sha-Whitelist (`serve.lua`s `safe_sha`) muss dabei
mitwandern — sie ist die Sicherheitseigenschaft der Route, nicht Deko.

### 2. Aktions-Knöpfe in der App-Leiste, kontextabhängig

**Entschieden:** Knopf in der App-Oberfläche *außerhalb* des iframes; die
Seite meldet per `postMessage`, welches Panel offen ist, damit der Knopf zum
Kontext passt.

**Warum nicht in der Seite selbst:** ein Knopf *im* Panel der erzeugten Seite
kann keinen Prozess starten. Das ist dieselbe Kategorie, die
`docs/ECOSYSTEM.md` bereits als Absage führt („A browser page cannot
`pcall(require, …)` a Neovim plugin — not a gap, a category error").

**Gewünschte Aktionen:** „Telemetry jetzt erzeugen" beim Telemetry-Panel,
`:DocMap full` bei Hierarchy → Types.

**Die Vorbedingung ist jetzt erfüllt:** die Seite läuft nicht mehr über das
Asset-Protokoll, sondern über einen echten Origin
(`http://127.0.0.1:<port>/`, `src-tauri/src/server.rs`), es gibt also einen
Host-Kanal, an den `postMessage` überhaupt gehen kann. Vorher gab es nichts,
wohin die Seite hätte melden können.

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
