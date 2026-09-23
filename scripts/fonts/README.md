# PDF fonts

Noto Sans (Latin + Cyrillic, which covers Turkish ğ ş ı İ and Russian) and Noto Sans Arabic,
from https://github.com/notofonts. Both are under the SIL Open Font License 1.1, which allows
embedding them in the PDFs we hand out.

Only the translated editions use them (`createDoc({ unicode: true })` in
`scripts/lib/pdf-brand.mjs`). The German PDFs keep pdfkit's built-in Helvetica, so they did
not change by a byte when these were added.
