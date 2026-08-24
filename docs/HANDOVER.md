# Übergabe — offene Arbeit am Desktop/Ökosystem

Was eine neue Sitzung über **diesen Rechner und diese Arbeitsweise** wissen
muss. Kein Aufgabenspeicher — dafür gibt es zwei andere Dateien, und das
Aufteilen ist der Punkt:

| Datei | Antwortet auf |
|---|---|
| [`PLAN.md`](PLAN.md) | **Was ist offen** — und zwar für **alle drei Repositories**, nach Aufwand geordnet. Seit 2026-08-20 die einzige Warteschlange |
| [`PLAN-DONE.md`](PLAN-DONE.md) | **Was wurde gebaut und warum so** — inklusive der Entscheidungen, die nicht neu verhandelt werden |
| [`ROADMAP.md`](ROADMAP.md) je Repo | **Wohin es geht**, in Prosa. Richtung, kein Fahrplan |
| `WORKPLAN.md` · `FEATURES.md` · `FINISHED.md` | **Die Herleitung.** Protokolle, die wachsen und nie gekürzt werden |
| dieses Dokument | **Wie man hier arbeitet**: Stand der Repos, installierte Werkzeuge, Gates, Fallstricke |

**Die Warteschlange stand vorher an fünf Stellen** — zwei `WORKPLAN.md`,
drei `ROADMAP.md`, eine `IDEAS.md` und dieser Plan — und dieselbe Aufgabe
tauchte in mehreren davon in unterschiedlichem Zustand auf. Zusammengeführt
2026-08-20: die Häkchen sind aus den Protokoll- und Begründungsdokumenten
entfernt, ihr Text steht unverändert weiter da.

Zusammengeführt 2026-08-20 aus diesem Dokument und `HANDOVER-2026-08-20.md`.
Die Tageshandover ist entfallen, nicht verloren: was sie an Ergebnissen
trug, steht in `PLAN-DONE.md` und in den `FEATURES.md` der Repos, und was
sie an Bedienwissen trug, steht unten unter *Alles ausführen*.

## Stand

| Repo | Branch | HEAD | CI |
|---|---|---|---|
| `C:\repos\documentation.nvim` | main | `21d0a51`, getaggt **`v0.1.0`** | grün, 5/5 Gates |
| `E:\repos\runtime-analysis.nvim` | main | `e10c374` | grün |
| `C:\repos\docmap-desktop` | main | `faf39e9`, getaggt **`v0.4.0`** (Draft, s. u.) | grün; Release-Workflow ist Tag-getriggert (`v*`) und lädt die Engine von `standalone-latest`, bevor `cargo tauri build` startet. Ablauf in [`RELEASING.md`](RELEASING.md) |
| `C:\Users\bartl\AppData\Local\nvim` (persönliche Config) | main | `597af5d5` | kein CI |

