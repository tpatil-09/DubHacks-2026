# SafeMatch Background Check

This is a three-agent, public-source research pipeline for SafeMatch. It takes a person's voluntarily supplied search details and produces `output/report.json` in the team's frontend contract (`claude.md` §7), plus a detailed `output/report.full.json`.

```
PersonQuery ─▶ Investigator ─▶ investigator.json ─▶ Verifier ─▶ verifier.json ─▶ Synthesizer ─▶ report.json (+ report.full.json)
              (Claude Code:                         (Claude Code:                 (deterministic build +
               WebSearch/WebFetch)                   WebSearch/WebFetch +          LLM-phrased summaries,
                                                     Python guards + rules)        schema-validated)
```

> **Limitations.** This is a limited, automated review of publicly accessible sources. It is **not** a certified, FCRA-compliant or comprehensive criminal background check. An empty result is **not** proof of a clean record. Every finding needs human review before anyone acts on it.

## How the agents run

Each agent is a **headless Claude Code session** (`claude -p`, a documented CLI interface). It's authenticated with the `CLAUDE_CODE_OAUTH_TOKEN` already in your `.env`, so no Anthropic API key is needed. Each session is locked down:

| Hardening | Flag / mechanism |
|---|---|
| Tool allowlist: research agents get only `WebSearch,WebFetch`; the Synthesizer gets no tools | `--tools`, `--allowedTools`, `--permission-mode dontAsk` |
| No MCP servers, no user/project settings or hooks, no saved session | `--strict-mcp-config`, `--setting-sources ""`, `--no-session-persistence` |
| Structured output | `--json-schema` (inlined from the Pydantic models), re-validated in Python, ≤2 retries |
| Minimal subprocess env (`ANTHROPIC_API_KEY` and every other secret are stripped), empty temp cwd, wall-clock timeout | `ClaudeCLIProvider.build_env()` |

**The LLM never decides the outcome.** Python enforces it:

- **Verifier guards** (`agents/verifier.py`, `apply_guards`, G1–G9) can only *downgrade* the model's judgement. For example, a name-only match can be at most `weak_match`; a source that couldn't be opened, or whose quoted excerpt isn't on the live page, can't be `verified`; recorded contradictions block `verified`; a "dismissed", "acquitted" or "exonerated/vacated" outcome overrides a conviction stage; a different first name alone is never treated as a different person. Every override is logged in `guard_adjustments`.
- **Excerpt grounding**: `SafeFetcher` re-downloads the original page (with SSRF guards) and checks that the quoted excerpt is really there.
- **Safety flags** (`rules/safety_flags.py`, R1–R7) are fully deterministic. See below.
- **Synthesizer**: buckets, statuses, flags, the record tier, the overall status and each finding's `why_unresolved` reason are computed in code. The model only phrases summaries and the TLDR headline, and those are rejected (and replaced by a template) if they add URLs, use labels like "dangerous", call a non-conviction a conviction, call something unverified "verified", or contradict the record tier.

## How the Investigator searches

The Investigator aims for **recall**: its job is to find everything plausibly relevant. The Verifier's job is to decide what holds up. By default a run gets **40 searches and 30 findings** (`scope.max_searches` up to 60, `scope.max_findings` up to 60).

- The seed plan always includes **location-free** queries. The supplied location is where the person lives now, and records are often in other states or across a metro border (for example, Portland, OR and Vancouver, WA).
- It searches for **exculpatory** outcomes (exonerated, wrongful conviction, innocence project, vacated, dismissed, acquitted) as hard as for offenses.
- It **follows leads**: other cities, case numbers and name variants. When records appear under a variant (for example, "VanDyke Perry" for "Xavier Perry"), it runs linking searches to retrieve the source that connects the two names.
- Same-name records are kept for the Verifier, which must run its own linking search before calling a different first name a different person.

## Setup

Requires Python ≥3.9 and the Claude Code CLI (`claude`) on `PATH`.

```bash
cd background_check
python3 -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"          # or: pip install -r requirements.txt
```

### Configuration (`.env`)

