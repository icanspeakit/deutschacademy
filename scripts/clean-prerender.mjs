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
// Only .prerender goes. The rest of dist stays, so rebuilds keep their speed.
import { rmSync } from "node:fs";
rmSync(new URL("../dist/.prerender", import.meta.url), { recursive: true, force: true });
