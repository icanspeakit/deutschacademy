# Grammatik-Pool: PDF → Thema

Quelle: `Desktop/Grammatik PDF - Kuratiert/01_Grammatik-Themen` — 58 PDFs, ~120 Seiten.
Dieses Dokument ordnet den Pool den Themen auf `/uebungen/grammatik` zu.

## Stand

Der Pool ist **abgearbeitet**. Alle Themen, für die Material vorliegt, haben einen Workspace
(`src/data/grammatik/<id>.json`). Auf keiner Niveaustufe stehen noch Platzhalterkarten:
A1 = 4 Themen, A2 = 7, B1 = 11, B2 = 5.

Offen bleiben nur die vier alten Quiz-Themen ohne eigenes PDF im Pool
(Dativ, Trennbare Verben, Passiv, Relativpronomen, Konjunktiv II) — sie laufen weiter als
Lückentext-Quiz aus `grammatik.json`.

## Wichtig: Textebene

Nur **17 der 58 PDFs** haben eine Textebene (`pdftotext` liefert Inhalt). Die übrigen ~40 sind
Bildscans und wurden Seite für Seite visuell gelesen.
In den Tabellen unten: **T** = Textebene vorhanden, **S** = Scan.

## Status

| Status | Bedeutung |
| --- | --- |
| ✅ Workspace | vollständige Kursbuchseite, `src/data/grammatik/<id>.json` |
| 🟡 Quiz | existiert nur als Lückentext-Quiz in `grammatik.json` |

---

## A1

| Thema | id | Quell-PDFs |
| --- | --- | --- |
| ✅ Artikel: der, die, das | `artikel` | `Ganze Lektion zu Artikeln` (10S, **T**) · `Artikelubung` (1S, **T**) · `Artikel` (2S, S) · `Antworten zu dem Artikel schreiben` (1S, S) |
| ✅ W-Fragen: wer, was, wo, wann | `w-fragen` | `Fragewörter` (1S, S) · `Positionen im Satz` (1S, S) |
| ✅ Ja/Nein-Fragen und „doch“ | `ja-nein-fragen` | `Ja Nein Fragen` (1S, S) |
| 🟡 Akkusativ | `akkusativ` | `Akk` (2S, S) — eigene Seite (`akkusativ.astro`) |

## A2

| Thema | id | Quell-PDFs |
| --- | --- | --- |
| ✅ Modalverben | `modalverben` | `Modalverben` (1S, T) · `Modalverben Hausaufgabe` (1S, S) · `Kann ich oder muss ich` (1S, S) |
| ✅ Satzstellung: die Satzbrücke | `satzstellung` | `Positionen im Satz` (1S, S) · `Satzstellung` (4S, S) · `Positionen im Satz Hausaufgabe` (1S, S) · `Sätze` (1S, S) |
| ✅ Wechselpräpositionen: wo oder wohin? | `wechselpraepositionen` | `Wechselpräp` (2S, S) · `Präp erklärt` (2S, S) · `Präp m Akk` (2S, S) · `Prä m Dat` (2S, S) · `WEchselprä Partner A`/`B` (je 1S, S) · `f 12 05 C11 Rauf und Runter(2)` (2S, S) |
| ✅ Negation: nicht oder kein | `negation` | `Negation` (2S, S) · `Negationswörter` (2S, S) |
| ✅ Perfekt: haben oder sein | `perfekt` | `Perfekt Partnerseite A`/`B` (je 1S, S) |
| 🟡 Dativ | `dativ` | *(kein eigenes PDF im Pool)* |
| 🟡 Trennbare Verben | `trennbare-verben` | `Trennbare_Verben` (2S, T) · `trennbare Verben` (1S, S) · `Nicht-trennbare_Verben` (1S, T) |

## B1

| Thema | id | Quell-PDFs |
| --- | --- | --- |
| ✅ Verben mit Präpositionen | `verben-praepositionen` | `Verben und Präpositionen` (4S, T) · `A2-B1_Verben-mit-Praepositionen-Uebung-1` (8S, T) · `Verben m Dativ Präp.` (2S, S) · `nomen verb verbundung hausaufgabe yum 8 okt` (1S, **T** — trotz Dateiname eine PONS-Präpositionsliste) |
| ✅ Adjektivdeklination | `adjektivdeklination` | `MATRIX ADJEKTIVE` (1S, T) · `Adjektivübung` (5S, T) · `Adjektivubung nur ABs` (3S, T) · `Adjektivdeklination` (2S, S) · `Adjektive` (1S, S) · `2404 Adjektive 2 …` (4S, S) |
| ✅ Nebensätze: als oder wenn | `als-oder-wenn` | `ue04_nebensatz_als_wenn` (1S, T) · `Nebensatze A`/`B` (je 1S, S) |
| ✅ Zweiteilige Konnektoren | `zweiteilige-konnektoren` | `zweiteilige Konnektoren` (1S, **T**, mit Lösungsschlüssel) · `Doppelkonnektoren` (2S, S) |
| ✅ Infinitiv mit zu: um, ohne, anstatt | `infinitiv-mit-zu` | `Inf und zu` (8S, S) · `zweiteilige Konnektoren`, Übung 4 (T) |
| ✅ Indirekte Fragen: Wissen Sie, ob …? | `indirekte-fragen` | `Indirekte Fragen` (2S, S) |
| ✅ N-Deklination | `n-deklination` | `N Deklination` (2S, S) · `Nr 5 und 6 N Deklination` (1S, S) |
| ✅ Präteritum & Plusquamperfekt | `praeteritum-plusquamperfekt` | `Nr. 5 PQP und Präteritum` (1S, S) |
| ✅ irgend… | `irgend` | `irgend` (2S, S) |
| 🟡 Passiv mit Modalverben | `passiv` | `Passiv Sätze bilden aus Begegnungen` (1S, S) |
| 🟡 Relativpronomen | `relativpronomen` | `Relativpronomen im N A D` (2S, S) |

