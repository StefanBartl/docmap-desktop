# Implementierungsplan — was offen ist

Stand 2026-08-20, nach dem `v0.2.0`-Schnitt. **Hier steht nur noch, was
aussteht.** Erledigtes samt Begründung liegt in
[`PLAN-DONE.md`](PLAN-DONE.md) — ein Plan, der seine fertigen Punkte
behält, hört auf, ein Plan zu sein, und wird ein zweites, schlechteres
Änderungsprotokoll.

**Aufwandsklassen**, ehrlich und grob: **XS** unter einer Stunde ·
**S** ein paar Stunden · **M** ein Arbeitstag oder mehr · **L** mehrere
Sitzungen.

## Inhalt

- [Wartet auf dich](#wartet-auf-dich)
- [Klein](#klein)
- [Mittel](#mittel)
- [Groß](#groß)
- [Ausdrücklich nicht geplant](#ausdrücklich-nicht-geplant)
- [Abhängigkeiten](#abhängigkeiten)
- [Wo ich weitermachen würde](#wo-ich-weitermachen-würde)

---

## Wartet auf dich

| # | Frage | Warum ich sie nicht selbst beantworte |
|---|---|---|
| **D5** | **`K` im Browser** (unten, Q8): worauf schlägt es nach, wenn der Cursor auf einer *Listenzeile* steht statt auf Quelltext? | Drei Lesarten, alle vertretbar. Meine Empfehlung steht im Eintrag — aber es ist eine Entscheidung über Bedienung, und die gehört dir |
| **D1-Auslöser** | Discussions einschalten, sobald **jemand anderes** eine echte Frage stellt | Entschieden (aus, mit Stolperdraht) — siehe `PLAN-DONE.md`. Der Auslöser ist ein Ereignis, keine Aufgabe |

---

## Klein

### Q8 · `K` — das Zeichen unter dem Cursor nachschlagen — **S**, Engine (§4.3)

**D5 — eine Entscheidung, ein Satz von dir.** Beim Anfassen kam eine Frage
heraus, die der Eintrag nicht beantwortet, und Raten wäre hier teuer, weil `K`
eine Taste ist, die man einmal lernt.

`:DocBrowse` zeigt eine **Liste** (Modul- und Funktionsnamen), keinen
Quelltext. „Das Zeichen unter dem Cursor" ist im Seiten-Hover eindeutig — dort
steht gerendeter Quelltext, und `word` ist ein Lua-Schlüsselwort. In einer
Liste steht der Cursor auf einer Zeile, die einen *Eintrag* benennt. Drei
mögliche Bedeutungen, und sie schließen einander aus:

| | `K` bedeutet | Wofür es gut ist | Wogegen |
|---|---|---|---|
| **a** | **Glossar-Karte** für das Wort unter dem Cursor (dieselbe Registry wie die Seite, vierte Auslösefläche — so war der Eintrag gemeint) | konsistent mit der Seite; billig | in der Liste steht selten ein Schlüsselwort. Meistens täte `K` nichts |
| **b** | **Was ist dieser Eintrag** — Zusammenfassung, Signatur, Doku-Zustand, ohne die Ansicht zu verlassen | trifft das, was in einer Liste unter dem Cursor *steht*; „what is this" im Wortsinn | nicht mehr dieselbe Registry; überschneidet sich mit dem Detail-Pane |
| **c** | **Beides, nach Kontext** — Glossar wenn das Wort eines ist, sonst der Eintrag | verhält sich immer sinnvoll | eine Taste mit zwei Bedeutungen ist die Art Magie, die man später bereut |

**Meine Empfehlung: (a)**, aber erst *nachdem* der Referenz-Tab existiert
(**M7**, dessen billige Hälfte unabhängig ausliefert). Grund: (a) ist genau
dann wertvoll, wenn es etwas nachzuschlagen *gibt*, und heute wäre es eine
Taste, die meistens schweigt. **Q8 gehört damit hinter M7**, nicht in die
Quick Wins — das ist die eigentliche Erkenntnis aus diesem Anlauf.

Falls du (b) willst, ist es unabhängig von M7 sofort baubar.

---

## Mittel

### M3 · Cross-Repo-Dashboard — **M**, `docmap-desktop`

Die Workspace-Ebene, die kein einzelnes Repository haben kann. Diese App ist
die einzige Stelle, die mehrere Projekte gleichzeitig hält.

### ~~M5 · Picker-Integration~~ — gebaut 2026-08-20

`:DocMap pick` — Fuzzy-Suche über jedes Modul und jede Funktion, Sprung auf
die Quellzeile. **Nicht** das `/` des Browsers: das springt *innerhalb* von
`:DocBrowse` und lässt dich dort, was beim Erkunden richtig ist. Das hier
endet in der Datei, der Browser geht gar nicht auf. §4.2 nennt sie
ausdrücklich als zwei Interaktionen.

Einträge lesen sich als `module` und `module#M.fn` — dieselben zwei Formen,
die der Browser-Sprung baut. Gemessen an diesem Repo: **913 Einträge**, 907
mit Datei, 784 mit Zeile.

**`pickers.nvim` zuerst, `lib.nvim`s Kit als Rückfall.** Erstes löst
telescope/fzf-lua/snacks auf und bietet
`engines.pick_item{ items, prompt, on_select }` — ein Eintrag mit `file`
bekommt die native Datei-Vorschau der Engine geschenkt. 913 Einträge sind
die Aufgabe eines echten Pickers. Ohne das: `kit.select` mit
`respect_override`, wie es `browse/init.lua` für seine Trail-Liste schon
macht. Keins von beiden ist harte Abhängigkeit.

**Drei Dinge aus `pickers.nvim` gelesen statt angenommen — eines änderte den
Code:**

- `on_select` gibt bei jeder Engine das Original-Item zurück (telescope über
  `entry.value`, fzf-lua über eine eigene `by_line`-Tabelle). Nur ein Item
  *ohne* `file` kommt bei fzf als blanker String zurück — ein Namespace-Knoten
  ist genau das. Dafür gibt es eine Text→Eintrag-Tabelle; sie ist über das
  Label geschlüsselt, was trägt, weil die Labels eindeutig sind (gemessen:
  913 Einträge, 0 Kollisionen).
- **`engines.load()` meldet einen Fehler**, wenn keine Engine installiert ist:
  *„Install telescope.nvim, fzf-lua, or snacks.nvim."* Für `:Pickers` richtig,
  hier falsch — wer `pickers.nvim` ohne Engine hat, hätte diesen Fehler
  bekommen und unmittelbar danach einen funktionierenden Picker. Der Code
  fragt jetzt erst `available()` und startet keine Auflösung, die nichts
  aufzulösen hat. Ende-zu-Ende geprüft: Rückfall auf den Kit, 913 Einträge,
  **null** Meldungen.

`:checkhealth` meldet es in beide Richtungen als `info` — ein fehlendes
Werkzeug, das nichts kostet, ist keine Warnung.

### M6 · Config-Analyse: die drei übrigen Punkte — **S–M je**, Engine

Andere Plugin-Manager als lazy.nvim (packer, vim-plug, mini.deps sind eigene
Extraktoren, keine gebogene Version des einen) · Lazy-Load-Inventar
(beantwortet „warum ist das noch nicht geladen") · verwaiste Spec-Dateien.
Keymap-Konflikte sind gebaut.

### M7 · Reference-Tab — **M**, Engine — *Schritt 4 von 6 gebaut*

**Gebaut 2026-08-20, `645950e`: der `TAGS`-Refactor** — der geteilte
Vorbedingungs-Punkt, der dreifach zahlt (Tag-Panel hier, Adoption-Panel
§2.1, dritte Art der Lookup-Schicht). `core/tags.lua` katalogisiert jeden
Tag, den die Pipeline wirklich liest; die Anker sind **aus der
veröffentlichten LuaLS-Seite gelesen**, nicht geraten. Der Katalog liegt
schon als `IR.tags` auf der Seite, also sind beide verbleibenden Konsumenten
jetzt das, was ihre eigenen Schätzungen versprochen haben.

Nebenbei gemessen statt behauptet: die Karte ist bis auf Zeilennummern in
`functions.lua` unverändert — mit einer Ausnahme, und die ist das Ergebnis:
`parse_doc_block` fällt von Komplexität **25 auf 12**.

**Beide Konsumenten sind seither gebaut** (2026-08-20):

- **§2.1, das Annotation-Adoption-Panel** (`d6a47f7`) — elftes
  Analysis-Panel, zählt **pro Funktion**, nicht pro Vorkommen. Erster echter
  Lauf: **zehn von vierzehn Funktions-Tags werden hier nirgends benutzt.**
  `docs/ANNOTATIONS.md` behält seine Vorkommens-Tabelle und sagt jetzt, was
  sie misst — ihre Zählung enthält Prosa *über* Tags, und genau so konnte
  `@nodiscard` als 112 dastehen, während keine Funktion eines trug.
- **Die Tag-Karte** (`a8fc6d1`) — dritte Auslösefläche: die Badges *sind* die
  Tags. Keine neue Mechanik; `data-kw` bringt Verzögerung, Nachlauf,
  Tastaturweg und Positionierung schon mit.

**Bleibt in M7:** Schritt 5 (Check-Katalog als vierte Art, gehört zu
`MULTILANG.md` 3.6 / I18N-0) und Schritt 6 (der Reference-Tab selbst —
ausdrücklich offen, ob die Panels nach den In-Place-Lookups noch einen Tab
verdienen). Danach D5/Q8 (`K`), das erst jetzt etwas zu sagen hätte.

Zwei Panels plus eine „was ist das"-Fläche. **Die billige Hälfte zuerst**:
die kuratierte Linkliste liefert unabhängig vom Rest aus. Offen und in
`HANDOVER.md` notiert: Lua auf 5.1 pinnen (Neovim läuft LuaJIT; die
5.4-Doku führt bei `goto`, Integer-Division und `<close>` aktiv in die Irre),
und ob MDNs URL-Struktur für JS/TS dasselbe hergibt.

### M9 · Compiler Explorer, zwei Schritte weiter — **M**

Zwei markierte Funktionen in einem `clientstate` nebeneinander (die Frage,
die das Duplikate-Panel aufwirft und nicht beantworten kann), und ein
**lokaler** Compiler Explorer statt godbolt.org. Der Link ist heute das
einzige Feature der erzeugten Seite, das überhaupt ins Netz greift. Die
committete Seite darf niemals den `localhost` einer Maschine fest verdrahten.

### M11 · Phase-0-IR: Owning Scope, ein File / viele Module — **M**, Engine

Voraussetzung für tieferes Python (Klassen) und Rust (`mod x {}`, `impl`).
Berührt jeden Konsumenten von `Documentation.FunctionInfo`. **Nicht** nötig
für die bereits gebauten Backends — deshalb steht es hier und nicht in
Teil 1.

### M12 · Extension-API, Stufe 2 — **M**, `docmap-desktop`

Lesende Erweiterungen: ein Panel, das etwas aus dem Artefakt Berechnetes
zeigt. Der lokale Server ist die Naht und existiert.

---

## Groß

| # | Was | Warum groß |
|---|---|---|
| **L1** | **Call-Kanten für die übrigen achtzehn** (nach M1) | Echte Feature-Arbeit pro Sprache, jede gegen fremden Code gemessen |
| **L2** | **i18n vollständig** (I18N-1 bis I18N-7) | `render/html.lua` ist ~85 % der Arbeit — 7 433 Zeilen gegen 14 `vim.notify`-Stellen im ganzen Plugin. Die englische Extraktion ist **manuell und geprüft**, kein Regex-Durchlauf: `html.lua` baut Sätze per Konkatenation, ein Sweep zerschnitte sie an Interpolationsgrenzen, und das ist später nicht reparierbar, ohne die Arbeit zu wiederholen |
| **L3** | **Die fünfzehn übrigen Sprachen** | Verfügbar, nicht geplant. Die vollständige Tabelle — Endungen, Doku-Konvention, Sichtbarkeitsregel, welches bestehende Backend jede wiederverwendet — steht in `PLAN-DONE.md` unter D4. **Fünfzehn, nicht sechzehn**: die alte Zahl stimmte, bis Scratch ausgeschlossen wurde |
| **L4** | **API-Traffic als Messung** (`runtime-analysis` §1.7b) | Der Schritt vom Zählen zum Messen, und der Weg zu einem Profiler. Metadaten und Formen, **niemals Payloads** — vorab entschieden, weil die Aufzeichnungen committet werden |
| **L5** | **Checklisten von einem Agenten ausführen lassen** | Der Tab und die Auswahl leben in dieser App. Zwei Dinge vorher entscheiden, beide über Vertrauen: eine handgeschriebene Behauptung und eine gemessene Beobachtung dürfen nicht gleich aussehen, und die Bearbeitung eines Agenten ist ein Vorschlag, kein Ergebnis |
| **L6** | **Extension-API, Stufe 3 (schreibend)** | Der Seitenkanal ist heute einseitig. Eine Seite, die beliebige Nachrichten ihres Hosts ausführt, ist eine andere Sicherheitsposition als eine, die nur spricht |
| **L7** | **Zwei Artefakte in der Seite vergleichen** (§3.1) | M–L, eigene Bewertung |
| **L8** | **Ganz ohne Neovim** (`PORTABILITY.md`) | „Karte aus dem Terminal" geht längst; die Neovim-Abhängigkeit ganz fallen zu lassen ist separat kalkuliert |

---

## Ausdrücklich nicht geplant

Damit niemand sie erneut verhandelt. Jede hat ihre Begründung an ihrer
eigenen Stelle; hier steht nur, dass sie entschieden ist.

- **Grammatik-Manager mit Download** — lädt native Shared Libraries von einem
  rollenden Tag ohne veröffentlichte Prüfsumme nach. Im CI in Ordnung, als
  Knopf in einer installierten App ein stiller Update-Kanal für ungeprüften
  ausführbaren Code. Die Diagnose-Hälfte ist **Q1**.
- **Wave 4 der Sprachen** (Fortran, Ada, COBOL, Delphi, MATLAB, VB.NET) —
  Umfang, nicht Schwierigkeit.
- **§1.6 `@since`-Drift, §2.3 Bus-Faktor, §2.4 Kopplung/Kohäsion, §5.2–5.4
  (OpenAPI, SFCs, ORM), §6.5 Workspace-Symbole, §6.7 REUSE-Rezept, §7
  Skalierung** — je eigene Ablehnung in `IDEAS.md`.
- **Die vier „Never"-Zeilen** in `runtime-analysis.nvim/docs/IDEAS.md` §7,
  darunter: documentation.nvim darf niemals hart auf das Runtime-Plugin
  angewiesen sein (ein statischer Analysator, der ohne Runtime-Plugin nicht
  läuft, hat genau die Eigenschaft verloren, die ihn im CI nützlich macht),
  und Laufzeitdaten gehören nie ins committete Artefakt.
- **Die Analyse selbst in der App reimplementieren** — die ehrliche Endstufe
  von „braucht kein Neovim", und keine kleine Strecke von hier: die App
  besäße dann zwei unabhängige Reimplementierungen, die zu ihren
  Neovim-Originalen verhaltensgleich bleiben müssten.
- **Ein Font-Picker** — eine Schriftwahl trifft man einmal; was Leute
  wirklich suchen, ist Größe, und das ist `View → Zoom in`.

---

## Abhängigkeiten

Nur die, die die Reihenfolge tatsächlich erzwingen:

| Erst | Dann | Warum |
|---|---|---|
| **M11** (Phase-0-IR) | tieferes Python/Rust | Klassen und `impl`-Blöcke haben ohne Owning Scope keinen Ort. **Kein Blocker**, sondern eine Fidelitätsgrenze: die Backends sind ohne ihn gebaut, über qualifizierte flache Namen |
| **M7** Schritt 5 | zusammen mit I18N-1 | Der Check-Katalog als vierte Lookup-Art fasst dieselben Daten an, die die Übersetzung ohnehin anfassen muss. Zweimal wäre zweimal dieselbe Datei |
| **M7** (Reference-Tab) | **D5/Q8** (`K`) | `K` ist erst dann eine Taste, die etwas zu sagen hat |
| **M4** ✓ | **§1.3** (API-Bruch-Erkennung) | Erledigt und damit freigeschaltet: „public" war undefiniert, jetzt ist es deklariert und es gibt eine benannte Fläche zum Vergleichen |

**Erledigt und deshalb nicht mehr in dieser Tabelle:** der gemeinsame
Schema-Bump für I18N-0 und `MULTILANG.md` C.1 (beide zusammen gemacht, ein
Bump), das Muster für Call-Kanten (Go, gegen ein fremdes Repo gemessen), und
die Extension-API-Zusage vor der ersten Erweiterung. Alle drei in
[`PLAN-DONE.md`](PLAN-DONE.md).

---

## Nachgezogen am 2026-08-20, nach dem Release

Zwei Dinge aus dem Release-Schnitt sind erledigt, beide standen als offene
Befunde in der Engine-`ROADMAP.md`:

- **Der Shim-Contract-Spec** (`TESTS/shim_contract_spec.lua`) — die dritte der
  drei dort notierten Optionen, und die einzige, die den *nächsten* Fehler vor
  der CI fängt. Läuft auf jeder Maschine, braucht weder PUC Lua noch den
  `lua_tree_sitter`-Rock: liest jeden `vim.*`-Pfad und jeden Methodennamen aus
  einem **echten Parse** (grep meldete 44/43 gegen die 27/30 des Parsers) und
  fragt `vim_shim.lua` selbst, was es kann — geladen mit gefälschtem
  `lfs`/`dkjson` und ohne `_G.vim`, weil der Shim mit
  `if _G.vim then return _G.vim end` öffnet und sonst Neovims eigene Tabelle
  zurückgibt. Genau der Fehler ist mir beim Schreiben passiert: erst
  antwortete jede Abfrage „ja", auch für Namen, die der Shim nachweislich
  nicht hat. **Das Gate ist der unklassifizierte Name** — mutationsgeprüft
  gegen beide historischen Formen.
- **Der falsche relative Link im Artefakt** — im Generator behoben, nicht in
  einem Header, weil die Messung sagte: *jeder* relative Link in einer
  Zusammenfassung war kaputt (4 von 4 hier, 1 von 1 in `runtime-analysis`).
  Und die Frage der Notiz („warum meldet der Neovim-Check das nicht?") hat
  eine Antwort, die bleibt: `docs.corpus` schließt `out_dir` aus — man
  repariert einen Generator, man lintet nicht seine Ausgabe.

**Offen bleibt dort**, ausdrücklich: der `standalone`-Gate überspringt sich
weiterhin still. Der Contract fängt, was statisch sichtbar ist — eine
Shim-Funktion, die *existiert* und sich anders verhält, fängt er nicht. Die
zwei billigeren Optionen (hart fehlschlagen, wenn die Rocks da sind; den Skip
in der Zusammenfassung wiederholen) sind weiter offen und weiter richtig.

---

## Wo ich weitermachen würde

Nach Nutzen pro Aufwand, mit dem was sich zuletzt geändert hat:

1. **M5** (Picker-Integration) — S–M, und die einzige offene Sache, die einen
   Weg in die Karte *aus dem Editor heraus* baut. Alles andere Offene ist
   entweder M-groß oder wartet auf eine Entscheidung.
2. **M6** (Config-Analyse: andere Plugin-Manager, Lazy-Load-Inventar,
   verwaiste Spec-Dateien) — drei getrennte S–M-Stücke, jedes für sich
   nützlich, keines von einem anderen abhängig.
3. **M7 Schritt 6** — die ehrliche Frage, ob der Reference-Tab nach den
   In-Place-Lookups überhaupt noch verdient ist. Möglicherweise lautet die
   Antwort *nein*, und dann ist das der billigste Punkt der Liste.
4. **M3** (Cross-Repo-Dashboard) — das Einzige, was nur diese App kann, und
   das erste, was von den dreiunddreißig Repos im Korpus wirklich profitiert.

**Nicht als Nächstes**, obwohl sie oben stehen: **L1** und **L2** sind beide
mehrere Sitzungen und beide eine Umfangsentscheidung, keine technische.

---
