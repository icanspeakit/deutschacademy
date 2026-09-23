// Which grammar topics a Stufe holds, and in what order — the one list both the map on
// /fortschritt (LearnShell's left column) and the course bar on a topic page read.
//
// It used to live inside LearnShell.astro only. The topic page's "Thema 2 von 9" and its
// ‹ › have to walk exactly the list the learner just picked the topic from, so the list
// moved here rather than being written out a second time: a copy would agree until the
// day a topic is added or re-ordered in grammatik-lehrplan.json, and then disagree.
//
// Two kinds of topic share a level: full workspaces (src/data/grammatik/*.json) and the
// quiz-only topics left in grammatik.json. A workspace wins over a quiz topic with the
// same id — the rule [id].astro routes by. Order within a level is the teaching order in
// src/lib/lehrplan.js; topics the plan does not place yet go last.
import grammatik from "../data/grammatik.json";
import { byPlan } from "./lehrplan.js";

const workspaceMods = import.meta.glob("../data/grammatik/*.json", { eager: true });
export const workspaces = Object.values(workspaceMods).map((m) => m.default ?? m);

const workspaceIds = new Set(workspaces.flatMap((w) => [w.id, w.slug].filter(Boolean)));

export const KURS_LEVELS = ["A1", "A2", "B1", "B2"];

/**
 * The topics of one level, in course order.
 * Each entry: `{ id, kind: "workspace" | "quiz", data }`, where `id` is the URL slug —
 * the same key /fortschritt's `?thema=` and the progress store use.
 */
export function kursTopicsAt(level) {
  const ws = workspaces
    .filter((w) => w.level === level)
    .map((w) => ({ id: w.slug ?? w.id, kind: "workspace", data: w }));
  const quiz = grammatik
    .filter((t) => t.level === level && !workspaceIds.has(t.id))
    .map((t) => ({ id: t.id, kind: "quiz", data: t }));
  return [...ws, ...quiz].sort(byPlan((t) => [t.id], () => level));
}

/**
 * Where one topic sits in its course: its level, its place, and its neighbours.
 * `null` when the topic is not in any level's list.
 */
export function kursPosition(id) {
  for (const level of KURS_LEVELS) {
    const list = kursTopicsAt(level);
    const i = list.findIndex((t) => t.id === id);
    if (i === -1) continue;
    const name = (t) => t.data.name;
    return {
      level,
      index: i + 1,
      total: list.length,
      prev: i > 0 ? { id: list[i - 1].id, name: name(list[i - 1]) } : null,
      next: i < list.length - 1 ? { id: list[i + 1].id, name: name(list[i + 1]) } : null,
    };
  }
  return null;
}
