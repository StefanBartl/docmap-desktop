# Übergabe — offene Arbeit am Desktop/Ökosystem

Arbeitsprotokoll für die Fortsetzung in einem neuen Chat. **Konvention:** ein
Punkt, der fertig *und gepusht* ist, wird hier gestrichen — nicht als
„erledigt" markiert stehengelassen, sonst wächst das Dokument, statt den
Rest zu zeigen. Was gebaut wurde und warum, steht danach im jeweiligen Repo
(`docs/ROADMAP/FEATURES/FEATURES.md`, `docs/FINISHED.md`), nicht hier.

## Stand

| Repo | Branch | HEAD | CI |
|---|---|---|---|
| `E:\repos\documentation.nvim` | main | `1c1c151` | grün, 5/5 Gates |
| `E:\repos\runtime-analysis.nvim` | main | `5f51de8` | grün |
| `E:\repos\docmap-desktop` | main | `c7a05f4` | kein CI-Gate; Release-Workflow (Tag-getriggert). **Arbeitsverzeichnis hat unfertige, aber vollständig verifizierte Sidecar-Änderungen — siehe #7 unten, NICHT committen ohne den dortigen Block gelesen zu haben.** |
| `C:\Users\bartl\AppData\Local\nvim` (persönliche Config) | main | `707b3ed6` | kein CI |

Installiert, dauerhaft:

| Pfad | Inhalt |
|---|---|
| `C:\tools\docmap.exe` | voll-fidele Engine, 1,83 MB, kann Lua + JS/TS/TSX, **neu gebaut 2026-08-12 mit `--api=`-Unterstützung** — alte Version liegt als `C:\tools\docmap.exe.bak-20260812` daneben |
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

### Kleinigkeit: Telemetry/Loaded aus der Standalone-Binary lesen

`--api=telemetry`/`--api=loaded` melden gegen die echte (neu gebaute)
Engine ehrlich `available:false, reason:"no data"` statt zu lügen oder
abzustürzen — aber es ist tatsächlich falsch, wenn echte Telemetriedaten
vorliegen (gemessen: 63 KB echte Daten lagen daneben, wurden aber nicht
gefunden). Ursache bis auf den Grund verfolgt und in
`documentation.nvim/standalone/docmap.lua`s `ensure_soft`-Doc-Kommentar
sowie `PORTABILITY.md` Step 5 (2026-08-12) festgehalten:
`runtime-analysis.telemetry` lädt, zieht aber `lib.nvim.autocmd` →
`lib.lua.lazy` nach — ein anderer `lib.*`-Namensraum als `lib.nvim.*`, den
`scripts/bundle_manifest.lua`s `bucket()` nicht erkennt (nur `^lib%.nvim`).
Deshalb wird dieses Modul nie in die kompilierte Binary gestaged, selbst
wenn der Probendurchlauf es findet.

**Aufgabe:** `bucket()` auf `^lib%.` erweitern (oder gezielt `lib.lua`
ergänzen), plus beim Bau `RUNTIME_ANALYSIS_NVIM_DIR` gesetzt lassen, damit
der Manifest-Probendurchlauf den vollen Abhängigkeitsbaum sieht. Klein,
lokalisiert, aber nicht heute erledigt.

### 7. Bundling der Engine — Code fertig & verifiziert, Commit bewusst zurückgehalten, CI-Rezept jetzt bewiesen

**Nicht zu verwechseln mit der App-Distribution, die schon existiert**
(`.github/workflows/release.yml`, `a1c665b`): ein gepushter `vX.Y.Z`-Tag
baut die **App selbst** pro Plattform und hängt Installer an ein Release.
Das löst „wie kommt jemand an die App" — hier geht es um „wie kommt die
Engine *mit* in diese Installer".

**Entschieden (2026-08-12, mit dem Nutzer):** documentation.nvim bekommt
einen eigenen Release-Workflow, der die Engine + 4 Grammatiken pro
Plattform baut und als GitHub-Release-Assets veröffentlicht.
docmap-desktops `release.yml` lädt diese Assets herunter und staged sie
vor `cargo tauri build`. Verworfen: Engine komplett in docmap-desktops
eigener CI aus Quellcode bauen (zu groß, zu fragil dupliziert); nur lokal
lassen (verschiebt das Problem nur).

