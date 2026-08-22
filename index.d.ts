/**
 * zile-onomastice — Romanian name days and holidays as open data.
 * Source: https://trends.ro · CC BY 4.0
 */

/** How well-attested a name-day attribution is. See README. */
export type Confidence = 'established' | 'convention' | 'approximate' | 'single-source';

export type Gender = 'm' | 'f' | 'u';

export type OccasionKind = 'holiday' | 'nameday' | 'life-event';

/** A date rule: `'MM-DD'` for a fixed date, `'easter±N'` for a movable feast. */
export type DateRule = string;

export interface NameRecord {
  name: string;
  slug: string;
  namedayRule: DateRule;
  gender: Gender;
  diminutives: string[];
  confidence: Confidence;
  /** Present whenever `confidence` is not `'established'`. */
  note?: string;
}

export interface OccasionRecord {
  slug: string;
  title: string;
  kind: OccasionKind;
  /** `null` only for life events, which are not tied to a calendar date. */
  dateRule: DateRule | null;
}

export interface NameDayResult {
  name: string;
  slug: string;
  rule: DateRule;
  /** `true` when the day follows Orthodox Easter rather than a fixed date. */
  movable: boolean;
  gender: Gender;
  diminutives: string[];
  confidence: Confidence;
  url: string;
  note?: string;
  /** ISO `YYYY-MM-DD`, present only when a year was supplied. */
  date?: string;
}

export interface CelebrationDay {
  date: string;
  namedays: Array<{
    name: string;
    slug: string;
    gender: Gender;
    confidence?: Confidence;
    url?: string;
  }>;
  occasions: Array<{
    title: string;
    slug: string;
    kind: OccasionKind;
    url?: string;
  }>;
}

/** All 86 name records, as published. */
export const names: NameRecord[];

/** All 35 occasion records, as published. */
export const occasions: OccasionRecord[];

/**
 * Looks up a name day by name, slug or diminutive, with or without diacritics.
 * Returns `null` for names not in the dataset.
 */
export function nameDay(name: string, year?: number): NameDayResult | null;

/**
 * Everything celebrated on a date.
 * @param date `'YYYY-MM-DD'`, `'MM-DD'`, or a `Date`
 * @param year required when `date` is `'MM-DD'`; defaults to the current year
 */
export function whoCelebratesOn(date: string | Date, year?: number): CelebrationDay;

/** What Romania celebrates today, evaluated in Europe/Bucharest. */
export function today(): CelebrationDay;

/** Every name day and occasion in `year`, grouped by date and sorted. */
export function calendar(year: number): CelebrationDay[];

/** Orthodox Easter Sunday for `year`, as a Gregorian date. `month` is 1-12. */
export function orthodoxEaster(year: number): { month: number; day: number };

/** Resolves a date rule to a UTC `Date` in `year`. Throws on an invalid rule. */
export function resolveRule(rule: DateRule, year: number): Date;

/** `true` if the rule names a movable feast. */
export function isMovable(rule: DateRule): boolean;

/** Formats a UTC `Date` as `'YYYY-MM-DD'`. */
export function toIsoDate(date: Date): string;
