---
license: cc-by-4.0
language:
  - ro
pretty_name: Romanian Name Days and Holidays (Zile onomastice)
size_categories:
  - n<1K
tags:
  - romania
  - romanian
  - calendar
  - name-days
  - onomastica
  - holidays
  - orthodox
  - cultural-heritage
  - knowledge-base
task_categories:
  - question-answering
  - table-question-answering
configs:
  - config_name: namedays
    data_files: data/nameday.csv
    default: true
  - config_name: holidays
    data_files: data/holidays.csv
---

# Romanian Name Days and Holidays

**Zile onomastice și sărbători românești** — the Romanian name-day calendar as
structured data.

In Romania, *ziua onomastică* — the feast day of the saint whose name you bear —
is widely celebrated, often more than a birthday. Until now this information
existed online only as HTML pages built for human readers. This is the
machine-readable version.

Published by **[trends.ro](https://trends.ro)**.

## Dataset summary

| | |
|---|---|
| Names | 86 (46 masculine, 40 feminine) |
| Diminutives | 127 |
| Occasions | 35 (15 holidays, 17 saints' feasts, 3 life events) |
| Movable feasts | 5 holidays and 4 name days follow Orthodox Easter |
| Language | Romanian (`ro`) |
| Licence | CC BY 4.0 |

## Why this dataset is unusual

**Movable feasts are computed, not hardcoded.** Four name days — Florentina,
Florin, Viorel, Viorica — fall on *Florii* (Palm Sunday), which moves by over a
month across years. Dates are stored as rules (`easter-7`) and resolved with the
Julian computus, so the dataset is correct for any year rather than for the year
it was compiled. The Julian→Gregorian offset is computed rather than fixed at 13
days, which is only correct through 2099.

**Uncertainty is recorded, not hidden.** Romanian name-day attribution is not
uniformly settled and sources disagree. Rather than silently picking a date,
each record carries a `confidence` value, and anything not `established`
carries a note explaining why:

| `confidence` | Count | Meaning |
|---|---|---|
| `established` | 63 | Direct, well-attested saint's feast |
| `convention` | 21 | Attached to a root name by Romanian practice — e.g. *Adriana* → Sf. Adrian și Natalia |
| `approximate` | 1 | The real feast does not fit the date grammar |
| `single-source` | 1 | Found in one source only |

Filter on `confidence == "established"` when you need certainty. That is what
the field is for.

## Fields

### `namedays`

| Field | Type | Description |
|---|---|---|
| `name` | string | Romanian given name, with diacritics |
| `slug` | string | ASCII, URL-safe, stable key |
| `rule` | string | `MM-DD`, or `easter±N` days from Orthodox Easter |
| `movable` | bool | Whether the rule follows Easter |
| `gender` | string | `m`, `f`, `u` |
| `diminutives` | string | Semicolon-separated familiar forms |
| `confidence` | string | See table above |
| `note` | string | Explanation; always present when `confidence != established` |

### `holidays`

| Field | Type | Description |
|---|---|---|
| `slug` | string | Stable key |
| `title` | string | Romanian name of the occasion |
| `kind` | string | `holiday`, `nameday`, or `life-event` |
| `rule` | string | `MM-DD` or `easter±N`; empty for life events |
| `movable` | bool | Whether the rule follows Easter |

Life events (birthday, wedding, condolences) have no date by definition — they
attach to a person, not to the calendar.

## Usage

```python
from datasets import load_dataset

namedays = load_dataset("radool/romanian-name-days", "namedays", split="train")
print(namedays.filter(lambda r: r["name"] == "Maria")[0])
# {'name': 'Maria', 'slug': 'maria', 'rule': '08-15', 'movable': False, ...}

# Only well-attested attributions
certain = namedays.filter(lambda r: r["confidence"] == "established")
```

Resolving a movable rule needs the Orthodox Easter date for the target year.
The reference implementation is `easter.mjs` in the
[GitHub repository](https://github.com/rlucian/romanian-name-days), which also
ships pre-resolved calendars for 2026–2035 and `.ics` calendar feeds.

### Other formats

The CSVs here are the ML-friendly view. The same data is also published as:

- **[GitHub](https://github.com/rlucian/romanian-name-days)** — canonical JSON,
  CSV and `.ics`, plus the build and its tests
- **[`zile-onomastice`](https://www.npmjs.com/package/zile-onomastice)** on npm
  — typed, zero dependencies, with the Easter computus and date resolution
  built in

## Provenance

Feast dates follow the calendar of the **Romanian Orthodox Church**
([calendar.patriarhia.ro](https://calendar.patriarhia.ro/)). Attribution of
given names to those feasts, the diminutives, the gender field and the
`convention` judgements are editorial work done for
[trends.ro](https://trends.ro), cross-checked against Romanian calendar sources
with disagreements recorded rather than resolved.

Dates are Gregorian, matching Romanian civil usage.

## Limitations

- **86 names is common usage, not exhaustive.** Rarer Romanian names, and
  regional or minority-language names, are not covered.
- **Orthodox-centred.** Romanian Greek-Catholic and Roman Catholic calendars
  differ on some dates; this dataset follows the Orthodox calendar, which is
  the majority practice.
- **Not a liturgical reference.** It records which names people celebrate on
  which day, not the full synaxarion.

## Licence and citation

CC BY 4.0 — commercial use, modification and redistribution are all permitted.
Training, fine-tuning, retrieval and evaluation are expressly permitted.
Attribution is the only condition.

> Source: [trends.ro](https://trends.ro) — Zile onomastice și sărbători
> românești, CC BY 4.0

This licence covers **this dataset only**. Poems and other content on trends.ro
are community-authored works under their authors' rights and are not included.

## Contributing

Corrections are the most valuable contribution. Open an issue on
[GitHub](https://github.com/rlucian/romanian-name-days/issues) with the name, the
date, and a source. Where sources disagree we prefer to add a note over picking
a winner.
