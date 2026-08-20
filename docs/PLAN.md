# Implementierungsplan — `documentation.nvim` · `docmap-desktop` · `runtime-analysis.nvim`

**Ein Plan für alle drei Repositories.** Stand 2026-08-20. Vorher stand die
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
| **A1** | **`v0.2.0` veröffentlichen.** Der Entwurf steht mit neun Assets, alle vier Plattform-Jobs grün. `RELEASING.md` sagt es selbst: *der letzte Schritt ist ein Mensch, der die App öffnet.* Vier Dinge durchgehen (Projekt lädt seine Karte · Karte erzeugen läuft · Einstellungen öffnen · Hilfe → Über nennt Engine und Build), plus **Projekt → Projekteinstellungen…** — das Feature, dessen Flags der Grund für den Engine-Build waren | Nichts automatisiert das, und nichts sollte |
| **A2** | **Discussions einschalten** — sobald **jemand anderes** eine echte Frage stellt. Dann wandert `question` auf `discussions/new?category=q-a`, eine Zeile in `TOPICS` | Entschieden (aus, mit Stolperdraht). Der Auslöser ist ein Ereignis, keine Aufgabe |

---

## Quick Wins

Stunden. Reihenfolge innerhalb der Liste: Nutzen pro Aufwand.

**Alle bis auf eine sind erledigt.** Offen bleibt nur QW6 **Stufe 2** —
Zaunblöcke *auf der Seite* — und die ist **M**, keine Stunde. Zwei der
erledigten haben nicht das ergeben, was ihr Eintrag erwartete: QW4 endete
mit „nichts zu tun", QW5 mit „nein, bleibt doppelt" — und beide sind
deshalb festgehalten statt offen.

### ~~QW2 · Datei-Pane: die übrigen Unter-Einträge~~ — **gebaut 2026-08-20**, `292f925`

Das Pane sagt jetzt auch, was git von einem Eintrag hält: **nicht in git**
und **von git ignoriert — trotzdem in der Karte**.

**Die beiden Hälften beantworten entgegengesetzte Überraschungen.**
`nicht gescannt` und `eigenes Repository` erklären einen Ordner, der da ist
und *nicht* in der Karte. Die zwei neuen erklären das Umgekehrte — und
*ignoriert* ist das, was sonst nichts in diesem Fenster sagen könnte: der
Scan liest `.gitignore` nicht, also wird ein in git ignorierter Ordner
trotzdem kartiert.

`ignored` ist bewusst ein eigenes Feld statt Teil von `skipped`: `skipped`
ist die Regel *dieses Werkzeugs* und überall gleich, `ignored` die des
*Repositories*. Ein Verzeichnis kann beides, eines oder keines sein.

**Ein Test hat einen echten Konstruktionsfehler gefunden**, keine
Bestätigung: `-unormal` fasst ein untracked Verzeichnis zu einer Zeile
zusammen und erwähnt seinen Inhalt nie — an der Wurzel richtig, eine Ebene
tiefer stillschweigend falsch. Der Bericht über das Verzeichnis selbst wird
jetzt an die Einträge weitergereicht.

Höchstens eine Notiz pro Zeile, äußerste Tatsache zuerst.

### ~~QW3 · Erklär-Attribute auch *innerhalb* der Views~~ — **gebaut 2026-08-20**, `f705e09`

**Und es war die Engine, nicht der Desktop** — die Views sind die der
erzeugten Seite. Zweiundzwanzig Controls haben eine Erklärkarte bekommen:
die sechs Hierarchy-Graphen und alle sechzehn Analysis-Werkzeuge.

**Sechs davon benutzten ein rohes `title`**, wogegen der Mechanismus im
eigenen Code argumentiert: *„a `title` attribute would have been free and
never appears on focus."* Umgestellt statt verdoppelt.

Weil ein `title` von Screenreadern vorgelesen wird, ist die Karte jetzt per
`aria-describedby` verknüpft — und die Verknüpfung wird beim Schließen
entfernt, sonst beschreibt sie ein verstecktes Element.

`explain_spec.lua` hält die Verbindung in beide Richtungen; in beide
Richtungen mutationsgeprüft.

### ~~QW4 · Den Fokus-Pfad des Erklär-Popups verifizieren~~ — **gemessen 2026-08-20: nichts zu tun**

Im echten Browser durchgespielt statt begründet: **mit Fensterfokus feuert
`focusin` korrekt** und trifft den richtigen `[data-help]`-Vorfahren — auch
auf einem `<summary>`. Ohne Fensterfokus feuert nichts, und das ist eine
Eigenschaft eines unfokussierten Fensters, nicht des Elements oder des
Panes. Alle elf Controls im Desktop sind per Tastatur erreichbar.

**Zwei Korrekturen an mir selbst**, beide aus dem Messen statt dem Lesen:
`<summary>` *ist* fokussierbar (`tabIndex` 0), und die vier `sub.*`-Texte,
die verwaist aussahen, sind per JavaScript verdrahtet. Ich hätte beinahe
einen Defekt gemeldet, den es nicht gibt.

