# Prüfungen: Quellen-Inventar

Drei Quellen, gesichtet am 2026-09-14. Was verwendet wurde, was nicht — und warum.

---

## 1. `Desktop/Grammatik PDF - Kuratiert/03_Pruefungsvorbereitung_telc`

13 PDFs. Textebene bei 7 von 13.

| Datei | S. | Text | Verwendet für |
| --- | --- | --- | --- |
| `Outline A1 Exam` | 1 | ✅ | **Prüfungsformat telc A1** (Subtests, Zeiten, Punkte, Notenskala) → `telc-formate.json` |
| `telc_deutsch_b1-b2_beruf_pruefungsvorbereitung` | 36 | ✅ | **Prüfungsformat telc B1·B2 Beruf** (5 Subtests, alle Teile, Aufgabentypen, Zeiten) → `telc-formate.json`; Format-Vorlage für den Sprachbausteine-Trainer |
| `telc_deutsch_a1_uebungstest_1` | 44 | ✅ | *noch nicht* — kompletter A1-Übungstest, siehe „Offene Entscheidung" |
| `Sprachbausteine Teil 1` | 1 | Scan | Formatbestätigung |
| `Oraler Test Teil 2` / `Teil 3` | 1+1 | ✅ | Bestätigt: Sprechen-Teile sind bei telc A1 und Goethe A1 identisch |
| `TELC Sprechen Teil (3)`/(4)/(5) | 3× 1 | teils | — |
| `Pruefungsvorbereitung B1-B2 muendliche Pruefung Bild 1-6` | 6 | ✅ | Kandidat für einen Bildbeschreibungs-Trainer B1/B2 (analog `/uebungen/sprechen`) |
| `Schreiben A Musterbeispiel und Bewertung` | 1 | Scan | Kandidat für Schreib-Bewertungskriterien |
| `1 KOMPLETT Anamnesebogen nach Telc Vorbild` | 5 | Scan | Pflege-/FSP-Material — gehört eher zu Pflegeplace als hierher |
| `Anleitung-Anmeldung - KT_deutsch` | 2 | ✅ | Anmeldeprozess, kein Prüfungsinhalt |

## 2. `Desktop/Top/.../Eurasia/Test`

| Inhalt | Verwendet für |
| --- | --- |
| `Goethe A1/sd_1_uebungssatz01.pdf` (44 S., Textebene) + `.mp4` | **Prüfungsformat Goethe A1 / Start Deutsch 1** → `goethe-formate.json`. Enthält außerdem Transkriptionen (S. 32), Lösungen (S. 36) und Bewertungskriterien (S. 37/42) |
| `sd_1_uebungssatz02.pdf` + `.mp4` | zweiter Goethe-A1-Übungssatz, gleiche Struktur |
| `Telc ÜTest A1/*.pdf` + `.mp3` | derselbe A1-Übungstest wie in Ordner 1 — **plus die Audiodatei**, die dort fehlt |
| `SB.pdf`, `SB_A1V1.pdf`, `SB Lösung.txt` | Sprachbausteine mit Lösungsschlüssel (10 Items) |
| `Bewertungen_interne Prüfungen_A1 + A2.xlsx`, `Mündliche Gruppen Prüfung.xlsx` | ⛔ **nicht verwendet** — siehe unten |
| `Hören/`, `Lesen/`, `Schreiben und SB/` (51 JPEGs) | ⛔ **nicht verwendet** — siehe unten |

### ⛔ Personenbezogene Daten — nicht verwendbar

Die drei Bildordner enthalten **abfotografierte Prüfungsarbeiten namentlich genannter realer
Personen** (Dateinamen sind Klarnamen), die beiden XLSX-Dateien sind offenbar Bewertungslisten.
Das sind personenbezogene Daten samt Leistungsdaten — sie gehören unter keinen Umständen auf die
Website, auch nicht anonymisiert als „Beispiellösung", solange die Betroffenen dem nicht
ausdrücklich zugestimmt haben. Ich habe sie nicht geöffnet und nicht ausgewertet.

