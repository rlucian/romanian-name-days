// index.mjs — the `zile-onomastice` package API.
//
// Romanian name days and holidays. Zero dependencies.
//
//   import { nameDay, whoCelebratesOn, orthodoxEaster } from 'zile-onomastice';

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveRule, isMovable, orthodoxEaster, toIsoDate } from './easter.mjs';

export { orthodoxEaster, resolveRule, isMovable, toIsoDate };

const DATA = join(dirname(fileURLToPath(import.meta.url)), 'data');
const read = (f) => JSON.parse(readFileSync(join(DATA, f), 'utf8'));

/** All 86 name records, as published. */
export const names = read('nameday.json');

/** All 35 occasion records, as published. */
export const occasions = read('holidays.json');

/**
 * Normalises a Romanian name for lookup: lowercase, diacritics stripped.
 *
 * Romanian users type "Marioara" as often as "Mărioara", and ș/ş plus ț/ţ each
 * have two Unicode forms in circulation (the correct comma-below letters and
 * the Turkish cedilla ones that older Romanian software emitted). All four
 * have to fold to the same key or lookups fail for reasons nobody can see.
 */
function normalise(value) {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')  // combining marks left by NFD
    .replace(/[\u015f\u015e]/g, 's') // s-cedilla (legacy Romanian encoding)
    .replace(/[\u0163\u0162]/g, 't') // t-cedilla (legacy Romanian encoding)
    .toLowerCase()
    .trim();
}

const byName = new Map();
for (const record of names) {
  byName.set(normalise(record.name), record);
  byName.set(normalise(record.slug), record);
  for (const diminutive of record.diminutives) {
    // A diminutive never overwrites a real name: "Ana" is a name in its own
    // right and must not be shadowed by being someone else's short form.
    const key = normalise(diminutive);
    if (!byName.has(key)) byName.set(key, record);
  }
}

/**
 * Looks up the name day for a Romanian given name.
 *
 * Accepts the name, its slug, or any listed diminutive, with or without
 * diacritics. Returns `null` if the name is not in the dataset — 86 names
 * covers common Romanian usage, not every name that exists.
 *
 * @param {string} name
 * @param {number} [year] resolve to a concrete date in this year
 * @returns {object|null}
 */
export function nameDay(name, year) {
  const record = byName.get(normalise(name));
  if (!record) return null;

  const movable = isMovable(record.namedayRule);
  const result = {
    name: record.name,
    slug: record.slug,
    rule: record.namedayRule,
    movable,
    gender: record.gender,
    diminutives: record.diminutives,
    confidence: record.confidence,
    url: `https://trends.ro/onomastica/${record.slug}`,
  };
  if (record.note) result.note = record.note;
  if (year !== undefined) result.date = toIsoDate(resolveRule(record.namedayRule, year));
  return result;
}

/**
 * Everything celebrated on a given date.
 *
 * @param {string|Date} date `'YYYY-MM-DD'`, `'MM-DD'`, or a Date
 * @param {number} [year] required when `date` is `'MM-DD'`; defaults to the
 *                        current year
 * @returns {{ date: string, namedays: object[], occasions: object[] }}
 */
export function whoCelebratesOn(date, year) {
  let iso;

  if (date instanceof Date) {
    iso = toIsoDate(date);
  } else if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    iso = date;
  } else if (/^\d{2}-\d{2}$/.test(date)) {
    iso = `${year ?? new Date().getUTCFullYear()}-${date}`;
  } else {
    throw new TypeError(`Unrecognised date: ${JSON.stringify(date)}`);
  }

  const resolvedYear = Number(iso.slice(0, 4));

  const matching = (rule) => rule !== null && toIsoDate(resolveRule(rule, resolvedYear)) === iso;

  return {
    date: iso,
    namedays: names
      .filter((n) => matching(n.namedayRule))
      .map((n) => ({
        name: n.name,
        slug: n.slug,
        gender: n.gender,
        confidence: n.confidence,
        url: `https://trends.ro/onomastica/${n.slug}`,
      })),
    occasions: occasions
      .filter((o) => matching(o.dateRule))
      .map((o) => ({
        title: o.title,
        slug: o.slug,
        kind: o.kind,
        url: `https://trends.ro/sarbatori/${o.slug}`,
      })),
  };
}

/**
 * What Romania celebrates today, in Europe/Bucharest — never the host
 * machine's timezone, which is wrong for anything deployed outside Romania
 * and produces off-by-one-day bugs that only show up near midnight.
 */
export function today() {
  const iso = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Bucharest',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  return whoCelebratesOn(iso);
}

/**
 * Every name day and occasion in `year`, grouped by date and sorted.
 *
 * @param {number} year
 * @returns {Array<{ date: string, namedays: object[], occasions: object[] }>}
 */
export function calendar(year) {
  const days = new Map();

  const add = (rule, key, value) => {
    if (rule === null) return;
    const iso = toIsoDate(resolveRule(rule, year));
    if (!days.has(iso)) days.set(iso, { date: iso, namedays: [], occasions: [] });
    days.get(iso)[key].push(value);
  };

  for (const n of names) {
    add(n.namedayRule, 'namedays', { name: n.name, slug: n.slug, gender: n.gender });
  }
  for (const o of occasions) {
    add(o.dateRule, 'occasions', { title: o.title, slug: o.slug, kind: o.kind });
  }

  return [...days.values()].sort((a, b) => a.date.localeCompare(b.date));
}
