// The search lens's index — see src/lib/searchIndex.js. Prerendered like the rest of
// the site, so it is one static file on the CDN.
import { buildSearchIndex } from "../lib/searchIndex.js";

export function GET() {
  return new Response(JSON.stringify(buildSearchIndex()), {
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}
