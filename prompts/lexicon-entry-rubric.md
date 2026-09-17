---
rubric: v4
status: measured — every rule in "Observed failure modes" below was produced by a real batch
         (A–F from unit b1-01, G from tranche-8; see docs/content-engine-ledger.md)
---

# Lexicon entry rubric

**This file is program input.** `scripts/generate-lexicon.mjs` sends it as the cached prefix on
every generation call, and stamps each row it produces with the `rubric` version above. Change
this file and bump the version, or you lose the ability to tell which rows came from which bar.

Schema: `docs/lexicon-enrichment-v1.md` §2. Field split: §1 of the same document.

---

## Output shape

One JSON array. Each element:

```json
{
  "lemma": "die Bewerbung → NO. See below.",
  "pos": "noun",
  "gender": null,
  "plural": null,
  "en": "application",
  "example": "Ich schicke die Bewerbung morgen ab.",
  "grammar_anchor": "perfekt"
}
```

No prose, no markdown fence, no commentary. Just the array.

## Fields you write

**`lemma`** — the citation form, bare. `Bewerbung`, not `die Bewerbung`. Nouns capitalised, verbs
in the infinitive, adjectives in the uninflected positive form.

**`pos`** — exactly one of: `noun` `verb` `adj` `adv` `prep` `conj` `pron` `num` `phrase`.

**`en`** — the English gloss. Lowercase unless it's a proper noun. Comma-separate distinct senses
(`"city, town"`). No articles, no "to" on verbs unless the infinitive reads oddly without it.
Keep it under six words; this is a gloss, not a definition.

**`example`** — one sentence. See the rules below; this is the field that decides whether the
entry is worth anything.

**`grammar_anchor`** — one of these 21 ids, or omit the field entirely:

```
adjektivdeklination  als-oder-wenn  artikel  fokuspartikeln  indirekte-fragen
infinitiv-mit-zu  irgend  ja-nein-fragen  modalverben  n-deklination
negation  negationswoerter  nomen-verb-verbindungen  partizip-als-adjektiv
perfekt  praeteritum-plusquamperfekt  satzstellung  verben-praepositionen
w-fragen  wechselpraepositionen  zweiteilige-konnektoren
```

Set it only when the example sentence **actually demonstrates** that structure. An anchor that
doesn't match the sentence is worse than none, because the grammar page will cite the word as an
illustration of something it doesn't illustrate.

## Fields you write as `null`, always

`gender` · `plural` · `forms` · `aux` · `comparative` · `superlative`

These have factual right answers, and `node scripts/fetch-wiktionary.mjs <level> --fill` fills them
from de.wiktionary.org. Write them as explicit `null`, not omitted, so the fill pass can find the
rows. Note that the level file is **invalid** between the two steps — the validator errors on a
noun without a gender — so generation and fill are one operation, not two you can stop between.

**A guessed gender ships forever and cannot be found again without re-checking every row.** This
is the one rule in this file that has no exceptions and no judgement calls.

## Example-sentence rules

1. **One sentence.** At B1, twelve words or fewer; at B2, fourteen; at C1/C2, up to eighteen.
   (B2 was unspecified until the B2 run needed it — a gap, not a judgement call left open.)
2. **Every other word in the sentence must be at or below the target level.** An A2 learner
   reading a B1 example should only meet one unfamiliar word: the lemma. This is the most commonly
   violated rule and the most damaging — an example built from harder vocabulary than its headword
   teaches nothing.
3. **Use the lemma in its most frequent sense**, and that sense must be the one `en` glosses. A
   sentence illustrating a secondary meaning is a different entry.
4. **Natural collocation, not a definition.** `Ich schicke die Bewerbung morgen ab.` ✓ —
   `Eine Bewerbung ist ein Dokument für eine Stelle.` ✗. Definitions are what dictionaries do;
   examples exist to show the word at work.
5. **Concrete and everyday.** The learner is an adult in Germany doing ordinary things: work,
   appointments, housing, health, forms, travel. Not literary, not abstract, not aspirational.
6. **No proper nouns** except common German first names (Ana, Tom, Lena) and major German city
   names. No brands, no institutions, no pop culture — the reader may be anywhere and this content
   must not go stale.
7. **No cultural knowledge required** beyond living in Germany. A sentence that needs a reference
   explained is a sentence that failed.
