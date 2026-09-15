// @ts-check
import { defineConfig } from 'astro/config';

// https://astro.build/config
export default defineConfig({
  server: {
    // Listen on every interface, not just 127.0.0.1, so the dev server is reachable
    // from a phone on the same Wi-Fi — and from a tunnel — without passing --host
    // every time.
    host: true,
    // Dev-server requests carry the tunnel's hostname, which Astro rejects by default
    // as a DNS-rebinding guard. This only affects `astro dev`; the built site is
    // unaffected.
    allowedHosts: true,
  },
});
