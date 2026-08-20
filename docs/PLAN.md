# Implementierungsplan — alles Offene, nach Aufwand geordnet

Stand 2026-08-20, nach dem Per-Projekt-Einstellungs-Durchgang. **Dies ist der
Fahrplan, nicht das Protokoll**: was gebaut wurde und warum, steht in
`documentation.nvim/docs/FEATURES/FEATURES.md` und in den `WORKPLAN.md`s.
Hier steht nur, was noch aussteht — und in welcher Reihenfolge es sich lohnt.

**Ausgewertet:** `docmap-desktop` (`WORKPLAN.md`, `ROADMAP.md`),
`documentation.nvim` (`ROADMAP/ROADMAP.md`, `ROADMAP/WORKPLAN.md`,
`IDEAS/IDEAS.md`, `IDEAS/IDEAS_IMPLEMENTATION_PLAN.md`, `IDEAS/MULTILANG.md`,
`IDEAS/I18N.md`, `IDEAS/ReferenceTab.md`, `LANGUAGES.md § Parity`),
`runtime-analysis.nvim` (`IDEAS.md`, `ROADMAP.md`).

**Aufwandsklassen**, ehrlich und grob: **XS** unter einer Stunde ·
**S** ein paar Stunden · **M** ein Arbeitstag oder mehr · **L** mehrere
Sitzungen.

Ein Punkt, der fertig *und gepusht* ist, wird hier gestrichen, nicht
abgehakt stehengelassen — dieselbe Konvention wie in `HANDOVER.md`.

## Inhalt

