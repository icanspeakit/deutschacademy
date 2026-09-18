# Brand masters

The logo as it comes out of Illustrator. **Sources, not assets** — nothing here is served.

| file | what |
|---|---|
| `logo-master.png` | the "da für Dich" lockup, 4000×1139, transparent |
| `logo-master-cropped.png` | the same lockup, tightly cropped (from the 2018 export set) |

Everything the site loads is derived from `logo-master.png` by
`scripts/build-brand-assets.py`, which writes:

- `public/assets/logo.png` — 618×176, the nav and footer mark
- `public/assets/og-default.png` — 1200×630, the Open Graph card

Run it when the master changes:

```
python scripts/build-brand-assets.py brand/logo-master.png
```

## Why the masters live here and not in public/

Anything under `public/` is a public URL. The master is ninety times the pixels the
browser ever draws, and there is no page that wants it — leaving it there means the only
thing it can do is get requested by accident. Keeping it in the repo *outside* `public/`
keeps the source available to the next person without shipping it.

## Why these are committed rather than ignored

The derived files in `public/assets/` are committed too, so a checkout builds without a
Python step. That only stays honest if the input they were derived from is committed
beside them — otherwise "regenerate the logo" means going back to someone's Desktop.

The full 2018 export set (the `.ai` files, the circle lockups, the wordmark-only
variants) is not here; it lives in the design archive. Only what the site derives from.