Settings are read from the process environment first, then `background_check/.env`, then the repo-root `.env`. Values are whitespace-trimmed. See `.env.example`.

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `CLAUDE_CODE_OAUTH_TOKEN` | live runs | – | from `claude setup-token`; passed only to the local `claude` subprocess |
| `MODEL_PROVIDER` | no | `claude_cli` | `claude_cli` or `mock` |
| `MODEL_NAME` | no | CLI default | e.g. `sonnet`, `opus` |
| `SEARCH_PROVIDER` | no | `none` | `tavily` adds supplementary Tavily leads |
| `TAVILY_API_KEY` | only if tavily | – | |
| `OUTPUT_DIR` | no | `./output` | |
| `AGENT_TIMEOUT_SECONDS` | no | `1200` | per Claude Code session |
| `VERIFY_EXCERPTS_WITH_FETCH` | no | `true` | Python-side excerpt grounding |
| `RECORDS_PROVIDERS` | no | `courtlistener` | official-records APIs to query (`none` to disable) |
| `COURTLISTENER_API_TOKEN` | recommended | – | CourtListener API token (free; 5/min, 50/hour, 125/day) |

No other API keys are needed. **Cost note:** a live run makes 3+ Claude Code sessions (one Investigator, one Verifier per 5 findings, one Synthesizer) with up to ~40 Investigator searches plus up to 40 per Verifier batch. That counts against your Claude plan's usage limits. Observed runs took 3–6 minutes per person.

## Commands

All commands run from `background_check/` with the venv active. Add `--mock` to any agent command to use deterministic fixtures with no network and no model calls. `--scenario PATH` picks the fixture (default: `tests/fixtures/scenarios/demo_mixed.json`).

```bash
# Each agent separately
python -m safematch.cli investigator --query-file test_cases/example.json
python -m safematch.cli verifier     --input output/investigator.json
python -m safematch.cli synthesizer  --input output/verifier.json

# Full pipeline (writes output/investigator.json, verifier.json, report.json, report.full.json)
python -m safematch.cli run --query-file test_cases/example.json [--output-dir DIR] [--report-name NAME.json]
python -m safematch.cli run --mock --query-file test_cases/example.json      # demo report for frontend work

python -m safematch.cli validate-report --input output/report.json        # frontend contract
python -m safematch.cli validate-report --input output/report.full.json   # detailed report
python -m safematch.cli export-schema    # regenerate config/report_schema.json after model changes
```

Exit codes: `0` ok, `1` invalid report, `2` config or input error. A live stage refuses input that a mock stage produced (and the reverse), so fixture evidence can never mix into a real report.

## Tests

```bash
pytest tests/unit -v          # models, config, rules, guards, agents, providers, SSRF
pytest tests/integration -v   # full mocked pipeline + CLI subprocess runs
pytest tests/evaluation -v    # 14 synthetic scenarios with declared expected outcomes + record tiers
pytest -m live -v -s          # LIVE: real Claude Code + web search (opt-in; also RUN_LIVE=1)
pytest                        # everything except live
```

Synthetic scenarios (`tests/fixtures/scenarios/`) cover a verified conviction, a same-name unrelated person, an unverified accusation, a dismissed charge, conflicting sources, no results, an inaccessible registry, a search-provider error, an Investigator agent failure, an exonerated (vacated) conviction, and a mixed demo report used by `--mock`. Several scenarios deliberately make the mock model **over-claim** (for example, "verified" on a name-only match) to prove that the guards hold.

## Records sources (official APIs)

Web search can't reach most official records: state sex-offender registries and county court portals are interactive forms, and the national registry site (NSOPW) has no public developer API. So the pipeline also calls the **CourtListener** API directly, in Python, before the agents run. Each name-matching record becomes a candidate finding of type `official_court_record`, with a link. The Verifier then judges identity and the exact case outcome, as it does for everything else.

| Provider | What it covers | What it doesn't | Setup |
|---|---|---|---|
| **CourtListener** (Free Law Project, REST API v4, free) | Federal and **state appellate opinions** (criminal appeals name the defendant) and federal criminal dockets (PACER/RECAP) | State trial-court cases that were never appealed; sex-offender registries | Free account, then the token at courtlistener.com/profile/api-token goes in `COURTLISTENER_API_TOKEN`. Free accounts allow **5 requests/minute, 50/hour and 125/day**. Each person search uses 2 requests, so roughly 60 people a day. Free Law Project memberships raise the limits. |

