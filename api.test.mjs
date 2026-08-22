#!/usr/bin/env node
// api.test.mjs — the published package surface.
// test.mjs covers the data and the computus; this covers what consumers call.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  nameDay,
  whoCelebratesOn,
  today,
  calendar,
  names,
  occasions,
  orthodoxEaster,
} from './index.mjs';

test('nameDay finds a name by its canonical form', () => {
  const maria = nameDay('Maria');
  assert.equal(maria.name, 'Maria');
  assert.equal(maria.rule, '08-15');
  assert.equal(maria.movable, false);
  assert.equal(maria.gender, 'f');
  assert.equal(maria.url, 'https://trends.ro/onomastica/maria');
});

test('nameDay is diacritic- and case-insensitive, and accepts slugs', () => {
  const canonical = nameDay('Maria');
  for (const variant of ['maria', 'MARIA', '  Maria  ', 'maria']) {
    assert.equal(nameDay(variant)?.slug, canonical.slug, `variant: ${variant}`);
  }
  // Ștefan / Stefan — the diacritic is optional in everyday typing, and the
  // legacy cedilla form Ştefan must fold to the same record too.
  const stefan = nameDay('Ștefan');
  if (stefan) {
    assert.equal(nameDay('Stefan')?.slug, stefan.slug);
    assert.equal(nameDay('Ştefan')?.slug, stefan.slug, 'cedilla form');
  }
});

test('nameDay resolves diminutives to the full name', () => {
  // Mărioara is listed as a diminutive of Maria.
  assert.equal(nameDay('Mărioara')?.slug, 'maria');
  assert.equal(nameDay('Marioara')?.slug, 'maria');
});

test('a diminutive never shadows a real name', () => {
  // "Oana" is a name in its own right AND a short form of Ioana. The record
  // returned must be Oana's own, not Ioana's.
  const oana = nameDay('Oana');
  assert.equal(oana?.slug, 'oana');
  // Same for Ana, which is listed as a name and appears inside other forms.
  assert.equal(nameDay('Ana')?.slug, 'ana');
});

test('nameDay returns null for an unknown name rather than guessing', () => {
  assert.equal(nameDay('Xyzzy'), null);
  assert.equal(nameDay(''), null);
});

test('nameDay resolves a concrete date when given a year', () => {
  assert.equal(nameDay('Maria', 2027).date, '2027-08-15');
  // Florin follows Florii, which moves. 2027 Easter is 2 May, so Florii is 25 April.
  const florin = nameDay('Florin', 2027);
  assert.equal(florin.movable, true);
  assert.equal(florin.date, '2027-04-25');
  // …and a different date the next year, which is the whole point.
  assert.notEqual(nameDay('Florin', 2028).date, florin.date);
});

test('a caveated name exposes its note to the consumer', () => {
  const flagged = names.find((n) => n.confidence !== 'established');
  const result = nameDay(flagged.name);
  assert.notEqual(result.confidence, 'established');
  assert.ok(result.note, 'note must reach the consumer, not just the raw file');
});

test('whoCelebratesOn accepts all three date forms', () => {
  const iso = whoCelebratesOn('2027-08-15');
  assert.equal(iso.date, '2027-08-15');
  assert.ok(iso.namedays.some((n) => n.slug === 'maria'));

  const short = whoCelebratesOn('08-15', 2027);
  assert.deepEqual(short, iso);

  const asDate = whoCelebratesOn(new Date(Date.UTC(2027, 7, 15)));
  assert.deepEqual(asDate, iso);

  assert.throws(() => whoCelebratesOn('15 august 2027'), TypeError);
});

test('whoCelebratesOn surfaces movable feasts on the right day', () => {
  const easter2027 = whoCelebratesOn('2027-05-02');
  assert.ok(
    easter2027.occasions.some((o) => o.slug === 'paste'),
    'Paște should fall on 2027-05-02',
  );

  const florii2027 = whoCelebratesOn('2027-04-25');
  assert.ok(florii2027.occasions.some((o) => o.slug === 'florii'));
  assert.ok(florii2027.namedays.some((n) => n.slug === 'florin'));
});

test('whoCelebratesOn returns empty lists for an ordinary day', () => {
  // A date with nothing attached must return empty arrays, never null/undefined,
  // so callers can map over the result unconditionally.
  const quiet = whoCelebratesOn('2027-02-05');
  assert.ok(Array.isArray(quiet.namedays));
  assert.ok(Array.isArray(quiet.occasions));
});

test('undated life events never appear on a calendar day', () => {
  const undated = occasions.filter((o) => o.dateRule === null).map((o) => o.slug);
  assert.ok(undated.length > 0);

  for (const day of calendar(2027)) {
    for (const occasion of day.occasions) {
      assert.ok(
        !undated.includes(occasion.slug),
        `${occasion.slug} has no date but appeared on ${day.date}`,
      );
    }
  }
});

test('calendar(year) covers every dated record exactly once', () => {
  const days = calendar(2027);

  const namedayCount = days.reduce((sum, d) => sum + d.namedays.length, 0);
  assert.equal(namedayCount, names.length, 'every name appears exactly once');

  const occasionCount = days.reduce((sum, d) => sum + d.occasions.length, 0);
  const dated = occasions.filter((o) => o.dateRule !== null).length;
  assert.equal(occasionCount, dated);

  // Sorted ascending, no duplicate dates.
  const dates = days.map((d) => d.date);
  assert.deepEqual(dates, [...dates].sort());
  assert.equal(new Set(dates).size, dates.length);
});

test('calendar tracks Easter across years', () => {
  for (const year of [2027, 2028, 2029]) {
    const { month, day } = orthodoxEaster(year);
    const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const easterDay = calendar(year).find((d) => d.date === iso);
    assert.ok(easterDay, `no calendar entry on Easter ${year}`);
    assert.ok(easterDay.occasions.some((o) => o.slug === 'paste'));
  }
});

test('today() works and is shaped like any other day', () => {
  const result = today();
  assert.match(result.date, /^\d{4}-\d{2}-\d{2}$/);
  assert.ok(Array.isArray(result.namedays));
  assert.ok(Array.isArray(result.occasions));
});
