# Übergabe — offene Arbeit am Desktop/Ökosystem

Arbeitsprotokoll für die Fortsetzung in einem neuen Chat. **Konvention:** ein
Punkt, der fertig *und gepusht* ist, wird hier gestrichen — nicht als
„erledigt" markiert stehengelassen, sonst wächst das Dokument, statt den
Rest zu zeigen. Was gebaut wurde und warum, steht danach im jeweiligen Repo
(`docs/ROADMAP/FEATURES/FEATURES.md`, `docs/FINISHED.md`), nicht hier.

> **Der Fahrplan liegt seit 2026-08-20 in [`PLAN.md`](PLAN.md)** — alles
> Offene aus allen drei Repos, nach Aufwand geordnet (Quick Wins, Mittel,
> Groß), mit den Entscheidungen, die dich blockieren, und dem, was
> ausdrücklich nicht geplant ist. Dieses Dokument bleibt das Arbeitsprotokoll:
> Stand der Repos, installierte Werkzeuge, Arbeitsweise.

## Stand

| Repo | Branch | HEAD | CI |
|---|---|---|---|
| `E:\repos\documentation.nvim` | main | `d995ca3` | grün, 5/5 Gates. `release-engine.yml` publiziert die Engine + 4 Grammatiken als GitHub-Release `standalone-latest`, **jetzt inklusive `runtime-analysis.nvim`** |
| `E:\repos\runtime-analysis.nvim` | main | `24fb842` | grün |
| `E:\repos\docmap-desktop` | main | `ff8d252` | kein CI-Gate; Release-Workflow (Tag-getriggert), **lädt jetzt die Engine von `standalone-latest` vor `cargo tauri build`** |
| `C:\Users\bartl\AppData\Local\nvim` (persönliche Config) | main | `597af5d5` | kein CI |

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

## Offen — Sprachachsen, Stand 2026-08-18

Zwei Vorhaben, die den gleichen Wortstamm teilen und sonst nichts:
**Multilang** (welche Programmiersprachen die Engine *liest*) und **i18n**
(welche Oberflächensprache sie *spricht*). Beide sind geplant, eines hat
angefangen.

**Die Pläne, kanonisch, nicht doppelt gepflegt:**

| Dokument | Inhalt |
|---|---|
| `documentation.nvim/docs/ROADMAP/WORKPLAN.md` | **Der Wiedereinstiegspunkt.** Alles Besprochene, auch das nicht Gebaute, in einer Datei — geschrieben, damit die Arbeit einen Kaltstart in einer neuen Session übersteht. Dieser Abschnitt hier ist die Desktop-Hälfte davon |
| `documentation.nvim/docs/ROADMAP/IDEAS/MULTILANG.md`, **Part 4** | Stufenplan 1–8. Ersetzt Part 2s Reihenfolge und folgt dabei Part 3s eigener Empfehlung: **C vor Python**, weil C weder Owning-Scope noch Ein-File-viele-Module braucht und deshalb *neben* den geteilten Nähten landen kann, wie JS/TS damals |
| `documentation.nvim/docs/ROADMAP/IDEAS/I18N.md` | Neu. Drei Flächen, davon `render/html.lua` ~85 % der Arbeit (7 433 Zeilen gegen 14 `vim.notify`-Stellen im ganzen Plugin) |
| `documentation.nvim/docs/ROADMAP/IDEAS/ReferenceTab.md`, Abschnitt „The lookup layer" | Keyword-Hover und Verwandtes. Eine Registry, vier Auslöseflächen |
| `docmap-desktop/docs/ROADMAP.md`, Abschnitte „Languages" / „Interface languages" | Nur die Hüllen-Hälfte |

**Branches:**

| Repo | Branch | Enthält |
|---|---|---|
| `documentation.nvim` | `feat/lookup-layer` | 4 Commits: Planung (Doku), `lang_registry.report()` + `languages` in `--capabilities`, Keyword-Hover im Snippet, **Quellwurzel-Erkennung pro Sprache**. Alle 5 Gates grün, Karte regeneriert |
| `docmap-desktop` | `claude/doc-apps-convergence-plan-b8c69f` | 4 Commits: `scan_languages` (Zählen), `engine_languages` (Fähigkeiten lesen), Join beider, ehrliches Engine-Verdikt. `cargo test` 12/12, `node --test` 31/31 |

**Nichts ist gepusht.** Beide Branches sind lokal.

### Was als Nächstes dran ist, in dieser Reihenfolge

Vereinbart: **Desktop zuerst**, ausdebuggen, und erst was sich dort bewährt
hat wandert dorthin, wo es in `documentation.nvim` auch passt.

