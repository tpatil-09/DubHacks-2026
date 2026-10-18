# Live evaluation: Mark Papamechail (2026-10-17)

The test is `pytest -m live tests/evaluation/test_live_papamechail.py -s`. Its query is the name plus the location "Massachusetts", with no age supplied. Reports are written to `output/eval/papamechail/`, which is gitignored. Both runs used real Claude Code sessions (WebSearch/WebFetch) with the OAuth token, and no mocks.

## Results

| | Run 1 | Run 2 (after G4 fix) |
|---|---|---|
| Test result | passed (4m17s, including the smoke test) | passed (5m36s) |
| ProPublica investigation found | yes | yes |
| Other sources | CBS Boston, Salem News | + NECN and other outlets (7 sources, 3 inaccessible) |
| Candidate findings | 8 | 9 |
| Verified / unresolved / contradicted | 0 / 8 / 0 | 0 / 9 / 0 |
| Identity | all `possible_match` (name + MA) | all `possible_match` |
| Flag raised | no | no |
| `overall_status` | `findings_require_review` | `partial` (the Verifier reported a failed registry search) |
| Massachusetts registry | recorded as `record_requires_formal_request` | recorded as `record_requires_formal_request` and `search_failed` |
| Excerpts confirmed on the live page by Python | 7 of 8 (one page could not be fetched) | 8 of 9 |

## What went right

- **Found the non-obvious source.** Both runs located the ProPublica investigation along with local reporting on later cases.
- **Kept stages distinct.** Findings were labeled separately as charge, dismissed (prosecution dropped), acquitted (jury verdict) and registry_entry. No allegation was promoted to a conviction.
- **Kept historical reporting separate from current status.** Registry claims came only from news, so they are marked `historical_report_only` and stay unverified. No current registry match was fabricated, and the system recorded that Massachusetts SORB data requires a formal request.
- **No flag without official evidence.** Every finding failed R1 (no official court or registry source could be opened) and R2 (no strong identity match without an age or other identifier). That is the correct result given what is publicly retrievable.
- **Honest failures.** The paywalled or blocked Salem News and NECN pages appear as `fetch_failed`, and the finding built from a search snippet is labeled `secondary_source`.

## Bug the live run found (fixed)

In run 1, the Verifier's outcome text for a multi-case claim read roughly "convicted twice … acquitted in one case". Guard G4 saw "acquitted" and relabeled the whole finding as `acquitted`, which **understated documented convictions**.

G4 now sets the stage to `unknown` when the outcome text mixes convictions with other outcomes, and adds a "needs to be split by case" note. Two regression tests were added. In run 2 the guard fired three times, and no conviction claim was mislabeled.

## Remaining weaknesses

1. **Multi-case claims.** The Investigator sometimes bundles several cases into one claim ("convicted twice and acquitted once"). After the fix these become stage `unknown`, which is safe but loses detail. The historical convictions then aren't shown as `historical_report_only` convictions. Next step: tell the Investigator to emit one finding per case, then re-test.
2. **No official corroboration.** Massachusetts court and SORB records were not retrievable by public web search, so nothing could reach `verified`. This is expected, and it is why a real launch needs licensed court-record or registry data (for example, NSOPW or state SORB requests). That access also brings FCRA obligations.
3. **Conservative verification of reputable news.** The Verifier left every ProPublica claim `unverified` rather than `verified` with `possible_match`. That is acceptable, since nothing flags either way, but it means reputable reporting appears under "unresolved".
4. **Non-determinism.** Two runs produced different source sets (4 vs 7) and different overall statuses (`findings_require_review` vs `partial`). The tests assert on process for this reason, not on exact outputs.

---

# Stage-by-stage live evaluation (`scripts/live_eval.py`)

Each stage runs **separately through the CLI** against three designed cases. Two planted false claims are injected between the Investigator and the Verifier. To reproduce:

```bash
pytest --junitxml=output/eval/pytest_mocked.xml
python scripts/live_eval.py                         # all stages, ~5–6 min
python scripts/live_eval.py --from-stage synthesizer  # re-run only Stage 3 on saved verifier.json
python scripts/build_eval_page.py                   # -> output/eval/eval_report.html
```

## Latest result: 51/52 live checks, 101 mocked tests passed

| Case | What it tests | Result |
|---|---|---|
| Documented (Mark Papamechail, MA) | Finds ProPublica, keeps stages distinct, catches planted claims | 21/22. Both planted claims were caught (`contradicted`), and Python confirmed neither quote is on the ProPublica page. |
| Same name, wrong person (AZ, age 22–26) | Identity matching | 16/16. All 7 records were `mismatch` → contradicted, with no flag. |
| Negative control (invented name) | No fabrication | 14/14. 0 findings, status `inconclusive` because the Idaho registry and court portals couldn't be queried. |

