# Übergabe — offene Arbeit am Desktop/Ökosystem

Arbeitsprotokoll für die Fortsetzung in einem neuen Chat. **Konvention:** ein
Punkt, der fertig *und gepusht* ist, wird hier gestrichen — nicht als
„erledigt" markiert stehengelassen, sonst wächst das Dokument, statt den
Rest zu zeigen. Was gebaut wurde und warum, steht danach im jeweiligen Repo
(`docs/ROADMAP/FEATURES/FEATURES.md`, `docs/FINISHED.md`), nicht hier.

## Stand

| Repo | Branch | HEAD | CI |
|---|---|---|---|
| `E:\repos\documentation.nvim` | main | `42d8cae` | grün, 5/5 Gates. `release-engine.yml` publiziert die Engine + 4 Grammatiken als GitHub-Release `standalone-latest`, **jetzt inklusive `runtime-analysis.nvim`** |
| `E:\repos\runtime-analysis.nvim` | main | `5f51de8` | grün |
| `E:\repos\docmap-desktop` | main | `053bf5e` | kein CI-Gate; Release-Workflow (Tag-getriggert), **lädt jetzt die Engine von `standalone-latest` vor `cargo tauri build`** |
| `C:\Users\bartl\AppData\Local\nvim` (persönliche Config) | main | `707b3ed6` | kein CI |

Installiert, dauerhaft:

