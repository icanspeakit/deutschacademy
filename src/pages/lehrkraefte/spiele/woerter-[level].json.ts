// The word data the printable games (/lehrkraefte/spiele/*) generate from — one static
// JSON file per level, written at build time from the lexicon.
//
// A file per level rather than the words inlined into each page: all of A1–B2 with the four
// translations is ~500 KB, and a teacher making a Bingo for one A1 Lernset needs a tenth of
// that. The page fetches the level it is showing, once; the CDN and the browser cache do
// the rest.
//
// Rows are arrays, not objects, to keep the files small. The order is WORD_FIELDS in
// src/lib/spiele/common.js — change both together.
import type { APIRoute, GetStaticPaths } from "astro";
import { all, units } from "../../../lib/lexicon.js";

const LEVELS = ["A1", "A2", "B1", "B2"];

export const getStaticPaths: GetStaticPaths = () =>
  LEVELS.map((level) => ({ params: { level: level.toLowerCase() }, props: { level } }));

export const GET: APIRoute = ({ props }) => {
  const level = (props as { level: string }).level;
  const levelUnits = units().filter((u: { level: string }) => u.level === level);
  const unitIndex = new Map(levelUnits.map((u: { id: string }, i: number) => [u.id, i]));
  const words = all()
    .filter((e: any) => e.level === level && unitIndex.has(e.unit))
    .map((e: any) => [
      unitIndex.get(e.unit),
      e.lemma,
      e.pos ?? "",
      e.gender ?? "",
      e.pluralOnly ? "" : e.plural ?? "",
      e.en ?? "",
      e.ar ?? "",
      e.ru ?? "",
      e.tr ?? "",
    ]);
  const body = {
    level,
    units: levelUnits.map((u: { id: string; title: string }) => [u.id, u.title]),
    words,
  };
  return new Response(JSON.stringify(body), { headers: { "Content-Type": "application/json; charset=utf-8" } });
};
