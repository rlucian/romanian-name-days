// easter.mjs — Orthodox Easter (Paștele ortodox) and movable-feast resolution.
//
// Zero dependencies. Works in Node, Deno, Bun and the browser.
//
// Why this file exists as a separate, documented module: most published
// Romanian calendars hardcode movable feasts year by year, or hardcode the
// Julian->Gregorian gap at 13 days (correct only for 1900-2099). Both go
// wrong eventually. This computes them, and says how.
//
// All arithmetic uses Date.UTC / getUTC*, so results never depend on the
// host machine's timezone.

/**
 * Days the Gregorian calendar runs ahead of the Julian calendar for a given
 * Julian year. General formula, valid indefinitely:
 *
 *     offset = century - floor(century / 4) - 2
 *
 * For 1900-2099 this evaluates to 13, which is why hardcoding 13 appears to
 * work — and why calendars that do it will silently produce wrong dates from
 * 2100 onward.
 *
 * @param {number} year
 * @returns {number} whole days
 */
export function julianToGregorianOffsetDays(year) {
  const century = Math.floor(year / 100);
  return century - Math.floor(century / 4) - 2;
}

/**
 * Orthodox Easter Sunday for `year`, as a Gregorian calendar date — i.e. the
 * date civil calendars report as "Paștele ortodox".
 *
 * Uses the Julian-calendar computus (Meeus's Julian algorithm), then converts
 * the result to the Gregorian calendar.
 *
 * Verified against published dates — see test.mjs. If this function ever
 * disagrees with those, the function is wrong, not the dates.
 *
 * @param {number} year
 * @returns {{ month: number, day: number }} month is 1-12
 */
export function orthodoxEaster(year) {
  const a = year % 4;
  const b = year % 7;
  const c = year % 19;
  const d = (19 * c + 15) % 30;
  const e = (2 * a + 4 * b - d + 34) % 7;
  const julianMonth = Math.floor((d + e + 114) / 31); // 3 = March, 4 = April
  const julianDay = ((d + e + 114) % 31) + 1;

  // Treat the Julian result as a UTC calendar date, then advance by the
  // Julian->Gregorian offset. UTC month rollover handles e.g.
  // "30 March + 13 days -> 12 April" for us.
  const date = new Date(Date.UTC(year, julianMonth - 1, julianDay));
  date.setUTCDate(date.getUTCDate() + julianToGregorianOffsetDays(year));

  return { month: date.getUTCMonth() + 1, day: date.getUTCDate() };
}

const MAX_DAYS_IN_MONTH_LEAP_AWARE = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function daysInMonth(month, year) {
  if (month === 2) return isLeapYear(year) ? 29 : 28;
  return MAX_DAYS_IN_MONTH_LEAP_AWARE[month - 1];
}

/**
 * Resolves a date rule to a concrete Gregorian date in `year`.
 *
 * Two rule forms:
 *   'MM-DD'    fixed date, e.g. '12-25' -> 25 December
 *   'easter±N' N days from Orthodox Easter Sunday, e.g. 'easter-7' -> Florii
 *
 * The 'MM-DD' branch validates the day against the real number of days in
 * that month for `year`, so '02-29' resolves only in leap years and '02-30'
 * throws rather than silently rolling over into March.
 *
 * @param {string} rule
 * @param {number} year
 * @returns {Date} a UTC Date at midnight
 */
export function resolveRule(rule, year) {
  const easterMatch = /^easter([+-]\d+)$/.exec(rule);
  if (easterMatch) {
    const offsetDays = parseInt(easterMatch[1], 10);
    const { month, day } = orthodoxEaster(year);
    const date = new Date(Date.UTC(year, month - 1, day));
    date.setUTCDate(date.getUTCDate() + offsetDays);
    return date;
  }

  const fixedMatch = /^(\d{2})-(\d{2})$/.exec(rule);
  if (!fixedMatch) {
    throw new Error(`Unrecognised date rule: ${JSON.stringify(rule)}`);
  }

  const month = Number(fixedMatch[1]);
  const day = Number(fixedMatch[2]);
  if (month < 1 || month > 12) {
    throw new Error(`Rule ${rule}: month out of range`);
  }
  if (day < 1 || day > daysInMonth(month, year)) {
    throw new Error(`Rule ${rule}: no such day in ${year}`);
  }

  return new Date(Date.UTC(year, month - 1, day));
}

/** `true` if the rule names a movable feast (one that follows Easter). */
export function isMovable(rule) {
  return /^easter[+-]\d+$/.test(rule);
}

/** Formats a UTC Date as 'YYYY-MM-DD'. */
export function toIsoDate(date) {
  return date.toISOString().slice(0, 10);
}