| Pfad | Inhalt |
|---|---|
| `C:\tools\docmap.exe` | voll-fidele Engine, 1,98 MB, kann Lua + JS/TS/TSX, **liest jetzt echte Telemetriedaten** (`--api=telemetry`/`loaded`, verifiziert gegen echte 63 KB Daten) — vorherige Versionen als `C:\tools\docmap.exe.bak-20260812`/`.bak-20260812b` daneben |
| `C:\tools\docmap-grammars\` | `lua.dll`, `javascript.dll`, `typescript.dll`, `tsx.dll` |
| `C:\tools\docmap-libs\` | `lfs.a`, `lua_tree_sitter.a` — damit ein Engine-Rebuild nicht drei Repos neu klonen muss |
| `C:\Program Files (x86)\Lua\5.4\src\lua.exe` | echtes PUC Lua 5.4.8 — **war die ganze Zeit schon da**, nur nicht auf PATH und luarocks nicht darauf konfiguriert |
| `C:\tools\lua5.4.exe` | Kopie davon, PATH-erreichbar — `scripts/ci.lua`s `standalone`-Gate sucht `lua5.4`/`lua5.3`/`lua` per Name auf PATH |
| `C:\Users\bartl\.luarocks\` | `luafilesystem`, `dkjson`, `luastatic`, `lua-tree-sitter` (alle für Lua 5.4) — installiert 2026-08-12 |
| `C:\tools\lua-tree-sitter-src\` | `--recurse-submodules`-Klon von `xcb-xwii/lua-tree-sitter`, `incdirs`-Fix im Rockspec bereits angewendet — für einen künftigen Rebuild der Runtime-Rock aufgehoben, nicht nur der bereits vorhandenen statischen `lua_tree_sitter.a` |

`DOCMAP_TS_DIR` ist als **Benutzervariable** gesetzt. Windows liest sie beim
Prozessstart: ein laufendes Neovim oder eine laufende App sieht sie erst nach
Neustart.

Engine neu bauen (aus `documentation.nvim`, unter PUC Lua 5.4, **nicht**
Neovim) — mit den jetzt bekannten echten Pfaden:

```
LUA_PATH="C:\Users\bartl\.luarocks\share\lua\5.4\?.lua;C:\Users\bartl\.luarocks\share\lua\5.4\?\init.lua;.\?.lua;.\?\init.lua"
LUA_CPATH="C:\Users\bartl\.luarocks\lib\lua\5.4\?.dll;.\?.dll"
LUA_INCDIR="C:/Program Files (x86)/Lua/5.4/src"
LUA_LIBA="C:/Program Files (x86)/Lua/5.4/src/liblua.a"
DOCMAP_STATIC_LIBS=C:\tools\docmap-libs  CC=gcc
LUASTATIC="C:\Users\bartl\.luarocks\lib\luarocks\rocks-5.4\luastatic\0.0.12-1\bin\luastatic"
DOCMAP_TS_DIR=C:\tools\docmap-grammars
"C:\Program Files (x86)\Lua\5.4\src\lua.exe" scripts/package.lua --out=build --keep
```

`DOCMAP_TS_DIR` beim Bauen ist **nicht** optional — siehe
`documentation.nvim/docs/ROADMAP/V1_EXTENSION/PORTABILITY.md`, Abschnitt zur
Manifest-Closure: das Manifest wird *gemessen*, und es misst nur, was der
gemessene Lauf tatsächlich lud. Volle Herleitung, inklusive der beiden
`lua-tree-sitter`-Packaging-Fixes (ICU-Header fehlen im veröffentlichten
Rock, `incdirs` fehlt `tree-sitter/lib/src`) und was `--capabilities`/
`checklist`/`commits`/`commit/<sha>` gegen echte Daten bestätigt haben:
PORTABILITY.md, Step 5 (2026-08-12).

---

## Offen

Nichts Umsetzbares im Moment — siehe „Blockiert" unten für die beiden
Punkte, die auf externen Input warten.

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

**Ein Skript, das nur je unter einer Plattform lief, hat mit hoher
Wahrscheinlichkeit eine plattformspezifische Blindstelle, egal wie lange
es schon existiert.** `scripts/package.lua` lief seit seiner Entstehung
nur unter Windows und enthielt drei latente Bugs, alle derselben Art (eine
„ist-das-schon-absolut"-Prüfung, die nur die Windows-Schreibweise kannte).
WSL (hier: eine bereits laufende Arch-Instanz) ist der pragmatische Weg,
so etwas zu prüfen, ohne auf einen echten CI-Lauf zu warten — aber Vorsicht
vor Cross-Contamination aus früheren Sessions in `/tmp` (ein gegen LuaJIT
statt PUC Lua gebautes `.so` hat den Interpreter zum Absturz gebracht,
nicht zu einem sauberen Fehler) und vor `find /` über gemountete
Windows-Laufwerke (`/mnt/c`, `/mnt/e`) — läuft praktisch endlos.

**Manche Fehler sind nur in echter CI zu finden, nicht lokal — und das ist
in Ordnung, solange man das offen sagt statt falsche Sicherheit zu
behaupten.** `documentation.nvim`s `release-engine.yml` brauchte sechs
echte CI-Läufe, bis beide Plattformen grün waren, jeder mit einem eigenen,
vorher nicht vorhergesagten Fehler: `ubuntu-22.04`s glibc zu alt für
`tree-sitter-cli`s vorkompiliertes Binary (→ `ubuntu-latest`); ein unter
Windows fehlendes `-llua`-Äquivalent beim dynamischen `.dll`-Link
(`undefined reference to lua_pushstring` — Windows-DLLs lösen Importe beim
Linken auf, nicht beim Laden, anders als Linux mit `-Wl,-E`); derselbe Fix
brach Linux anders (`liblua.a` ohne `-fPIC` kann nicht in ein `-shared`-Ziel
gelinkt werden); ein fehlender `lib.nvim`-Checkout (lief lokal nur, weil
dieser Rechner zufällig `lib.nvim` als Nachbar-Repo hat); `npm install -g`s
Ablagepfad war dreimal in Folge ein bewegliches Ziel (funktionierte auf
`ubuntu-latest` per Zufall, brauchte `npm config get prefix` unter MSYS2,
und selbst das war beim nächsten Lauf falsch — behoben durch einen
selbstgewählten `--prefix`-Pfad statt npms Ablageort zu erraten); und am
Ende der subtilste: `$work` aus `mktemp -d` ist unter MSYS2 ein
**MSYS2-interner** Pfad (`/tmp/…`), den `bash` und mitgelieferte Tools
transparent verstehen, ein echtes, mit mingw gebautes `lua.exe` aber nicht —
es liest Umgebungsvariablen als reinen Text und interpretiert ein
führendes `/` als „Wurzel des aktuellen Laufwerks", eine völlig andere
Stelle. Gelöst mit `cygpath -m`, aber erst gefunden, weil eine
fehlgeschlagene Fehlersuchliste (`require('lfs')`) genau zeigte, welche
Pfad-Herkunft (Default vs. selbstgesetzt) sich unterschiedlich verhielt.

Die Lehre daraus für nächstes Mal: bei einem neuen CI-Workflow, der einen
Toolchain-lastigen Build automatisiert, **lokale Verifikation (WSL, ein
zweiter Rechner) findet die meisten, aber nicht alle Fehler** — manche
brauchen die exakte, isolierte Umgebung einer echten Runner-Aktion
(`msys2/setup-msys2` z. B.), die lokal nicht sauber nachstellbar ist. Push,
CI beobachten, den *nächsten* echten Fehler beheben, wiederholen — nicht
beim ersten lokalen Erfolg aufhören und CI-Grün nur behaupten.

**„Erkannt, aber nicht platziert" ist ein eigener Fehlermodus, getrennt von
„gar nicht erkannt" — und beide müssen einzeln geprüft werden.** Die
Telemetry-Kleinigkeit brauchte am Ende drei getrennte Fixes, nicht einen:
`bucket()` erkannte `lib.lua.*` nicht (Symptom: Modul wird gemessen, aber
nie gestaged); `staged_name()` kannte den `lib/lua/`-Zweig nicht, selbst
nachdem `bucket()` ihn erkannte (Symptom: „gemessen, aber nirgendwo zum
Ablegen"); und `bucket()` kannte `runtime-analysis.*` **selbst** überhaupt
nicht, unabhängig von seinen Abhängigkeiten (Symptom: das Hauptmodul fehlt
komplett, still von `pcall` geschluckt). Jeder Fix allein reichte nicht —
`--api=telemetry` blieb `"no data"`, bis alle drei behoben waren. Beweis
kam erst durch `strings build/docmap.exe | grep <bekannter Bezeichner>`:
ein „erfolgreicher" Build kann ein Modul dem Namen nach kennen (eigene
Kommentare erwähnen es), ohne dessen echten Quellcode zu enthalten — nur
das direkte Greppen der kompilierten Binary unterscheidet die beiden Fälle
zuverlässig.
