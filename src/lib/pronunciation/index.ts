// The pronunciation provider the browser uses. To switch vendors, point this re-export
// (and the one in ./server.ts) at another adapter that implements ./types.ts.
export { azureProvider as pronunciationProvider } from "./azure";
export { PronunciationError } from "./types";
export type {
  Assessment,
  AssessedWord,
  AssessedPhoneme,
  AssessOptions,
  PronunciationErrorCode,
  PronunciationProvider,
  SpeakOptions,
  WordError,
} from "./types";
