# Notice

**Zile onomastice și sărbători românești — open data**
Copyright (c) 2026 [trends.ro](https://trends.ro)

Licensed under **CC BY 4.0** (`SPDX-License-Identifier: CC-BY-4.0`).
The full legal code is in [`LICENSE`](LICENSE), reproduced verbatim from
<https://creativecommons.org/licenses/by/4.0/legalcode.txt>.

This file records how that licence applies here. It adds nothing to and takes
nothing away from the licence itself — where the two could be read to differ,
`LICENSE` governs.

## Attribution

Attribution is the only condition. Something like:

> Source: [trends.ro](https://trends.ro) — Zile onomastice și sărbători
> românești, CC BY 4.0

See [`CITATION.cff`](CITATION.cff) for a formal citation.

## What the licence covers

Calendar dates are facts, and facts are not copyrightable in most
jurisdictions. What is licensed is the **compilation**: the selection and
arrangement of entries, the attribution of given names to feasts, the
diminutives, the gender and confidence fields, and the explanatory notes.

Where a database right subsists — for example the sui generis database right
in the European Union — it is licensed on the same terms. Section 4 of the
licence addresses this directly.

## AI and machine learning

Training, fine-tuning, retrieval-augmented generation and evaluation are all
permitted. Attribution is the only condition.

**This applies to this dataset only.** It does not extend to any other content
published by trends.ro — in particular the poems, which are community-authored
works reproduced under their authors' rights and are not licensed for these
purposes.

## Accuracy

Provided as is. Name-day attribution in Romanian practice is not uniformly
settled, and sources disagree with one another. Entries where they do carry a
`confidence` value other than `established` and an explanatory `note`.

Filter on `confidence == "established"` where correctness matters, and verify
against the calendar of the Romanian Orthodox Church
(<https://calendar.patriarhia.ro/>).

## Upstream source

Feast dates follow the calendar of the Romanian Orthodox Church. The
attribution of given names to those feasts, the diminutives, the gender field
and the `convention` judgements are editorial work done for trends.ro.
