// Azure Speech, server half: trades the subscription key for a 10-minute STS token.
// Server-only — this file reads the secret key and must never be imported by browser code.
//
// One token serves every learner: it is tied to the key, not to a person, so it is cached
// per server instance for 8 of its 10 minutes rather than fetched per request.
import type { ClientCredentials, PronunciationServerProvider } from "./types";

// Runtime env first (Vercel's settings), then Astro's build-time env (.env.local in dev).
// `||`, not `??`: a variable missing at build time can be baked in as "".
const KEY = process.env.AZURE_SPEECH_KEY || import.meta.env.AZURE_SPEECH_KEY;
// Either of the two says where the key lives:
//   AZURE_SPEECH_ENDPOINT  the resource's own address — an Azure AI Foundry / multi-service
//                          resource gives a project endpoint (…services.ai.azure.com/api/
//                          projects/…); only its origin is used, and it issues Speech tokens.
//   AZURE_SPEECH_REGION    a plain Speech resource's region (westeurope) — the regional STS.
const ENDPOINT = process.env.AZURE_SPEECH_ENDPOINT || import.meta.env.AZURE_SPEECH_ENDPOINT;
const REGION_ENV = process.env.AZURE_SPEECH_REGION || import.meta.env.AZURE_SPEECH_REGION;

function stsUrl(): string | null {
  if (ENDPOINT) {
    try { return `${new URL(ENDPOINT).origin}/sts/v1.0/issueToken`; } catch { return null; }
  }
  return REGION_ENV ? `https://${REGION_ENV}.api.cognitive.microsoft.com/sts/v1.0/issueToken` : null;
}

// The browser SDK wants a region beside the token. A Foundry endpoint does not name one, but
// the token does: its payload carries `"region": "swedencentral"`.
function regionOf(token: string): string | null {
  try {
    const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString("utf8"));
    return typeof payload.region === "string" ? payload.region : null;
  } catch {
    return null;
  }
}

const TOKEN_TTL_MS = 8 * 60_000; // Azure's tokens live 10 minutes; hand out 8.
let cached: { token: string; region: string; expires: number } | null = null;

export const azureServer: PronunciationServerProvider = {
  id: "azure",

  async issueClientCredentials(): Promise<ClientCredentials> {
    const url = stsUrl();
    if (!KEY || !url) {
      // Logged without the values themselves.
      console.error("[pronunciation/azure] AZURE_SPEECH_KEY and AZURE_SPEECH_ENDPOINT (or AZURE_SPEECH_REGION) must be set");
      return { ok: false, reason: "config" };
    }
    if (!cached || cached.expires - Date.now() < 30_000) {
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: { "Ocp-Apim-Subscription-Key": KEY, "Content-Length": "0" },
        });
        if (!res.ok) {
          console.error(`[pronunciation/azure] STS answered ${res.status}`);
          return { ok: false, reason: "upstream" };
        }
        const token = await res.text();
        const region = REGION_ENV || regionOf(token);
        if (!region) {
          console.error("[pronunciation/azure] no region: set AZURE_SPEECH_REGION, the token did not name one");
          return { ok: false, reason: "config" };
        }
        cached = { token, region, expires: Date.now() + TOKEN_TTL_MS };
      } catch {
        console.error("[pronunciation/azure] STS unreachable");
        return { ok: false, reason: "upstream" };
      }
    }
    return {
      ok: true,
      body: { token: cached.token, region: cached.region },
      expiresIn: Math.floor((cached.expires - Date.now()) / 1000),
    };
  },
};
