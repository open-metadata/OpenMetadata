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

**One script, three call sites.** Each audit is a single implementation invoked by the agent hook,
`make ui-checkstyle-changed`, and the `ui-checkstyle` CI job. There is no second copy to drift.

Depth behind the rules lives in `skills/vendor/` — `react-best-practices`, `web-design-guidelines`
and `composition-patterns`, vendored verbatim from
[vercel-labs/agent-skills](https://github.com/vercel-labs/agent-skills) (MIT) so they need no install
step. Skills load only when invoked, which is why the load-bearing subset is distilled into
`.claude/rules/frontend-performance.md` and `.claude/rules/frontend-a11y.md`, which auto-load on
matching files.

**Checkstyle is the enforcement point — not pre-commit.** New gates are deliberately kept out of
`.pre-commit-config.yaml`: every hook there is paid on every single commit, and these audits shell
out to `git diff` and `node`. Committing must stay fast. `ui-checkstyle` is the one place a gate has
to hold, and `make ui-checkstyle-changed` is how you get that answer locally before pushing.

## Run it locally

```bash
make ui-checkstyle-changed     # exactly what CI runs, on just your changed files
```

This is the command to trust — it runs the fixing steps (organize-imports, eslint, prettier, license
headers, i18n sync, app-docs) **and** the three audit gates (`tw-audit`, `tw-guard`, `reuse-audit`).
The gates are collected rather than short-circuited, so one failure does not hide the others.

## What each gate enforces

| Gate | Scope | Fails when |
|---|---|---|
| ESLint + Prettier + organize-imports | changed files | output differs from committed form |
| Licence header | changed files | Apache-2.0 header missing/stale |
| i18n key-sync | all locales | locale files out of sync with `en-us.json` |
| `tw-audit` | changed files | hardcoded Tailwind value that maps to a design token |
| `tw-guard` | **added lines** | new `antd` import or new `.less` file |
| `reuse-audit` | **added lines** | UI hand-rolled from raw elements the component library already exports |
| SonarJS (ESLint) | changed files | one of 16 zero-backlog correctness rules trips |
| SonarCloud gate | **new code** | complexity, duplication, or new issues on lines this PR added |

## Component reuse — what `reuse-audit` flags

No off-the-shelf linter knows this design system, so this is the one bespoke check. It inspects
**added lines only**, so existing hand-rolled UI is untouched and migrates over time.

| Instead of hand-rolling | Import from `@openmetadata/ui-core-components` |
|---|---|
| `<div role="listbox">`, `role="combobox"` | `Select`, `MultiSelect`, `Combobox`, `Autocomplete` |
| `<div role="menu">`, `role="menuitem"` | `Dropdown` |
| `<div role="tablist">`, `role="tab"` | `Tabs` |
| `<div role="dialog">`, `role="alertdialog"` | `Modal` |
| `role="switch"` / `radiogroup` / `progressbar` / `tooltip` | `Toggle` / `RadioButtons` / `ProgressIndicator` / `Tooltip` |
| raw `<button>`, `<input>`, `<select>`, `<textarea>` in `src/components/**` | `Button`, `Input`, `Select`, `Textarea` |
| `onKeyDown` handling `ArrowDown`/`ArrowUp` | `Select` / `Dropdown` / `Tabs` — keyboard nav is built in |
| `createPortal` overlays | `Modal`, `Popover`, `SlideoutMenu` |

Tests, mocks, stories and Playwright specs are out of scope. If a raw element is genuinely required,
put `reuse-audit-ignore` in a comment on that line.

## SonarJS in ESLint — the fast half of Sonar

`eslint-plugin-sonarjs` is the *same engine and the same `Sxxxx` rule ids* as the SonarCloud analysis
that already runs on every UI PR. A finding in your editor is the finding Sonar will report.

Only **16 rules with a measured zero backlog** are enabled, at `error`. ESLint reports per file, not
per added line, so any rule with existing violations would fail PRs for code they merely touched.

Deliberately **not** in ESLint, with their measured backlogs:

```
no-duplicate-string 640   cognitive-complexity 85   no-collapsible-if 21
no-extra-arguments   20   no-redundant-jump    14   no-duplicated-branches 9
no-identical-functions 6  prefer-object-literal 1   no-redundant-boolean 1
```

These belong to SonarCloud, whose Clean-as-You-Code model scopes them to **new lines** — something
ESLint fundamentally cannot express. Promote a rule into `eslint.config.mjs` once its backlog is
cleared.

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

*Reference branch = `main`* for branches; *Previous version* (or 30 days) for `main` itself. Set in
project settings, not on the gate.

### Branch protection

Mark these three required on `main`:

| Required check | Enforces |
|---|---|
| `ui-checkstyle` | lint, prettier, licence, i18n, `tw-audit`, `tw-guard`, `reuse-audit` |
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
