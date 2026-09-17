// Shared progress storage for every exam trainer page (Leben in Deutschland, telc,
// Goethe, TestDaF, …). Ported from the Pflegeplace project's src/lib/exam/state.ts:
// same keyed-per-exam shape, so a cross-exam "Mein Fortschritt" view can read every
// exam's answers without a migration.
//
// The DTZ Übungssatz keeps its own "da-dtz-v1:" keys (src/lib/dtzTrainer.js) because
// it stores a writing task and a self-rating alongside the answers; everything else
// lives here under "da-exam-v1:<examId>".

const PREFIX = "da-exam-v1:";

export function freshExamState() {
  return { answers: {} };
}

export function loadExamState(examId) {
  try {
    const raw = localStorage.getItem(PREFIX + examId);
    const parsed = raw ? JSON.parse(raw) : null;
    if (parsed && parsed.answers) return { answers: parsed.answers };
  } catch {
    /* private mode or a corrupt entry — start fresh rather than fail the page */
  }
  return freshExamState();
}

export function saveExamState(examId, state) {
  try {
    localStorage.setItem(PREFIX + examId, JSON.stringify(state));
  } catch {
    /* quota or private mode — the sitting still works, it just won't persist */
  }
}

export function clearExamState(examId) {
  try {
    localStorage.removeItem(PREFIX + examId);
  } catch {
    /* nothing to do */
  }
}
