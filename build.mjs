#!/usr/bin/env node
// build.mjs — derives every distributed format from the two canonical files.
//
//   data/nameday.json  ─┐
//   data/holidays.json ─┴─> CSV, per-year resolved calendars, .ics feeds
//
// Zero dependencies, so anyone can reproduce the release with `node build.mjs`
// and diff it against what we published. That reproducibility is the point:
// a dataset nobody can rebuild is a dataset nobody should trust.
//
// Usage:  node build.mjs [--from 2026] [--to 2035]

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveRule, isMovable, toIsoDate, orthodoxEaster } from './easter.mjs';

const ROOT = dirname(fileURLToPath(import.meta.url));
const DATA = join(ROOT, 'data');

// ---------------------------------------------------------------- arguments

function arg(flag, fallback) {
  const i = process.argv.indexOf(flag);
  return i === -1 ? fallback : Number(process.argv[i + 1]);
}

const YEAR_FROM = arg('--from', new Date().getUTCFullYear());
const YEAR_TO = arg('--to', YEAR_FROM + 9);

// ------------------------------------------------------------------- helpers

const readJson = (name) => JSON.parse(readFileSync(join(DATA, name), 'utf8'));

function writeOut(name, contents) {
  mkdirSync(DATA, { recursive: true });
  writeFileSync(join(DATA, name), contents);
  const kb = (Buffer.byteLength(contents) / 1024).toFixed(1);
  console.log(`  ${name.padEnd(34)} ${kb.padStart(7)} KB`);
}