## Problems found and fixed in this round
- The summary filter banned the word "guilty", so correct "found not guilty" summaries were rejected. Fixed (only judgements like "is guilty" are banned now), with a regression test.
- The Verifier's `case_outcome` sometimes summarized other cases. The prompt now scopes it to the one case.
- My negative-control check wrongly required a "clean" status. When registry or court portals can't be queried, `inconclusive` is the correct answer, so I changed the check.

## Still failing (real)
- **V7, bundled claims:** even with "one finding per case" in the prompt, 2 of 9 Investigator claims still bundled several cases. The G4 guard catches them and marks them `unknown`, which is safe but loses detail.

---

# Exoneration recall case (`live_eval.py --cases exoneration`)

This case was added after a run missed a Washington Innocence Project page. That page documents a 1992 New York wrongful conviction (exonerated in 2018) and vacated 2008 Washington registration convictions for a Portland, OR resident whose records appear under a name variant.

- **Why it was missed:** every query was tied to the supplied location, the plan had no exoneration terms, and the page is titled with the name variant.
- **Fix:** the plan now includes location-free and exculpatory queries, follow-up searches on name variants, and a 40-search default budget. The Verifier must run a linking search before treating a different first name as a different person. A new `vacated` record stage was added.
- **First re-run:** 19/19 checks passed, but the result was wrong. The page linking the two names wasn't retrieved, so the Verifier marked every record as a different person. I added check V7 ("exoneration linked to the subject") and fixed the identity rules.
- **Second re-run: 20/20.**
  - The linking page was found, and the exoneration records are a strong or possible match at stage `vacated`.
  - A same-name 28-year-old from Rhode Island is a `mismatch`.
  - No flag was raised, and the TLDR tier is `cleared_outcomes_only`.

---

# Official records API (CourtListener)

**Live CourtListener check** (`pytest -m live -k courtlistener`, no token): a search for a widely reported Maryland appellate case returned 3 distinct official opinions (Syed v. State, 2018; State v. Syed, 2019; Syed v. Lee, 2024), each with a courtlistener.com link. The live test only checks that the integration returns parseable official records.

**Live end-to-end run** (same public case):
- **Records pipeline:** the 3 CourtListener records entered as `official_court_record` findings (`from_records_api`). The agents built on them and found 13 more sources, 16 findings in total.
- **Report:** validates against the frontend contract and lists its coverage: CourtListener searched, registries not checked (with a pointer to nsopw.gov).
- **Status was `partial`:** the federal-docket query hit CourtListener's rate limit. A token alone doesn't fix this, because the default for authenticated accounts is also 5 requests/minute (plus 50/hour and 125/day). The provider now spaces requests about 12.5 s apart and honours `Retry-After`. With the token, two back-to-back person searches completed with no throttling errors.
- **Civil filings:** federal dockets are now kept only with a criminal docket number (`-cr-`). Before this, a civil forfeiture case captioned "United States v. …" slipped through.
- **Bug found and fixed:**
  - The outcome history read "vacated 2022, **reinstated** on appeal 2023, sentence reduced 2025", so the conviction stands.
  - Guard G4 relabelled these findings "vacated" because the outcome text mentioned a vacatur, which overstated the person's position. The Verifier had correctly said "conviction".
  - G4 now leaves the stage alone when the outcome also reports a reinstatement, and adds a note to confirm the current status. Regression test added.
- **No flag:** identity stayed at `possible_match` (name and city), so no flag fired, as intended.

**Synthetic scenarios added:**

| Scenario | Expected result |
|---|---|
| Official conviction with a strong identity match | flag |
| Official record, name-only match | no flag |
| Records API outage | `partial` |

**Official opinion text via the API.** CourtListener's web pages return HTTP 202 to automated fetches, so the agents couldn't read them, and API findings stayed `unverified`. The provider now fetches each opinion's text from `/api/rest/v4/opinions/{id}/`. The id is the opinion id from the search hit; the page URL holds the *cluster* id, and using that one returned unrelated cases. A live run for the same Maryland case retrieved full text for all 3 opinions (status `retrieved`, 0 errors). The extracted passages included the 2000 guilty verdicts, the post-conviction grant of a new trial, and the 2024 holding on the vacatur and nolle prosequi. These are passed to the Verifier as `official_text_passages`.
