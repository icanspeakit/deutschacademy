// @ts-check
import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel';
import react from '@astrojs/react';
import postcssRTLCSS from 'postcss-rtlcss';

export default defineConfig({
  // Static stays the default: every one of the ~670 content pages is still prerendered
  // to HTML at build time and served from the CDN with no server involved. The adapter
  // does not change that — it only makes it *possible* for an individual route to opt
  // out with `export const prerender = false`, which the handful of auth routes do and
  // nothing else should. If the prerendered page count ever drops after a change here,
  // the change is wrong: the build will still succeed and the site will still work, it
  // will just be rendering on demand what it used to serve from the edge.
  output: 'static',
  adapter: vercel(),

  // React is here for the auth islands only (sign-in card, nav account state). The rest
  // of the site is vanilla .astro plus the JS modules in src/lib/ — the zero-JS default
  // on content pages is load-bearing and adding an island to a page that does not need
  // one gives it a runtime it was deliberately built without.
  integrations: [react()],

  // /dashboard and /fortschritt were two pages answering the same question under two
  // names. They are now one page at /fortschritt; this keeps old links, bookmarks and
  // anything already shared working instead of 404ing.
  redirects: {
    '/dashboard': '/fortschritt',
  },
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
  vite: {
    css: {
      // Arabic is the only RTL language we ship (see LANGUAGES in src/lib/i18n.js), and
      // the stylesheets are written left-to-right: ~340 physical direction declarations
      // against ~18 logical ones. Converting them all by hand would be an enormous diff
      // and a trap — a `left: 50%` paired with `translateX(-50%)`, or the
      // `border-left: 11px solid` of a CSS triangle, must not flip naively, and a regex
      // cannot tell those apart. postcss-rtlcss reads each declaration in context and
      // appends a [dir="rtl"] rule wherever one is needed, for both src/styles/*.css and
      // the scoped <style> blocks in .astro files.
      //
      // One stylesheet serves both directions, so switching language needs no reload and
      // no second CSS file — which matters because setLang() flips documentElement.dir
      // live, and the pre-paint script in Layout.astro has already set it before the
      // first frame.
      //
      // Declared here rather than in a postcss.config.mjs: Astro's Vite root does not
      // pick that file up, and a config that silently does nothing is worse than none.
      postcss: {
        plugins: [
          postcssRTLCSS({
            // "override" on purpose. In "combined" mode the plugin also prefixes the LTR
            // rules with [dir="ltr"], which would blank the styling of any page that does
            // not carry a dir attribute. "override" leaves every existing rule
            // byte-identical and only adds RTL rules after it, so de/en/tr/uk cannot
            // regress: the worst case is an Arabic rule that loses on specificity, not a
            // page with no CSS.
            mode: 'override',
            // Mirror the keyframes of slide-in animations (nav drawer, picker panels)
            // instead of leaving them entering from the wrong edge.
            processKeyFrames: true,
            // Flip asymmetric shorthands with calc() rather than dropping them.
            useCalc: true,
            // Background images and icons here are direction-neutral; rewriting url()
            // would only look for -rtl files that do not exist.
            processUrls: false,
          }),
        ],
      },
    },
  },
});
