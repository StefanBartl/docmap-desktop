# Implementierungsplan — `documentation.nvim` · `docmap-desktop` · `runtime-analysis.nvim`

**Ein Plan für alle drei Repositories.** Stand 2026-08-21. Vorher stand die
Warteschlange an fünf Stellen — zwei `WORKPLAN.md`, drei `ROADMAP.md`, eine
`IDEAS.md` und dieser Plan —, und dieselbe Aufgabe tauchte in mehreren davon
in unterschiedlichem Zustand auf. Jetzt steht sie hier und sonst nirgends.

## Was hier steht und was nicht

| | Wo | Was |
|---|---|---|
| **Offene Arbeit** | **dieses Dokument** | Alles, was noch aussteht, in drei Aufwandsstufen |
| **Begründungen** | `IDEAS.md`, `MULTILANG.md`, `I18N.md`, `PORTABILITY.md`, `ReferenceTab.md`, `DESKTOP_WEBAPP.md` | *Warum* ein Punkt so zugeschnitten ist, was er kostet, was dagegen spricht. Keine Häkchen, keine Reihenfolge — die stehen hier |
| **Protokoll** | `PLAN-DONE.md`, beide `WORKPLAN.md`, `FEATURES.md`, `FINISHED.md` | Was gebaut wurde und warum. Wächst, wird nie gekürzt |
| **Öffentlicher Ausblick** | je `ROADMAP.md` | Wohin das Projekt geht, in Prosa, für Fremde |

**Erledigtes wird hier gestrichen, nicht abgehakt stehengelassen** — sonst
wächst das Dokument, statt den Rest zu zeigen. Die Begründung wandert beim
Streichen nach `PLAN-DONE.md`.

**Aufwandsklassen**, ehrlich und grob: **XS** unter einer Stunde ·
**S** ein paar Stunden · **M** ein Arbeitstag oder mehr · **L** mehrere
Sitzungen.

**Die IDs sind neu.** Wo ein Punkt vorher eine andere Nummer hatte, steht sie
dabei — Commit-Nachrichten und Protokolle verweisen darauf.

## Inhalt

