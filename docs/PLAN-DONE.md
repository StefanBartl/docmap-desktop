# Erledigt — das Protokoll zum Plan

Was aus [`PLAN.md`](PLAN.md) gebaut wurde, mit der Begründung, die beim
Bauen entstanden ist. **Der Plan enthält nur noch Offenes**; hier liegt der
Rest, damit keine Entscheidung zweimal getroffen wird und keine
Erkenntnis mit dem Häkchen verschwindet.

Alles unten ist auf `main` in dem Repo, das der Eintrag nennt. Wo ein
Commit steht, ist er die Quelle; wo keiner steht, nennt der Eintrag das
Repo und das Datum.

**Was hier auffällt und nicht in einer Häkchenliste stünde:** in fast jedem
Eintrag steht ein Satz, der mit ‚und dabei kam heraus‘ anfängt. Das ist
kein Zufall der Formulierung — es ist das Ergebnis davon, jede Sache gegen
echte Daten zu messen statt gegen die eigene Erwartung.

---

## Die vier Entscheidungen, beantwortet 2026-08-20

### D1 · Discussions — es gibt einen Grund, er greift nur noch nicht

Die Frage war „gibt es einen Grund". Es gibt genau einen, und er ist
schmaler als die fünf Kategorien vermuten lassen. Von `feature`, `bug`,
`question`, `docs` und `other` gehören vier eindeutig in Issues: ein Bug,
ein Doku-Fehler und „sonstiges" sind Arbeitsposten, die geschlossen werden.

**Nur `question` passt wirklich zu Discussions**, und dort passt es gut: eine
Frage ist kein Defekt, sie wird nie „geschlossen", sie verstopft als Issue
die Arbeitsliste, und ihre Antwort ist später nicht auffindbar wie ein
Q&A-Thread mit akzeptierter Antwort. `feature` wäre als *Ideas* vertretbar,
aber für ein Ein-Personen-Projekt ist eine Issue-Liste genau die Arbeitsliste,
die man will.

**Dagegen steht ein zweiter Posteingang.** Der Nutzen — Auffindbarkeit von
Antworten, Tracker bleibt Arbeitsliste — entsteht erst, wenn jemand
tatsächlich fragt. Heute würde das Einschalten einen leeren Posteingang in
zwei leere teilen.

**Empfehlung: aus lassen. Auslöser für „an":** die erste echte Frage von
jemandem, der nicht du ist. Dann `question` auf `discussions/new?category=q-a`
umstellen — eine Zeile in `TOPICS`, genau wie `feedback.rs`' eigener Header
es vorsieht. Damit ist das keine offene Frage mehr, sondern eine Entscheidung
mit Stolperdraht.

### D4 · Es sind fünfzehn, und hier sind sie

Die Zahl „sechzehn" stimmte, bis Entscheidung 1 **Scratch** ausschloss —
keine Textsprache, für diesen Contract nichts zu lesen. Danach wurde sie nie
nachgezogen. Genau die Drift, für die es dieses Werkzeug gibt, im eigenen
Backlog.

Die vollständige Liste mit Doku-Konvention, Sichtbarkeitsregel, dem
bestehenden Backend, dessen Entscheidung sie wiederverwendet, und einer
Kostenschätzung steht in
[`MULTILANG.md` § *The fifteen that are available*](../../documentation.nvim/docs/ROADMAP/IDEAS/MULTILANG.md).

Kurzfassung, nach Kosten:

- **Billig (S), weil ein bestehendes Backend die harte Entscheidung schon
  getroffen hat:** **VB.NET** (fast C#), **Groovy** (fast Java/Kotlin),
  **R** (Roxygen2 — das LuaCATS-ähnlichste außerhalb von Lua), **Bash**
  (Pfad-Identität wie Zig, `source` ist die Require-Kante).
- **S–M:** **PowerShell** (Export-Liste wie Erlang), **F#** (`.fsi` — die
  `.mli`-Form, einmal gelöst), **Julia**, **Solidity** (NatSpec ist
  tag-förmig).
- **M, eigene Form:** **Perl** (POD ist *kein* Kommentar — bisher nur Python
  als Präzedenzfall), **SQL** (Entscheidung 3), **Delphi**
  (`interface`/`implementation` in *einer* Datei — die hat weder C noch
  OCaml), **Ada** (Spec und Body in zwei Dateien — die dritte Sprache, die
  das erzwingt, und damit ein Muster, das die IR vielleicht tragen sollte).
- **M und eine andere Art Backend:** **Fortran**, **COBOL**, **MATLAB** —
  kein gepflegter Grammar, also Zeilen-Scanner. Das ist eine *zweite* Sorte
  Backend; wer hier anfängt, bezahlt das Muster.

**Empfehlung, falls doch eine kommt:** aus den oberen zehn wählen, nicht weil
die unteren fünf schwer wären, sondern weil der erste Zeilen-Scanner ein
neues Muster etabliert und das teurer ist als die Sprache selbst.

---

---

## Gebaut

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

### ~~Q4 · `orphaned-class-alias`~~ — gebaut 2026-08-20

Ein `@class`/`@alias`, auf den nichts mehr zeigt — `unreferenced-module` eine
Ebene tiefer. `info`, wie sein Geschwister-Check: ein veröffentlichter Typ
kann legitim nur von einem *Konsumenten* außerhalb dieses Baums referenziert
werden.

**Gemessen: 28 in `lib.nvim`, 1 in `runtime-analysis.nvim`, 1 im eigenen
Repo** — `Documentation.Browse`, eine Aggregat-Klasse für die Modul-
Oberfläche, auf die nichts zeigt; exakt dieselbe Form wie `lib.nvim`s
`Lib.Fs.ALL` und `Lib.Modules`. Stichprobenartig von Hand geprüft, kein
Fehlalarm darunter.

**Der Fund steckte in der Messmethode.** Die erste Fassung fragte
`line:find(name)` — ein Teilstring-Vergleich, mit dem `Lib.Fs.Read` von jeder
Erwähnung von `Lib.Fs.ReadAsync` als „referenziert" galt. Das verdeckte vier
der achtundzwanzig echten Funde. Jetzt ein Token-Vergleich; die eigene
Deklarationszeile zählt nicht als Verwendung, **der Rest der Zeile schon** —
`---@class Child : Parent` ist oft die einzige Stelle, an der `Parent`
überhaupt genannt wird.