/** RFC 4180 CSV field: quote when it contains a comma, quote or newline. */
function csvField(value) {
  if (value === null || value === undefined) return '';
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsv(rows, columns) {
  const lines = [columns.join(',')];
  for (const row of rows) {
    lines.push(columns.map((c) => csvField(row[c])).join(','));
  }
  return lines.join('\n') + '\n';
}

/** Escapes a text value for an iCalendar property (RFC 5545 §3.3.11). */
function icsText(value) {
  return String(value)
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

/** Folds a line to 75 octets per RFC 5545 §3.1. */
function icsFold(line) {
  const bytes = Buffer.from(line, 'utf8');
  if (bytes.length <= 75) return line;
  const out = [];
  let start = 0;
  let limit = 75;
  while (start < bytes.length) {
    // Never split a multi-byte UTF-8 character: walk back to a lead byte.
    let end = Math.min(start + limit, bytes.length);
    while (end > start && end < bytes.length && (bytes[end] & 0xc0) === 0x80) end--;
    out.push(bytes.subarray(start, end).toString('utf8'));
    start = end;
    limit = 74; // continuation lines are prefixed with one space
  }
  return out.join('\r\n ');
}

function icsCalendar(name, description, events) {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//trends.ro//Zile onomastice si sarbatori romanesti//RO',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${icsText(name)}`,
    `X-WR-CALDESC:${icsText(description)}`,
    'X-WR-TIMEZONE:Europe/Bucharest',
    // Each event is a multi-line block; it has to be split into individual
    // content lines BEFORE folding. Folding a whole block as if it were one
    // line inserts continuation breaks in the middle of property names and
    // produces a file that parses as garbage (caught by test.mjs).
    ...events.flatMap((event) => event.split('\r\n')),
    'END:VCALENDAR',
  ];
  return lines.map(icsFold).join('\r\n') + '\r\n';
}

/**
 * One all-day VEVENT.
 *
 * `DTSTAMP` is fixed rather than "now" so a rebuild of unchanged data
 * produces a byte-identical file — otherwise every build shows as a diff and
 * the reproducibility claim above becomes untestable.
 */
function icsEvent({ uid, date, summary, description, url, yearly }) {
  const stamp = '20260101T000000Z';
  const start = date.replace(/-/g, '');
  const next = new Date(`${date}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  const end = toIsoDate(next).replace(/-/g, '');

  return [
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${stamp}`,
    `DTSTART;VALUE=DATE:${start}`,
    `DTEND;VALUE=DATE:${end}`,
    ...(yearly ? ['RRULE:FREQ=YEARLY'] : []),
    `SUMMARY:${icsText(summary)}`,
    ...(description ? [`DESCRIPTION:${icsText(description)}`] : []),
    ...(url ? [`URL:${icsText(url)}`] : []),
    'TRANSP:TRANSPARENT',
    'END:VEVENT',
  ].join('\r\n');
}

// ---------------------------------------------------------------------- data

const names = readJson('nameday.json');
const holidays = readJson('holidays.json');

console.log(`Building from ${names.length} names and ${holidays.length} occasions`);
console.log(`Resolving years ${YEAR_FROM}–${YEAR_TO}\n`);

// ------------------------------------------------------------------ integrity

const problems = [];

const seenSlugs = new Set();
for (const entry of [...names, ...holidays]) {
  const key = `${entry.slug}`;
  if (entry.namedayRule !== undefined || entry.dateRule !== undefined) {
    const rule = entry.namedayRule ?? entry.dateRule;
    if (rule !== null) {
      try {
        resolveRule(rule, YEAR_FROM);
      } catch (err) {
        problems.push(`${key}: ${err.message}`);
      }
    }
  }
  if (seenSlugs.has(key)) problems.push(`duplicate slug: ${key}`);
  seenSlugs.add(key);
}

if (problems.length) {
  console.error('Integrity check failed:');
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}
console.log('Integrity check passed.\n');

// ----------------------------------------------------------------------- CSV

console.log('CSV:');

writeOut(
  'nameday.csv',
  toCsv(
    names.map((n) => ({
      name: n.name,
      slug: n.slug,
      rule: n.namedayRule,
      movable: isMovable(n.namedayRule) ? 'true' : 'false',
      gender: n.gender,
      diminutives: (n.diminutives ?? []).join('; '),
      confidence: n.confidence ?? 'established',
      note: n.note ?? '',
    })),
    ['name', 'slug', 'rule', 'movable', 'gender', 'diminutives', 'confidence', 'note'],
  ),
);

writeOut(
  'holidays.csv',
  toCsv(
    holidays.map((h) => ({
      slug: h.slug,
      title: h.title,
      kind: h.kind,
      rule: h.dateRule ?? '',
      movable: h.dateRule && isMovable(h.dateRule) ? 'true' : 'false',
    })),
    ['slug', 'title', 'kind', 'rule', 'movable'],
  ),
);

// -------------------------------------------------------- resolved calendars

console.log('\nResolved calendars:');

const byYear = new Map();

for (let year = YEAR_FROM; year <= YEAR_TO; year++) {
  const days = new Map();

  const push = (rule, entry) => {
    if (!rule) return;
    const iso = toIsoDate(resolveRule(rule, year));
    if (!days.has(iso)) days.set(iso, { date: iso, namedays: [], occasions: [] });
    if (entry.type === 'nameday') days.get(iso).namedays.push(entry.value);
    else days.get(iso).occasions.push(entry.value);
  };

  for (const n of names) {
    push(n.namedayRule, { type: 'nameday', value: { name: n.name, slug: n.slug, gender: n.gender } });
  }
  for (const h of holidays) {
    push(h.dateRule, { type: 'occasion', value: { title: h.title, slug: h.slug, kind: h.kind } });
  }

  const easter = orthodoxEaster(year);
  const resolved = {
    year,
    orthodoxEaster: `${year}-${String(easter.month).padStart(2, '0')}-${String(easter.day).padStart(2, '0')}`,
    source: 'https://trends.ro',
    days: [...days.values()].sort((a, b) => a.date.localeCompare(b.date)),
  };

  byYear.set(year, resolved);
  writeOut(`calendar-${year}.json`, JSON.stringify(resolved, null, 2) + '\n');
}

// ----------------------------------------------------------------------- ICS

console.log('\nCalendar feeds:');

const nameEvents = [];
for (const n of names) {
  if (isMovable(n.namedayRule)) {
    // A movable name day cannot be expressed as a yearly RRULE — it follows
    // Easter. Emit one concrete event per year in range instead of quietly
    // pinning it to a wrong fixed date, which is what most feeds do.
    for (let year = YEAR_FROM; year <= YEAR_TO; year++) {
      nameEvents.push(
        icsEvent({
          uid: `nameday-${n.slug}-${year}@trends.ro`,
          date: toIsoDate(resolveRule(n.namedayRule, year)),
          summary: `Onomastică: ${n.name}`,
          description: `${n.name} își serbează numele (sărbătoare mobilă, ${n.namedayRule}). Sursa: https://trends.ro/onomastica/${n.slug}`,
          url: `https://trends.ro/onomastica/${n.slug}`,
        }),
      );
    }
  } else {
    nameEvents.push(
      icsEvent({
        uid: `nameday-${n.slug}@trends.ro`,
        date: toIsoDate(resolveRule(n.namedayRule, YEAR_FROM)),
        summary: `Onomastică: ${n.name}`,
        description: `${n.name} își serbează numele. Sursa: https://trends.ro/onomastica/${n.slug}`,
        url: `https://trends.ro/onomastica/${n.slug}`,
        yearly: true,
      }),
    );
  }
}

writeOut(
  'onomastici.ics',
  icsCalendar(
    'Zile onomastice (România)',
    `Zilele onomastice din calendarul românesc. ${names.length} nume. Sursa: https://trends.ro`,
    nameEvents,
  ),
);

const holidayEvents = [];
for (const h of holidays) {
  if (!h.dateRule) continue; // undated life events are not calendar entries
  if (isMovable(h.dateRule)) {
    for (let year = YEAR_FROM; year <= YEAR_TO; year++) {
      holidayEvents.push(
        icsEvent({
          uid: `occasion-${h.slug}-${year}@trends.ro`,
          date: toIsoDate(resolveRule(h.dateRule, year)),
          summary: h.title,
          description: `Sărbătoare mobilă (${h.dateRule}). Sursa: https://trends.ro/sarbatori/${h.slug}`,
          url: `https://trends.ro/sarbatori/${h.slug}`,
        }),
      );
    }
  } else {
    holidayEvents.push(
      icsEvent({
        uid: `occasion-${h.slug}@trends.ro`,
        date: toIsoDate(resolveRule(h.dateRule, YEAR_FROM)),
        summary: h.title,
        description: `Sursa: https://trends.ro/sarbatori/${h.slug}`,
        url: `https://trends.ro/sarbatori/${h.slug}`,
        yearly: true,
      }),
    );
  }
}

writeOut(
  'sarbatori.ics',
  icsCalendar(
    'Sărbători românești',
    `Sărbători din calendarul românesc, inclusiv cele mobile. Sursa: https://trends.ro`,
    holidayEvents,
  ),
);

writeOut(
  'calendar-complet.ics',
  icsCalendar(
    'Calendar românesc — onomastici și sărbători',
    `Zile onomastice și sărbători. Sursa: https://trends.ro`,
    [...nameEvents, ...holidayEvents],
  ),
);

console.log('\nDone.');
