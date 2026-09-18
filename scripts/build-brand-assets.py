"""Derive the site's brand images from the one master logo.

    python scripts/build-brand-assets.py [path-to-master.png]

The master is the "da fuer Dich" lockup as it comes out of Illustrator: 4000x1139,
transparent, 200 KB. That file is the right thing to keep and the wrong thing to serve --
it appears on every page at a rendered height of 44px, so a visitor downloads roughly
ninety times the pixels the browser draws, on a site where about nine in ten visits are
phones.

So this writes the sizes the site actually needs, from the one source, reproducibly:

    public/assets/logo.png         the lockup at 4x its largest rendered height (44px in
                                   the nav, 40px in the footer), which covers every
                                   device pixel ratio anyone will bring to it
    public/assets/og-default.png   1200x630, the Open Graph card -- the logo centred on
                                   the site's own surface colour, because a link shared
                                   into WhatsApp with no image is a grey box with a URL

Python rather than node: this repo has no `sharp` and Astro does not install one, and a
native image dependency for two files that change once a year is a worse trade than the
Pillow that is already on this machine. Nothing in the build depends on it -- it is run
by hand when the master changes, and its output is committed.
"""
import sys
from pathlib import Path
from PIL import Image

MASTER = Path(sys.argv[1] if len(sys.argv) > 1 else "brand/logo-master.png")
ROOT = Path(__file__).resolve().parent.parent
OUT_LOGO = ROOT / "public/assets/logo.png"
OUT_OG = ROOT / "public/assets/og-default.png"

# 4x the 44px nav logo. Not 2x: a 3x phone is ordinary now, and the file is small enough
# at this size that the next step up buys nothing.
LOGO_H = 176

# Open Graph's canonical size. Facebook, WhatsApp, Telegram, Slack and LinkedIn all crop
# to roughly 1.91:1, so anything else is cut somewhere none of them agree on.
OG = (1200, 630)
# The lockup is very wide (3.5:1). Filling the card leaves no margin at the sides, where
# a thumbnail crops hardest, so it sits at 58% and the card breathes.
OG_LOGO_W = round(OG[0] * 0.58)

# The colour the site's own pages sit on, so the card and the page it opens look like the
# same product.
SURFACE = (255, 255, 255, 255)


def main() -> None:
    master = Image.open(MASTER).convert("RGBA")
    print(f"master: {master.width}x{master.height}")

    logo = master.copy()
    logo.thumbnail((master.width, LOGO_H), Image.LANCZOS)
    OUT_LOGO.parent.mkdir(parents=True, exist_ok=True)
    logo.save(OUT_LOGO, "PNG", optimize=True)

    card_logo = master.copy()
    card_logo.thumbnail((OG_LOGO_W, master.height), Image.LANCZOS)
    card = Image.new("RGBA", OG, SURFACE)
    card.alpha_composite(
        card_logo,
        ((OG[0] - card_logo.width) // 2, (OG[1] - card_logo.height) // 2),
    )
    card.convert("RGB").save(OUT_OG, "PNG", optimize=True)

    for p in (OUT_LOGO, OUT_OG):
        with Image.open(p) as im:
            print(f"{p.relative_to(ROOT).as_posix()}: {im.width}x{im.height}, "
                  f"{p.stat().st_size / 1024:.1f} KB")


if __name__ == "__main__":
    main()
