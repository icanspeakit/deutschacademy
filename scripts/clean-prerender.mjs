// Runs as `prebuild`, before every `astro build`.
//
// Astro reuses dist/.prerender between runs. A build that dies mid-way leaves it
// half-written, and the NEXT build then fails with an error that looks like a source bug
// but is not: twice in one session here, once as `TypeError: Cannot read properties of
// undefined` inside a component and once as `ERR_MODULE_NOT_FOUND` on a chunk. Both times
// the underlying crash was `Assertion failed: !(handle->flags & UV_HANDLE_CLOSING)` — libuv
// on Windows — and both times `rm -rf dist` was the entire fix, after the second error had
// already sent someone looking through the data.
//
// Only .prerender goes. The rest of the output stays, so rebuilds keep their speed.
//
// TWO paths, because the adapter decides where the build lands: a plain static build puts
// it in dist/, the Vercel adapter in .vercel/output/server/. When the adapter was added,
// this script kept cleaning dist/ alone and silently stopped guarding anything — the same
// ERR_MODULE_NOT_FOUND on a wortschatz chunk came back, and a second `pnpm build` was
// again the whole fix. Clearing both costs nothing and survives the next adapter change.
import { rmSync } from "node:fs";
for (const dir of ["../dist/.prerender", "../.vercel/output/server/.prerender"]) {
  rmSync(new URL(dir, import.meta.url), { recursive: true, force: true });
}