### ~~QW5 · `proc_trace` und `:RAInspect` sind zweimal dieselbe Technik~~ — **entschieden 2026-08-20**, `c07fec7`

**Ergebnis: keine gemeinsame Wrapper-Registry** — und trotzdem ist die
Lücke zu.

Dagegen sprach: es gibt **einen** Konsumenten, und §4.2 daneben sagt
ausdrücklich, dass Herunterschieben auf einen *zweiten* wartet.
`proc_trace` fragt nie, wer etwas umhüllt hat — es wäre Produzent, nicht
Leser. Und der Fall, der eine Konvention rechtfertigen würde — ein fremdes
Plugin, das `vim.notify` patcht — ist genau der, den eine Konvention **in
`lib.nvim`** nicht erreicht.

**Die zwei Wrapper, die dieses Ökosystem kontrolliert, brauchten sie nicht.**
`proc_trace` veröffentlicht bereits `is_active()` und umhüllt vier
*bekannte* Pfade, also nennt `:RA provenance vim.fn.system` es jetzt exakt —
ohne neue Konvention, ohne Änderung in `lib.nvim`, dreißig Zeilen auf der
Konsumentenseite.

Dabei korrigiert: der Schlusssatz des Berichts behauptete, nichts hier kenne
fremde Wraps — was ab dem zweiten exakten Fall dem Satz darüber widersprach.

### QW6 · Code in Beschreibungen — **Stufe 1 gebaut 2026-08-20**, Stufe 2 offen

**Inline-Code ist erledigt** (`7d3f859`): eine Funktion `prose()`, in
**dreizehn** Flächen verdrahtet — die Hierarchy-Kästen, das
Annotations-Popup, Funktions- und Knotenzeilen, das Detailpane, Symbole,
Keymap-Zeilen, beide Feature-Ansichten, die Tag-Tabelle, die Keyword-Karte
und die Compare-Matrix. Im Browser nachgemessen: **750 `<code>`-Elemente,
96 davon in den Hierarchy-Kästen**, keins leer, keins verschachtelt.

