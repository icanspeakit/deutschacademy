// Every grammar topic that has a page, in one list, with the two things a navigation
// surface needs: the progress key and how many gradeable answers the topic holds.
//
// Three places were deriving this independently — LearnShell.astro, the /navnew sketch and
// [id].astro's own getStaticPaths — and they only agreed by accident. The rail on a topic
// page has to show exactly the rows the dashboard shows, with exactly the same counts, or
// the two surfaces contradict each other in front of the learner.
//
// `key` is the URL slug, never the raw `id`: that is what recordAttempt() writes and what
// /dashboard reads. See topicKeyOf() in grammarTasks.js for the one topic where they differ.
import { taskCountOf, topicKeyOf } from "./grammarTasks.js";
import grammatik from "../data/grammatik.json";
import { byPlan } from "./lehrplan.js";

const workspaceMods = import.meta.glob("../data/grammatik/*.json", { eager: true });
const workspaces = Object.values(workspaceMods).map((m) => m.default ?? m);
const covered = new Set(workspaces.map((w) => w.id));

const topicOf = (t, kind) => ({
  key: topicKeyOf(t),
  name: t.name,
  level: t.level,
  href: `/${topicKeyOf(t)}`,
  tasks: taskCountOf(t),
  kind,
  // Whether this topic can be heard and spoken, not just read and typed. Surfaces on the
  // hub and the rail so a learner looking for something to do out loud can find one.
  aktiv: !!t.aktiv,
});

/**
 * Every topic in the order the course teaches it, level by level.
 *
 * This used to be "workspaces alphabetically, then the quiz-only topics", which put
 * Modalverben before Perfekt in A2 although the syllabus teaches Perfekt first — and
 * being a workspace rather than a quiz is a fact about how much content a topic has, not
 * about when a learner should meet it. Both kinds now sort together by the Lehrplan.
 */
const LEVELS = ["A1", "A2", "B1", "B2"];
export const grammarCatalog = [
  ...workspaces.map((w) => topicOf(w, "workspace")),
  // akkusativ keeps its own bespoke page and is not on the [id] route.
  ...grammatik
    .filter((t) => t.id !== "akkusativ" && !covered.has(t.id))
    .map((t) => topicOf(t, "quiz")),
]
  .sort(byPlan((t) => [t.key]))
  .sort((a, b) => LEVELS.indexOf(a.level) - LEVELS.indexOf(b.level));

export const grammarAt = (level) => grammarCatalog.filter((t) => t.level === level);

export const grammarByKey = (key) => grammarCatalog.find((t) => t.key === key) ?? null;