8. **Present tense** unless the `grammar_anchor` requires otherwise (`perfekt`,
   `praeteritum-plusquamperfekt`).
9. **Separable verbs go split** in the example, as they are in real use: `Ich schicke … ab`, not
   `Ich abschicke`.
10. **No sentence may be a translation of its own gloss.** If the example reads like the English
    `en` field run through a dictionary, rewrite it.
11. **The finite verb must be easier than the headword.** See failure A — rule 2 in general is
    hard to self-check, but this one special case catches most of its violations and is cheap.
12. **An abstract noun gets a first- or second-person sentence.** See failure B.
13. **An example may lean on another lemma from the same unit only if that lemma sorts earlier**
    in the unit. Forward references teach nothing: the learner has not met the word yet.

## Word selection

- The lemma must be a **real German lemma that de.wiktionary.org has an entry for.** This is
  checked automatically after generation, and a high miss rate means the selection is bad, not the
  rubric. Do not invent plausible-looking compounds.
- **Not already in the lexicon.** The existing 1,350 lemmas are supplied to you; exclude them. A
  repeat collides on `id` and is rejected by the validator. **Exclusion is by spelling, not by
  sense** — see failure C.
- **A lemma may not differ from an existing one by capitalisation alone.** See failure G. `id` is
  `slugify(lemma)`, which lowercases, so the noun `Schweigen` and the verb `schweigen` are the same
  id, and so are the adjective `arm` and the body part `Arm`. This bites hardest on nominalised
  infinitives (`Essen`, `Lernen`, `Klettern`) and on noun/adjective homographs — check the
  exclusion list case-insensitively, not as written.
- **No nominalised infinitives as noun lemmas.** See failure H. `Sitzenbleiben`, `Generationenwohnen`,
  `Schweigen`, `Essen`, `Lernen`: de.wiktionary has no page for most of them, and the compound-head
  fallback cannot help because the head is a verb, not a noun. They also collide on `id` with their
  own verb (failure G). Name the thing instead — `Wiederholung`, `Mehrgenerationenhaus`.
- **No adjectival nouns.** See failure D. `Vorgesetzter`, `Angestellter`, `Beamter`, `Verwandter`,
  `Deutscher`, `Bekannter` all have Wiktionary entries and none of them can be sourced. Use the
  plain noun instead (`Abteilungsleiter`, `Mitarbeiter`).
- **Level-appropriate by usefulness, not by obscurity.** B1 is not "rarer A2 words" — it's the
  vocabulary an adult needs to handle work, bureaucracy and health conversations unaided.
- **Coherent with the unit's topic.** All 25 words in a unit share one topic from the closed
  taxonomy. A word that doesn't fit the topic belongs in a different unit.
- Prefer words whose frequency rank will actually resolve against the OpenSubtitles list that
  `attach-ranks.mjs` uses — but do not guess ranks. A null rank is honest.

## Observed failure modes

Every entry below is a mistake made while producing unit `b1-01` (25 B1 `arbeit` entries,
2026-09-17), named after the failure that motivated it, the way
`docs/lexicon-enrichment-v1.md` §4 names each parser rule after its bug. Evidence:
`docs/vocab-generation-tier0-v1.md`.

**A — the scaffolding verb, not the scaffolding noun.** Rule 2 says every other word must be at
or below level. In practice it was never a noun that broke it: the compounds around the headword
(`Quartalsende`, `Nachtschichten`, `Personalabteilung`) are transparent and cost a learner
nothing. What broke it was the **finite verb**, three times out of twenty-five —
`Meine Kündigungsfrist **beträgt** drei Monate`, `Der Betriebsrat **vertritt** die Interessen`,
`Die Arbeitslosigkeit ist **gesunken**`. Each one is a second unknown word carrying the sentence,
and each was invisible on reread because the sentence *sounds* correct. Hence rule 11.

A blunt "is every token in the A1/A2 bank?" check does **not** work as the gate: run over these
same 25 rows it flagged 19, almost all of them inflections (`Monaten`, `bekommst`, `Löhne`) or
ordinary words the 1,350-word bank simply does not happen to contain (`Januar`, `Prozent`,
`Leute`). Restricted to the finite verb's lemma, it flagged exactly the three real ones. Check
the verb; do not check the nouns.

