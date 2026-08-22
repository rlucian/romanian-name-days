#!/usr/bin/env node
// test.mjs — run with `node --test test.mjs` (Node 18+) or plain `node test.mjs`.
//
// The Orthodox Easter dates below are the guard on the whole dataset: every
// movable feast and four of the name days are derived from them. If the
// computus disagrees with these published dates, the computus is wrong.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { orthodoxEaster, resolveRule, isMovable, toIsoDate } from './easter.mjs';

const ROOT = dirname(fileURLToPath(import.meta.url));
const readData = (n) => JSON.parse(readFileSync(join(ROOT, 'data', n), 'utf8'));

/**
 * The controlled vocabulary for `confidence`. Documented in README.md — if a
 * value is added here it must be explained there, or consumers cannot
 * interpret it.
 */
const CONFIDENCE_VALUES = ['established', 'convention', 'approximate', 'single-source'];

// Published Orthodox Easter Sundays, Gregorian calendar.
const KNOWN_EASTER = {
  2020: '2020-04-19',
  2021: '2021-05-02',
  2022: '2022-04-24',
  2023: '2023-04-16',
  2024: '2024-05-05',
  2025: '2025-04-20',
  2026: '2026-04-12',
  2027: '2027-05-02',
  2028: '2028-04-16',
  2029: '2029-04-08',
  2030: '2030-04-28',
};

test('Orthodox Easter matches published dates', () => {
  for (const [year, expected] of Object.entries(KNOWN_EASTER)) {
    const { month, day } = orthodoxEaster(Number(year));
    const actual = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    assert.equal(actual, expected, `Orthodox Easter ${year}`);
  }
});

test('Easter always falls on a Sunday, across four centuries', () => {
  for (let year = 1800; year <= 2200; year++) {
    const date = resolveRule('easter+0', year);
    assert.equal(date.getUTCDay(), 0, `Easter ${year} is not a Sunday`);
  }
});

test('movable feasts land on their correct weekday', () => {
  for (let year = 2026; year <= 2050; year++) {
    // Florii (Palm Sunday) is the Sunday before Easter.
    assert.equal(resolveRule('easter-7', year).getUTCDay(), 0, `Florii ${year}`);
    // Rusalii (Pentecost) is the seventh Sunday after Easter.
    assert.equal(resolveRule('easter+49', year).getUTCDay(), 0, `Rusalii ${year}`);
    // Înălțarea Domnului is the fortieth day — always a Thursday.
    assert.equal(resolveRule('easter+39', year).getUTCDay(), 4, `Înălțarea ${year}`);
  }
});

test('fixed rules resolve, and impossible ones throw', () => {
  assert.equal(toIsoDate(resolveRule('12-25', 2027)), '2027-12-25');
  assert.equal(toIsoDate(resolveRule('08-15', 2027)), '2027-08-15');
  assert.equal(toIsoDate(resolveRule('02-29', 2028)), '2028-02-29'); // leap year
  assert.throws(() => resolveRule('02-29', 2027), /no such day/); // not a leap year
  assert.throws(() => resolveRule('02-30', 2028), /no such day/);
  assert.throws(() => resolveRule('13-01', 2028), /month out of range/);
  assert.throws(() => resolveRule('nonsense', 2028), /Unrecognised/);
});

test('every name resolves and has the required fields', () => {
  const names = readData('nameday.json');
  assert.ok(names.length > 0);

  const slugs = new Set();
  for (const n of names) {
    assert.ok(n.name, 'name is required');
    assert.ok(n.slug, `slug required for ${n.name}`);
    assert.ok(['m', 'f', 'u'].includes(n.gender), `bad gender for ${n.name}`);
    assert.ok(Array.isArray(n.diminutives), `diminutives must be an array for ${n.name}`);
    assert.ok(
      CONFIDENCE_VALUES.includes(n.confidence),
      `bad confidence value for ${n.name}: ${n.confidence}`,
    );
    assert.ok(!slugs.has(n.slug), `duplicate slug: ${n.slug}`);
    slugs.add(n.slug);
    assert.doesNotThrow(() => resolveRule(n.namedayRule, 2027), `rule for ${n.name}`);
  }
});

