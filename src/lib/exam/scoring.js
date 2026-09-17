// Progress math for the exam trainers. Dataset-shape agnostic: every caller just
// hands in a flat list of item ids and an ExamState (see ./state.js).

export function countAnswered(ids, state) {
  return ids.filter((id) => !!state.answers[id]).length;
}

export function countCorrect(ids, state) {
  return ids.filter((id) => state.answers[id]?.correct).length;
}

export function percent(part, total) {
  return total ? Math.round((part / total) * 100) : 0;
}

// A band is { min, label, cls } — the caller supplies the exam's own official
// thresholds (DTZ's 33/20, the Einbürgerungstest's 17 of 33, …). Nothing here
// invents a grading scale; a trainer with no published bands passes none.
export function bandFor(score, bands = []) {
  return bands.find((b) => score >= b.min) ?? null;
}