- [Teil 0 — was nur du entscheiden kannst](#teil-0--was-nur-du-entscheiden-kannst)
- [Teil 1 — Quick Wins](#teil-1--quick-wins)
- [Teil 2 — Mittel](#teil-2--mittel)
- [Teil 3 — Groß](#teil-3--groß)
- [Teil 4 — ausdrücklich nicht geplant](#teil-4--ausdrücklich-nicht-geplant)
- [Abhängigkeiten](#abhängigkeiten)
- [Die nächsten zehn Schritte](#die-nächsten-zehn-schritte)

---

## Teil 0 — was nur du entscheiden kannst

Diese vier blockieren Arbeit, die sonst sofort laufen könnte. Keine davon
kostet mich Zeit; jede kostet dich einen Satz.

| # | Frage | Was danach passiert |
|---|---|---|
| **D1** | **GitHub Discussions einschalten?** Eine Einstellung in deinen Repos | Danach XS: eine Zeile pro Kategorie in `src-tauri/src/feedback.rs`, und Feedback wird ein Thread statt eines Issues |
| **D2** | **Gestentausch in der Hierarchie** (§9.2): Einfachklick verlässt die Ansicht Richtung Tree. Sollen Einfach- und Doppelklick tauschen? | Es gibt Muskelgedächtnis dagegen. Die *Überraschung* ist bereits behandelt (der Hover nennt beide Gesten) — offen ist nur der Tausch selbst |
| **D3** | **Welche neue Ansicht** (§9.3)? „Wie Hierarchy, aber mit anderem Fokus" ist eine Richtung, keine Aufgabe | Eine benannte Ansicht mit einer Frage, die sie beantwortet, schlägt drei allgemeine |
| **D4** | **Die sechzehn übrigen Sprachen** bleiben „verfügbar, nicht geplant"? | Wave 4 ist abgesagt (`MULTILANG.md`, Entscheidung 4). Sie werden wieder baubar, sobald jemand eine anfragt — die protokollierten Entscheidungen machen den Wiedereinstieg zu einem Tag statt zu einer Wiederentdeckung |

---

## Teil 1 — Quick Wins

Erst das, was in Stunden fertig ist. Reihenfolge innerhalb der Liste:
Nutzen pro Aufwand.

### ~~Q1 · Grammatik-Diagnose: welche Datei fehlt wo~~ — gebaut 2026-08-20

Die App sagte, *welche Backends* keine Grammatik haben, aber nicht, **welche
Datei in welchem Verzeichnis** fehlt — die Hälfte, die vom verworfenen
Grammatik-Manager übrig blieb: kein Netz, keine neue Abhängigkeit, nur die
Auskunft.

Gebaut als `grammar_dir` (Rust) plus `grammarDiagnosis` (rein, testbar),
vier Sätze im Katalog statt einem mit Löchern. **Es listet den
Verzeichnisinhalt, statt die Suchregel nachzubauen** — die Regel gehört der
Engine (`standalone/treesitter.lua`), und eine zweite Fassung hier könnte
ihr widersprechen und dabei maßgeblich aussehen.

Zwei Befunde kamen erst vom Ansehen im Browser: der Satz wiederholte die
neunzehn Namen aus der Zeile darüber (141px in einer 259px-Spalte, dazu in
zwei Vokabularen — Backend-Namen oben, Grammatiknamen unten), und das
Beispiel war eine Datei, die zwei Sätze vorher als *vorhanden* aufgezählt
wurde. Beides behoben, beides jetzt durch Tests festgehalten.

### ~~Q2 · Letzte Auswahl pro Workspace~~ — gebaut 2026-08-20

Ein Schlüssel pro Workspace, migriert in dem Moment, in dem der aktive
Workspace bekannt wird — nicht beim ersten Wechsel, der würde die Auswahl des
alten Workspace unter dem neuen ablegen.

**Und „nirgendwo" war ein Zustand, den die Seitenleiste nicht ausdrücken
konnte:** ein `<select>` hat immer eine gewählte Option, also nannte der
Picker das erstsortierte Projekt, während die Fläche daneben „Nichts
ausgewählt" sagte. Der erste Fix sah richtig aus und war es nicht — die
Option wurde gesetzt und eine Zeile später überschrieben. **Beides fand der
Blick auf die laufende Seite; der Strukturtest lief durch beide Fassungen
grün.**

### ~~Q3 · Doku-Hygiene in der Engine~~ — gebaut 2026-08-20, `8b98f86`

Vier Stellen waren benannt, **zehn Abschnitte waren betroffen** — vier davon
ohne jede Markierung, also als offene Arbeit lesbar. Dazu eine Behauptung,
die der Bau widerlegt hatte: der Owning-Scope-Eintrag sagte, er müsse vor
jeder Sprache landen, die ihn braucht — Python, Rust, Go, Java, C++, Kotlin,
Swift und Scala sind ohne ihn gebaut worden, über qualifizierte flache
Namen. Ursprünglich benannt: `ROADMAP/WORKPLAN.md:111` führt
„Doc-Coverage pro Sprache" offen, gebaut am 2026-08-20 · `IDEAS/IDEAS.md`
markiert §3.4/§4.1/§8.2 inline als erledigt, statt sie zu entfernen ·
`IDEAS_IMPLEMENTATION_PLAN.md` braucht eine Neubewertung, seit §9s Kosten
viermal bezahlt und §1.7s Vorbedingung erfüllt sind · `MULTILANG.md`s
Phase-0-Liste zeigt Punkte, die geschlossen sind.

**Billig und selbstverstärkend:** die letzten beiden Doku-Durchgänge haben je
einen echten Defekt gefunden, weil jemand die Doku gegen den Code gelesen hat
statt gegen die Erinnerung.

### Q4 · `orphaned-class-alias` — **S**, Engine (`IDEAS` §1.5)

Ein `@class`/`@alias`, auf den nichts mehr zeigt. Eigene Bewertung dort: S,
Nutzen mittel, Kandidat.

### Q5 · Tests, die eine verschwundene Funktion nennen — **S**, Engine (§1.4)

Dieselbe Klasse wie `doc-references-missing`, andere Richtung: der Test nennt
`M.foo`, das es nicht mehr gibt.

### Q6 · Per-entry reference anchors — **S**, Engine

Der Renderer kann sie längst; sie sind absichtlich leer. Es fehlt, sie zu
füllen.

### Q7 · Print-/PDF-Stylesheet — **S**, Engine (§3.3)

Die Seite ist ein einzelnes Artefakt; ausdruckbar zu sein ist eine
Medien-Query, kein Feature.

### Q8 · `K` — das Zeichen unter dem Cursor nachschlagen — **S**, Engine (§4.3)

Paart mit `ReferenceTab.md`s billigster Hälfte (kuratierte Linkliste), die
unabhängig vom Rest ausliefern kann. Der Keyword-Hover in der Seite existiert
schon — das hier ist dieselbe Registry, vierte Auslösefläche.

### ~~Q9 · Eine GitHub Action~~ — gebaut 2026-08-20, `3ae9c83`

`action.yml` an der Wurzel plus `scripts/action_run.lua`. Anschließen kostet
jetzt drei Zeilen statt zweier kopierter Dateien:

```yaml
- uses: StefanBartl/documentation.nvim@main
  with:
    source: lua/myplugin
```

`REUSE.md`s „zwei Dateien kopieren und fünf Zeilen ändern" bleibt daneben
richtig — für ein Repository mit eigenen Layer-Regeln.

### ~~Q10 · Live-Call-Count-Badge im Annotation-Popup~~ — gebaut 2026-08-20, `9a1cd10`

Gelandet in `documentation.nvim`s LSP-Hover statt in einem eigenen Popup:
`K` auf einer Funktion liest jetzt
`**3** incoming calls · **1** outgoing call · called **412**× in the last 7 days`.

**Drei Zustände, und der mittlere ist der Grund für das Zeitfenster.** Echte
jüngste Aufrufe heißen lebendig; aufgezeichnete ohne jüngste sind ein *kalter
Pfad* — was die Gesamtzahl allein nicht sagen kann; gar keine dritte Klausel
heißt „keine Telemetrie", nie „nicht aufgerufen".

**Der Fall, für den es gebaut wurde, ist der, in dem beide statischen Zahlen
null sind.** Eine Funktion, die statisch niemand aufruft — als Callback-Wert
gebunden, oder über dynamischen Dispatch erreicht — lieferte vorher *gar
keinen* Hover. Genau das ist der blinde Fleck der statischen Analyse.

**Eine Korrektur am Eintrag:** `(7d)` steht nicht in `Data.functions`, das
zählt seit jeher. Ableitbar ist es aus `Data.days`' Kalenderkübeln, und daher
kommt `Row.calls_recent`.

**Zwei echte Defekte auf dem Weg**, beide mehr wert als das Feature selbst:
der Join traf fast nichts (`scan_full` gegen `M.scan_full` — dieselbe
Schlüsselraum-Verwechslung, die auf der *Modul*-Seite schon einmal gefunden
und behoben wurde, auf der *Funktions*-Seite überlebt), und ein zweites
Repository in einer Sitzung bekam überhaupt keine Call-Hierarchie
(`reuse_client` verglich nur den Namen).

### ~~Q11 · `:MDView preview-tab` als Report-Stil~~ — gebaut 2026-08-20, `0d5ec4d`

`report_style = "preview-tab"`: ein echter Puffer im eigenen Tab, kein Relay,
kein Browser, nichts heruntergeladen.

**Der Gewinn ist `conceallevel`, nicht der Puffer** — gemessen an
`mdview.adapter.preview_tab`, nicht angenommen. Ein read-only Scratch-Puffer
in einem Tab wäre zwanzig Zeilen hier gewesen; das Verbergen der `**` und
Backticks ist der Teil, für den es sich lohnt, von einem anderen Plugin
abzuhängen.

**`"auto"` blieb unangetastet.** Den billigeren Tier zum Standard zu machen
ist ein echtes Argument — und verliert gegen ein besseres: `"auto"` ist das,
worauf jede bestehende Konfiguration schon auflöst.

### ~~Q12 · Ein gemeinsamer Projektschlüssel~~ — entschieden 2026-08-20, `5f4083f`

**Die Entscheidung ist `lib.nvim.fs.project_key`**, und es gab nie einen
echten Wettbewerb: §3.4 nannte es selbst, es liegt in der Abhängigkeit, die
alle drei teilen, und die Request-History schlüsselt heute darauf.

`documentation.nvim` normalisiert `opts.root` jetzt durch dasselbe
`lib.nvim.fs.normkey`, und die Registry schlüsselt Handles über dieselbe
Funktion statt über eine zweite Kopie, die zufällig übereinstimmte.

**Die Abweichung war gemessen, nicht vermutet:** bei explizit übergebenem
Root — jeder Headless-Lauf, jeder CI-Job, jedes Projekt aus diesem Programm —
waren `e:/repo` und `E:/repo` zwei Repositories.

**Zwei Dinge vorher geprüft**, weil eine Schlüsseländerung die teure Sorte
ist: kein absoluter Pfad steht im `module_map.json` (keine committete Karte
wird stale), und `normkey` degradiert korrekt unter `standalone/vim_shim.lua`
— gegen dessen echte `uv`-Oberfläche ausprobiert, was die eine reale Lücke
zutage brachte (`normkey` schneidet keinen Schrägstrich am Ende ab; unter
Neovim hatte `fs_realpath` das verdeckt).

**Offen und jetzt billig:** Telemetrie-Namespaces sind Plugin-Namen, mdview
schlüsselt auf `cwd`. Beides absichtlich, beides blockiert nichts.

### Q13 · Extension-API, Stufe 1 — **S**, `docmap-desktop`, reine Doku

`ROADMAP.md` sagt es selbst: *das Artefakt ist bereits die API.*
`module_map.json` ist byte-deterministisch, versioniert und dokumentiert. Was
fehlt, ist der Satz — und eine Kompatibilitätszusage, was ein Schema-Bump
ändern darf. Stufen 2 und 3 stehen in Teil 2 und 3.

### Q14 · Den fehlenden Werkzeugnamen nennen — **S**, Engine (§6.8)

Im Desktop existiert das beste Exemplar bereits (die Notiz über
Hierarchy → Types nennt `lua-language-server`). Offen ist die Neovim-Seite —
und **mit der Korrektur, die dazugehört**: die zwanzig Drift-Prüfungen der
Karte sind ihre eigenen und brauchen keinen Linter in keiner Sprache. Nur
Types ist werkzeugabhängig. Ein mason.nvim-Hinweis gehört ausschließlich nach
Neovim.

---

## Teil 2 — Mittel

### ~~M1 · Call-Kanten: **eine** Sprache vollständig, als Muster~~ — gebaut 2026-08-20, Go

**Das größte Einzelloch im Werkzeug**, und für eine Sprache ist es zu.
Vorher lieferten vier Backends von dreiundzwanzig Call-Kanten (`lua`, `js`,
`ts`, `tsx`); jetzt fünf, und achtzehn liefern weiter `{}`.

**Die Messung hat wieder etwas geändert — wie bei jedem der vierzehn
Backends davor, ohne Ausnahme.** Und diesmal war es nicht der Extraktor,
sondern der *Resolver*, was der eigentliche Fund für die übrigen achtzehn
ist:

- **Ein Go-Paket ist ein Verzeichnis.** Ein unqualifiziertes `double(n)` in
  `widget.go` kann eine Funktion in `helper.go` daneben meinen, und nichts an
  der Aufrufstelle sagt das. Go hat kein `module_file`, also sind das zwei
  IR-Knoten — ein dateiweiser Resolver verliert damit *fast die Hälfte* eines
  echten Go-Call-Graphen, nicht dessen Rand. Gemessen an `aws/smithy-go`:
  883 Call-Kanten, **397 davon dateiübergreifend innerhalb eines Pakets**.
- **Getragen von einem Feld, nicht von einem Sonderfall:**
  `LangBackend.call_scope = "package"`. Die nächste Sprache, die das braucht,
  ist ein Feld an ihrem Backend und keine Zeile in `core/calls.lua`.
- **Ein Name, den zwei Dateien eines Verzeichnisses deklarieren, wird
  verworfen statt geraten.** Echtes Go kompiliert das nur, wenn das
  Verzeichnis *nicht* ein Paket ist (`widgets` neben `widgets_test`) — es gibt
  keine ehrliche Wahl, und eine selbstsichere falsche Kante ist genau das,
  wogegen `calls_heuristic` opt-in bleibt.
- **Erste Messung ergab null Funktionen** — weil die Go-Grammatik gar nicht
  geladen war. Auch das ein Fund: die Zahl sah aus wie ein Ergebnis.

**Die Lehre für L1:** *zuerst fragen, was in dieser Sprache ein Scope ist,
dann die Query schreiben.* Lua und die ECMA-Familie haben darüber nichts
beigebracht, weil bei ihnen Datei und Scope zufällig dasselbe sind.

**Offen und bewusst so:** `other.Bump` löst nicht auf. Ein Go-Import-Pfad ist
absolut gegen den Modulgraphen, das bräuchte die `module`-Zeile aus `go.mod`
— eine Build-Datei, keine Quelldatei — oder einen Suffix-Vergleich, also
Raten. Der Callee-Text wird trotzdem ausgegeben.

### M2 · Cross-Repo-Checks über `tag_files` — **S–M**, Engine (§1.7)

**Die Vorbedingung ist erfüllt** und war es lange, ohne dass es jemand
gemerkt hat: 33 `.nvim`-Repositories, ~30 mit committeter Karte, ein
geteiltes `lib.nvim`.

### M3 · Cross-Repo-Dashboard — **M**, `docmap-desktop`

Die Workspace-Ebene, die kein einzelnes Repository haben kann. Diese App ist
die einzige Stelle, die mehrere Projekte gleichzeitig hält.

### M4 · Public-API-Surface-Panel — **S–M**, Engine (§2.2)

### M5 · Picker-Integration (telescope/pickers.nvim) — **S–M**, Engine (§4.2)

### M6 · Config-Analyse: die drei übrigen Punkte — **S–M je**, Engine

Andere Plugin-Manager als lazy.nvim (packer, vim-plug, mini.deps sind eigene
Extraktoren, keine gebogene Version des einen) · Lazy-Load-Inventar
(beantwortet „warum ist das noch nicht geladen") · verwaiste Spec-Dateien.
Keymap-Konflikte sind gebaut.

### M7 · Reference-Tab — **M**, Engine

Zwei Panels plus eine „was ist das"-Fläche. **Die billige Hälfte zuerst**:
die kuratierte Linkliste liefert unabhängig vom Rest aus. Offen und in
`HANDOVER.md` notiert: Lua auf 5.1 pinnen (Neovim läuft LuaJIT; die
5.4-Doku führt bei `goto`, Integer-Division und `<close>` aktiv in die Irre),
und ob MDNs URL-Struktur für JS/TS dasselbe hergibt.

### M8 · I18N-0 — Findings tragen Parameter statt Prosa — **M**, Engine

`check.lua`s `add()` bekommt `(severity, check, node_id, params)`, ein
Formatter an jeder Kante, `module_map.json` verliert die englischen Sätze.
**Braucht einen Schema-Bump — und zwar denselben, den `MULTILANG.md` C.1 auch
braucht.** Zwei Bumps für eine Gelegenheit wären eine vermeidbare Bruchstelle
für jeden Konsumenten. Abnahme: `--check`-Ausgabe unter `LANG=en`
byte-identisch.

### M9 · Compiler Explorer, zwei Schritte weiter — **M**

Zwei markierte Funktionen in einem `clientstate` nebeneinander (die Frage,
die das Duplikate-Panel aufwirft und nicht beantworten kann), und ein
**lokaler** Compiler Explorer statt godbolt.org. Der Link ist heute das
einzige Feature der erzeugten Seite, das überhaupt ins Netz greift. Die
committete Seite darf niemals den `localhost` einer Maschine fest verdrahten.

### M10 · Die beiden Joins aus `runtime-analysis` — **M**

§1.1 Churn × Call-Count (trennt „refaktorieren" von „löschen", was heute
nichts tut) und §1.2 Auto-Coverage × Telemetrie (ergibt die
heiß-und-ungetestet-Warteschlange und repariert nebenbei `coverage.lua`s
selbst benannten blinden Fleck). Beide brauchen **keine neue Erhebung** auf
keiner der beiden Seiten.

### M11 · Phase-0-IR: Owning Scope, ein File / viele Module — **M**, Engine

Voraussetzung für tieferes Python (Klassen) und Rust (`mod x {}`, `impl`).
Berührt jeden Konsumenten von `Documentation.FunctionInfo`. **Nicht** nötig
für die bereits gebauten Backends — deshalb steht es hier und nicht in
Teil 1.

### M12 · Extension-API, Stufe 2 — **M**, `docmap-desktop`

Lesende Erweiterungen: ein Panel, das etwas aus dem Artefakt Berechnetes
zeigt. Der lokale Server ist die Naht und existiert.

---

## Teil 3 — Groß

| # | Was | Warum groß |
|---|---|---|
| **L1** | **Call-Kanten für die übrigen achtzehn** (nach M1) | Echte Feature-Arbeit pro Sprache, jede gegen fremden Code gemessen |
| **L2** | **i18n vollständig** (I18N-1 bis I18N-7) | `render/html.lua` ist ~85 % der Arbeit — 7 433 Zeilen gegen 14 `vim.notify`-Stellen im ganzen Plugin. Die englische Extraktion ist **manuell und geprüft**, kein Regex-Durchlauf: `html.lua` baut Sätze per Konkatenation, ein Sweep zerschnitte sie an Interpolationsgrenzen, und das ist später nicht reparierbar, ohne die Arbeit zu wiederholen |
| **L3** | **Die sechzehn übrigen Sprachen** | Verfügbar, nicht geplant — siehe D4 |
| **L4** | **API-Traffic als Messung** (`runtime-analysis` §1.7b) | Der Schritt vom Zählen zum Messen, und der Weg zu einem Profiler. Metadaten und Formen, **niemals Payloads** — vorab entschieden, weil die Aufzeichnungen committet werden |
| **L5** | **Checklisten von einem Agenten ausführen lassen** | Der Tab und die Auswahl leben in dieser App. Zwei Dinge vorher entscheiden, beide über Vertrauen: eine handgeschriebene Behauptung und eine gemessene Beobachtung dürfen nicht gleich aussehen, und die Bearbeitung eines Agenten ist ein Vorschlag, kein Ergebnis |
| **L6** | **Extension-API, Stufe 3 (schreibend)** | Der Seitenkanal ist heute einseitig. Eine Seite, die beliebige Nachrichten ihres Hosts ausführt, ist eine andere Sicherheitsposition als eine, die nur spricht |
| **L7** | **Zwei Artefakte in der Seite vergleichen** (§3.1) | M–L, eigene Bewertung |
| **L8** | **Ganz ohne Neovim** (`PORTABILITY.md`) | „Karte aus dem Terminal" geht längst; die Neovim-Abhängigkeit ganz fallen zu lassen ist separat kalkuliert |

---

## Teil 4 — ausdrücklich nicht geplant

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
| **M8** (I18N-0) | **L2** (i18n) | Solange Findings fertige englische Sätze sind, ist jede Übersetzung eine Nachbearbeitung von Prosa |
| **M8** + `MULTILANG.md` C.1 | — | **Ein** Schema-Bump für beide. Zwei wären zwei Bruchstellen für jeden Konsumenten |
| **M1** (eine Sprache) | **L1** (achtzehn) | Das Muster muss an fremdem Code gemessen sein, bevor es achtzehnmal kopiert wird |
| **M11** (Phase-0-IR) | tieferes Python/Rust | Klassen und `impl`-Blöcke haben ohne Owning Scope keinen Ort |
| **Q13** (Stufe 1) | **M12**, **L6** | Eine API-Zusage vor der ersten Erweiterung, nicht danach |
| **D1** | die Discussions-Zeile | Eine Einstellung in deinen Repos |
| **Q12** (Projektschlüssel) | jeder weitere Join | Jetzt eine Entscheidung, später eine Migration |

---

## Die nächsten zehn Schritte

Mein Vorschlag, wenn nichts dazwischenkommt — Quick Wins zuerst, aber nicht
alle, bevor das größte Loch angefangen ist:

1. **Q3** Doku-Hygiene (billig, und findet erfahrungsgemäß echte Defekte)
2. **Q1** Grammatik-Diagnose im Desktop
3. **Q2** Letzte Auswahl pro Workspace
4. ~~**Q10 + Q11** die beiden Stundensachen aus `runtime-analysis.nvim`~~ — erledigt
5. ~~**Q12** den gemeinsamen Projektschlüssel entscheiden, solange er billig ist~~ — erledigt
6. ~~**Q9** die GitHub Action~~ — erledigt, `3ae9c83`
7. ~~**M1** Call-Kanten für **eine** Sprache, gegen ein fremdes Repo
   gemessen~~ — erledigt, Go
8. **Q4 + Q5** die beiden neuen Checks ← **hier weitermachen**
9. **M2** Cross-Repo-Checks — die Vorbedingung liegt seit Wochen erfüllt da
10. **M8** I18N-0 samt Schema-Bump, gemeinsam mit `MULTILANG.md` C.1

Danach ist der nächste große Block **L1** (die achtzehn übrigen Sprachen für
Call-Kanten) oder **L2** (i18n) — und das ist dann wieder eine Entscheidung
über Umfang, keine über Technik.