## B2

| Thema | id | Quell-PDFs |
| --- | --- | --- |
| ✅ Negationswörter: nie, nirgends, nicht mehr | `negationswoerter` | `Negationswörter` (2S, S) |
| ✅ Partizip I und II als Adjektiv | `partizip-als-adjektiv` | `Partizip 1` (1S, **T**) · `C11 Partizipien` (1S, S) · `f 12 05 C11 Partizipien (1)` (1S, S — Duplikat) |
| ✅ Nomen-Verb-Verbindungen | `nomen-verb-verbindungen` | `Nomen Verb Verbindungen drucken und schneiden` (4S, **T**, mit Lösungen) · `Nomen Verb Verbindungen` (1S, S) |
| ✅ Position von auch & Fokuspartikeln | `fokuspartikeln` | `Auch` (2S, S — im Original als C1 markiert, hier als B2 eingeordnet) |
| 🟡 Konjunktiv II | `konjunktiv2` | *(kein PDF im Pool)* |

## Nicht Grammatik

| Datei | Warum |
| --- | --- |
| `Wortgruppen` (4S, T) | Thematische Wortlisten — Länder, Sprachen, Zahlen, Monate, Tageszeiten. Gehört zu **Wortschatz**, nicht in die Grammatik. Gute Quelle für `src/data/wortschatz.json`. |

---

## Wie ein Thema entsteht

1. Quell-PDF lesen — mit Textebene per `pdftotext -layout -enc UTF-8`, sonst Seite für Seite als Bild
   (`pymupdf`, `page.get_pixmap(dpi=140)`).
2. `src/data/grammatik/<id>.json` nach dem Schema unten schreiben.
3. Ein Emoji in die `ICON`-Map in `src/pages/uebungen/grammatik.astro` eintragen.
4. Fertig. Hub (`grammatik.astro`) und Seite (`[id].astro`) finden die Datei per Glob — kein weiterer Code nötig.

Schema-Kurzform:

```jsonc
{
  "id": "...", "slug": "...",        // slug optional, sonst = id
  "name": "...", "level": "A2",
  "subtitle": "...",
  "source": "...",                   // welche PDFs — Herkunft nachvollziehbar halten
  "concept": {
    "flow":        [{ "text": "...", "variant": "verb" | "prep" | null }],
    "exampleHtml": "...",            // darf <span class=\"vp-verb\">/\"vp-prep\"> enthalten
    "qa":          [{ "html": "...", "tag": "..." }],
    "noteHtml":    "...",
    "reference": {
      "showLabel": "...", "hideLabel": "...",
      "tables": [{ "caption": "...", "note": "...", "head": [...], "rows": [[...]] }],
      "boxes":  [{ "badge": "...", "variant": "akk" | "dat", "items": [...] }]
    }
  },
  "exercises": [
    { "type": "fill",  "title": "...", "hint": "...", "placeholder": "...",
      "items": [{ "prompt": "... ___ ...", "hint": "...", "answer": "x" }] },
    { "type": "match", "title": "...", "pairs": [{ "q": "...", "a": "..." }] },
    { "type": "table", "title": "...", "columns": ["...", "..."],
      "rows": [{ "term": "...", "answer": "x" }] },
    { "type": "story", "title": "...",
      "segments": [{ "text": "..." }, { "blank": 0, "answer": "x" }] },
    { "type": "build", "title": "...",
      "sentences": [{ "id": "b1", "hint": "...", "correct": [...], "shuffled": [...] }] }
  ]
}
```

`answer` darf überall ein Array sein, wenn mehrere Formen richtig sind
(`["müssen", "sollen"]`) — die erste gilt als Musterlösung. Vergleich ist
umlauttolerant und ignoriert Groß-/Kleinschreibung.
Alle fünf Übungstypen sind optional; ein Thema darf auch nur zwei haben.

Beim Schreiben beachten:

- **fill**: jedes `prompt` braucht genau ein `___`. Mehrere Lücken pro Satz gehen nicht —
  dafür ist `story` da.
- **story**: die `blank`-Indizes müssen bei 0 beginnen und lückenlos aufsteigen.
- **build**: `shuffled` muss eine echte Permutation von `correct` sein (gleiche Strings,
  gleiche Anzahl) — sonst lässt sich der Satz nie richtig legen.
- **table**: `columns` hat genau zwei Einträge.
- **reference.tables**: jede Zeile muss so viele Zellen haben wie `head`.