### ~~Q5 · Tests, die eine verschwundene Funktion nennen~~ — gebaut 2026-08-20

`test-references-missing`, `warn`: ein Spec nennt `mod.member` über eine
`local mod = require(…)`-Bindung, und das Modul hat das nicht mehr. Dieselbe
Klasse wie `doc-references-missing`, andere Richtung — und die Richtung, die
`coverage.lua`s `fn.tested` nicht abdeckt.

**Drei Fehlalarm-Klassen, jede an echtem Code gemessen statt ausgedacht.** Die
erste Fassung lieferte neun Treffer an drei Repositories, und alle neun waren
falsch: ein **Re-Export** (`M.x = require(…).x`, für `symbols.lua`
absichtlich unsichtbar, weil `deps` ihn besitzt), eine **zur Laufzeit
zusammengesetzte Oberfläche** (`lib/init.lua` ist wörtlich
`return require(require("lib.config").strategy_module())`; `Path` bekommt sein
`new` aus einer Klassenfabrik) und ein **überdeckendes Local**
(`local config = { host = … }` in einem Testkörper). Alle drei sind jetzt
Negativ-Fixtures im Spec.

**Und der eigentliche Fund kam vom Profiler, nicht vom Lesen.** Die erste
Fassung verankerte die require-Query auf `(chunk …)` — die traf **einmal** in
75 Spec-Dateien, weil ein Spec hier `return function(H) … end` ist und jedes
`require` darin steht. Der Check meldete nichts, weil er nichts ansah. Null
Treffer sind kein Beweis: was ihn belegt, sind die 713 / 760 / 547
aufgelösten Zugriffe pro Baum und die Positivkontrolle im Spec.

Kosten: ~150 ms, 5,9 % von Scan+Check — bleibt daher an statt opt-in.

### ~~Q6 · Per-entry reference anchors~~ — gebaut 2026-08-20

Leer waren sie aus einem genannten Grund: die Anker des Lua-5.1-Manuals waren
nie **geprüft**, und ein Referenz-Panel voller Links, die falsch landen, ist
genau der Fehler, für den es in diesem Repo schon einen `dead-readme-link`-
Check gibt. Füllen hieß also prüfen, nicht schreiben.

Das veröffentlichte Manual wurde geholt, seine 397 `<a name>`-Anker
extrahiert, jeder Eintrag dagegen abgeglichen:

- **35 Bibliotheksfunktionen** → `#pdf-<name>`, die Konvention des Manuals
  selbst, für jede einzeln bestätigt.
- **22 Schlüsselwörter** → Abschnittsanker, gefunden durch Suche im
  *Fließtext* nach dem Satz, der das Wort dokumentiert — nicht durch
  Inhaltsverzeichnis-Raten. Deshalb landen `do` und `end` bei **2.4.2**
  (Blocks) statt neben `if` bei 2.4.4, und `self` bei **2.5.9**.
- **`goto` bekommt keinen**, und das ist der Punkt: es existiert in 5.1 gar
  nicht — was seine eigene `note` sagt — ein Link hätte dem Satz daneben
  widersprochen.
- **Die 18 `vim.*`-Einträge bekommen keinen**, wie es der Renderer ohnehin
  schon kodiert.

`glossary_spec.lua` prüft die *Form*, nicht die Ziele — ein Spec, der ins Netz
greift, fällt im Zug um. Mutationsgeprüft.

**ECMA bleibt leer**, und der Grund ist die Form, nicht der Aufwand: Lua ist
eine Seite mit Fragmenten (ein Fetch prüft alles), MDN ist *eine Seite pro
Schlüsselwort* — ein Eintrag müsste einen Pfad anhängen, und das zu prüfen
sind Dutzende Requests gegen eine Site, die umbaut.

### ~~Q7 · Print-/PDF-Stylesheet~~ — gebaut 2026-08-20

Ein `@media print`-Block in `render/html.lua`. Vier Dinge, die sonst
*schlecht* statt nur schlicht gedruckt hätten:

1. **Die Panes sind beschnitten, nicht lang.** `#tree`, `#detail` und die
   beiden History-Panes tragen `max-height:calc(100vh - Npx)` mit
   `overflow:auto` — auf Papier heißt das: der erste Bildschirm wird
   gedruckt, der Rest existiert stillschweigend nicht. Das Aufheben ist die
   eine Änderung, ohne die es gar nicht funktioniert.
2. **Dark Mode geht mit zum Drucker.** `prefers-color-scheme` gehört dem
   Leser, nicht dem Blatt, und Browser überschreiben das nicht.
3. **Bedienelemente, die auf Papier keine sind** — Tabs, Suchfeld,
   Graph-Steuerzeile, alle Buttons. Die Tab-*Leiste* geht, die aktuelle
   Ansicht bleibt: `.view` blendet die anderen ohnehin aus, ein Ausdruck ist
   also der Tab, auf dem man stand.
4. **Zeilen, die am Falz zerreißen** — `break-inside:avoid`.

**Bewusst nicht:** eingeklappte Tree-Äste aufklappen. Gedruckt wird, was auf
dem Schirm steht.

**Verifiziert statt angenommen:** die Seite wurde mit `@media print` auf
`@media screen` umgeschrieben, im Browser geladen und die berechneten Stile
abgefragt — `#tree` bei `max-height:none`/`overflow:visible`, Tabs, Toolbar,
Steuerzeile und Buttons auf `display:none`, Body weiß auf schwarz,
`.row` auf `break-inside:avoid`, und `main` einspaltig, wenn der Tree-Tab
aktiv ist.

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

### ~~Q13 · Extension-API, Stufe 1~~ — gebaut 2026-08-20

Geschrieben, wo das Artefakt herkommt statt wo darüber geredet wurde:
[`documentation.nvim/docs/HOSTING.md` § *The artifact is the extension
point*](../../documentation.nvim/docs/HOSTING.md). Die Engine besitzt das
Schema; eine Zusage darüber gehört neben den Schreiber, nicht neben einen
Leser.

