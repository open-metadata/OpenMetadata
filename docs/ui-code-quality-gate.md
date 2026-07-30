# UI code-quality gate

How frontend quality is enforced on every `openmetadata-ui` PR, and what you must configure in
SonarCloud and branch protection to complete it.

The governing rule: **new code must be clean; existing debt is fixed gradually.** Every gate below is
scoped to what a change *adds*, never to the whole file or the whole repo, so the backlog can never
block a PR.

## The two sides

Almost all new UI code is AI-generated, so a check that only runs in CI arrives too late — the model
already chose the wrong pattern. Every rule therefore exists twice.

| | Generation-time (agent is writing) | Review-time (CI) |
|---|---|---|
| **Knowledge** | `.claude/rules/*.md`, auto-loaded by `paths:` glob | — |
| **Enforcement** | `.claude/settings.json` hooks | `ui-checkstyle` job |
| **Self-serve** | `make ui-checkstyle-changed` | required status check |

**One toolchain, three call sites.** The same ESLint config runs in the agent hook, in
`make ui-checkstyle-changed`, and in the `ui-checkstyle` CI job. Prefer an off-the-shelf ESLint plugin
over a bespoke script: a plugin matches the AST rather than diff text, gives live editor feedback,
and composes with `--fix` and `eslint-disable`. Reach for a script only when a rule genuinely cannot
be expressed in ESLint — `tw-guard` qualifies, because its antd/`.less` backlog (864 and 449 files)
makes added-lines-only scoping unavoidable.