1. ~~**Sprach-Badges am echten Fenster ansehen.**~~ — **gemessen
   2026-08-20**, und die Frage nach der dritten Zeile hat sich erledigt: die
   Projektliste ist seither ein `<select>`, die Badges hängen am Detailblock
   darunter (`#proj-langs`). Beides geprüft, im Browser statt im Fenster —
   Badge „Go · Python“, Tooltip „71 % Go (150) — no grammar · 29 % Python
   (60) — no grammar“. Womit: `tools/preview/` in `docmap-desktop`, die
   echte Oberfläche mit gestubbter Tauri-Brücke. **Damit ist die
   Screenshot-Schuld weiter unten kleiner, nicht bezahlt** — der Harness
   misst Layout, nicht Verhalten, und rendert in einem Browser, nicht in
   WebView2.
2. ~~`--capabilities` um `languages` erweitern~~ — **gebaut.** Der Join
   steht: Zählung (Desktop) mal Backend-Liste (Engine), verbunden über den
   **Tree-sitter-Grammatiknamen**, nicht über den Backend-Namen. Die Engine
   nennt ihr TypeScript-Backend `ts`; das weiß außerhalb der Engine niemand,
   und es hier zu wissen wäre genau die Duplizierung, die `languages.rs`
   verweigert. Vier Zustände, und die zwei leicht zu verwechselnden sind die
   wichtigen: `degraded` (Backend da, Grammatik fehlt — nur Modulbaum) ist
   nicht `none` (gar kein Backend), und `unknown` (ältere Engine) ist auch
   nicht `none` — eine alte Engine liest Lua einwandfrei, und „kein Backend"
   würde den Nutzer etwas reparieren schicken, das funktioniert.

   **Was aber noch fehlt: eine Engine, die das Feld hat.** `C:\tools\docmap.exe`
   ist älter und antwortet ohne `languages` — verifiziert, das ist der
   `unknown`-Pfad. Voller Nutzen erst nach einem Engine-Rebuild (Rezept
   weiter oben in diesem Dokument) oder einem neuen `standalone-latest`.
3. ~~Grammatik-Manager~~ — **verworfen, mit Begründung.** Der Download-Teil
   lädt native Shared Libraries nach, die die Engine per `dlopen` ausführt,
   und zwar von einem rollenden Tag (`gh release delete standalone-latest`
   dann `create`) ohne veröffentlichte Prüfsumme: was heute dort liegt, ist
   nicht, was gestern dort lag, und es gibt keine Version zum Festnageln. Im
   CI in Ordnung, als Knopf in einer installierten App ein stiller
   Update-Kanal für ungeprüften ausführbaren Code. Dazu: `release.yml` bündelt
   die Grammatiken ohnehin in jeden Installer (`resolve_grammars` fällt auf
   das Ressourcenverzeichnis zurück), die Zielgruppe wäre also fast leer.

   **Was davon offen bleibt und sich lohnt: die Diagnose-Hälfte** — welche
   Grammatikdatei fehlt in welchem Verzeichnis. Kein Netz, keine neue
   Abhängigkeit.
4. ~~Keyword-Hover~~ — **gebaut** in `render/html.lua`, gegen zwölf echte
   Eingaben gemessen (Keywords in Strings, Kommentaren, Long-Strings,
   Template-Literalen bleiben undekoriert; `.rs` dekoriert gar nichts).
   **Im Desktop-Fenster noch nicht angesehen** — das ist der eigentliche
   nächste Schritt, zusammen mit Punkt 1.
5. **Grammatik-Diagnose** (siehe 3) im Desktop: Liste plus Download aus
   `standalone-latest` **entfällt** — nur noch: welche Datei fehlt wo.
6. **Stufe 1 des Multilang-Plans** (Polyglot-Verifikation) — noch offen,
   und die Voraussetzung für jedes weitere Backend.

### Was schon gemessen ist

- **Der Sprachzähler stimmt gegen Handzählung.** `documentation.nvim`: 142
  Lua-Dateien = 98 (`lua/`) + 33 (`TESTS`) + 4 (`standalone`) + 6
  (`scripts`) + 1 (`docs`). Erster Lauf meldete 448 — 306 davon waren
  Kopien des Repos unter `.claude/worktrees/`. Deshalb überspringt der Walk
  jetzt jedes Unterverzeichnis, das ein eigener Checkout ist (`.git`
  *existiert*, nicht *ist ein Verzeichnis* — in Worktree und Submodul ist es
  eine Datei).
- **Der Fähigkeits-Join ist Ende zu Ende geprüft, ohne Engine-Rebuild.**
  Echtes JSON aus der neuen Registry (unter Neovim erzeugt) durch die neue
  Frontend-Schicht: Engine-Panel „lua · no grammar for js, ts, tsx — module
  tree only", Tooltip für dieses Repo „54 % JavaScript (7) — no grammar ·
  31 % Rust (4) — no backend". Beides wahr, beides vorher unsichtbar.
  Dieses Neovim hat die Lua-Grammatik und die drei ECMA-Grammatiken nicht.