How records are handled:
- **Name matching:** a record is kept only if the first and last name appear together ("First [Middle] Last" or "Last, First"). A shared surname in a caption like "Syed v. Lee" isn't enough.
- **Criminal only:** dockets are limited to criminal cases, so bankruptcy and civil filings are dropped. Opinions must be criminal appeals (State/People/Commonwealth/United States captions, or criminal terms in the opinion).
- **Trusted, not assumed:** API records skip the "is the quote on the page" check, because Python fetched them straight from the source. Every identity rule still applies, so an official record with only a name match is never more than a weak match and never raises a flag.
- **Rate limits:** requests are spaced about 12.5 s apart to stay under 5/minute, and a `429` waits for the server's `Retry-After`. If the hourly or daily quota runs out, the search stops and the report says so.
- **Failures:** if the API fails, the report is marked `partial`, never "clear".
- **Registries:** these aren't checked directly. Every report says so and points to nsopw.gov. Paid aggregator APIs (for example Checkr Trust, built for dating apps) could add registry coverage later through the same `RecordsProvider` interface.

## Output files

The pipeline writes two reports. Both are validated before either is written.

| File | Format | Used by |
|---|---|---|
| `report.json` | The team contract from `claude.md` §7, checked by the frontend's zod schema in `web/src/types/safetyReport.ts`, plus `tldr` as the first key (zod ignores extra keys) | The frontend |
| `report.full.json` | The detailed `FinalReport` described below (schema in `config/report_schema.json`) | Audit and debugging, `scripts/build_report_page.py`, the evaluation harness |

`src/safematch/frontend_contract.py` converts one to the other deterministically:

| `report.json` field | Comes from |
|---|---|
| `summary` | `tldr.tier_label` + `tldr.headline` |
| `findings[]` | verified + unresolved findings. Records about other people (identity `mismatch`) and contradicted claims are left out and counted in `limitations`. |
| `findings[].description` | `summary` (for unresolved findings this starts with `why_unresolved`) |
| `findings[].case_status` | record stage: `conviction` / `guilty_plea` only for a conviction stage. A vacated (exonerated) conviction becomes `dismissed` if the charges were dismissed, otherwise `unknown`, and is never `conviction`. A charge whose outcome was dismissal or acquittal becomes `dismissed` / `acquitted`; otherwise `charge_pending`. An allegation becomes `allegation_only`; a registry entry becomes `not_applicable`. |
| `findings[].identity_assessment` | `strong_match` / `possible_match` / `weak_match`; `inconclusive` becomes `unresolved` |
| `findings[].identity_rationale` | `why_unresolved`, or the Verifier's rationale |
| `scope.search_completed` | `false` when the report is `partial` (search or agent failure) |
| `limitations[0]` | the required UI notice from `claude.md` §9 |
| `human_review_required` | always `true` |
| `findings[].evidence_status` / `why_unresolved` / `historical_report_only` | optional extensions used by the SafeMatch UI to split Verified vs Unresolved and lead unresolved cards with the reason |

`python -m safematch.cli validate-report --input <file>` detects which format it was given. Every synthetic scenario and the saved live cases have been parsed with the frontend's real zod schema (`zod@4.6.7`).

## Detailed report format (`report.full.json`)

The authoritative schema is `config/report_schema.json` (JSON Schema 2020-12, generated from `models.FinalReport`). Every detailed report has exactly these top-level keys:

| Key | Contents |
|---|---|
| `tldr` (first) | `record_tier`, `tier_label`, `headline`, `key_points[]` (each cites `finding_ids`), `caveats[]`, `written_by` (see below) |
| `report_metadata` | `report_id`, `schema_version`, `generated_at`, `subject`, `pipeline_mode` (`live`/`mock`), `is_test_fixture`, `disclaimer` |
| `identity_assessment` | `overall_identity_match`, `distinct_individuals_suspected`, counts by match level, notes |
| `verified_records[]` | findings with `evidence_status = verified` |
| `unresolved_findings[]` | `unverified` + `inconclusive` findings |
| `contradicted_findings[]` | disproved claims, including records about a *different* person |
| `case_outcomes[]` | stage/disposition per case (excluding identity mismatches) |
| `source_summary` | sources checked (accessible or not), queries run, search failures |
| `safety_indicators` | `verified_record_flag`, `label`, `indicators[]` (each with `rule_id`, `basis`, `source_url`), `rules_version` |
| `limitations[]` | scope, access failures, disclaimer |
| `overall_status` | `records_require_attention` · `findings_require_review` · `no_relevant_records_found_in_scope` · `partial` · `inconclusive` |

Each finding (`ReportFinding`) contains: `finding_id`, `source_url`, `source_type`, `claim`, `why_unresolved`, `summary`, `evidence_status`, `identity_match`, `record_stage` (allegation/arrest/charge/conviction/registry_entry/dismissed/acquitted/vacated/unknown; `vacated` = conviction vacated, overturned, expunged or exonerated), `offense_category`, `source_reliability`, `historical_report_only`, dates, `jurisdiction`, `case_identifier`, `disposition`, `supporting_urls`, `contradictory_evidence`, `missing_information`, `rationale`. Unknown values are `null`.

### TLDR and record tier

`tldr.record_tier` answers the question "how serious is what we found?". Fixed rules compute it from the records **linked to this person**, meaning findings with a strong or possible identity match that were not contradicted. Records about other people with the same name are excluded. The highest applicable tier wins:

| `record_tier` | Meaning |
|---|---|
| `verified_record_requires_attention` | A safety flag fired: an official, strongly matched, verified serious conviction or current registry entry |
| `reported_conviction_unconfirmed` | A conviction or registration was reported (e.g. by news) but not confirmed on an official record |
| `unresolved_allegations_or_charges` | Allegations, arrests or charges with no confirmed outcome |
| `cleared_outcomes_only` | Accused, charged or convicted, but every matter ended in dismissal, acquittal or a vacated conviction/exoneration |
| `no_linked_records` | Nothing was linked to this person (records about other people may have been excluded) |
| `insufficient_information` | Nothing was linked, but key searches or sources failed |

The tier describes the evidence, not the person, and there is still no risk score.

The model writes `headline` and `key_points` from the tier. Each sentence is checked, and any sentence that fails falls back to a template. A sentence fails the check if it:
- contradicts the tier (for example, says "convicted" without saying the conviction was vacated, under `cleared_outcomes_only`)
- calls something "verified" without a flag
- uses a URL or labels like "dangerous".

`written_by` records which version was used.

**Why a finding is unresolved.** For `unverified` and `inconclusive` findings, `why_unresolved` holds a plain-language reason, for example *"Current official status was not confirmed, and the match is by name only, so it may be a different person."* Python builds it from the Verifier's data (official-source check, source access, excerpt check, missing outcome, conflicts and identity match), so the model can't soften it. It is also the first sentence of `summary`. For verified and contradicted findings it is `null`.

**Frontend guidance:**
- Lead with `tldr.tier_label` and `tldr.headline` as the summary card.
- For unresolved findings, show `why_unresolved` prominently (it is also the first sentence of `summary`).
- Show a banner whenever `report_metadata.is_test_fixture` is true.
- Use the label `"Verified record requiring attention"`, and only when `safety_indicators.verified_record_flag` is true.
- Never treat `no_relevant_records_found_in_scope` as "safe".

The intermediate files `investigator.json` and `verifier.json` keep the full audit trail: provenance, guard adjustments and the reasons rules failed.

## Safety-indicator rules

`verified_record_flag` is true only when **all** of the following hold for a finding:

- **R1:** a high-reliability official court or registry source
- **R2:** a `strong_match` identity
- **R3:** status `verified`
- **R4:** a conviction for a sexual, domestic-violence or other serious violent offense, **or** an official registry entry with a stated current-as-of date
- **R5:** the case outcome was checked
- **R6:** no contradictions
- **R7:** the evidence doesn't come from a fixture (in live runs)

