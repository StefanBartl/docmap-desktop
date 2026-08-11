# Übergabe — offene Arbeit am Desktop/Ökosystem

Arbeitsprotokoll für die Fortsetzung in einem neuen Chat. **Konvention:** ein
Punkt, der fertig *und gepusht* ist, wird hier gestrichen — nicht als
„erledigt" markiert stehengelassen, sonst wächst das Dokument, statt den
Rest zu zeigen. Was gebaut wurde und warum, steht danach im jeweiligen Repo
(`docs/ROADMAP/FEATURES/FEATURES.md`, `docs/FINISHED.md`), nicht hier.

## Stand

| Repo | Branch | HEAD | CI |
|---|---|---|---|
| `E:\repos\documentation.nvim` | main | `1b72ff3` | grün |
| `E:\repos\runtime-analysis.nvim` | main | `5f51de8` | grün |
| `E:\repos\docmap-desktop` | main | `6632332` | kein CI-Gate; Release-Workflow (Tag-getriggert) |
| `C:\Users\bartl\AppData\Local\nvim` (persönliche Config) | main | `707b3ed6` | kein CI |

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
`C:\tools\docmap.exe` ersetzen. Danach ist #1 wirklich fertig — alle sechs
Routen (`telemetry`, `telemetry/snapshots`, `loaded`, `loaded/snapshots`,
`checklist`, `commits`, plus `commit/<sha>`) sind inzwischen in `core/api.lua`
gebaut, nicht mehr nur die ersten vier. Telemetry/Loaded sind gegen echte
Daten geprüft (158 gejointe Zeilen für `documentation.nvim` selbst);
`commits`/`commit/<sha>`/`checklist` gegen die echte Commit-Historie
desselben Repos (`TESTS/api_spec.lua`) — beides über einen echten `git`,
nicht gemockt. Die Rust-Seite (`server.rs`) kennt alle Routen bereits und
kompiliert/testet grün, konnte aber mangels neuer Binary noch nicht
end-to-end gegen einen echten Engine-Aufruf laufen.

**Die git-gestützten Routen brauchten einen echten Architekturschritt, nicht
nur eine Erweiterung:** `standalone/vim_shim.lua` hatte nie `vim.system` —
bewusst, siehe `docmap.lua`s eigener Kopf zum `--full`-Ausschluss. `core/api`
nimmt Git-Zugriff jetzt als Abhängigkeit (`opts.git`) statt ihn anzunehmen;
jeder Host reicht seine eigene Funktion herein (`vim.system` im Editor,
`io.popen` im Standalone). **Gemessen statt angenommen**, weil hier
mangels PUC Lua auf dieser Maschine nur eine Neovim-LuaJIT-Sonde als Proxy
zur Verfügung stand: `file:close()` liefert unter Windows **keinen**
Exit-Code, weder bei Erfolg noch bei echtem Git-Fehler — anders als
`vim.system(...):wait().code`. Der Standalone-Pfad erkennt einen
fehlgeschlagenen Git-Aufruf deshalb heuristisch (führende
`fatal:`/`error:`/`usage:`-Zeile in der gemergten stderr/stdout-Ausgabe),
dokumentiert als Heuristik, nicht als Garantie — aber keines der hier
tatsächlich angeforderten Formate (Sha, Steuerzeichen, `diff --git`) kann
zufällig so beginnen.

**Auf dieser Maschine nicht prüfbar:** es gibt kein PUC Lua 5.4 auf PATH,
deshalb wurde das `standalone`-Gate in `scripts/ci.lua` bei jedem Lauf
*übersprungen* und der gebündelte Pfad ist nur begründet und geprobt, nicht
ausgeführt. `scripts/bundle_manifest.lua` hat dafür jetzt drei Ergänzungen
im `--api=`-Probendurchlauf: die vier ursprünglichen Routen, `checklist`
+ `commits`, und `commit/<HEAD-Sha>` (real per `git rev-parse` aufgelöst) —
letzteres zieht `core/history` nach, gemessen, nicht vermutet, und keine
der anderen sechs Proben lädt es mit.

**Regel des Nutzers, weiterhin gültig:** Telemetry- und Loaded-Tab **immer
sichtbar** lassen. Daten zeigen wenn vorhanden, sonst der Hinweis, dass man
`runtime-analysis.nvim` in Neovim laufen lassen muss. Nicht ausgrauen, nicht
verstecken.

### 7. Bundling der Engine

Binary + Grammatiken pro Plattform als Tauri-Sidecar. Bessere Erfahrung, aber
ein Release-Problem — eine Packaging-Frage, nichts Blockierendes.

**Nicht zu verwechseln mit der App-Distribution, die jetzt existiert**
(`.github/workflows/release.yml`, `a1c665b`): ein gepushter `vX.Y.Z`-Tag
baut die **App selbst** pro Plattform und hängt Installer an ein Release.
Das löst „wie kommt jemand an die App" — #7 hier ist „wie kommt die Engine
*mit* in diese Installer", eine andere Frage, weiterhin offen.

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
