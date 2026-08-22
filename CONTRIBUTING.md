# Contributing

**Corrections are the most valuable contribution to this repository.** A name
day we have wrong, or a name we're missing, is worth more than any code change.

## Reporting a wrong or missing name day

Open an issue with three things:

1. **The name** — as it is spelled in Romanian, with diacritics.
2. **The date** — or the rule, if it follows Easter.
3. **A source** — a published calendar, a parish listing, a reference work.
   "Everyone knows" is genuinely useful as context, but we can't cite it.

## When sources disagree

**We would rather record the disagreement than pick a winner.** If one source
says 2 December and another says 7 January, say so in the issue and quote both.
The entry gets a `confidence` value and a `note` explaining the split.

This is the part of the dataset that makes it citable. Every other Romanian
calendar silently resolves these conflicts, which is why none of them can be
checked.

## Editing the data

Only two files are hand-edited:

- `data/nameday.json`
- `data/holidays.json`

**Everything else is generated.** Don't edit the CSV, the `calendar-YYYY.json`
files or the `.ics` files — your changes will be overwritten by the next build.

After editing:

```bash
node build.mjs --from 2026 --to 2035
node --test test.mjs api.test.mjs
```

Commit the regenerated files together with the source edit, so the repository is
always internally consistent.

### Rules the build enforces

- A `confidence` other than `established` **must** have a `note`. A caveat you
  can't interpret is worse than no caveat, so this fails the build.
- `confidence` must be one of `established`, `convention`, `approximate`,
  `single-source`. Adding a value means documenting it in the README.
- Date rules must be `MM-DD` or `easter±N`, and must resolve. `02-30` fails
  rather than rolling into March.
- Slugs must be unique and ASCII.
- An occasion may only have a null date if its `kind` is `life-event`.

## Adding a name

```json
{
  "name": "Casian",
  "slug": "casian",
  "namedayRule": "02-29",
  "gender": "m",
  "diminutives": [],
  "confidence": "established"
}
```

Keep the file sorted by `slug` — the export does this automatically upstream,
and a sorted file keeps diffs readable.

## Code changes

`easter.mjs` is the one file where correctness is load-bearing for everything
else. If you change it, the test suite must still pass unmodified — the
published Easter dates in `test.mjs` are the specification, not the
implementation's output. If the computus disagrees with them, the computus is
wrong.
