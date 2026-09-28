---
name: openmetadata-pr-review
description: Reviews OpenMetadata and Collate pull requests as a maintainer deciding whether to merge. Use WHENEVER the user asks to review a pull request — any phrasing ("review this PR", "PR review", "can you review #1234", "review my PR", a pasted github.com/open-metadata/OpenMetadata/pull/NN URL, or a batch of PR numbers). Default handler for every PR-review request on OpenMetadata (open-metadata/OpenMetadata, a fork, or a Collate repo). Also use when asked whether a PR should go into a release or backport branch, whether two PRs duplicate each other, or why a PR's CI is failing.
user-invocable: true
argument-hint: "[PR number, PR URL, comma-separated numbers, or nothing to review the current branch's PR]"
---

# OpenMetadata PR Review

Review contributor PRs as a senior maintainer deciding whether to merge. Every verdict is grounded in the **actual diff**, the **linked issue**, and the **live CI/review state** — never the PR title or description alone.

The four things a review must answer (the standing bar):

1. **Does it make sense?** Real problem, correctly diagnosed, root-cause fix not a band-aid, in scope, not a duplicate.
2. **Is the code good?** Correct, follows the repo's patterns and the rules in `.claude/rules/`, no scope creep or accidental damage.
3. **Does it have a test — integration if possible?** New API endpoint → integration test; connector → real/testcontainer test; bug fix → a regression test that fails without the fix.
4. **Is the test meaningful?** See [The meaningful-test rubric](#the-meaningful-test-rubric) — this is where most contributor PRs fail and where a rubber-stamp review is worst.

## When to use

- **Any** request to review a pull request — one PR, a set, "the ToReview ones", "review my PR", a pasted PR URL, or a whole backlog. This is the default handler for PR-review requests, whether the PR is the user's own or a contributor's.
- Triaging a backlog of open contributor PRs.

**Boundary with the `code-review` skill and your harness's diff-review tool.** `code-review` (and `/code-review` on Claude Code) is for **local, not-yet-a-PR changes** — uncommitted work or a branch diff — as a pre-PR self-check. The moment there's an actual PR to look at, by number, URL, or the current branch's open PR, use *this* skill. `/code-review ultra <PR#>` is a separate user-triggered, billed cloud review; you cannot launch it.

**Boundary with `connector-review`.** That skill does a deep single-connector audit against `skills/standards/`. If the PR under review is a connector PR, run this skill for the merge verdict and load `connector-standards` (or delegate to `connector-review`) for the connector-specific detail.

## Usage

```
openmetadata-pr-review 28656          # deep review of one PR
openmetadata-pr-review 27029,27278    # review several (auto-detects duplicates)
openmetadata-pr-review                 # review the current branch's PR
```

**Set the repo once, then use `$REPO` in every command.** Substituting it per call is how a review ends up mixing two repositories.

```bash
REPO=open-metadata/OpenMetadata            # OSS default
REPO=open-metadata/openmetadata-collate    # Collate
REPO=<owner>/<repo>                        # a contributor's fork
```

Pick it from what the user gave you: a PR URL names the repo; a bare number means the repo of the current directory (`gh repo view --json nameWithOwner --jq .nameWithOwner`), falling back to the OSS default. If the working directory is a clone of one repo and the PR lives in another, `$REPO` wins — the PR is the subject, not the checkout.

## Workflow

### Step 0 — Confirm scope and freshness

For a batch, first fetch metadata + **current** open/closed state — contributors and the user close PRs constantly, and reviewing a closed PR wastes a full agent. Use the helper:

```bash
python3 skills/openmetadata-pr-review/scripts/pr_triage.py -R "$REPO" 26965,26977,27020
```

It prints OPEN vs CLOSED/MERGED sorted by `createdAt`. Report which are already closed/merged and drop them before reviewing. Re-run this at the end of a long batch — state drifts during the review.

### Step 1 — Pin the head from remote, before anything else

**Never review from local state.** A contributor can push at any moment, and a local clone or a previously-fetched ref goes stale silently — you will review commits that no longer exist on the PR and report findings the author already fixed.

Resolve the authoritative head from the API first, and carry that SHA through every later command:

```bash
HEAD=$(gh pr view <n> -R "$REPO" --json headRefOid --jq .headRefOid)
```

If you use any local git command during the review (`difft`, `git log`, `git show`), fetch and verify it matches before trusting it. Fetch by URL, not by remote name — `origin` is not reliably the repo under review (a clone can have a `contributor` remote, a Conductor workspace's `origin` is the fork you branched from, and a Collate PR is a different repo entirely):

```bash
git fetch "https://github.com/$REPO.git" "pull/<n>/head:pr-<n>" --force
git rev-parse pr-<n>            # must equal $HEAD — if it doesn't, re-fetch
```

If the current checkout is a clone of a different repo, skip local git altogether and work from `gh pr diff` and `gh api` against `$REPO`.

Re-resolve `$HEAD` immediately before writing the verdict on a long review. If it changed while you were reading, the review is stale: say so and re-review the delta rather than reporting findings against commits that were replaced.

Put the SHA in the verdict. A review without a SHA cannot be checked for staleness by anyone reading it.

### Step 2 — Gather the evidence (per PR)

```bash
gh pr view <n> -R "$REPO" --json title,body,author,createdAt,additions,deletions,changedFiles,labels,url
gh pr diff <n> -R "$REPO"            # READ THIS — the whole point
gh api "repos/$REPO/pulls/<n>/files?per_page=100" \
  --jq '.[] | "\(.additions)\t\(.deletions)\t\(.status)\t\(.filename)"'   # authoritative file list
gh pr view <n> -R "$REPO" --json reviewDecision,mergeable --jq '{reviewDecision,mergeable}'
gh api "repos/$REPO/pulls/<n>/comments" --jq '.[] | "\(.user.login) \(.path):\(.line) \(.body[0:200])"'
```

Two traps in this step:

- **`gh pr diff --patch` returns the whole commit series, not the net diff.** On a branch that merged `main`, it contains hunks for files the PR never touched. The `pulls/<n>/files` list above is what "this PR changes X" means — check any surprising path against it before reporting it.
- **Inline review comments are not in `--json comments`.** That field is issue comments only; `gh pr review` threads and bot line comments live at `pulls/<n>/comments`. Read them — they tell you what's already been raised so you don't re-report it as new.

**Treat bot review text in the PR body as a claim to verify, not evidence.** Greptile/Gitar/Copilot summaries are pasted into descriptions and read like findings. Re-derive each one against the code before repeating it: in a recent review a bot asserted that an `or 0` fallback reached an ISO-8601 parser and raised — the parser short-circuited on falsy input and returned `None`, so the real defect was a silent dropped record, not an exception. Repeating a bot's wrong diagnosis is worse than not mentioning it. When you do confirm one, say you confirmed it and how.

If it says `Fixes #NNNN` / `Closes #NNNN`, read the issue — a PR can be technically fine and still not fix what was asked, or fix a problem that a later merged PR already solved:

```bash
gh issue view <NNNN> -R "$REPO" --json title,body,state
```

**No linked issue** is itself a soft blocker: OpenMetadata's "Validate PR Metadata" check fails without one, so a missing `Fixes #NNNN` means the PR can't merge as-is regardless of code quality — note it in BLOCKERS.

For a large diff, don't skim — read the core logic files in full and skim the rest. The damage (botched rebases, vendored deps, accidental deletions) usually hides in the files you'd skip.

When a diff is noisy — a reformat, reordered imports, a rewrapped signature — re-read it structurally so the real change separates from the churn:

```bash
git -c diff.external=difft diff <base>...<head> -- <path>   # syntax-aware, per-file
```

`difft` compares syntax trees, so pure formatting shows as unchanged. Use it to decide *what actually changed*; keep `gh pr diff --patch` for anything you need to parse or quote, since difftastic's output is for reading, not machine consumption.

**Read the test code in full, unabridged.** Diff viewers and command proxies sometimes compact or truncate long test bodies, and you cannot judge whether a test is meaningful from a truncated body. If the diff looks abbreviated, read the raw diff or the test file at the PR head directly:

```bash
gh pr diff <n> -R "$REPO" --patch          # raw, unified patch
gh api repos/$REPO/contents/<path/to/test_file>?ref=$HEAD --jq '.content' | base64 -d
```

### Step 3 — Judge against this repo's rules

**The rules are in the repo — read them, don't recall them.** `CLAUDE.md` carries the cross-cutting constraints; `.claude/rules/*.md` carry the per-language detail and are the authority when this file and a rule disagree. Open the rule that matches the files the PR touches:

| PR touches | Read |
|---|---|
| `**/*.java` | `.claude/rules/java.md` |
| UI `*.{ts,tsx}` | `.claude/rules/frontend-react.md`, `component-library.md`, `frontend-styling.md`, `frontend-a11y.md`, `frontend-performance.md`, `i18n.md` |
| `openmetadata-ui/src/main/resources/ui/playwright/**` | `.claude/rules/frontend-playwright.md` |
| `ingestion/src/**/*.py` | `.claude/rules/python-ingestion.md` (+ the `connector-standards` skill for connector PRs) |
| `openmetadata-spec/**` or any `generated/**` | `.claude/rules/schema-first.md` |
| `bootstrap/sql/**` | `.claude/rules/migrations.md` |

The high-signal checks, distilled — use these to decide *which* rule to open, not as a replacement for it:

**Makes sense / architecture**
- Root-cause fix, not a band-aid. Targeted, not defensive belt-and-suspenders.
- Extends an established pattern (`docs/design-patterns.md`) rather than inventing a parallel one.
- Connector-specific logic stays in connector files — never in shared `builders.py`, `lineage/parser.py`, `sqa_mixin.py`.
- No new dependency that duplicates existing functionality. A new connector that's really a thin wrapper of an existing one (e.g. Supabase = hosted Postgres) is a scope question, not an automatic yes.
- Doesn't duplicate another open PR (see [Duplicate detection](#duplicate-detection)).
- **Every cache bounded.** A bare `dict`/`HashMap`/`Map` keyed on entities is an OOM red flag on large catalogs — `CLAUDE.md` makes this a hard constraint, so an unbounded cache is a blocker, not a nit.
- **Comments explain why.** A diff full of `// Create user` above `createUser()` is noise the repo explicitly rejects.

**Python** — pytest + plain `assert`, no `unittest.TestCase`; lazy `%`-style logging, never f-strings in `logger.*`; `model_str()` for RootModel→str; Pydantic v2 `Field(default=...)`; `Either(left=StackTraceError)` on topology yields.

**Java** — no wildcard imports; `mvn spotless:apply` clean; small methods, single trailing return, ≤3 nesting; no empty catch, no bare `catch (Exception)`, no magic strings; integration test in `openmetadata-integration-tests/` for any new/changed endpoint.

**TypeScript/React** — no `any`; no new Ant Design (use `openmetadata-ui-core-components`); `tw:` Tailwind prefix and design tokens, no hex; i18n keys, no string literals; generated models regenerated, not hand-edited.

**Cross-layer contract** (a frequent "incomplete" failure)
- Schema change (`openmetadata-spec/`) → `make generate` → generated Python/TS committed and in sync (watch for a red `generate-types` check).
- **A new member in a `oneOf` union has blast radius outside the diff.** Adding a connection type to `databaseService.json`/`pipelineService.json` widens the union every `connection.<field>` access is typed against, so code in *untouched* connectors starts failing type-check (e.g. adding a connection with no `hostPort` breaks `kafkaconnect/metadata.py`'s `connection.hostPort`). Read the static-check errors for files the PR never touched — those are the regression, and they are easy to miss because they're not in the diff.
- New connector → JSON schema + generated models + `setup.py` plugin entry + UI icon wiring (`ServiceIconUtils.ts`) + locale `*.md` doc + tests. Partial = NEEDS_WORK.
- New connection field → `yarn parse-schema`; `"format": "password"` (never `"password": true`) so secrets route through the secrets manager and get masked.
- Migration in `bootstrap/sql/` → append-only, **both** MySQL and PostgreSQL, idempotent, and tested against real multi-row data.

**Guardrails / safety**
- No customer names or data anywhere (code, tests, fixtures, logs). Placeholders only.
- Destructive features (deleting lineage, secrets, entities) must be opt-in, age/precedence-guarded, and covered by a real integration test against MySQL **and** PostgreSQL. Scrutinize the deletion predicate hard.
- No committed secrets, `.orig` merge artifacts, `package-lock.json` in a yarn repo, CRLF conversions, or vendored dependency trees.
- **`.github/workflows/**` changes are a supply-chain surface.** Any workflow edit in a contributor PR gets read line by line — new `pull_request_target` triggers, third-party actions pinned by tag instead of SHA, and secrets exposed to fork-run jobs are blockers.
- **License headers are per-module and only the UI is enforced.** `ingestion/` and `openmetadata-airflow-apis/` Python files carry the Collate Community License header, UI TS/TSX carries Apache-2.0, Java mostly carries none. A wrong Python or Java header ships silently — check it by eye against a sibling file in the same directory.

### Step 4 — Assess the test (integration if possible, and meaningful)

This is the step most reviews skip. Do it explicitly for every PR. See the rubric below. A PR with no test, or a test that only proves the mocks are wired, does **not** clear the bar — say so plainly. For a full coverage analysis on a large PR, the `test-enforcement` skill has the 90%-changed-class procedure.

**On a multi-file PR, map source file → test file before judging quality.** "Has tests" is not a property of a PR, it's a property of each file. List every new/changed source file with its line count, then list which test file exercises it; the ones with nothing pointed at them are the finding. Grep the test files for the source module's symbols rather than trusting the directory layout — a `test_<connector>.py` next to a four-module connector routinely covers two of them. In one connector review this turned "68 tests, all passing" into "the 240-line status module has zero tests and the 656-line lineage module has two constructor tests" — and both untested modules were where the runtime bugs were.

### Step 5 — Verdict + report

Use the verdict scale and per-PR format in [Output](#output). For a batch, add the grouped triage.

Fill every slot of the per-PR contract, in order. The `read:` lines are part of the contract,
not a nicety: each names the artefact you opened *this session* that backs the slot above it.

A slot whose `read:` is `not read` is itself a finding — it tells the user which parts of the
verdict are unbacked. Write that instead of softening the claim with "should", "seems" or
"probably", and instead of inferring from a proxy: the checks summary is not the job log, the
diff's file list is not the test body, and the PR description's claim is not the issue.

## The meaningful-test rubric

A test is meaningful only if a wrong implementation would make it fail. Apply these in order:

1. **Would it fail without the fix?** For a bug fix, the test must reproduce the bug — assert the *broken* output is now correct. If the test passes against unpatched `main`, it proves nothing. When in doubt, mentally (or actually) revert the fix and check the test would go red.
2. **Does it assert an observable outcome?** API response body, DB/search state, emitted lineage edges, computed stats, resolved ORM types, the actual parsed value. NOT `verify(mock).methodWasCalled()` and NOT asserting the return of a method whose collaborators are all mocked.
3. **Mock only at boundaries.** Mocking an external HTTP client or third-party driver is fine. Mocking 3+ of the project's *own* classes to test internal plumbing means the test is testing wiring, not behavior — flag it. `thenCallRealMethod()` on the one method under test with everything else mocked is the classic tell.
4. **Prefer integration.** OpenMetadata has real infra — `OpenMetadataApplicationTest`, Docker/testcontainers, real OpenSearch. For endpoints and connectors, an integration test that exercises the real path beats any amount of mocked unit tests. Note when a PR *could* have used it and didn't. Real-DB integration tests in this repo routinely catch bugs (missing enum cases, NOT-NULL violations on create) that mocked unit tests structurally cannot.
5. **Ask the killer question:** "If this test passes but the code is wrong, does anything break?" If the answer is "no, everything real is mocked out," the test is decoration.

You don't need to check out the branch — reason about whether each assertion would still hold against the *unpatched* code. For a high-stakes or destructive PR where that reasoning is uncertain, it's worth fetching the branch and running just that one test (with and without the fix).

**Telling an integration test from a mocked one in this repo:**
- Java integration test → lives in `openmetadata-integration-tests/`, class ends `*IT`, extends `BaseEntityIT`, uses `SdkClients`/`TestNamespace`, or extends `OpenMetadataApplicationTest`. A `*Test` in `openmetadata-service/` full of `Mockito.mock(...)` + `thenCallRealMethod()` is a unit test, often mock-wiring.
- Python integration test → lives in `ingestion/tests/integration/`, uses `testcontainers` (a real DB/engine spun up), real `OpenMetadata` client calls. A test in `ingestion/tests/unit/` built from `MagicMock`/`patch` with the source object faked is a unit test — fine for pure parsing logic, insufficient for topology/lineage/connection behavior.
- UI → a Jest test that mocks the component's whole data layer proves rendering, not behavior. User-facing changes want a Playwright spec under `openmetadata-ui/src/main/resources/ui/playwright/`; note that some libraries (RAQB, for one) are fully mocked in Jest, so their logic is *only* testable in Playwright.

Common failing patterns seen in the wild: `unittest.TestCase` + `MagicMock` source object with the real method rebound onto it; a `test_x` that builds hand-crafted mock rows and asserts the parser's own branching rather than feeding real SQL through `LineageParser`; a connector test asserting the connector's own (wrong) return types so it stays green while the real topology path is broken; `assertEqual(null, ...)` instead of `assertNull`.

Report the test explicitly per PR: **present + meaningful**, **present but mock-wiring only**, or **missing**.

## Reading CI

`red` is not a verdict — *which job* is red is. Pull the failing job's log before you call it:

```bash
gh pr checks <n> -R "$REPO" | awk -F'\t' '$2!="pass" && $2!="skipping"'   # current state per check
gh api "repos/$REPO/actions/jobs/<job-id>/logs"                          # the one failing job
```

**Use `gh pr checks`, not `--json statusCheckRollup`, to decide what is red.** Any label event (`safe to test`, a team label) fires a second `pull_request_target` batch, so the rollup lists the *same* check name twice — once FAILURE from the old run, once SUCCESS from the new one — and reading it naively inverts the answer. `gh pr checks` reports the current state per check. Related tell: skipped matrix jobs publish their check name with the expression unexpanded (`Integration Test Lane (${{ matrix.lane.name }})`), which is the "required context stuck on Expected" case, not a failure.

Cascade jobs (`py-tests-status`, `Verify Expected Jobs`, `*-summary`) only restate an upstream result — walk to the job that actually failed before quoting anything.

Distinguish four cases, and say which one in the CI slot:
- **red because of this code** — a real blocker.
- **red because stale** — the branch is behind `main` and a since-fixed failure is being replayed. Needs a rebase, not a code change.
- **red on `main` too** — a pre-existing main regression the PR inherited. Not this PR's blocker; worth naming so it isn't misattributed.
- **check never ran / stuck on "Expected"** — a required context that was skipped or renamed. Not a code problem, but it does block merge.

Repo-specific gates worth knowing:

| Check | What it actually gates |
|---|---|
| `Validate PR Metadata` | a linked issue (`Fixes #NNNN`) **and** its Shipping-project fields. Does not re-run on issue edits — needs a push or manual re-run |
| `python / Unit Tests & Static Checks (<ver>)` | ruff **and** basedpyright. Existing violations are grandfathered in `ingestion/.basedpyright/baseline.json`; **any new violation in any file fails**, so a new connector must land type-clean, not baseline-clean |
| `py-checkstyle` | ruff format only — passes even when static-checks is red |
| `ui-checkstyle` | ESLint + Prettier + the Apache-2.0 UI header |
| `Java checkstyle` | spotless |
| `generate-types` | schema ↔ generated model drift |
| `maven-collate-ci` | the private Collate build against this OSS commit. A `cannot find symbol` on an `org.openmetadata.*` class means the branch is behind main, not that the PR broke Collate |
| `harness-integrity` | warnings only — never a blocker |

## Duplicate detection

Contributors pile onto popular issues — you routinely get 2–4 PRs fixing the same thing. Before finalizing:

- Group PRs by their linked issue number and by the file(s) they touch.
- When two+ PRs target the same issue/feature, pull them into a **Duplicates** group and compare head-to-head: which is complete, which has real tests, which has green CI, which the maintainers already engaged with. Recommend one to keep and one to close — and note if the winner should absorb a good piece of the loser (e.g. keep the superset fix, port in the other's safer helper).
- Don't conflate adjacent-but-different work (e.g. cross-database lineage vs materialized-view lineage on the same connector) as duplicates.

## Reviewing many PRs — fan out

For more than ~6 PRs, and only when the active policy permits delegation, dispatch parallel read-only review agents (~7 PRs each) rather than reviewing serially. Give each agent the Step 1–5 instructions and the exact per-PR output format so results collate cleanly. Seed each agent with any duplicate/red-flag hints you already suspect for its batch (e.g. "27278 likely duplicates 27029"; "27628 shows +200/-11795 — check for a botched rebase"). Collate all batches, then do the cross-batch duplicate grouping yourself (agents can't see across batches).

## Output

### Per-PR verdict

```
### PR <number>
VERDICT: MERGE_READY | MINOR_FIXES | NEEDS_WORK | REJECT | UNCLEAR
HEAD: <headRefOid from the API> — re-checked at verdict time: yes | no
SENSE: <1-2 sentences: is the problem real and the approach right?>
QUALITY: <1-2 sentences: code quality + rule adherence>
TEST: present+meaningful | present-but-mock-wiring | missing — <one line: what it does/doesn't prove; integration available?>
  read: <test file:line — or "not read">
CI: green | red-because-of-this-code | red-because-stale-rebase | red-on-main-too | not-checked
  read: <failing job name + log URL — or "not read">
ISSUE: fixes | partial | none-linked
  read: <issue URL — or "not read">
BLOCKERS: <specific blocking issues, or "none">
SIZE: <+adds/-dels, N files>
```

Verdict scale:
- **MERGE_READY** — correct, tests meaningful, CI green (or only stale-rebase red). Merge after a glance.
- **MINOR_FIXES** — sound fix; needs a rebase, small cleanup, license header, or one added test.
- **NEEDS_WORK** — real problem but wrong approach, scope creep, broken/unreachable paths, or a test that proves nothing. Mark ⚠️ if merging as-is would regress production.
- **REJECT** — broken (doesn't compile/parse), misleading (false security/fix claim), destructive without guards, duplicate to close, or unmergeable at the premise (unresolvable dep, obsoleted by a merged PR).
- **UNCLEAR** — genuinely can't tell without info you don't have; say what's missing.

**Draft PRs:** a draft opened to solicit design feedback is not automatically UNCLEAR. Still give a substantive verdict on what's there — if the *approach* is sound but unfinished, NEEDS_WORK; if the approach itself is the open question and it's wrong or risky, say so. Reserve UNCLEAR for when *you* lack information, not for when the author is undecided. Note the draft status and the open design question in SENSE.

### Batch triage (grouped)

After the per-PR blocks, group them (ordered by creation date within each group):

1. **Close to Merge** — MERGE_READY + MINOR_FIXES.
2. **Good but more fixes needed** — NEEDS_WORK. Flag ⚠️ the ones that would regress prod.
3. **Bad** — REJECT.
4. **Duplicates** — every PR in a duplicate cluster, pulled out of 1–3, with a keep/close recommendation per cluster.

End with a tally and a short "closest to merge / highest-value" call-out.

## Notes

- Be decisive. A hedged verdict helps no one — if uncertain, say exactly what would resolve it.
- Cite `file:line` for concrete defects.
- Posting to GitHub (`gh pr review`, `gh pr comment`) is an outward-facing action — only do it if the user explicitly asks. Default output is to the user here.
