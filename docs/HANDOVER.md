# Übergabe — offene Arbeit am Desktop/Ökosystem

Arbeitsprotokoll für die Fortsetzung in einem neuen Chat. **Konvention:** ein
Punkt, der fertig *und gepusht* ist, wird hier gestrichen — nicht als
„erledigt" markiert stehengelassen, sonst wächst das Dokument, statt den
Rest zu zeigen. Was gebaut wurde und warum, steht danach im jeweiligen Repo
(`docs/ROADMAP/FEATURES/FEATURES.md`, `docs/FINISHED.md`), nicht hier.

## Stand

| Repo | Branch | HEAD | CI |
|---|---|---|---|
| `E:\repos\documentation.nvim` | main | `0335e05` | grün, `standalone`-Gate läuft jetzt real |
| `E:\repos\runtime-analysis.nvim` | main | `5f51de8` | grün |
| `E:\repos\docmap-desktop` | main | `15b7d0d` | kein CI-Gate; Release-Workflow (Tag-getriggert) |
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