Depth behind the rules lives in `skills/vendor/` — `react-best-practices`, `web-design-guidelines`
and `composition-patterns`, vendored verbatim from
[vercel-labs/agent-skills](https://github.com/vercel-labs/agent-skills) (MIT) so they need no install
step. Skills load only when invoked, which is why the load-bearing subset is distilled into
`.claude/rules/frontend-performance.md` and `.claude/rules/frontend-a11y.md`, which auto-load on
matching files.

**Checkstyle is the enforcement point — not pre-commit.** New gates are deliberately kept out of
`.pre-commit-config.yaml`: every hook there is paid on every single commit. Committing must stay
fast. `ui-checkstyle` is the one place a gate has
to hold, and `make ui-checkstyle-changed` is how you get that answer locally before pushing.

## Run it locally

```bash
make ui-checkstyle-changed     # exactly what CI runs, on just your changed files
```

This is the command to trust — it runs the fixing steps (organize-imports, eslint, prettier, license
headers, i18n sync, app-docs) **and** the audit gates (`tw-audit`, `tw-guard`).
The gates are collected rather than short-circuited, so one failure does not hide the others.

## What each gate enforces

| Gate | Scope | Fails when |
|---|---|---|
| ESLint + Prettier + organize-imports | changed files | output differs from committed form |
| Licence header | changed files | Apache-2.0 header missing/stale |
| i18n key-sync | all locales | locale files out of sync with `en-us.json` |
| `tw-audit` | changed files | hardcoded Tailwind value that maps to a design token |
| `tw-guard` | **added lines** | new `antd` import or new `.less` file |
| `jsx-a11y` (ESLint) | changed files | one of 19 zero-backlog accessibility rules trips |
| SonarJS (ESLint) | changed files | one of 16 zero-backlog correctness rules trips |
| SonarCloud gate | **new code** | complexity, duplication, or new issues on lines this PR added |

## Component reuse — guidance, not a gate

`.claude/rules/component-library.md` carries the table of what to import instead of hand-rolling
(`Select` rather than `<div role="listbox">`, and so on). **No linter knows this design system**, so
that table is guidance and review, not an automated check.

A bespoke `reuse-audit` script was built for this and then removed. It reimplemented, badly, what
ESLint already does well: matching regexes against raw diff lines produced false positives on
`data-role=`, on `[role="menu"]` selectors and inside comments, and its hand-rolled git handling
could report "clean" when the diff had failed to load. Its one real advantage — inspecting only
added lines — existed to tolerate a backlog of **16** instances, small enough not to justify ~430
lines of bespoke code and its own test suite.

What CI enforces instead is that a hand-rolled widget must at least be *accessible*: `jsx-a11y`
rejects an invalid `role`, a role missing its required `aria-*` props, and an unusable tab order.
Using the library component is the easy way to satisfy that.

## Two severity tiers, chosen by measurement

Every rule is on. Severity is decided by the rule's **measured backlog**, never by taste, because
ESLint reports per *file* rather than per added line — an `error` rule with existing violations
would fail PRs for code they merely touched.

| Tier | Meaning | Today |
|---|---|---|
| `error` | zero measured backlog — blocking | 16 SonarJS + 19 jsx-a11y |
| `warn` | has a backlog — visible in the editor and CI output, not blocking | 21 SonarJS, 15 jsx-a11y, 4 React, `react-hooks/exhaustive-deps`, `i18next/no-literal-string`, `@typescript-eslint/no-non-null-assertion` |

Repo-wide today: **0 errors, 8935 warnings** across 3846 files. The warnings *are* the backlog, made
visible instead of hidden — the target is zero, reached rule by rule.

`i18next/no-literal-string` was disabled with a `TODO: re-enable when the plugin supports ESLint 9`.
That incompatibility no longer reproduces; it runs fine and reports a large backlog, so it is back on
at `warn`. The repo convention is no user-facing string literals, so it should reach `error`.

**Rules deliberately still off**, and why:

- `react/jsx-no-useless-fragment` — auto-fixes, so at any severity `eslint --fix` rewrites files and
  hard-fails the git-diff check. Land a one-time repo-wide autofix commit, then add it at `error`.
- `sonarjs/file-header`, `arrow-function-convention`, `shorthand-property-grouping`,
  `elseif-without-else` and similar — stylistic, and they conflict with Prettier and the repo's
  existing conventions. Turning them on would add thousands of warnings nobody intends to fix, which
  devalues every other warning.
- `sonarjs/no-reference-error`, `no-implicit-dependencies` — need resolver/global configuration this
  config does not supply; without it they are almost entirely false positives.

**Promotion path:** clear a rule's backlog, re-measure, move it to `error`. The counts live in
`eslint.config.mjs` next to each rule so the next person can see what it costs.

> **Before adding any rule to the `warn` tier, check whether it auto-fixes.** `ui-checkstyle` runs
> `eslint --fix` and fails on the resulting git diff, so an auto-fixing rule at `warn` would silently
> rewrite files and hard-fail the gate. Every current `warn` rule reports `fixable: none` or
> suggestions-only. `react-hooks/exhaustive-deps` declares `fixable: 'code'` but was verified
> empirically not to rewrite a dependency array under `--fix` — which matters twice over, since
> auto-adding an effect dependency changes runtime behaviour.

## SonarJS in ESLint — the fast half of Sonar

`eslint-plugin-sonarjs` is the *same engine and the same `Sxxxx` rule ids* as the SonarCloud analysis
that already runs on every UI PR. A finding in your editor is the finding Sonar will report.

The high-backlog SonarJS rules are also enforced *blockingly* by SonarCloud, whose Clean-as-You-Code
model scopes them to **new lines** — something ESLint fundamentally cannot express. So
`cognitive-complexity` and `no-duplicate-string` warn locally and block on new code in the PR gate.

`eslint-plugin-sonarjs` is pinned **exactly** (`4.2.0`). SonarCloud upgrades its analyzer server-side
on its own schedule and that drift is silent.

## The Sonar lens in your editor — SonarQube for IDE

This is the third place the same rules appear, and the only one that shows the *server's* profile
verbatim rather than a local approximation.

1. Install **SonarQube for IDE** (formerly SonarLint) — available for VS Code, IntelliJ, and others.
2. Bind the workspace in **Connected Mode** to SonarCloud, organization `open-metadata`, project
   `open-metadata-ui`.
3. Connected Mode pulls the project's quality profile, so the editor flags exactly what the PR gate
   will flag — including the high-backlog rules ESLint holds back, marked against new code.

Without Connected Mode the plugin uses its own defaults and will disagree with CI. Bind it, or rely
on `make ui-checkstyle-changed`.

## SonarCloud configuration (admin — must be done once)

Project `open-metadata-ui`, organization `open-metadata`, scanned by `.github/workflows/yarn-coverage.yml`.

### Quality profile

Create a custom profile whose active rules mirror the set enabled in `eslint.config.mjs`, and set rule
parameters explicitly on both sides — do not rely on two defaults agreeing (`cognitive-complexity`
threshold 15 in both places).

### Quality gate — conditions on New Code ONLY

Gate name: **OpenMetadata UI — Clean as You Code**. Set it as the project's default gate.

| Condition (New Code) | Operator | Value |
|---|---|---|
| Coverage | is less than | **90.0%** |
| Issues | is greater than | **0** |
| Security Hotspots Reviewed | is less than | **100%** |
| Duplicated Lines (%) | is greater than | **3.0%** |
| *any condition on Overall Code* | — | **none** |

**Never attach a condition to Overall Code.** It would fail on legacy debt from day one and break the
entire "new code only" contract. Every condition above is evaluated solely against the lines a PR
adds or modifies.

> **90% coverage on new code is the strictest condition here** — above Sonar way's default of 80%,
> and the UI currently has no coverage floor at all (`jest.config.js` sets `collectCoverageFrom` but
> no `coverageThreshold`). Expect this to be the condition that fails most PRs at first: any new
> component, hook or util needs tests landing in the same PR. That is the intent — new code is held
> to a standard the backlog is not — but it is a real change in what "done" means for a UI PR, and
> teams should hear it before the gate turns on rather than from a red check.
>
> Two mechanical consequences worth knowing:
> - A PR that only **moves or reformats** code can still register those lines as new and uncovered.
> - Coverage comes from `sonar.typescript.lcov.reportPaths` (`src/test/unit/coverage/lcov.info`), so
>   if the Jest run fails or the lcov is missing, new-code coverage reads as 0% and the gate fails.
>   Fix the test run, not the gate.

### New Code definition

Set in the repo: `sonar.newCode.referenceBranch=main` in `sonar-project.properties`. For `main`
itself, use *Previous version* (or 30 days) in project settings.

### What can and cannot live in `sonar-project.properties`

A recurring question. The split is *analysis config in the repo, gate policy on the server*:

| In `sonar-project.properties` | Only in SonarCloud |
|---|---|
| `sonar.qualitygate.wait` / `.timeout` | the gate's **conditions**, incl. Coverage ≥ 90% |
| `sonar.newCode.referenceBranch` | which gate is assigned to the project |
| `sonar.sources`, `.exclusions`, `.coverage.exclusions` | the quality **profile** (active rules) |
| `sonar.typescript.lcov.reportPaths` | |

There is **no `sonar.qualitygate.coverage` property** — thresholds cannot be version-controlled in
Sonar. If you want a coverage number that lives in the repo and fails locally, that is
`coverageThreshold` in `jest.config.js`, which the UI does not set today. It measures overall or
per-glob coverage rather than new-code coverage, so it complements the Sonar gate rather than
replacing it.

**`sonar.coverage.exclusions` is the lever that decides whether 90% is reachable.** It is unset
today, so everything analysed counts in the denominator — including ~440 `*.interface.ts`, ~97 files
under `src/constants/`, and ~30 barrel `index.ts`, none of which carry meaningful executable
behaviour. Excluding them makes the 90% measure real code; leaving them in makes the target harder
for reasons unrelated to test quality. Decide deliberately — it is a policy choice, not a default.

### Branch protection

Mark these three required on `main`:

| Required check | Enforces |
|---|---|
| `ui-checkstyle` | lint (incl. SonarJS + jsx-a11y), prettier, licence, i18n, `tw-audit`, `tw-guard` |
| `ui-coverage` | Jest run completed |
| **`ui-sonar-gate`** | the Clean-as-You-Code quality gate, incl. 90% coverage on new code |

Mark **`ui-sonar-gate`**, **not** SonarCloud's own check. The scan is gated behind
`dorny/paths-filter` and the `safe to test` label, so a PR with no UI changes never produces that
check and would block forever waiting on it. `ui-sonar-gate` always runs and passes when the scan
was legitimately skipped.

The gate result comes from the scanner itself: the PR scan passes `-Dsonar.qualitygate.wait=true`
(timeout 600s), so SonarCloud decides and the scanner exits non-zero on failure. `ui-sonar-gate`
turns that outcome into the check contributors see. This is the supported mechanism — do not
reintroduce polling of `/api/qualitygates/project_status`, which races the asynchronous report
processing and silently passes when it times out.

## Two behaviours to expect

**Modified lines count as new code.** Editing a line in a messy legacy file pulls that line's issues
into gate scope. This is the mechanism that retires debt gradually — you clean what you touch — but
it reads as "the gate failed on code I didn't write". It isn't; the line is in your diff.

**New-code attribution needs confirming once.** The PR scan passes `-Dsonar.scm.disabled=true`
(the push scan does not). New code for a PR comes from the `sonar.pullrequest.*` parameters, so this
is probably fine — but on the first gated PR, check that Sonar's **New Code** tab shows only the diff
and not whole files. If it shows whole files, drop that flag from the PR scan step.

## Tracking the backlog

The gate is blind to old code by design, so it will never tell you whether debt is shrinking. Track
`sqale_index`, `code_smells` and `duplicated_lines_density` on *overall* code monthly:

```
GET https://sonarcloud.io/api/measures/search_history
    ?component=open-metadata-ui&metrics=cognitive_complexity,duplicated_lines_density,code_smells,sqale_index,ncloc
```

Expectation: flat or falling on a growing `ncloc`. Two consecutive months climbing is the signal to
schedule targeted cleanup — Clean as You Code only retires debt where people happen to edit.