test('every occasion resolves; only life events may be undated', () => {
  const holidays = readData('holidays.json');
  assert.ok(holidays.length > 0);

  for (const h of holidays) {
    assert.ok(h.title, `title required for ${h.slug}`);
    assert.ok(['holiday', 'nameday', 'life-event'].includes(h.kind), `bad kind: ${h.slug}`);
    if (h.dateRule === null) {
      assert.equal(h.kind, 'life-event', `${h.slug} is undated but not a life event`);
    } else {
      assert.doesNotThrow(() => resolveRule(h.dateRule, 2027), `rule for ${h.slug}`);
    }
  }
});

test('a caveated entry explains itself', () => {
  const names = readData('nameday.json');
  for (const n of names) {
    if (n.confidence !== 'established') {
      assert.ok(n.note && n.note.length > 20, `${n.name} is flagged but has no usable note`);
    }
  }
});

test('resolved calendars agree with the rules they came from', () => {
  const year = 2027;
  const calendar = readData(`calendar-${year}.json`);
  const names = readData('nameday.json');

  assert.equal(calendar.orthodoxEaster, KNOWN_EASTER[year]);

  const indexed = new Map();
  for (const day of calendar.days) {
    for (const nd of day.namedays) indexed.set(nd.slug, day.date);
  }

  for (const n of names) {
    assert.equal(
      indexed.get(n.slug),
      toIsoDate(resolveRule(n.namedayRule, year)),
      `${n.name} is on the wrong day in calendar-${year}.json`,
    );
  }
});

test('ICS output is well-formed', () => {
  for (const file of ['onomastici.ics', 'sarbatori.ics', 'calendar-complet.ics']) {
    const ics = readFileSync(join(ROOT, 'data', file), 'utf8');

    assert.ok(ics.startsWith('BEGIN:VCALENDAR\r\n'), `${file}: missing header`);
    assert.ok(ics.endsWith('END:VCALENDAR\r\n'), `${file}: missing footer`);

    const opens = (ics.match(/BEGIN:VEVENT/g) ?? []).length;
    const closes = (ics.match(/END:VEVENT/g) ?? []).length;
    assert.equal(opens, closes, `${file}: unbalanced VEVENT blocks`);
    assert.ok(opens > 0, `${file}: no events`);

    // RFC 5545 requires CRLF line endings throughout.
    assert.equal(ics.includes('\n') && !/[^\r]\n/.test(ics), true, `${file}: bare LF found`);

    // No content line may exceed 75 octets once folded.
    for (const line of ics.split('\r\n')) {
      assert.ok(
        Buffer.byteLength(line, 'utf8') <= 75,
        `${file}: unfolded line over 75 octets: ${line.slice(0, 40)}…`,
      );
    }

    // UIDs must be unique or clients silently merge events.
    const uids = [...ics.matchAll(/^UID:(.+)$/gm)].map((m) => m[1]);
    assert.equal(new Set(uids).size, uids.length, `${file}: duplicate UIDs`);
  }
});

test('movable name days are not pinned to a fixed RRULE', () => {
  const names = readData('nameday.json');
  const movable = names.filter((n) => isMovable(n.namedayRule));
  assert.ok(movable.length > 0, 'expected at least one movable name day');

  const ics = readFileSync(join(ROOT, 'data', 'onomastici.ics'), 'utf8');
  for (const n of movable) {
    const block = ics
      .split('BEGIN:VEVENT')
      .find((b) => b.includes(`nameday-${n.slug}-`));
    assert.ok(block, `no dated events for movable name ${n.name}`);
    assert.ok(
      !block.includes('RRULE:FREQ=YEARLY'),
      `${n.name} follows Easter but was published as a yearly repeat`,
    );
  }
});