**2026-08-24: `v0.1.0` und `v0.4.0` getaggt, in dieser Reihenfolge.**
`documentation.nvim` hatte bis dahin gar kein Versionsschema — nur
`standalone-latest`, den rollenden Pre-Release. Anlass war die Frage, ob
man auf weitere Roadmap-Punkte (Multilang L3 u. a., allesamt „mehrere
Sitzungen" ohne Termin) warten oder mit dem fertigen, getesteten Stand
(Projekteinstellungen-Dialog, `.docmap.json`, drei frisch behobene
CI-Defekte — Details in [`PLAN-DONE.md`](PLAN-DONE.md)) releasen soll.
Entscheidung: releasen, jetzt. Eine leere Roadmap gibt es nie, und
`RELEASING.md`s eigene Lehre aus `v0.2.0` ist, dass ein Entwurf schnell
altert — warten kostet mehr als es bringt.

Reihenfolge war wichtig: erst `standalone-latest` frisch bauen lassen
(`publishedAt` 2026-08-24T18:52:45Z, ausgelöst automatisch durch den
`lua/**`-Push auf `documentation.nvim`), **dann** `v0.4.0` taggen — sonst
hätte der gebündelte Sidecar hinter den eigenen Fixes zurückgelegen,
genau der Fehler, den `RELEASING.md` aus `v0.2.0` dokumentiert.

**`v0.4.0` ist ein Draft, noch nicht veröffentlicht.** Der Build lief beim
Schreiben dieser Zeile noch — Status mit `gh run list --workflow=release.yml
--limit 1` prüfen. Sobald grün, steht **A1 in [`PLAN.md`](PLAN.md)**: der
menschliche Check (App öffnen, Karte laden, Projekteinstellungen mit ein
paar der neuen Flags ausprobieren), dann `gh release edit v0.4.0
--draft=false`. Das ist absichtlich kein Automatismus — siehe `RELEASING.md`.

**`v0.3.0` geschnitten am 2026-08-21, veröffentlicht.** Der Release-Workflow
baut die Installer aus dem Tag und legt sie als **Entwurf** an — der letzte
Schritt ist ein Mensch, der die App öffnet, und das automatisiert nichts.

**`v0.2.0` wurde nie veröffentlicht.** Der Entwurf stand vollständig, und
dann landeten 22 Desktop- und 17 Engine-Commits darauf — die
Workspace-Übersicht, Extension-API Stufe 2, die zweisprachigen Dialoge, und
in der Engine alles von `opts.plugins.wrappers` bis `K` im Browser. Eine
öffentliche Version, die niemand je installiert hätte, ist keine Version.
Der Entwurf ist gelöscht, der Tag bleibt als Punkt in der Historie stehen,
und 0.2.0 wird nicht wiederverwendet: ein Tag, der auf einen anderen Baum
zeigt als das, was über ihn geschrieben steht, ist teurer als eine
übersprungene Nummer.

**Was dieser Schnitt gelehrt hat und in `RELEASING.md` steht:** die Engine
zuerst neu bauen. `standalone-latest` lag 58 Commits zurück, darunter die
beiden Flags, die der Projekteinstellungs-Dialog schickt. Der Engine-Build ist
außerdem die einzige Stelle, an der der `standalone`-Gate auf einer sauberen
Maschine läuft — er fand drei echte Defekte in drei Anläufen (`node:start()`
und `vim.pesc` fehlten im Shim, das Swift-Grammar baute ein Node-Binding, das
niemand liest). Verifiziert vor dem Tag: die publizierte Engine meldet 23
Sprachen, Schema 5, und akzeptiert `--exclude`/`--languages`.

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

## Offene Arbeit — steht woanders

Dieser Abschnitt führte bis 2026-08-20 die Sprach- und i18n-Achsen samt
Reihenfolge. Beide sind seither Einträge in [`PLAN.md`](PLAN.md) (L1, L2, L3),
mit den Bewertungen und den Abhängigkeiten, die tatsächlich vorordnen. Hier
stand die Liste ein zweites Mal, und zwei Listen für eine Frage sind die
Drift, die dieses Ökosystem sonst überall bekämpft.

**Was aus diesem Abschnitt bleibt, weil es Bedienwissen ist und keine
Aufgabe:** die Karte eines Repos wird stale, sobald sich seine Doku ändert —
danach `nvim --headless -l scripts/gen_map.lua` und das Ergebnis
mitcommitten. Und `DOCMAP_TS_DIR` ist eine **Benutzervariable**: ein
laufendes Neovim oder eine laufende App sieht eine Änderung erst nach
Neustart.

---

## Blockiert / nicht vergessen

**Phase 4 (UI-Politur) in `documentation.nvim`** — Typografie-Skala (16
verschiedene `font-size`-Werte gemessen) und Zebra-Streifen. Beide brauchen
visuelle Prüfung. Aus demselben Grund sind zwei bereits gebaute Dinge
**nicht visuell geprüft**: das eingeklappte Engine-Panel und das
Kanten-Popup im Calls-Graph. Beide sind syntaktisch und strukturell geprüft
— jemand sollte sie an einem echten Fenster ansehen.

**Teilweise überholt seit 2026-08-20:** `docmap-desktop/tools/preview/`
serviert die echte Oberfläche dieser App mit gestubbter Tauri-Brücke, also
lässt sich Layout dort **messen** statt behaupten — genau so wurde der
Save-Knopf gefunden, der unter dem Falz lag (`54f4c41`). Was das **nicht**
löst: die generierte Seite von `documentation.nvim` (Typografie-Skala,
Zebra-Streifen, Kanten-Popup) rendert sich selbst und braucht ihren eigenen
Weg, und ein Browser ist nicht WebView2.

**Phase 6 (Hosted Web, echt)** — braucht ein Multi-Tenant-Trust-Modell, das
nirgends existiert. Die statische Hälfte ist erledigt.

---

## Alles ausführen

```bash
nvim --headless -l scripts/ci.lua
```

in `documentation.nvim` — five gates. A docs change makes the map stale;
regenerate with `scripts/gen_map.lua` and commit the result.

The language specs skip when their grammar is absent, which is the normal
local state. To run them for real, point at the built grammars:

```bash
DOCMAP_PYTHON_PARSER=C:/tools/docmap-grammars/python.dll nvim --headless -u NONE -l TESTS/run.lua
```

Every backend spec reads its own `DOCMAP_<LANG>_PARSER` — the full list is in
`documentation.nvim/docs/LANGUAGES.md § Running the language specs`, along
with the four backends that have no variable because Neovim ships their
grammars. All twenty-three
grammars are built into `C:/tools/docmap-grammars/` on this machine, and
`scripts/build_engine_release.sh` builds them from source for a release —
**twenty-three files for twenty-two languages**, because OCaml needs two
(`.ml` and `.mli` are different languages to the parser) and assembly needs
none.

In `docmap-desktop`:

```bash
cd src-tauri && cargo test
```

```bash
node --test src/lib/*.test.js
```

`cargo test` needs the placeholder sidecar first — see *Gates* above.

To look at the frontend without building the app:

```bash
python tools/preview/preview.py
```

Then open `http://localhost:8731/tools/preview/preview.html`. Real markup,
real CSS, real `main.js`; every `invoke` answered by `tools/preview/stub.js`.
Layout only — the commands do nothing, and a browser is not WebView2.

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