Falls echte Lernerbeispiele gewünscht sind: der Goethe-Übungssatz enthält auf S. 37 eine
**Musterlösung mit Bewertung** vom Institut selbst — dafür geeignet, ohne Personenbezug.

## 3. `Projects/Pflegeplace`

Astro-Projekt, gleicher Stack. Enthält deutlich mehr fertige Prüfungsmechanik als erwartet:

| Baustein | Umfang | Relevanz hier |
| --- | --- | --- |
| `src/data/dtz/uebungssatz-1.ts` + `-2.ts` | 2 × ~32 kB | **Zwei vollständige DTZ-Übungssätze** — Hören T1–T4, Lesen T1–T5, Schreiben, mit Lösungsschlüsseln |
| `src/lib/dtz/render.ts` | 48 kB | kompletter DTZ-Prüfungs-Renderer |
| `src/lib/dtz/scoring.ts`, `state.ts`, `writing-check.ts` | — | Auswertung, Fortschritt, Schreib-Prüfung |
| `src/lib/exam/*` | i18n, scoring, shuffle, state, render-helpers | generische Prüfungs-Primitive, gut übertragbar |
| `src/data/fsp/`, `kenntnispruefung/`, `physiotherapie/`, `telc-b*-pflege/` | ~150 kB | Pflege-/Medizin-Fachsprache — anderer Markt, hier nicht einschlägig |

Laut `src/data/dtz/CHANGELOG.md` sind alle 45 Hören-/Lesen-Antworten und die 6 Lesen-Teil-5-Lücken
von Übungssatz 1 gegen den Lösungsschlüssel der Quelle handgeprüft (null Abweichungen); in
Übungssatz 2 wurde dabei ein Transkriptionsfehler gefunden und korrigiert. Die Qualität ist also
belegt hoch.

---

## Scope: nur allgemeines Deutsch

**Entschieden (2026-09-14):** Diese Seite deckt **allgemeinsprachliche** Prüfungen ab. Berufs- und
fachsprachliche Varianten (telc Deutsch Beruf, Pflege, Medizin; Fachsprachprüfung;
Kenntnisprüfung) gehören nicht hierher — dafür gibt es Pflegeplace.

Daraus folgte diese Bereinigung:

| Was | Vorher | Jetzt |
| --- | --- | --- |
| `telc-formate.json` | telc A1 **und** telc B1·B2 Beruf | nur telc A1 (Start Deutsch 1) |
| `/pruefungen/telc` | Format-Tabellen für beide, Beruf im Fließtext und in der Meta-Description | nur A1; der Text nennt die Beruf-Varianten ausdrücklich als *nicht* abgedeckt |
| Sprachbausteine (beide Sätze) | Geschäftskorrespondenz („Externe/Interne Korrespondenz", Angebote, Urlaubsplanung im Betrieb) | Alltagstexte: Anfrage bei einer Sprachschule, Einladung zum Straßenfest, Brief an eine Freundin, Zeitungstext übers Radfahren |
| Grammatik → `modalverben` | Stationsalltag (Pflegehilfskräfte, Vitalzeichen, Medikamentengabe) | Alltag: Museum, Zug, Amt, Arztbesuch, Samstag mit Plänen |
| Grammatik → `partizip-als-adjektiv` | ein Beispielsatz aus der Pflege („Der Patient äußert …") | Alltagssatz („Sie hört einen pfeifenden Ton aus dem Keller") |
| `/uebungen/sprechen-b1b2` | 6 von 6 Themen aus der Arbeitswelt | allgemeine Prüfungsbereiche: Ehrenamt, Gesundheit, Wohnen, Medien, Sprachenlernen, Ankommen |

Die Quellenangaben in den Datendateien bleiben unverändert korrekt — sie nennen weiterhin das
PDF, aus dem der *Aufgabentyp* stammt, und halten fest, dass die Sätze auf Alltagskontexte
umgeschrieben wurden.

**Eine bewusste Ausnahme:** `/former-site` ist ein Archiv der alten Website, die tatsächlich
Pflegedeutsch angeboten hat. Die Seite ist von nirgendwo verlinkt; sie zu bereinigen würde das
Archiv verfälschen. Sie bleibt, wie sie war.

## Nutzungsrechte — wie damit umgegangen wird

Alle drei Quellen enthalten **fremdes, urheberrechtlich geschütztes Prüfungsmaterial**:
telc-Übungstests (© telc gGmbH), Goethe-Übungssätze (© Goethe-Institut), DTZ-Übungssätze
(© g.a.s.t. e. V.). `Pflegeplace/DTZ-BUILD-PROMPT.md`, Constraint 7, hält dazu fest, dass die
Nutzungsrechte zu klären sind, *bevor* solches Material live geht.

**Entschieden (2026-09-14): formattreu mit eigenen Inhalten.** Übernommen werden Struktur,
Aufgabenzahlen, Zeiten und Auswertung — also Tatsachen über den Aufbau einer Prüfung. Die Texte
und Aufgaben schreiben wir selbst. Damit entsteht keine Rechtefrage, und es lassen sich beliebig
viele weitere Sätze ergänzen.

| Gebaut | Was übernommen wurde | Was eigen ist |
| --- | --- | --- |
| `/pruefungen/telc` · `/pruefungen/goethe` | Prüfungsformate: Subtests, Teile, Zeiten, Punkte, Notenskalen | — (reine Formatangaben) |
| `/pruefungen/telc/sprachbausteine` | Format telc B1·B2 Beruf: Teil 1 = 8 Zuordnungen aus 10 Wörtern, Teil 2 = 10 × Multiple Choice | alle Texte und Aufgaben |
| `/pruefungen/dtz/uebungssatz` | DTZ-Blueprint: 9 Teile, 45 Aufgaben (Hören 1–20, Lesen 21–45), Punktegrenzen ≥33 = B1, ≥20 = A2; Engine-Mechanik aus Pflegeplace | alle Hörtexte, Lesetexte, Anzeigen, Aufgaben, Schreibaufgaben |
| `/uebungen/sprechen-b1b2` | Dreistufiges Format: Bildbeschreibung → Kurzvortrag → Diskussion | alle Themen, Fragen, Diskussionsfragen |

### Noch nicht gebaut

1. **Verbatim-Port der DTZ-Übungssätze 1 + 2** aus Pflegeplace — die echten g.a.s.t.-Texte, geprüft,
   mit Lösungsschlüsseln. Wäre inhaltlich stärker als ein eigener Satz, setzt aber geklärte
   Nutzungsrechte voraus. Die Daten liegen unverändert in `Pflegeplace/src/data/dtz/`.
2. **telc-A1- und Goethe-A1-Mock-Test** aus den Übungstests — Audio liegt für beide vor
   (`telc_deutsch_a1_uebungstest_1.mp3`, `sd1_uebungssatz_01.mp4`). Gleiche Voraussetzung.
3. **Bilder aus `Pruefungsvorbereitung B1-B2 ...pdf`** — sechs eingebettete Fotos, Herkunft und
   Lizenz unklar. Nicht extrahiert; der B1/B2-Trainer nutzt stattdessen Assets aus dem Repo.

### Hinweis zum B1·B2-Sprechmaterial

Die sechs Themen im telc-Ordner sind durchgehend **pflegespezifisch** (Pflegevisite,
Medikamentengabe, Kooperation von Angehörigen, Pflegeausbildung). Inhaltlich gehören sie zu
Pflegeplace, nicht zum allgemeinen Deutschangebot. Übernommen wurde nur das dreistufige Format;
die Themen auf `/uebungen/sprechen-b1b2` sind allgemein berufsbezogen. Wer eine Pflege-Spur will,
kann die sechs Originalthemen dort als eigenen Satz ergänzen.
