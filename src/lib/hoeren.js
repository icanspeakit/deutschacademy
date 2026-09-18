// Build-time helpers for the Hörverstehen pages.
//
// The pages need to know two things the JSON cannot tell them: whether a clip has actually
// been rendered yet, and how long it really is. Both come from disk — public/audio/hoeren/
// and the manifest scripts/generate-hoeren-audio.mjs writes beside the mp3s — so the page
// never advertises a duration the file does not have, and never shows a player for a file
// that is not there.
//
// Node built-ins are fine here: every page that imports this is prerendered.
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const AUDIO_DIR = path.join(process.cwd(), "public", "audio", "hoeren");

const manifest = (() => {
  const file = path.join(AUDIO_DIR, "manifest.json");
  if (!existsSync(file)) return {};
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch {
    return {};
  }
})();

/** Has `pnpm generate:hoeren` produced this clip? */
export function hasClip(id) {
  return existsSync(path.join(AUDIO_DIR, `${id}.mp3`));
}

export function clipHref(id) {
  return `/audio/hoeren/${id}.mp3`;
}

/** The real length when the file exists, the estimate in hoeren.json until it does. */
export function clipSeconds(text) {
  return manifest[text.id] ?? text.seconds;
}

/* Which icon stands for which task type. The split is one-way against two-way, not topic:
   a Durchsage, eine Mailbox, Radio und ein Vortrag reden zu dir (volume), ein Telefonat,
   ein Gespräch und eine Diskussion reden miteinander (mic). Nothing else about a card
   tells you that before you open it. */
export const TYPE_ICON = {
  ansage: "volume",
  anrufbeantworter: "volume",
  radio: "volume",
  vortrag: "volume",
  telefonat: "mic",
  gespraech: "mic",
  diskussion: "mic",
};