**B — abstract nouns pull the sentence into newspaper register.** `Arbeitslosigkeit`,
`Mindestlohn` and `Beförderung` all drew third-person institutional sentences —
*"Die Arbeitslosigkeit in der Region ist wieder gesunken."* That is grammatical, level-plausible
and exactly what rule 5 forbids: it is not an adult in Germany doing an ordinary thing, it is a
news bulletin. Concrete nouns did not have this problem. Hence rule 12.

**C — a lemma already in the bank under a different topic still collides.** Five of the first
twenty-five picks — `Kündigung`, `kündigen`, `Rente`, `Sozialversicherung`, `beantragen` — were
rejected by the exclusion check. All five felt new because their **work sense** is new: `Kündigung`
is banked at A2 under *Wohnungssuche & Mietvertrag* (ending a tenancy), `beantragen` at A1 under
*Ämter & Formulare*. The bank keys on `id`, which is derived from spelling alone, so a new sense
of a banked word is not a new row. If the work sense genuinely needs teaching, that is a second
`example` on the existing entry — raise it, do not generate around it.

**D — "has a Wiktionary entry" is not the same as "can be sourced".** `Vorgesetzter` passed the
existence check and then produced a row nothing could fill: it is an adjectival noun, so its page
carries `{{Deutsch adjektivisch Übersicht}}`, which has no `Genus` and no `Nominativ Plural`. The
schema requires `gender` on a noun, so the row failed the validator and **no fill pass could ever
clear it** — the only fix is a different lemma. Hence the word-selection rule above.

**E — the anchor must be something the learner can practise.** `Vorgesetzter` was given
`grammar_anchor: "adjektivdeklination"` because the headword itself is declined. That is the
"relates to rather than demonstrates" failure the rule already warns about, committed anyway,
because the headword's own morphology feels like a demonstration. It is not. The anchor names a
structure the **sentence** exhibits and the learner could drill; if removing the headword would
remove the structure, there is no anchor.

**F — under-anchoring is the quiet default.** Eight of twenty-five carried an anchor on the first
pass and a ninth was found on review (`Im Tarifvertrag steht, **wie viel Urlaub wir bekommen**` →
`indirekte-fragen`). Anchors get set for the obvious cases (Perfekt) and missed wherever the
structure is subordinate. Reread every sentence against the 21 ids once more before emitting.

**G — capitalisation is not a distinction; `id` is case-folded.** Tranche-8 had two rows rejected
by `merge-tranche` for an id collision rather than a lemma collision: the verb `schweigen` against
the noun `Schweigen` **in the same unit I had just written**, and the adjective `arm` against
`Arm`, the body part, banked at a1-21. Neither shows up when you scan the exclusion list by eye,
because the two spellings look different. `slugify` lowercases, and `id` is the localStorage
progress key, so a collision would silently merge two words' learner histories — which is why the
merge refuses it instead of renaming. German makes this common: every nominalised infinitive
(`das Essen`, `das Lernen`, `das Klettern`) shadows its own verb. Compare case-insensitively.

**H — a nominalised infinitive cannot be sourced, and it is not a near miss.** Two batches lost a
row to this before it was named: `Sitzenbleiben` (b2-tranche-5) and `Generationenwohnen`
(b2-tranche-7). Both are ordinary German. Neither has a de.wiktionary page, and unlike a compound
noun neither can inherit from its head, because the head is a **verb** — the fallback walks to
`bleiben` and `wohnen` and finds no `{{Deutsch Substantiv Übersicht}}` to read a gender from. Every
nominalised infinitive is neuter, which is exactly the trap: the gender is obvious and still not
*sourced*, so writing it in would be the one thing this pipeline never does. Both rows failed the
validator outright (`noun without gender`) and both were swapped for a noun that names the same
thing — `Wiederholung`, `Mehrgenerationenhaus`.

Compare **`-ierung`**, which looks like the same shape and is not: `Qualifizierung` and
`Personalisierung` failed, but `Digitalisierung`, `Automatisierung`, `Globalisierung`,
`Individualisierung`, `Urbanisierung`, `Restaurierung` and `Alphabetisierung` all resolved. Two out
of nine is a coin-flip in coverage, not a rule about the suffix — so there is no rubric rule for it,
only this note.

Still suspected, not yet observed in measured output:

- Examples that are subtly definitional (rule 4).
- Invented compounds with no Wiktionary entry — **zero** occurred in b1-01 (25/25 lemmas resolved),
  so the risk the tier anticipated is smaller than C and D, which did occur.
- Glosses that list four senses when the example only shows one.
