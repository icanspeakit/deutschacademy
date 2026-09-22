// Single source of truth for the operator details that Impressum, Datenschutzerklärung
// and Nutzungsbedingungen all repeat. One file to correct, not three pages to keep in sync.
//
// ⚠️ THE FIELDS MARKED `TODO` ARE NOT FILLED IN AND MUST NOT BE GUESSED.
// §5 DDG requires a real, reachable name and postal address. A placeholder here is worse
// than no page at all — an incomplete Impressum is itself abmahnfähig. The archived
// /former-site footer carries "Deutsch Academy Inc., 35F Tycoon Centre, Pearl Drive,
// Ortigas, 1600 Pasig City, Manila", which may or may not still be the operating entity;
// it was left untouched deliberately rather than copied here on a guess.

export const LEGAL = {
  // Who operates deutschacademy.com — the "Verantwortlicher" under Art. 4(7) DSGVO.
  operatorName: "Edgar Kretschmann",
  operatorStreet: "Ansbacher Straße 48",
  operatorPostcode: "10777",
  operatorCity: "Berlin",
  operatorCountry: "Deutschland",
  // §5 DDG requires at least one means of rapid electronic contact in addition to email.
  operatorPhone: "TODO",         // or delete this line and the row that renders it
  // Only if the operator is a company: register court + number, and the managing director.
  register: null,                // e.g. "Amtsgericht München HRB 123456"
  managingDirector: null,
  // §5 Abs. 1 Nr. 6 DDG — only if a VAT ID exists. null is correct for a small business.
  vatId: null,
  // §18 Abs. 2 MStV — required when the site publishes journalistic-editorial content.
  // Teaching material is not that, so this is null unless a blog/news section appears.
  responsibleForContent: null,

  contactEmail: "hello@deutschacademy.com",

  // Bumped by hand when the substance of a page changes, not on every deploy.
  lastUpdated: "21. September 2026",

  // Where signed-in learners' data physically sits. Matches the Supabase project region
  // (eu-central-1). If the project is ever moved, this line moves with it.
  dataRegion: "Frankfurt am Main, Deutschland (eu-central-1)",
};

/** "Musterstraße 1, 12345 Musterstadt, Deutschland" — one line, for inline use. */
export function operatorAddressLine() {
  return `${LEGAL.operatorStreet}, ${LEGAL.operatorPostcode} ${LEGAL.operatorCity}, ${LEGAL.operatorCountry}`;
}

/** True once every required field has been filled in. Pages render a visible warning
 *  banner while this is false, so an unfinished Impressum cannot go live unnoticed. */
export function legalComplete() {
  return ![
    LEGAL.operatorName,
    LEGAL.operatorStreet,
    LEGAL.operatorPostcode,
    LEGAL.operatorCity,
    LEGAL.operatorCountry,
  ].includes("TODO");
}

/** Returns null for an unfilled placeholder, so templates can do `{filled(x) && ...}`
 *  and never render the literal string "TODO" to a visitor. */
export function filled(value) {
  return value && value !== "TODO" ? value : null;
}