**Warum das nicht einfach committet und gut ist:** im Arbeitsverzeichnis
liegen bereits fertige, getestete Rust/JS-Änderungen für den Sidecar
(`engine_sidecar`/`resolve_grammars` in `src-tauri/src/main.rs`,
`tauri-plugin-shell`-Abhängigkeit, `tauri.windows.conf.json`/
`tauri.linux.conf.json` mit `externalBin`, `main.js`s „(bundled)"-Label).
**Selbst gemessen, nicht vermutet:** sobald die Plattform-Override-Dateien
existieren, verlangt `externalBin` die referenzierte Datei schon bei
`cargo check` — ohne gestagte Sidecar-Binary bricht der Build sofort
(`resource path "binaries\docmap-..." doesn't exist`). `release.yml`
kennt bisher **keinen** Schritt, der die Sidecar-Binary vor
`cargo tauri build` bereitstellt. Committen dieser Konfiguration würde
also den nächsten `vX.Y.Z`-Tag-Push für Windows und Linux brechen — kein
Verdacht, durch Entfernen von `src-tauri/binaries/` und erneutes
`cargo check` direkt reproduziert. main selbst bricht dadurch nicht (nur
ein Tag-Push löst `release.yml` aus), aber es sollte niemand taggen,
solange dieser Block hier steht.

**Was bereits verifiziert ist, lokal:**
- `cargo check --tests`: sauber
- `cargo test`: 4/4 grün, inklusive eines neuen Tests
  (`bundled_sidecar_and_grammars_resolve_to_real_files`), der über
  `tauri::test::mock_app()` die echte Sidecar-/Ressourcen-Auflösung ohne
  Fenster prüft — der einzige Weg, das in dieser Umgebung ohne
  Screenshot-Fähigkeit zu verifizieren
- `cargo clippy --all-targets`: sauber (bis auf einen vorbestehenden,
  nicht mit dieser Änderung zusammenhängenden `sort_by_key`-Hinweis)
- `main.js`: syntaktisch geprüft (`node --check`)
- Lokal gestagt und funktionsfähig: `src-tauri/binaries/docmap-x86_64-pc-windows-msvc.exe`,
  `src-tauri/resources/grammars/{lua,javascript,typescript,tsx}.dll` —
  beide Verzeichnisse laut `.gitignore`-Eintrag absichtlich nicht
  eingecheckt (echte, plattformspezifische Binärdateien, zig MB)

**Das CI-Rezept ist jetzt vollständig bewiesen, nicht nur geplant** — unter
WSL/Arch von Grund auf durchgeführt, byte-identisches Ergebnis:
siehe `documentation.nvim/docs/ROADMAP/V1_EXTENSION/PORTABILITY.md`,
„Step 6" (Commit `1c1c151`). Dabei wurden **drei echte, bis dahin nie
aufgefallene Bugs** in `scripts/package.lua`/`scripts/bundle_manifest.lua`
gefunden und behoben — alle derselbe Fehlerklasse: eine
„ist-dieser-Pfad-schon-absolut"-Prüfung, die nur die Windows-Schreibweise
(Laufwerksbuchstabe) erkannte, nie ein führendes POSIX-`/`. Auf Windows nie
aufgefallen, weil dort jeder Pfad einen Laufwerksbuchstaben trägt. Der
bewiesene Linux-Rezept-Kern (übertragbar in eine `ubuntu-22.04`-CI-Job):

```bash
# PUC Lua 5.4 aus dem Quellcode (Arch/Ubuntus lua54-Paket liefert keine
# statische .a)
curl -sL https://www.lua.org/ftp/lua-5.4.8.tar.gz | tar xz
cd lua-5.4.8 && make linux   # -> src/liblua.a, src/lua.h etc.

# lua-tree-sitter: --recurse-submodules holt den gepinnten tree-sitter-
# Commit automatisch mit (kein separates Nachziehen nötig, anders als der
# ursprüngliche Windows-Fund ohne --recurse-submodules)
git clone --recurse-submodules https://github.com/xcb-xwii/lua-tree-sitter

# Statische libs per plain gcc, KEIN luarocks nötig — die exakte
# Quelldateiliste steht in lua-tree-sitter/rockspec/*.rockspec unter
# `sources`; incdirs-Fix ist tree-sitter/lib/src zusätzlich zu den beiden
# im Rockspec genannten Pfaden
gcc -O2 -fPIC -c -Itree-sitter/lib/include -Iinclude -Itree-sitter/lib/src \
  -I<lua-5.4.8>/src <alle sources aus dem rockspec> 
ar rcs lua_tree_sitter.a *.o

# Grammatiken über die tree-sitter-CLI (die ci.yml's tests-Job schon für
# JS/TS/TSX nutzt) statt manuellem gcc — einfacher, kein separates
# libtree-sitter nötig, da eine Grammatik-.so nur gegen
# tree_sitter/parser.h kompiliert:
tree-sitter build --output lua.so <tree-sitter-lua repo>
tree-sitter build --output javascript.so <tree-sitter-javascript repo>
tree-sitter build --output typescript.so <tree-sitter-typescript>/typescript
tree-sitter build --output tsx.so <tree-sitter-typescript>/tsx

# luastatic ist ein reines Lua-Skript, kein Kompilat:
curl -sL -o luastatic.lua https://raw.githubusercontent.com/ers35/luastatic/master/luastatic.lua

# dkjson: reines Lua, eine Datei
curl -sL -o dkjson.lua https://raw.githubusercontent.com/LuaDist/dkjson/master/dkjson.lua

# package.lua selbst (der Host-Interpreter, der es AUSFÜHRT) braucht lfs
# UND dkjson ZUR LADEZEIT — zusätzlich zu den obigen statischen Archiven
# fürs Bundle. lfs also auch dynamisch bauen:
gcc -O2 -fPIC -shared -I<lua-5.4.8>/src lfs.c -o lfs.so

LUA_INCDIR=<lua-5.4.8>/src LUA_LIBA=<lua-5.4.8>/src/liblua.a \
DOCMAP_STATIC_LIBS=<dir mit lfs.a + lua_tree_sitter.a> CC=gcc \
LUASTATIC=<pfad>/luastatic.lua DOCMAP_TS_DIR=<grammars-dir> \
LUA_CPATH="<dir>/?.so;;" LUA_PATH="<dir>/?.lua;;" \
lua5.4 scripts/package.lua --out=build --keep   # RELATIV, siehe unten
```

**Zwei Fallen, die genau hier zuschlagen, wenn man vom Rezept abweicht:**
- `--out=` **muss relativ sein** (z. B. `build`, nicht `/tmp/x`) —
  `out_dir` wird an mehreren Stellen unbedingt mit `cwd .. "/" .. out_dir`
  verrechnet; das ist keine Fehlerkennung wie die drei behobenen Bugs,
  sondern eine nie ausgesprochene, aber bislang immer erfüllte Annahme.
  Absichtlich nicht aufgebohrt, weil niemand einen absoluten `--out`
  braucht.
- Eine stale, gegen die falsche Lua-ABI gebaute `lua_tree_sitter.so` auf
  `LUA_CPATH` bringt den Host-Interpreter zum **Absturz**, nicht zu einem
  saubereren Fehler — passiert, weil `~/ts-test` aus einer früheren
  Session eine gegen **LuaJIT** gebaute `.so` enthielt. Immer gegen
  denselben Lua-5.4-Header-Satz bauen wie den Host-Interpreter.

**Nächster konkreter Schritt:** aus obigem Rezept einen echten
`.github/workflows/release-engine.yml` in `documentation.nvim` machen
(Matrix `ubuntu-22.04`/`windows-latest`, macOS bewusst ausgespart —
konsistent mit PORTABILITY.md; Trigger: vermutlich ein rollierendes
Release-Tag wie `standalone-latest`, da `documentation.nvim` bisher keine
Versions-Tags hat und `docmap-desktop` eine stabile Download-URL
braucht), Assets benennen nach Target-Triple (`docmap-x86_64-pc-windows-msvc.exe`,
`docmap-x86_64-unknown-linux-gnu`, `grammars-<triple>.tar.gz`). Dann
`docmap-desktop/.github/workflows/release.yml` um einen Download-Schritt
vor `tauri-apps/tauri-action` erweitern, der genau diese Assets nach
`src-tauri/binaries/` und `src-tauri/resources/grammars/` legt. **Erst
danach** die im Arbeitsverzeichnis liegenden, bereits getesteten
Sidecar-Änderungen committen — zusammen mit der `release.yml`-Erweiterung,
nicht getrennt, damit kein Zwischenzustand auf `main` landet, der einen
Tag-Push bricht.

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