- **Der Keyword-Tokenizer ist gegen zwölf echte Eingaben gemessen**, aus der
  *generierten Seite* herausgezogen statt aus der Quelle nachgebaut: Keywords
  in Strings, Zeilen- und Blockkommentaren, Lua-Long-Strings und
  Template-Literalen bleiben undekoriert, während die umgebenden echten
  Keywords gefunden werden; ein escapetes Anführungszeichen beendet den
  String nicht zu früh; `constructor`/`toString` fallen nicht auf
  `Object.prototype` herein (die Suche geht über `hasOwnProperty`);
  `android` matcht nicht `and`; `.rs` dekoriert gar nichts.
- **Nicht angesehen:** die Karte selbst. Kein Screenshot in dieser Umgebung.
- **Stufe 1 ist gemessen, und der Verdacht lag an der falschen Stelle.** Der
  Walk ist in Ordnung. Kaputt war ein Schritt davor: `config.detect_source`
  war eine reine Lua-Heuristik und gab für *jeden* nicht erkannten Baum
  `"lua"` zurück — ein reines JS/TS-Projekt starb an `scan.lua`s Assert
  (`source directory not found: <root>/lua`). Die Engine liest seit Phase 1
  JavaScript, und **kein JavaScript-Projekt konnte überhaupt gescannt
  werden.** Behoben: die Backends beantworten es selbst (Lua besitzt
  `lua/<plugin>`, ECMA `src`/`lib`/`app`), jedes lehnt ab statt zu raten,
  und der Walk hat jetzt die Vendor-Skip-Liste, die eine `src`-oder-Wurzel
  als `source` nötig macht. Gegengeprüft: die Karte dieses Repos ist
  byte-identisch, und ein JS/TS-Projekt liefert mit geladenen Grammatiken
  echte Funktionsdaten (`split/2`, `join/2`) — **ohne dass zwischen den
  beiden Läufen irgendetwas umgestellt wurde.**
- **Noch offen, und ein Entwurfsproblem statt eines Bugs:** ein Baum mit
  Lua *und* JS in verschiedenen Verzeichnissen. `source` ist **ein**
  Verzeichnis, also gewinnt das zuerst antwortende Backend — verifiziert an
  einem Lua+JS+TS-Fixture: ein Lua-Modul, `src/` nie angesehen. Die zwei
  ehrlichen Optionen stehen in `MULTILANG.md` Stufe 1. **Vor Stufe 4
  entscheiden** — ein C-Backend landet genau in dieser Form (`src/` neben
  `include/`).
- **Noch nicht gemessen:** ob `scan.lua`s Walk wirklich polyglott ist. Er
  fragt die Registry pro Datei (Z. 415) und pro Verzeichnis (Z. 310), also
  *sollte* ein gemischter Baum funktionieren. Das ist genau die Art
  Behauptung, die Part 2 des Multilang-Dokuments selbst zu prüfen verlangt,
  statt sie zu glauben.

### Entscheidungen, die noch offen sind

1. **Hat die Engine inzwischen Nutzer?** Falls ja, wird die
   Schema-Versionierung (Stufe 3.1) von einer Nebenaufgabe zur harten
   Anforderung — die IR-Änderungen sind brechend.
2. **Referenz-Links im Keyword-Hover.** Die Erklärung selbst ist offline und
   veraltet nicht; der Link kann es. Entschieden: eine Basis-URL pro
   Sprache mit abgeleiteten Ankern statt hunderter Einzel-URLs, Lua auf 5.1
   gepinnt (Neovim läuft LuaJIT — die 5.4-Doku führt bei `goto`,
   Integer-Division und `<close>` aktiv in die Irre). Ungeprüft ist, ob
   MDNs URL-Struktur für JS/TS dasselbe hergibt.
3. **Cross-Language-Kanten (Stufe 7)** sind der originellste Punkt der
   Planung und der, der am ehesten Bedeutung erfindet, wo nur
   Namensgleichheit ist.

### Gates, unverändert

`documentation.nvim`: `nvim --headless -l scripts/ci.lua` — 5 Gates. Eine
Doku-Änderung macht die Karte stale; danach
`nvim --headless -l scripts/gen_map.lua` und das Ergebnis mitcommitten.

`docmap-desktop`: `cargo test` in `src-tauri/` und `node --test src/lib/*.test.js`.
`cargo test` braucht vorher die Platzhalter, die CI auch anlegt (beide sind
`.gitignore`d):

```
mkdir -p src-tauri/binaries src-tauri/resources/grammars
touch src-tauri/binaries/docmap-x86_64-pc-windows-msvc.exe
touch src-tauri/resources/grammars/placeholder.dll
```

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
