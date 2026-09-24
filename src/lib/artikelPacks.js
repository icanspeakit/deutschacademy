// The packs of the der/die/das trainer — "Nach Thema" and "Nach Regel" — worked out at
// build time from the lexicon and src/data/artikel-packs.json.
//
// Topic packs group the lexicon's own unit topics. A noun can carry more than one topic
// (17 of the 386 A1 nouns do); it belongs to the pack of its first, so every noun sits in
// exactly one pack and the packs of a level add up to the level.
//
// Rule packs are article patterns — -ung → die, -chen → das. A noun joins one only when
// it matches the pattern AND its real article is the pack's article. The ones that match
// and break the rule (der Reichtum, das Stadion) are returned as exceptions: they are what
// a rule pack must never teach, and together they make the "Ausnahmen" pack.
//
// Also importable from plain `node`, like lexicon.js — scripts can print the stats.
import config from "../data/artikel-packs.json" with { type: "json" };
import { verbs } from "./lexicon.js";

export const PACK_CONFIG = config;
const LEVELS = ["A1", "A2", "B1", "B2"];

const topicPackOf = new Map();
for (const pack of config.topics) for (const t of pack.topics) topicPackOf.set(t, pack.id);

/** The one topic pack a noun belongs to, or null if none of its topics is mapped. */
export function topicPackFor(noun) {
  for (const t of noun.topics ?? []) {
    const id = topicPackOf.get(t);
    if (id) return id;
  }
  return null;
}

let infinitives = null;
const isInfinitive = (lemma) => {
  infinitives ??= new Set(verbs().map((v) => v.lemma.toLowerCase()));
  return infinitives.has(lemma.toLowerCase());
};

/**
 * Which rule a noun's form points at, whatever its real article: `{ rule, why }`, or null
 * when no pattern applies. `why` names the matched pattern, for the exception list.
 */
export function ruleMatch(noun) {
  const L = noun.lemma;
  for (const r of config.rules) {
    if (r.names?.includes(L)) return { rule: r, why: "Name" };
    if (r.notSuffixes?.some((s) => L.endsWith(s))) continue;
    const suffix = r.suffixes.find((s) => L.endsWith(s));
    if (suffix) {
      // -chen is a diminutive only after a consonant other than s: Brötchen, Mädchen —
      // not Kuchen, Knochen, Groschen, which merely end in the same letters.
      if (r.diminutiveCheck && suffix === "chen" && !/[^aeiouäöüs]chen$/.test(L)) continue;
      return { rule: r, why: `-${suffix}` };
    }
    if (r.infinitives && isInfinitive(L)) return { rule: r, why: "Verb als Nomen" };
    // "der Lehrer": a person on -er, recognisable because the lexicon has "die Lehrerin".
    if (r.maleEr && L.endsWith("er") && noun._femaleForms?.has(L + "in")) return { rule: r, why: "Mann auf -er" };
  }
  return null;
}

/**
 * Every pack for every level, from the trainer's noun pool.
 * @param {Array} lexNouns  lexicon nouns with `gender` (A1–B2)
 */
export function buildArtikelPacks(lexNouns) {
  const femaleForms = new Set(lexNouns.filter((n) => n.gender === "die").map((n) => n.lemma));
  const nounTopic = {};
  const nounRule = {};
  const exceptions = [];

  for (const n of lexNouns) {
    nounTopic[n.id] = topicPackFor(n);
    const m = ruleMatch({ ...n, _femaleForms: femaleForms });
    if (!m) continue;
    if (m.rule.article === n.gender) nounRule[n.id] = m.rule.id;
    else exceptions.push({ id: n.id, level: n.level, lemma: n.lemma, gender: n.gender, rule: m.rule.id, why: m.why });
  }

  const byLevel = {};
  for (const [i, level] of LEVELS.entries()) {
    const here = lexNouns.filter((n) => n.level === level);
    const topics = config.topics
      // `levels` renames a pack per level: the same lexicon topic holds other nouns at A2.
      .map((p) => ({ id: p.id, name: p.levels?.[level]?.name ?? p.name, icon: p.levels?.[level]?.icon ?? p.icon, ids: here.filter((n) => nounTopic[n.id] === p.id).map((n) => n.id) }))
      .filter((p) => p.ids.length >= config.minPack);
    // A rule is taught with every noun up to this level: A2 has no "der" nouns of its own
    // to show it with, and a B1 learner still meets the A1 weekdays.
    const upTo = new Set(LEVELS.slice(0, i + 1));
    const reach = lexNouns.filter((n) => upTo.has(n.level));
    const rules = config.rules
      .map((r) => ({
        id: r.id, article: r.article, name: r.name, rule: r.rule, ruleLeicht: r.ruleLeicht,
        ids: reach.filter((n) => nounRule[n.id] === r.id).map((n) => n.id),
      }))
      .filter((r) => r.ids.length >= config.minPack);
    const exc = exceptions.filter((e) => upTo.has(e.level));
    if (exc.length >= 5) {
      rules.push({
        id: "ausnahmen", article: null, name: "Ausnahmen",
        rule: "Diese Wörter sehen aus wie eine Regel — und brechen sie. Sie muss man einzeln lernen.",
        ruleLeicht: "Diese Wörter passen nicht zur Regel. Lerne sie mit ihrem Artikel.",
        ids: exc.map((e) => e.id),
      });
    }
    byLevel[level] = { topics, rules };
  }

  return { byLevel, nounTopic, nounRule, exceptions };
}

/** Two or three real examples for a rule's intro card, from the nouns of its pack. */
export function ruleExamples(pack, pool, n = 3) {
  const byId = new Map(pool.map((q) => [q.id, q]));
  return pack.ids.slice(0, n).map((id) => byId.get(id)).filter(Boolean).map((q) => `${q.answer} ${q.lemma}`);
}
