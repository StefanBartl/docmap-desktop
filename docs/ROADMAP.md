# Roadmap — docmap-desktop

**Was dieses Programm ist, in einem Satz:** eine Projektliste und ein Fenster
vor Karten, die etwas anderes erzeugt hat.

Alles hier ist daran gemessen. Die Analyse und die Ansicht sind nicht die
Aufgabe dieses Programms, und alles, was anfängt sie nachzubauen, ist eine
falsche Abzweigung — bis hin zur ehrlichen Endstufe, die Analyse selbst in
der App zu reimplementieren, die deshalb ausdrücklich nicht geplant ist.

> **Die Warteschlange steht woanders.** Was als Nächstes gebaut wird — für
> dieses Repo *und* für `documentation.nvim` und `runtime-analysis.nvim` —
> steht seit 2026-08-20 in **einem** Plan: [`PLAN.md`](PLAN.md). Dieses
> Dokument nennt nur die Richtung.
>
> Was gebaut wurde und warum, steht in [`PLAN-DONE.md`](PLAN-DONE.md) und
> [`WORKPLAN.md`](WORKPLAN.md) — Letzteres trägt im Anhang auch die
> Scheiben-für-Scheiben-Herleitung, die vorher hier stand.

## Wo es hingeht

**Die Workspace-Ebene, die kein einzelnes Repository haben kann.** Diese App
ist die einzige Stelle im Ökosystem, die mehrere Projekte gleichzeitig hält.
Alles, was daraus folgt, ist die eigentliche Richtung: mehrere Karten
nebeneinander lesen, sehen welche veraltet sind, und Fragen beantworten, die
über ein Repository hinausgehen. Der Cross-Repo-Überblick ist das Erste, was
von den dreiunddreißig Repositories im Korpus wirklich profitiert.

**Das Artefakt ist die API, und das ist die Antwort statt einer Lücke.**
`module_map.json` ist byte-deterministisch, versioniert und dokumentiert —
wer eine Karte liest, ist heute schon eine Erweiterung, ohne Code in diesem
Programm. Die Kompatibilitätszusage dazu steht in `documentation.nvim`s
[`HOSTING.md`](https://github.com/StefanBartl/documentation.nvim/blob/main/docs/HOSTING.md).
Darauf bauen zwei weitere Stufen: lesende Erweiterungen, und — deutlich
später und mit einer anderen Sicherheitsposition — schreibende.

**Eine erzeugte Karte ist eine Momentaufnahme der Engine, die sie schrieb.**
Das ist die eine Sache, die man vor allem anderen wissen muss: eine
Seiten-Funktion, die nach deiner Karte erschienen ist, kommt durch
*Neuerzeugen dieses Projekts* — nicht durch ein Update der App oder der
Engine. Was ein App-Update ändert, ist dieses Fenster.

## Wo es ausdrücklich nicht hingeht

Die vollständige Liste mit Begründungen steht in [`PLAN.md`](PLAN.md). Die
zwei, die dieses Programm am direktesten betreffen:

- **Kein Grammatik-Manager mit Download.** Native Shared Libraries von einem
  rollenden Tag ohne veröffentlichte Prüfsumme nachzuladen ist im CI in
  Ordnung und als Knopf in einer installierten App ein stiller Update-Kanal
  für ungeprüften ausführbaren Code. Die Diagnose-Hälfte — *welche Datei
  fehlt in welchem Verzeichnis* — ist gebaut.
- **Keine zweite Implementierung der Analyse.** Zwei unabhängige Nachbauten,
  die zu ihren Neovim-Originalen verhaltensgleich bleiben müssten, sind
  keine kleine Strecke von hier.
