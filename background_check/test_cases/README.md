# Test cases

`example.json` is a **placeholder** query ("Jane Example"). It is not a real person. Use it to exercise the CLI.

A query file is a `PersonQuery`:

| field | required | notes |
|---|---|---|
| `full_name` | yes | first + last name |
| `middle_name` | no | name or initial |
| `location` | no | city/state the person **volunteered** |
| `jurisdictions` | no | e.g. `["King County, WA"]` |
| `age_min`, `age_max` | no | an age range (18–120); no DOB needed |
| `other_identifiers` | no | other legitimate disambiguators |
| `scope` | no | `max_searches` (1–60, default 40), `max_findings` (1–60, default 30), `source_types`, `offense_categories`, `include_public_social_media` |

Unknown fields are rejected. In particular, there's no date of birth and no home address.

Synthetic scenario fixtures (for `--mock --scenario ...` and tests) live in `../tests/fixtures/scenarios/`. They use reserved `.example` domains and invented names.

The live Mark Papamechail evaluation query lives only in `tests/evaluation/test_live_papamechail.py`. It is never part of default configuration.
