// Azure Speech, server half: trades the subscription key for a 10-minute STS token.
// Server-only — this file reads the secret key and must never be imported by browser code.
//
// One token serves every learner: it is tied to the key, not to a person, so it is cached
// per server instance for 8 of its 10 minutes rather than fetched per request.
import type { ClientCredentials, PronunciationServerProvider } from "./types";

// Runtime env first (Vercel's settings), then Astro's build-time env (.env.local in dev).
// `||`, not `??`: a variable missing at build time can be baked in as "".
const KEY = process.env.AZURE_SPEECH_KEY || import.meta.env.AZURE_SPEECH_KEY;
const REGION = process.env.AZURE_SPEECH_REGION || import.meta.env.AZURE_SPEECH_REGION;

const TOKEN_TTL_MS = 8 * 60_000; // Azure's tokens live 10 minutes; hand out 8.
let cached: { token: string; expires: number } | null = null;

export const azureServer: PronunciationServerProvider = {
  id: "azure",

  async issueClientCredentials(): Promise<ClientCredentials> {
    if (!KEY || !REGION) {
      // Logged without the values themselves.
      console.error("[pronunciation/azure] AZURE_SPEECH_KEY or AZURE_SPEECH_REGION is not set");
      return { ok: false, reason: "config" };
    }
    if (!cached || cached.expires - Date.now() < 30_000) {
      try {
        const res = await fetch(`https://${REGION}.api.cognitive.microsoft.com/sts/v1.0/issueToken`, {
          method: "POST",
          headers: { "Ocp-Apim-Subscription-Key": KEY, "Content-Length": "0" },
        });
        if (!res.ok) {
          console.error(`[pronunciation/azure] STS answered ${res.status}`);
          return { ok: false, reason: "upstream" };
        }
        cached = { token: await res.text(), expires: Date.now() + TOKEN_TTL_MS };
      } catch {
        console.error("[pronunciation/azure] STS unreachable");
        return { ok: false, reason: "upstream" };
      }
    }
    return {
      ok: true,
      body: { token: cached.token, region: REGION },
      expiresIn: Math.floor((cached.expires - Date.now()) / 1000),
    };
  },
};