Der Satz („es gibt keine Plugin-API, und das *ist* die Antwort") plus vier
Dinge, auf die man sich verlassen kann, drei, die ein Bump tun darf, drei,
die er nicht darf.

**Beim Schreiben fand sich sofort eine falsche Zusage**, die dort schon
stand: „bumped when the artifact **gains** a field". Schema 5 hat drei
*entfernt*. Korrigiert — und die Regel dahinter festgehalten: eine Entfernung
darf die *Tatsache* nicht verlieren, nur ihre Formulierung. Derselbe Bump hat
`n`/`total` neben `value` ergänzt, damit „45 of 72" ohne das Englisch
überlebt.

Die Leseregel ist die, der dieses Projekt selbst folgt: **vorwärts
tolerieren, rückwärts ablehnen.** `core/diff.lua` vergleicht `schema >= 2`,
nie `== 2`, und degradiert, indem es *benennt, was es nicht sagen kann*.

### ~~Q14 · Den fehlenden Werkzeugnamen nennen~~ — gebaut 2026-08-20

`:checkhealth documentation` hat einen neuen Abschnitt **language support**.

**Und dabei kam eine größere Lücke heraus, als der Eintrag vermutete.** Der
Health-Check prüfte den **Lua**-Parser — die ganze Geschichte, solange es ein
Backend gab. Es sind dreiundzwanzig, und ein Go- oder Python-Baum ohne
Grammatik liefert einen vollständigen Modulbaum *ohne Funktionen darin*, was
sich wie ein Scanner-Fehler liest und nicht wie eine fehlende Grammatik. Das
ist der wahrscheinlichste Grund für ein leeres Panel außerhalb von Lua, und
darüber sagte der Check bisher nichts.

Jetzt: pro Sprache, die in den Quellwurzeln **tatsächlich vorkommt**,
Grammatik vorhanden oder nicht — mit `:TSInstall <grammar>`. Nie alle
dreiundzwanzig; zweiundzwanzig abwesende Grammatiken für ein Lua-Repository
sind eine Wand, die niemand liest.

**Die Korrektur steht daneben**, weil der Reflex „dann brauche ich pro
Sprache einen Linter" genau hier entsteht: nein. Jeder Check liest die IR,
die dieses Plugin gebaut hat, und meldet in jeder Sprache ohne installiertes
Werkzeug. Eine Grammatik kauft *Funktionsebene*, `lua-language-server` kauft
`@class`/`@alias`-Detail. Mehr externe Abhängigkeiten gibt es nicht, und
keine davon ist ein Linter.

**Der mason.nvim-Hinweis** steht ausschließlich an der
`lua-language-server`-Zeile und nirgends sonst — und ausdrücklich *nicht* an
den Grammatik-Zeilen: `:Mason` installiert Language Server, Grammatiken
kommen von `:TSInstall`. Ein Satz, der auf mason zeigt, ist hilfreich;
ein Programm, das eine Toolchain im Hintergrund installiert, ist etwas
anderes.

**Beide Pfade verifiziert**, nicht nur der grüne: derselbe Go-Fixture-Baum
einmal ohne und einmal mit geladener Grammatik durch `health.check()`.

---

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

### ~~M2 · Cross-Repo-Checks über `tag_files`~~ — gebaut 2026-08-20

`tag-require-missing` (warn) und `tag-file-unavailable` (info). Keine neue
Extraktion, genau wie veranschlagt — beide Artefakte gibt es schon.

**Aber nicht der Check, den §1.7 vorschlug, und der Grund ist eine
Messung.** Der Entwurf war `@see otherplugin.module.fn`. Vorher gezählt:
**`documentation.nvim` hat 0 `@see`-Ziele, `runtime-analysis.nvim` 0,
`lib.nvim` 4** — und alle vier lösen intern auf. Ein Cross-Repo-`@see`-Check
hätte an keinem Repository hier etwas zu prüfen gehabt, und keine Möglichkeit
festzustellen, ob er funktioniert.

Die **Requires** sind die Stelle, an der die Cross-Repo-Kanten tatsächlich
liegen: 18 unter `lib` aus `documentation.nvim`, 23 aus
`runtime-analysis.nvim`, 41 zusammen — heute alle intakt gegen `lib.nvim`s
Karte.

**Zwei Dinge, die erst beim Bauen sichtbar wurden:**

- **Die Vorbedingung war *nicht* erfüllt, wie sie hier stand.** Die Notiz
  sagte „~30 mit committeter Karte". Tatsächlich ignoriert jedes Plugin
  dieses Ökosystems außer `documentation.nvim` selbst `docs/map/` per
  `.gitignore` — aus gutem eigenen Grund: eine committete Karte ist mit der
  ersten Änderung veraltet, nur dieses Repo prüft das in CI, und über die
  Plugins hinweg waren es ~40 MB Artefakte, die niemand wollte. Damit ist
  das ein **Arbeitskopie-Check** mit Geschwister-Checkouts, kein CI-Check.
- **Deshalb gibt es `tag-file-unavailable`.** Ohne ihn wäre eine nicht
  lesbare Karte von einer sauberen nicht zu unterscheiden — das ist das eine
  Ergebnis, das ein Drift-Check nie liefern darf.

Nur `tag_files` ist maßgeblich, nie `external_repos`: der zweite Resolver
füllt dieselbe `ir.tag_links`-Tabelle aus einer *geratenen* GitHub-URL, und
darauf hin eine Abhängigkeit für kaputt zu erklären wäre eine andere
Behauptung. Der Check liest `ir.tag_audit`, das nur `tagfiles.lua` schreibt.

**Dieses Repo konfiguriert `tag_files` bewusst nicht selbst:** `tag_links`
steht im committeten Artefakt und trüge dann absolute lokale Pfade — die
Karte wäre maschinenabhängig und `--check` in CI dauerhaft rot.

### ~~M4 · Public-API-Surface-Panel~~ — gebaut 2026-08-20, `f9e2832`

Zehntes Analysis-Panel. Kein neues IR-Feld, kein Schema-Bump: die Seite
rechnet es aus `fn.internal`, `fn.documented` und den Call-Kanten, die die
Payload schon trägt. Am wenigsten erreichte Zeilen zuerst — das sind die,
wegen denen man das Panel öffnet.

**Der zweite ehrliche Vorbehalt kam von der laufenden Seite, nicht vom
Entwurf:** in einer Sprache, deren Sichtbarkeit ein *Tag* ist, sieht ein
ungetaggter dateilokaler Helfer genauso aus wie ein Einstiegspunkt — `norm(p)`
stand neben `M.render()`. Zwei von 776 Funktionen tragen hier `@internal`,
also nennt das Panel diese Zahl und sagt, dass die Liste nur so sehr eine
Oberfläche ist, wie der Baum es hingeschrieben hat.

**Schaltet §1.3 frei** (API-Bruch-Erkennung), abgelehnt als „„public' ist
undefiniert" — ist es nicht mehr.

### ~~M8 · I18N-0 — Findings tragen Parameter statt Prosa~~ — gebaut 2026-08-20

`add()` nimmt jetzt `(severity, check, node_id, params)` — alle **24**
Aufrufstellen, nicht 16 wie notiert. `core/findings.lua` hält den englischen
Katalog und macht daraus einen Satz an jeder der **zehn** Kanten. Schema 5.

**Benannte Platzhalter statt positioneller**, und das ist der eigentliche
Punkt: `%s requires %s, but %s must not reach into %s` gibt einer Übersetzerin
vier anonyme Slots, die sie nicht umstellen kann — Deutsch, Japanisch und
Arabisch brauchen je eine andere Reihenfolge.

**Zwei Korrekturen, beide aus dem Messen:**

1. **Findings standen nie in `module_map.json`.** Die Aufgabenliste nahm es
   an; `init.lua` serialisiert eine explizite Whitelist und hat sie nie
   enthalten. Diese Hälfte der Abnahme war also längst erfüllt, und der
   Schema-Bump war etwas ganz anderem geschuldet.
2. **Das Englisch im Artefakt ist fast vollständig *Subjekt*.** Über die
   eigene Karte gezählt: **820** Sätze sind Modul-Zusammenfassungen, **118**
   weitere die eigenen Docs und Features — alles Dinge, die Regel 2.4
   ausdrücklich **nie** übersetzt. Genau **10** waren Interface-Text, und alle
   zehn lagen in `quicks`. Die reiten jetzt auf der Seite (die ihre eigene
   Nutzlast baut), das Artefakt bekommt `n`/`total` neben `value` — „45 of
   72" bleibt als *Tatsache* erhalten, nur nicht als *Satz*.

„Kein englischer Satz in `module_map.json`" ist damit **kein richtiges Ziel**
und ist so festgehalten: wörtlich erreicht hieße es, Modul-Zusammenfassungen
zu übersetzen, was Regel 2.4 verbietet.

`MULTILANG.md` C.1 gibt es übrigens nicht — die Schema-Versionierung dort ist
seit `language` (3) und `markers` (4) abgehakt; Bumps passieren pro Feld, und
`diff.lua` toleriert sie ungeändert (`>= 2`).

**Abnahme dreifach erfüllt:** 140 gerenderte Findings aus drei echten
Repositories byte-verglichen; die 21 Specs, die exakten Wortlaut festnageln,
unverändert in dem, was sie behaupten; und `findings_spec.lua` für die zwei
Checks, die keiner von beiden erreicht.

**Der dritte Wächter hat sich sofort bezahlt gemacht:** der erste Formatter
escapte `%` in eingesetzten Werten — nötig für eine `gsub`-Ersetzung als
*String*, nie für den Rückgabewert einer Ersetzungs*funktion* —, also wurde
aus einem `%s` in einem @example-Fehler ein `%%s`. Kein Finding in drei echten
Repositories enthielt ein Prozentzeichen. **Ein Korpus, der einen Fall zufällig
nicht enthält, ist kein Beleg, dass der Fall funktioniert.**

### ~~M10 · Die beiden Joins aus `runtime-analysis`~~ — gebaut 2026-08-20, `103ceb7`

§1.1 als **Spalte auf `:DocMap churn`**, §1.2 als **`:DocMap untested`**. Die
Vorhersage stimmte: keine neue Erhebung auf beiden Seiten — die Join-Schicht
war schon von §1.5 und dem Telemetry-Browse-Modus bezahlt.

**Die Entscheidung, die keiner der beiden Einträge gestellt hatte:** die
Laufzeitachse darf die Reihenfolge **nicht** ändern. Telemetrie ist die
Nutzung *einer* Maschine; sie in den Score zu falten macht aus einer
Rangfolge, die sich wie eine Eigenschaft des Codes liest, eine, die zur
Hälfte davon abhängt, wer zuletzt gelaufen ist — zwei Entwickler, zwei
Reihenfolgen, keine falsch. Die Spalte trennt die Zeilen, die Sortierung
bleibt.

Gemessen an den echten 41 Sessions dieses Ökosystems: `editor.browse.view`,
Komplexität 383, oberste Zeile, *47 Aufrufe, keiner in der letzten Woche* —
und `core.check` eine Zeile darunter, *37 722 Aufrufe, 4 839 diese Woche*.
Zwei Zeilen, die am Tag davor identisch aussahen.

Beide Zusicherungen sind **absichtlich gebrochen worden**, um zu sehen, ob
der Spec rot wird: Aufrufe in den Score falten dreht die Reihenfolge (Zeile
108), „unused" statt „not called in your sessions" fällt bei Zeile 138.


---

### ~~QW1 · Der `standalone`-Gate soll laut sein~~ — gebaut 2026-08-20, `49246b2`

Die Schlusszeile sagte **„All 5 gates passed"**, während einer vierzig Zeilen
vorher *skipped* gedruckt hatte. Genau hinter diesem Satz sind drei echte
Defekte bis in ein Release gekommen — „vier Gates und ein Achselzucken" las
sich exakt wie fünf von fünf.

Jetzt: **`4 gates passed, 1 skipped: standalone`**, plus der Satz, auf den es
ankommt — *ein übersprungener Gate hat nichts geprüft.* Die Skips werden
gesammelt, wenn sie passieren, nicht am Ende gezählt: ein sechster Gate, der
irgendwann überspringen lernt, ist automatisch dabei.

**Der Skip bleibt ein Skip.** Ein Rechner mit Neovim und sonst nichts ist der
häufige lokale Fall; ihn rot zu machen macht `scripts/ci.sh` für genau die
Leute unbrauchbar, für die es da ist — und so wird ein Gate dauerhaft
abgeschaltet. Geändert hat sich die Genauigkeit, nicht die Schwere.

**Und die alte Meldung war auf diesem Rechner schlicht falsch.** „No PUC Lua
on PATH with lfs + dkjson" war ein Satz für zwei Probleme: hier liegt
`lua5.4` sehr wohl auf dem PATH, es kann nur die Rocks nicht laden. Nimmt man
`C:\tools` aus dem PATH, taucht ein zweites `lua` auf, dem allein `dkjson`
fehlt. Wer der alten Meldung folgte, suchte einen Interpreter, den er längst
hatte. Jetzt nennt sie den Interpreter, den fehlenden Rock und die
Installationszeile.

Alle drei Zweige durch Ausführen belegt, nicht durch Lesen: beide Rocks
fehlen, ein Rock fehlt (PATH ohne `C:\tools`), kein Interpreter vorhanden
(PATH nur mit Neovims eigenem Verzeichnis).


---

### ~~QW7 · Erst einrasten, dann springen~~ — gebaut 2026-08-20, `c478aa1`

Der Hover hebt einen Kasten und seine direkten Nachbarn hervor und blendet
alles andere ab — und das verschwand, sobald der Zeiger sich bewegte. Die
hervorgehobene Teilmenge war also nicht lesbar, nicht verfolgbar und nicht
zu einem Nachbarn hin weiterzugehen: genau das, wofür die Ansicht da ist.

Jetzt hält der **erste Klick** den Fokus, der **zweite** tut, was der Klick
vorher tat. Hovern ist unverändert, solange nichts eingerastet ist.

**Der `dblclick`-Handler ist weg**, und das ist der Kern der Bauart: ein
Doppelklick sendet zwei `click`-Ereignisse, die bereits einrasten und dann
handeln. Wer weiß, wo er hinwill, zahlt für das Einrasten nichts und merkt
es nie. Wäre der alte Handler geblieben, hätte er *zusätzlich* gefeuert und
zweimal gehandelt — das ist die erste Zusicherung im Spec.

Drei Wege hinaus, alle drei gewünscht: **Escape** (die Bedeutung, die die
Seite für ihre Popups ohnehin kennt), **Klick ins Leere** (was jeder
reflexhaft versucht) und **Klick auf einen anderen Kasten**, der dort neu
einrastet statt zu lösen — ohne das wäre das Verfolgen einer Kette die
mühsamste Art, ausgerechnet die Funktion fürs Verfolgen zu benutzen.

Die *Classic-clicks*-Pille behält ihre Bedeutung exakt: sie entscheidet, was
der **zweite** Klick tut, nicht ob der erste einrastet. Der Spec hält beides
auseinander, weil das Zusammenziehen ein naheliegender und stiller Fehler
wäre.

Am echten Baum durchgespielt statt gelesen — acht Schritte von „frisch
geladen" bis Escape, plus: zweiter Klick landet `center=` in der URL, und
ein Doppelklick handelt genau einmal.

---

## Aus dem zusammengeführten Plan, 2026-08-20 bis 2026-08-21

**Die Nummerierung ist ab hier eine andere.** Am 2026-08-20 wurden fünf
Warteschlangen aus drei Repositories zu einer zusammengelegt und neu
durchnummeriert; die Einträge oben tragen noch die alten Nummern. Wo ein
Eintrag seine frühere Nummer kennt, steht sie als *Vorher:* darin. `M1` weiter
oben ist deshalb nicht `M1` hier unten — beide Nummern sind korrekt, für
verschiedene Fassungen des Plans.

**Was in diesem Block auffällt:** in sechs der elf Einträge hat das Messen
*vor* dem Bauen den naheliegenden Entwurf verworfen. Nicht verfeinert —
verworfen. Die Rangfolge des Workspace-Dashboards, die Reichweite von `K`, der
Präfix-Rückfall der Abhängigkeitsauflösung, der Reference-Tab, Paare statt
ganzer Duplikatgruppen, und zwei Schätzungen in der Config-Analyse, die beide
in dieselbe Richtung danebenlagen. Das ist die Ausbeute des Verfahrens, nicht
der Beweis, dass die Entwürfe schlecht waren.

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

### ~~M1 · Config-Analyse: die drei übrigen Punkte~~ — **erledigt 2026-08-21**, Engine

Drei getrennte Stücke, keines vom anderen abhängig. **Zwei sind erledigt,
eines davon anders als geplant.**

- ~~**Lazy-Load-Inventar**~~ — **gebaut 2026-08-21.** Eigener Analyse-Tab:
  welches Plugin lädt auf welches Event/ft/cmd/keys, und was beim Start
  liegt. Die Messung an einer echten Config hat den Entwurf korrigiert:
  7 von 52 Specs standen unter dem falschen Ladezustand, weil `lazy = true`
  ohne jeden Trigger gelesen wurde, als lüde es später — es lädt nie.
  Daher drei Zustände statt zwei.
- ~~**Verwaiste Spec-Dateien**~~ — **entschieden 2026-08-21: wird nicht
  gebaut.** Gemessen, statt geschätzt: der einzige echte Fund in der einen
  verfügbaren Config war ein **Falsch-Positiv** (die Datei registriert über
  einen eigenen Helper, siehe unten), und die übrigen Kandidaten deklarieren
  nichts, weil ihr Inhalt bewusst auskommentiert ist. „Nennt kein Plugin"
  trennt also nicht Leiche von Parkplatz — das Kriterium trägt nicht, und
  ein Panel, das geparkte Dateien als tot meldet, ist schlechter als keins.
- **Statt dessen gebaut: `opts.plugins.wrappers`** — genau dieses
  Falsch-Positiv war der weit größere Fund. `core/plugins.lua` las nur das
  `return { … }` einer Datei; eine Config, die über `plugins.add({ … })`
  registriert, trug **nichts** bei — schweigend, ohne Fehler. Gemessen:
  **52 Specs gefunden, 85 nach Deklaration des einen Wrappers**, die
  fehlenden 33 in einer einzigen 906-Zeilen-Datei. 63 % dieser Config waren
  unsichtbar, und jedes Panel über `n.plugins` — inklusive des neuen
  Lazy-Tabs — beantwortete Fragen über die Hälfte, die zufällig ein
  Tabellen-Literal benutzt. Deklariert, nicht erraten, wie bei
  `bindings.wrappers`.
- ~~**Andere Plugin-Manager als lazy.nvim**~~ — **gebaut 2026-08-21, und es
  war kein M.** Die Schätzung sagte drei eigene Extraktoren; gemessen an je
  einer Datei in der Form jedes Managers sind es keine. packers `use`,
  vim-plugs `Plug` und mini.deps' `add` registrieren alle über einen Aufruf
  mit Tabelle oder String — genau das, was der Wrapper-Lauf schon liest.
  Wirklich gefehlt haben zwei Kleinigkeiten: ein **String**-Argument
  (`use "a/b"` — so listet jede packer-Config packer selbst, und so sieht
  bei vim-plug *jedes* Plugin aus) und drei Schreibweisen: `requires` und
  `depends` sind dieselbe Kante wie `dependencies`, `source` derselbe Repo
  wie der positionale String. Die Trigger-Keys heißen überall gleich.
  vim-plug nur in der Lua-Aufrufform — `Plug 'a/b'` in einer `.vim`-Datei
  ist VimScript, und das steht so da, statt halb gelesen zu werden.

Keymap-Konflikte sind gebaut. **M1 ist damit abgeschlossen.** Beide
Schätzungen dieses Blocks lagen in dieselbe Richtung daneben — sie
beschrieben das Feature statt der Lücke, und die Lücke sieht man erst, wenn
man das Ding gegen echten Code laufen lässt. *Vorher: M6.*

### ~~M2 · Reference-Tab, Schritt 6~~ — **entschieden 2026-08-21: kein Tab**, Engine

Die Antwort lautet *nein*, und sie wurde gezählt statt diskutiert. Über die
791 gerenderten Snippets dieses Repos: **64 von 76 Lua-Glossareinträgen sind
per Hover erreichbar**, 18.807 Dekorationen. Die zwölf übrigen fehlen *hier*
und wären im nächsten Repo da. Ein Tab wäre also ein Index über Antworten,
die der Leser ohnehin an der Frage trifft — genau der „Tab, zu dem niemand
navigiert", vor dem `ReferenceTab.md` selbst gewarnt hat.

**Das Zählen hat trotzdem etwas gefunden, nur nicht den Tab.** Das
Stdlib-Glossar war nach Punktnamen verschlüsselt, Lua wird aber mit
Doppelpunkt geschrieben: **1004 Doppelpunkt-Aufrufe gegen 6 mit Punkt** für
dieselben elf Funktionen. Die häufigste Aufrufform der Sprache war für ein
Feature unsichtbar, dessen ganzer Zweck das Erklären von Stdlib-Aufrufen ist.
`syntax.method_namespace` behebt das, **+934 Dekorationen**, verifiziert
durch Ausführen des Tokenizers aus der *erzeugten Seite*.

**M3 ist damit frei.** *Vorher: M7.*

### ~~M3 · `K` im Browser~~ — **erledigt 2026-08-21**

Die Glossar-Karte für das Wort unter dem Cursor, aus derselben Registry wie
der Keyword-Hover der generierten Seite.

**Zwei Messungen haben die Form entschieden.** Ein Glossarbegriff steht im
Browsertext dieses Repositorys **213-mal in einer Inline-`code`-Spanne und
2 558-mal in normaler Prosa** — "and", "for", "in", "end", "type". Ein `K`,
das überall antwortet, läge also etwa zwölfmal von dreizehn falsch, und zwar
auf die unangenehmste verfügbare Art: eine korrekte Definition an einem Wort,
das kein Code ist. Also ist die Spanne das Tor; außerhalb sagt die Taste,
warum sie schweigt.

Und die Spannen leben im **Detailpane**, das vorher gar nicht erreichbar war:
alle Browser-Tasten hängen am Listenpuffer, und bei vier Fenstern im Layout
landet ein natives `wincmd w` nicht dort. Deshalb waren auch zwei von sechzehn
Wurzeleinträgen unlesbar — 46 Zeilen Detail in einem 14-Zeilen-Pane ohne
Scrollmöglichkeit. `w` geht hinein, `q`/`<Esc>` zurück.

Die Taste ist `w` und nicht das zuerst gewählte `<Tab>`: ein Terminal sendet
für `<Tab>` und `<C-i>` dasselbe Byte, die Bindung hat also still `<C-i>` aus
der Besuchshistorie genommen. `docmap_browse_spec` hat es gefangen.

### ~~M4 · Cross-Repo-Dashboard~~ — **erledigt 2026-08-21**

Die Workspace-Ebene, die kein einzelnes Repository haben kann — dort, wo
vorher „Nichts ausgewählt" stand. Dieser Zustand ist kein fehlendes Thema, er
*ist* der Workspace.

**Die Rangfolge ist gemessen, nicht gewählt.** Über den eigenen Baum — 54
Repositories, 30 mit erzeugter Karte:

* **27 von 30 Karten stammten von Schema 2, während die Engine 5 schreibt.**
  Drei Artefaktversionen zurück, alle in einem Lauf fünf Tage zuvor erzeugt.
* **28 von 30 waren „veraltet"** — Quellen neuer als die Karte. Die lautere
  Zahl, und die schwächere: bei 17 davon war die neuste Datei ein
  `.gitignore` aus einem einzigen Rutsch, bei 22 das von `:helptags`
  geschriebene `doc/tags`. Generierte `tags` auszunehmen änderte die Zahl um
  exakt null.

Beide Signale feuern also fast überall; unterschieden werden sie dadurch,
*worauf* sie zeigen. Eine ältere Engine bedeutet konkret fehlende Inhalte,
und Neuerzeugen holt sie zurück. Deshalb führt sie, und „veraltet" nicht —
die naheliegende Ordnung war die, die die Zahlen verworfen haben.

Dazu die eine Sammelaktion, die das Menü noch nicht hatte: *Veraltete
erzeugen* vergleicht Änderungszeiten, und eine von einer älteren Engine
gebaute Karte ist danach gar nicht veraltet.

**Zwei Fehler hat erst der Blick in ein echtes Fenster gefunden**, beide
dieselbe Falle: `#map` und `.placeholder` setzen eigene `display`-Regeln, die
das `[hidden]`-Attribut überstimmen. Ein verstecktes `<iframe>` behielt damit
volle Höhe und schob die Übersicht in einem 720-Pixel-Fenster auf y=702. Es
fiel nie auf, solange der Platzhalter das Einzige dahinter war: er ist in
einer Box gleicher Höhe zentriert, ein Bildschirm nach unten geschoben sieht
aus wie ein Bildschirm nach unten zentriert. Genau der Fehlertyp, für den
`tools/preview/preview.py` existiert.

### ~~M5 · Extension-API, Stufe 2~~ — **erledigt 2026-08-21**

Gebaut als *ein* lesender Konsument, nicht als Plugin-Lader — und das ist die
Entscheidung, nicht die Abkürzung. `WORKPLAN.md` hat es selbst begründet: eine
Plugin-API ist ein Versprechen, das man nicht zurücknehmen kann, und
`module_map.json` stand in zwei Wochen von Schema 2 auf 5, wobei der letzte
Sprung drei Felder *entfernt* hat. Ein Lader auf ein Format, das sich noch
dreimal bewegt, erzeugt genau die Enttäuschung, die ein Ökosystem beendet,
bevor es anfängt. Stufe 2 zeigt stattdessen, dass die Zusage trägt, indem
etwas darauf steht.

**Was berechnet wird:** `requires_external` über alle Karten des Workspace
aufgelöst. Das ist präzise die Stelle, an der eine einzelne Karte aufhört —
sie hält fest, dass ein Modul außerhalb des Repositorys verlangt wurde, und
kann nicht sagen, wo es lebt, weil sie es nie gesehen hat. Mehrere Karten
können es, und dieses Fenster ist der einzige Ort, an dem mehrere liegen.
Ohne Engine, ohne Registrierung — nur die Dateien auf der Platte.

**Gemessen, bevor es geschrieben wurde**, über 30 erzeugte Karten: **1 820
deklarierte Modulnamen, kein einziger von zwei Repositories beansprucht.** Ein
Treffer ist damit eine Tatsache, kein Raten. Der naheliegende Rückfall — auf
das längste deklarierte Präfix hinuntergehen — wurde für die Messung gebaut
und löste **exakt null** zusätzliche Namen auf; er steht nicht im Code. Von
1 175 externen Requires trafen 852, 323 nicht, und die 323 sind die Antwort
bei der Arbeit: `telescope`, `fzf-lua`, `which-key` liegen nicht im
Workspace. Der Rust-Code reproduziert beide Zahlen zeichengenau.

**Zwei Zahlen statt einer**, weil sie verschiedene Fragen beantworten: *von
fünf Projekten benutzt* und *an 197 Stellen*. Einmal sechzigmal gegriffen ist
eine Kopplung, zwanzigmal einmal ist eine Konvention.

Stufe 3 (schreibend) bleibt **L7** und ist unverändert offen.

### ~~M6 · Compiler Explorer, zwei Schritte weiter~~ — **erledigt 2026-08-21**

Beide Hälften gebaut. Zwei markierte Funktionen liegen jetzt in *einem*
`clientstate`, je ein Editor — `sessions` ist ein Array, also das
dokumentierte Format wie dokumentiert benutzt.

**Marken statt eines Knopfes an der Duplikatgruppe, und das war gemessen.**
Über 232 Gruppen in 27 Repositories haben **144 genau zwei Mitglieder** — ein
Paar ist der Normalfall. Ein Paar dieses Repositories kommt auf höchstens
**3 104 Zeichen**, bequem in godbolt.orgs 8-KB-Anfragezeile, während **zwei
der 17 ganzen Gruppen sie reißen**. Ein „ganze Gruppe kompilieren" hätte also
ausgerechnet dort versagt, wo man am ehesten hinsieht. Marken sind zudem nicht
auf eine Gruppe beschränkt, und das wiegt schwerer: der lohnende Vergleich ist
oft der zwischen einem Duplikat und dem, was es hätte sein sollen.

**Die lokale Instanz steht im `localStorage`, nie im Artefakt.** Genau die
Bedingung, die dieser Eintrag gestellt hat: eine committete Seite mit einem
eingebackenen `localhost:10240` wäre ein Link, der für den Autor funktioniert
und für alle anderen still ins Leere läuft. `compiler_explorer_spec.lua` hält
fest, dass die einzige Adresse im Quelltext die öffentliche ist.

Zwei Stellen, an denen die naheliegende Umsetzung falsch liegt: die
8-KB-Grenze gehört godbolt.orgs CloudFront und nicht Compiler Explorer, gilt
für eine eigene Instanz also nicht — sonst erfände die Seite eine
Beschränkung, die ihr Ziel nicht hat. Und die Warnung wird *umgeschrieben*,
nicht umetikettiert: „verlässt deinen Rechner" ist bei einer Adresse auf
diesem Rechner unwahr, und eine Warnung, die Wolf ruft, lernt man
wegzuklicken.

---

## Nach dem zusammengeführten Plan, 2026-08-23

### ~~Die Optionsfläche: was ein Nutzer einstellen können sollte und nicht konnte~~ — **gebaut 2026-08-23**

Kein Eintrag aus `PLAN.md` — die Frage kam von außen („welche Optionen
gibt es sicher, die ein Nutzer konfigurieren könnte, aber noch nicht
kann?"), und die Durchsicht beider Repositories fand genug, um sie hier
festzuhalten.

Engine: [`documentation.nvim@8e3f8c6`](https://github.com/StefanBartl/documentation.nvim/commit/8e3f8c6) ·
App: [`docmap-desktop@df8e4a4`](https://github.com/StefanBartl/docmap-desktop/commit/df8e4a4)

**Der größte Teil der Antwort war nicht „es fehlt eine Funktion".** Es war
„der Weg von der Spec dorthin fehlt". `Documentation.Browse.Opts` trug
`width`/`height`/`list_width`/`theme`/`depth` und `browse.open` las sie
alle — `usrcmds/browse.lua` gab davon nichts weiter, also war eine
konfigurierte Fenstergröße nur erreichbar, indem man die Lua-API von Hand
aufrief. `render.dot` liest `rankdir`/`cluster_depth`/`hops`,
`render.mermaid` liest `direction`/`max_depth`/`depth`, und beide Kommandos
übergaben `{}`. Dasselbe Muster, zweimal, in Code der jahrelang so aussah,
als sei er konfigurierbar.

**`.docmap.json`, und warum das die Antwort auf drei Löcher gleichzeitig
ist.** `IDEAS.md` §6.2 hält fest, warum die GitHub Action `layers` nicht
anbietet: es passe in keinen Input, ohne eine Konfigurationssprache zu
erfinden. Das stimmt — über *Inputs*. Die Antwort auf „das passt nicht auf
eine Kommandozeile" ist eine Datei und nicht mehr Kommandozeile. Dieselbe
Datei löst die anderen zwei: das Standalone-Binary nimmt sieben Flags,
weshalb der Projekteinstellungen-Dialog dieser App genau zwei Regler
anbieten konnte (sein eigener Kommentar sagte das auch: *„anything further
belongs in the engine first"*), und `standalone/docmap.lua` hatte
`documentation.nvim`s **eigene drei Layer-Regeln fest eingebaut**, in jedem
Lauf über jeden fremden Baum — nicht weil das gewollt war, sondern weil
eine generische CLI keinen anderen Weg hatte, welche zu bekommen.

Allowlist statt Denylist, und das ist der Entwurf und keine
Sicherheitsmaßnahme: ein Repository sagt Fakten über *sich selbst*, nicht
über *deine Sitzung*. `command_name`, `keys`, `watch`, `diagnostics`,
`telemetry` werden mit namentlicher Warnung abgelehnt — ein Checkout, den
du geklont hast, darf weder deine Tasten neu belegen noch einen Watcher
starten. Aus demselben Grund Daten und kein Code: die Datei wird aus einem
Baum gelesen, den die CI gerade geklont hat, und sie auszuführen machte
„schau dir die Karte an" zu einem Code-Execution-Primitiv. `extra_checks`
bleibt deshalb host-seitig — es ist der einzige Verlust, und ein kleiner.

**`opts.checks`, und die zwei gemessenen Gründe dafür.**
`missing-module-tag` ist ein `error`, also hatte ein Repository, das seinen
Baum Datei für Datei annotiert, ein rotes `--check` vom ersten bis zum
letzten Commit — und ein Gate, das einen Monat rot ist, lernt man zu
ignorieren. Und `dead_code` meldet die öffentliche API jeder Bibliothek,
was sein eigener Doc-Kommentar ausspricht; der Rat war „lass es aus", weil
es keinen Weg gab, den Check zu behalten und die sechs absichtlich
veröffentlichten Funktionen still zu stellen. Ein *unbrauchbarer* Wert wird
ignoriert und gerade nicht wie `false` behandelt: Findings wegen eines
vertippten Severity-Namens stillschweigend zu löschen wäre das einzige
Ergebnis, das schlimmer ist als die Zeile zu übergehen.

**Die App hatte zwei sichtbare Folgen ihrer zwei Regler.** Ein Repository,
dessen Karte nicht in `docs/map` liegt, war hier nicht benutzbar —
`map_dir` wurde beim Hinzufügen einmal geschrieben und nie wieder, obwohl
der Kommentar am Feld sagte, es sei gespeichert statt abgeleitet, *„so a
project whose map lives somewhere other than `docs/map` is representable
later without a migration"*. Und **jede in diesem Fenster erzeugte Karte
hatte keinen einzigen Quelltext-Link**, weil `--repo-url` nie mitging;
dieselbe Engine erzeugt in der CI welche. Das ist der Unterschied, den man
zwischen beiden Karten tatsächlich sieht, und nichts hier erklärte ihn.

**Und dabei kam heraus, dass die Warnungen der Engine in genau den zwei
Hosts ins Leere gingen, in denen niemand hinschaut.** `config.build` warnt
über eine unbekannte Option, ein kaputtes `.docmap.json` und einen
vertippten `checks`-Key — über ein `notify`, das ihm übergeben wird.
`standalone/docmap.lua` und `scripts/action_run.lua` übergaben keins. Ein
CI-Log, das schweigt und grün wird, ist die schlechteste der drei Stellen,
an denen das passieren kann. Beide haben jetzt einen stderr-Shim.

**Gegengeprüft statt behauptet:** 5 Spec-Fehler vor und nach der Arbeit —
dieselben fünf, alle umgebungsbedingt auf dem Rechner (8.3-Kurzpfade,
Historientiefe, LSP-Attach). Zwei neue Specs in der Engine, drei neue
Rust-Tests und vier neue Frontend-Tests in der App; die letzten vier prüfen
jeden neuen Flag-Pfad von Markup über JS bis zum Kommandozeilenargument,
weil genau dort ein Feld sich speichern, neu laden und nichts tun kann.

**Nicht gebaut, mit Absicht:** `tauri-plugin-window-state`
(Fenstergröße merken) — eine neue Dependency, deren Bundling hier nicht
verifizierbar war. Und ein Freitextfeld für zusätzliche Engine-Argumente:
mit `.docmap.json` ist der bessere Ort dafür das Repository selbst.