- [Wartet auf dich](#wartet-auf-dich)
- [Quick Wins](#quick-wins)
- [Mittel](#mittel)
- [Groß](#groß)
- [Angrenzend — mdview.nvim](#angrenzend--mdviewnvim)
- [Ausdrücklich nicht geplant](#ausdrücklich-nicht-geplant)
- [Abhängigkeiten](#abhängigkeiten)
- [Wo ich weitermachen würde](#wo-ich-weitermachen-würde)

---

## Wartet auf dich

Nichts davon kostet mich Zeit; jedes kostet dich einen Satz oder einen
Handgriff.

| # | Was | Warum du |
|---|---|---|
| **A1** | **`v0.3.0` veröffentlichen.** Der Entwurf steht mit neun Assets, alle vier Plattform-Jobs grün. (`v0.2.0` wurde nie veröffentlicht und ist gelöscht — 39 Commits landeten darauf, bevor jemand die App geöffnet hatte.) `RELEASING.md` sagt es selbst: *der letzte Schritt ist ein Mensch, der die App öffnet.* Vier Dinge durchgehen (Projekt lädt seine Karte · Karte erzeugen läuft · Einstellungen öffnen · Hilfe → Über nennt Engine und Build), plus **Projekt → Projekteinstellungen…** — das Feature, dessen Flags der Grund für den Engine-Build waren | Nichts automatisiert das, und nichts sollte |
| **A2** | **Discussions einschalten** — sobald **jemand anderes** eine echte Frage stellt. Dann wandert `question` auf `discussions/new?category=q-a`, eine Zeile in `TOPICS` | Entschieden (aus, mit Stolperdraht). Der Auslöser ist ein Ereignis, keine Aufgabe |

---

## Quick Wins

Stunden. **Nichts mehr, und das ist wörtlich gemeint:** alle acht sind
erledigt und stehen in [`PLAN-DONE.md`](PLAN-DONE.md). Was hier unter der
alten Nummer QW6 übrig blieb, ist keine Stunde mehr, sondern **M** — es steht
nur deshalb noch in diesem Abschnitt, weil die Nummer sonst ins Leere zeigte.

### QW6 · Zaunblöcke auf der Seite — **M**, Engine

Mehrzeilige ```` ``` ````-Blöcke mit Syntax-Hervorhebung im erzeugten HTML.

Stufe 1 — Inline-Code über eine einzige `prose()`-Funktion in dreizehn
Flächen — ist gebaut und steht in
[`PLAN-DONE.md`](PLAN-DONE.md). Stufe 2 wurde damals bewusst nicht
mitgemacht: eine Zusammenfassung ist einzeilig, der mehrzeilige Fall ist
`@example`, und das ist eine andere Fläche mit anderer Form. Beides in einem
Regex ist der Weg zu einem Renderer, über den niemand mehr nachdenken kann.

**`color_my_ascii.nvim` hilft hier nicht**, und das ist eine Eigenschaft der
Flächen, keine Wertung: seine Fence-API ist puffer-basiert und braucht einen
Neovim-Puffer. Die erzeugte Seite ist ein eigenständiges Artefakt im Browser,
und die Standalone-Engine läuft ganz ohne Neovim. Für `:DocBrowse` half es
sehr wohl — das war QW8.

## Mittel

Ein Arbeitstag oder mehr.

### M7 · Phase-0-IR: Owning Scope, ein File / viele Module — **M**, Engine

Vorbedingung für tieferes Python (Klassen) und Rust (`mod x {}`, `impl`).
Berührt jeden Konsumenten von `Documentation.FunctionInfo`. **Nicht** nötig
für die bereits gebauten Backends — deshalb hier und nicht in den Quick Wins.
*Vorher: M11.*

### M8 · `:DocMap impact`, gewichtet nach Laufzeit-Reichweite — **M**, runtime-analysis (§1.3)

`impact` beantwortet „welche Funktionen berühren meine geänderten Zeilen und
wer ruft die auf". Mit Telemetrie daneben wird daraus „…und wie oft ist das
tatsächlich passiert" — eine Rangfolge statt einer Liste.

### M9 · `:DocMap why` × Call-Trees — **M**, runtime-analysis (§1.4)

`why <a> <b>` läuft heute den **statischen Require-Graphen**. Der Call-Tree
ist die andere Kette: nicht „was lädt was", sondern „was ruft was". Zwei
Antworten auf zwei verschiedene Fragen, die gerne verwechselt werden.

### M10 · Laufzeit-Evidenz als *Check-Eingabe* — **M**, runtime-analysis (§1.5)

Jede andere Kreuzung ist eine Ansicht. Die stärkere Form füttert
Laufzeit-Evidenz in die Checks — **als Unterdrückung, nie als Verschärfung**.
Die Grenze ist in §7 gezogen und bleibt: eine Warnung, die auf einer Maschine
erscheint und auf einer anderen nicht, ist schlechter als keine Warnung.

### M11 · Endpoint-Inventar × Request-Historie × Response-Form — **M**, runtime-analysis (§1.7)

Welche deklarierte Route wurde je aufgerufen, mit welcher Antwortform. Die
Hälfte „welche Route ist deklariert" existiert; die andere liegt in der
Historie des Request-Runners.

### M12 · Runtime-Tab im ausgelieferten Artefakt — **M**, drei Repos (§3.2)

`ECOSYSTEM.md` §7 Fläche 2, unverändert richtig: ein Runtime-Tab **immer**
zur Laufzeit gefüllt, nie eingebettet. Laufzeitdaten im committeten Artefakt
sind eine der vier „Never"-Zeilen.

### M13 · Ein `ECOSYSTEM.md`, vier Repositories lesen es — **S–M**, drei Repos (§3.3)

Ein weiches, echtes Problem: das Architekturdokument liegt in einem Repo und
beschreibt vier. Wer es in den anderen dreien sucht, findet nichts. **Dasselbe
Muster wie dieser Plan** — eine Quelle, drei Zeiger.

---

## Groß

Mehrere Sitzungen. Jede ist zuerst eine **Umfangsentscheidung**, keine
technische.

| # | Was | Der Kern |
|---|---|---|
| **L1** | **Call-Kanten für die übrigen achtzehn Sprachen** | Das Muster steht (Go, gegen `aws/smithy-go` gemessen). Die Lehre daraus ist die Anweisung: *erst fragen, was in dieser Sprache ein Scope ist, dann die Query schreiben.* Lua und die ECMA-Familie haben darüber nichts beigebracht |
| **L2** | **i18n vollständig** (I18N-1 bis I18N-9) | I18N-0 ist gebaut. `render/html.lua` ist ~85 % der restlichen Arbeit. Die englische Extraktion ist **manuell und geprüft**, kein Regex-Durchlauf — ein Sweep zerschnitte die per Konkatenation gebauten Sätze an Interpolationsgrenzen, und das ist später nicht reparierbar |
| **L3** | **Die fünfzehn übrigen Sprachen** | Verfügbar, nicht geplant (D4: „erstmal genug"). Vollständige Tabelle mit Kosten und dem bestehenden Backend, dessen Entscheidung jede wiederverwendet, in `MULTILANG.md`. Aus den oberen zehn wählen — die unteren fünf brauchen einen Zeilen-Scanner, also eine *zweite Sorte* Backend |
| **L4** | **API-Traffic als Messung** (§1.7b) | Der Schritt vom Zählen zum Messen, und der Weg zu einem Profiler. Metadaten und Formen, **niemals Payloads** — vorab entschieden, weil die Aufzeichnungen committet werden |
| **L5** | **Multi-Language-Telemetrie** (§1.9) | Profile *importieren*, nicht instrumentieren. Die einzige Form, in der Telemetrie über Lua hinausgeht, ohne in jeder Sprache einen Wrapper zu bauen |
| **L6** | **Checklisten von einem Agenten ausführen lassen** | Zwei Dinge vorher entscheiden, beide über Vertrauen: eine handgeschriebene Behauptung und eine gemessene Beobachtung dürfen nicht gleich aussehen, und die Bearbeitung eines Agenten ist ein *Vorschlag*, kein Ergebnis |
| **L7** | **Extension-API, Stufe 3 (schreibend)** | Der Seitenkanal ist heute einseitig. Eine Seite, die beliebige Nachrichten ihres Hosts ausführt, ist eine andere Sicherheitsposition als eine, die nur spricht |
| **L8** | **Zwei Artefakte in der Seite vergleichen** | Der textuelle Diff existiert; die *Form*-Änderung ist das, was er nicht zeigen kann |
| **L9** | **Ganz ohne Neovim** (`PORTABILITY.md`) | „Karte aus dem Terminal" geht längst; die Neovim-Abhängigkeit ganz fallen zu lassen ist separat kalkuliert |

---

## Angrenzend — mdview.nvim

`runtime-analysis.nvim`s `IDEAS.md` §2 beschreibt Kreuzungen mit
**mdview.nvim** — einem vierten Repo, das nicht Teil dieser drei ist.
Deshalb hier ohne Aufwandsklasse und ohne Platz in der Reihenfolge: es sind
keine Aufgaben, die man einfach einplant, sondern Absprachen mit einem
Nachbarn.

**Die Richtung ist festgelegt und gilt für alle:** jede Kreuzung läuft
*hierher*, nie umgekehrt. mdview ist Darstellung und weiß nichts über
Lua-Semantik — genau diese Asymmetrie hält mdview für Leute benutzbar, die
keins der Analyse-Plugins haben.

- **§2.1 Theme-Parität** — wem gehört das Aussehen des Reports.
- **§2.3 Die Response-Fläche des Request-Runners, gerendert** — ein JSON- oder
  HTML-Body in einem nackten Split ist die schwächste Fläche des Runners.
- **§2.4 mdviews Relay als token-gesicherter Server** — falls je eine
  Browser-Stufe entsteht.
- **§2.5 mdview mit mdviews eigener Bridge instrumentieren** — leicht
  zirkulär und vollkommen praktisch.
- **§2.6 `:MDView diagnose` ausleihen, keinen zweiten bauen.**

---

## Ausdrücklich nicht geplant

Damit niemand sie erneut verhandelt. Jede hat ihre Begründung an ihrer
eigenen Stelle; hier steht nur, dass sie entschieden ist.

- **Grammatik-Manager mit Download** — lädt native Shared Libraries von einem
  rollenden Tag ohne veröffentlichte Prüfsumme nach. Im CI in Ordnung, als
  Knopf in einer installierten App ein stiller Update-Kanal für ungeprüften
  ausführbaren Code. Die Diagnose-Hälfte ist gebaut.
- **Wave 4 der Sprachen** (Fortran, Ada, COBOL, Delphi, MATLAB, VB.NET) —
  Umfang, nicht Schwierigkeit. Wieder baubar, sobald jemand eine anfragt.
- **`@since`-Drift, Bus-Faktor, Kopplung/Kohäsion, OpenAPI, SFCs, ORM,
  Workspace-Symbole, REUSE-Rezept, Skalierung** — je eigene Ablehnung in
  `documentation.nvim/docs/ROADMAP/IDEAS/IDEAS.md`.
- **Eine Dateigrößen-Treemap** — das fotogenste Ding auf der Ideenliste, und
  es beantwortet nichts, was jemand gefragt hat.
- **Churn- und Ownership-Ansichten in der erzeugten Seite** — beide brauchen
  `git`, und ein committetes Artefakt mit Historie entwertet sich selbst.
  Sie bleiben Live-Ansichten der App oder des Editors.
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
| **M7** (Phase-0-IR) | tieferes Python/Rust | Klassen und `impl`-Blöcke haben ohne Owning Scope keinen Ort |
| **M12** (Runtime-Tab) | **L4** (API-Traffic) | Erst die Fläche, dann die reichere Messung darauf |
| **A2** | die Discussions-Zeile | Eine Einstellung in deinen Repos |

**Nicht mehr blockierend, weil die erste Hälfte gebaut ist:** Go hat das
Muster für **L1** geliefert, I18N-0 die Parameter für **L2**, der
Projektschlüssel jeden weiteren Join — und die Extension-API Stufe 2 die
Grundlage für **L7**, das damit als Einziges aus dieser Liste frei geworden
und trotzdem nicht als Nächstes dran ist.

---

## Wo ich weitermachen würde

Vierzehn Punkte sind seit dem 2026-08-20 abgearbeitet; sie stehen mit ihrer
Begründung in [`PLAN-DONE.md`](PLAN-DONE.md), nicht mehr hier.

**Als Nächstes M7** (Phase-0-IR: Owning Scope). Es ist der einzige offene
Punkt, der etwas *anderes* aufhält — tieferes Python und Rust haben ohne ihn
keinen Ort für Klassen und `impl`-Blöcke —, und es berührt jeden Konsumenten
von `Documentation.FunctionInfo`, weshalb es besser vor als nach den fünf
runtime-analysis-Punkten kommt.

Danach **M12** (Runtime-Tab), aus demselben Grund: es ist die Fläche, auf der
M8 bis M11 überhaupt erst etwas zeigen können.

**Nicht als Nächstes**, obwohl sie groß und sichtbar sind: **L1** und **L2**.
Beide sind mehrere Sitzungen und beide eine Umfangsentscheidung, keine
technische — die trifft man ausgeruht und nicht nebenbei.