Allegations, arrests, pending charges, dismissals, acquittals, news-only or social-only evidence, and weak or inconclusive identity matches never raise a flag. There is no overall risk score.

## Security & privacy

- **Secrets:** never logged. A log filter scrubs known secret values and `sk-ant-…` / `tvly-…` patterns, and CLI errors are scrubbed too. `.env` is gitignored, and `output/` is gitignored because reports contain personal data.
- **Untrusted content:** all web content is treated as untrusted. Prompts fence data in tagged blocks, and agents have no shell, file or MCP tools, so injected text can't trigger actions.
- **`SafeFetcher` (Python-side retrieval):**
  - allows http(s) on ports 80 and 443 only, with no credentials in URLs
  - resolves DNS and blocks loopback, private, link-local, metadata and multicast addresses
  - re-validates every redirect (at most 5)
  - caps responses at 2 MB with a 15 s timeout, and honours `robots.txt`
- **Excerpts:** at most 500 characters. Prompts tell the agents to omit victim names (they become `[victim]`). No photos are stored, and nothing is published automatically.
- **Known gap:** Claude Code's own WebFetch runs on Anthropic's infrastructure, so the SSRF limits above apply to Python's grounding fetches, not to the agents' browsing. There is also a small DNS-rebinding window between the address check and the connection.

## Live evaluation: Mark Papamechail

`tests/evaluation/test_live_papamechail.py` asserts on *process*, not on a hardcoded outcome:

- a reliable source is found
- stages are preserved
- news is never promoted to current official registry status
- flags appear only for official, strong-match, verified records
- limitations are recorded
- the report is schema-valid

The report is saved to `output/eval/papamechail/` (gitignored).

Results of the most recent run are in [EVALUATION.md](EVALUATION.md).

For a stricter check, `scripts/live_eval.py` runs each stage separately through the CLI on four designed cases: a documented case, a same-name wrong person, an exoneration recall test (the record is in other states and under a name variant) and a negative control. It injects planted false claims before the Verifier and records about 70 pass/fail checks per full run.

```bash
pytest --junitxml=output/eval/pytest_mocked.xml
python scripts/live_eval.py                              # all cases, all stages
python scripts/live_eval.py --cases exoneration           # one case (writes eval_results.<case>.json)
python scripts/live_eval.py --from-stage synthesizer      # re-run only Stage 3 on saved verifier.json
python scripts/build_eval_page.py                        # -> output/eval/eval_report.html (every stage, every check)
python scripts/build_report_page.py --input output/report.full.json --out output/report.html  # readable view of one report
```

## Project layout

```
config/report_schema.json        fixed report contract (generated; checked by a unit test)
src/safematch/
  models.py config.py orchestrator.py cli.py mock_scenarios.py
  frontend_contract.py           FinalReport -> report.json (claude.md section 7 / safetyReport.ts)
  prompts/{investigator,verifier,synthesizer}.md
  providers/llm.py               ClaudeCLIProvider, MockLLMProvider, complete_structured
  providers/search.py            optional TavilySearchProvider, MockSearchProvider
  providers/records.py           CourtListenerProvider, MockRecordsProvider (official records API)
  providers/source_retrieval.py  SafeFetcher (SSRF-safe), FixtureFetcher
  agents/{investigator,verifier,synthesizer}.py
  rules/safety_flags.py          deterministic R1–R7
  utils/{validation,logging_utils}.py
tests/{unit,integration,evaluation,fixtures/scenarios}
test_cases/example.json          placeholder query
scripts/live_eval.py             live stage-by-stage evaluation harness
scripts/build_eval_page.py       evaluation results -> HTML page
scripts/build_report_page.py     report.full.json -> readable HTML page
EVALUATION.md                    results of live evaluation runs
```

## Moving to production

The `claude -p` + OAuth-token approach suits development and a hackathon demo. Shipping it as a backend for real users should move to API-key authentication. To do that, add a provider class that implements `LLMProvider.run(task) -> dict`, for example using the Claude Agent SDK or the Messages API with a server-side web-search tool. Nothing else changes.