**Offen bleibt Stufe 2: Zaunblöcke** (```` ``` ````) mit
Syntax-Hervorhebung. Bewusst nicht mitgemacht — eine Zusammenfassung ist
einzeilig, der mehrzeilige Fall ist `@example`, und das ist eine andere
Fläche mit anderer Form. **M.**

**`color_my_ascii.nvim` hilft dabei nicht, und das ist eine Eigenschaft der
Flächen, keine Wertung.** Seine öffentliche Fence-API ist puffer-basiert
(`list_blocks(bufnr, …)`) — sie braucht einen Neovim-Puffer. Die erzeugte
Seite ist ein eigenständiges Artefakt, das im Browser geöffnet wird und
committet weitergegeben wird; sie kann kein Neovim-Plugin aufrufen, und die
Standalone-Engine läuft ganz ohne Neovim. **Wohl aber für `:DocBrowse`** —
siehe QW8.

### ~~QW8 · Code auch im Editor hervorheben~~ — **gebaut 2026-08-20**, `4aab630`

`:DocBrowse`s Detailpane zeigt Inline-Code jetzt als Code statt als
Backticks — die Fläche, die QW6 offengelassen hatte.

**Die Messung hat die Gewichtung dieses Eintrags umgedreht.** Vor dem Bauen
gezählt statt angenommen: **2 132** Inline-Spans sind in diesem Pane
erreichbar, dagegen **vier** Node-Bodies von hundertdreiundzwanzig mit einem
```` ``` ````-Zaun und **null** `@example`-Blöcke. Inline-Code ist also *das
Feature* und braucht gar keine Abhängigkeit — ein Pattern-Match und ein
Extmark. Der Eintrag hier las sich, als sei das der Fallback.

**`color_my_ascii.nvim` ist damit die Ergänzung, nicht der Mechanismus** —
weiche Abhängigkeit über `soft_require.probe`, und nur aufgerufen, wenn
`list_blocks` wirklich einen Block meldet. Die Begründung des Eintrags
stimmt unverändert: die Fence-API ist puffer-basiert, und dieses Pane *ist*
ein Neovim-Puffer.

**Drei Marken pro Span statt einer:** die Ticks als
`@punctuation.special`, der Text dazwischen als `@markup.raw` — sonst läse
sich die Interpunktion wie Inhalt. Die Backticks bleiben sichtbar; `conceal`
würde jede Spalte danach verschieben, und dieses Pane richtet mehrere von
Hand aus.

`show_detail` ist entstanden, weil es **zwei** Render-Pfade auf dasselbe
Pane gab. Genau die Form, die auseinanderläuft: eine Hervorhebung in nur
einem hätte den anderen mit Backticks stehen lassen, je nachdem wie der
Leser dorthin kam.

Mutationsgeprüft: nimmt man den Aufruf aus `show_detail`, fällt der Spec
namentlich (`expected 30, got 0`).

**Stufe 2 von QW6 bleibt offen** — Zaunblöcke *auf der Seite*. Das ist eine
andere Fläche als diese hier und nach wie vor **M**.

---

## Mittel

Ein Arbeitstag oder mehr.

### M1 · Config-Analyse: die drei übrigen Punkte — **S–M je**, Engine

Drei getrennte Stücke, keines vom anderen abhängig:

- **Andere Plugin-Manager als lazy.nvim** — packer, vim-plug, mini.deps sind
  eigene Extraktoren, keine gebogene Version des einen. **M.**
- **Lazy-Load-Inventar** — welches Plugin lädt auf welches Event/ft/cmd.
  Beantwortet „warum ist das noch nicht geladen". **S.**
- **Verwaiste Spec-Dateien** — ein `lua/plugins/foo.lua`, dessen Plugin
  nichts mehr nennt. **S.**

Keymap-Konflikte sind gebaut. *Vorher: M6.*

### M2 · Reference-Tab, Schritt 6 — **S**, Engine

Vier von sechs Schritten sind gebaut. Schritt 6 ist **die ehrliche Frage**,
ob der Tab nach den In-Place-Lookups überhaupt noch verdient ist. Möglich,
dass die Antwort *nein* lautet — dann ist das der billigste Punkt der Liste
und schaltet zugleich M3 frei. *Vorher: M7.*

### M3 · `K` im Browser — **S**, Engine (§4.3), **nach M2**

**Entschieden 2026-08-20:** die Glossar-Karte für das Wort unter dem Cursor —
dieselbe Registry wie der Keyword-Hover der Seite, vierte Auslösefläche, so
war der Eintrag gemeint.

**Und deshalb hinter M2**, nicht davor: wertvoll ist `K` erst, wenn es etwas
nachzuschlagen *gibt*. Heute stünde der Cursor in einer Liste meist auf
einem Namen, der kein Schlüsselwort ist, und die Taste schwiege. `K` lernt
man einmal. *Vorher: Q8 / D5.*

### M4 · Cross-Repo-Dashboard — **M**, Desktop

Die Workspace-Ebene, die kein einzelnes Repository haben kann. Diese App ist
die einzige Stelle, die mehrere Projekte gleichzeitig hält — und das Erste,
was von den dreiunddreißig Repositories im Korpus wirklich profitiert.
*Vorher: M3.*

### M5 · Extension-API, Stufe 2 — **M**, Desktop

Lesende Erweiterungen: ein Panel, das etwas aus dem Artefakt Berechnetes
zeigt. Der lokale Server ist die Naht und existiert. Stufe 1 (die
Kompatibilitätszusage) steht in `HOSTING.md`. *Vorher: M12.*

### M6 · Compiler Explorer, zwei Schritte weiter — **M**, Engine

Zwei markierte Funktionen nebeneinander in einem `clientstate` — die Frage,
die das Duplikate-Panel aufwirft und nicht beantworten kann —, und ein
**lokaler** Compiler Explorer statt godbolt.org. Der Link ist heute das
einzige Feature der erzeugten Seite, das überhaupt ins Netz greift. Die
committete Seite darf niemals den `localhost` einer Maschine fest verdrahten.
*Vorher: M9.*

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
| **M2** (Reference-Tab, Schritt 6) | **M3** (`K` im Browser) | `K` ist erst wertvoll, wenn es etwas nachzuschlagen gibt |
| **M5** (Extension-API Stufe 2) | **L7** (Stufe 3, schreibend) | Lesen, bevor geschrieben wird — und die Zusage steht schon |
| **M7** (Phase-0-IR) | tieferes Python/Rust | Klassen und `impl`-Blöcke haben ohne Owning Scope keinen Ort |
| **M12** (Runtime-Tab) | **L4** (API-Traffic) | Erst die Fläche, dann die reichere Messung darauf |
| **A2** | die Discussions-Zeile | Eine Einstellung in deinen Repos |

Nicht mehr blockierend, weil erledigt: **Go** hat das Muster für **L1**
geliefert, **I18N-0** die Parameter für **L2**, der **Projektschlüssel** jeden
weiteren Join.

---

## Wo ich weitermachen würde

Nach Nutzen pro Aufwand:

1. ~~**QW8**~~ — erledigt 2026-08-20.
2. **M1** (Config-Analyse) ← **hier weitermachen** — drei getrennte Stücke, jedes für sich nützlich,
   keines von einem anderen abhängig. Das Lazy-Load-Inventar ist davon das
   billigste und beantwortet eine Frage, die man wirklich hat.
3. **M2** — die ehrliche Frage zum Reference-Tab. Möglicherweise der
   billigste Punkt der Liste, und er schaltet M3 frei.
4. **M4** (Cross-Repo-Dashboard) — das Einzige, was nur diese App kann.

**Nicht als Nächstes**, obwohl sie groß und sichtbar sind: **L1** und **L2**.
Beide sind mehrere Sitzungen und beide eine Umfangsentscheidung, keine
technische — die trifft man ausgeruht und nicht nebenbei.
