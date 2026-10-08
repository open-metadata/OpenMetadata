---
name: pr-checklist
description: Use when opening or finalizing a GitHub PR for OpenMetadata. Walks through the repo PR template — linked issue, high-level design (for big PRs), unit/integration/Playwright tests + coverage, UI screen recording, and manual test steps — then drafts a fully-filled PR body and (optionally) creates the PR.
user-invocable: true
argument-hint: "[branch name or PR number — defaults to current branch]"
---

# PR Checklist for OpenMetadata

Walks through `.github/pull_request_template.md` section by section, gathers evidence, and produces a fully-filled PR description before creating the PR.

## When to Use

- Before running `gh pr create`
- After finishing implementation, before requesting review
- Updating the description of an existing PR that's missing required sections

## Usage

```
/pr-checklist                    # Walk template for current branch vs origin/main
/pr-checklist feature-branch     # Same, for a different branch
/pr-checklist 12345              # Update description of an existing PR
```

## Required Sections (from `.github/pull_request_template.md`)

Every PR must address each section below. Skip with an explicit "Not applicable — <reason>" rather than leaving blank.

1. **Linked issue** — `Fixes #<issue-number>` (GitHub auto-links). No issue → open one first. A test fix needs none (see Step 2).
2. **Type of change** — exactly one box checked.
3. **High-level design** — required for large PRs (new features, refactors, breaking changes, >5 files); skip for small bug fixes.
4. **Tests** — use cases covered, unit tests + coverage %, backend integration tests, ingestion integration tests, Playwright (UI) tests, manual test steps.
5. **UI screen recording / screenshots** — required for any UI change.
6. **Checklist** — every box either checked or explicitly N/A.

## Step-by-Step Workflow

### Step 1 — Inspect the change

```bash
git status
git diff origin/main...HEAD --stat
git log origin/main..HEAD --oneline
```

Use the diff to classify the PR:
- **Touches `openmetadata-ui/src/main/resources/ui/`** → UI change (recording required).
- **Touches `openmetadata-service/`** + new/changed REST endpoints → backend integration tests required.
- **Touches Java, a JSON schema, an index mapping, `bootstrap/sql/`, seed data or a pom** → the
  impacted Java tests must pass locally (Step 3). PR CI runs only the unit tests.
- **Touches `ingestion/src/metadata/ingestion/source/`** → ingestion tests required.
- **>5 files changed, or new feature / refactor / breaking change** → high-level design required.
- **Single-file fix with obvious scope** → small change, design section can be `N/A`.

### Step 2 — Confirm the linked issue

Ask the user for the issue number if not obvious from the branch name or commit messages. Verify it exists:

```bash
gh issue view <issue-number>
```

If no issue exists, stop and ask the user to open one before continuing.

**Exception: a test fix needs no issue.** Don't file an issue for a PR whose purpose is to fix a failing or flaky test. That holds even when the fix lands in the code the test caught rather than in the test itself. For such a PR:

- Replace the template's `Fixes #<issue-number>` line with the test it fixes, e.g. `Fixes the ChartResourceIT.test_bulkCreateOrUpdate_mixedCreateAndUpdate flake`.
- Give it a descriptive title with no issue number.
- Add the `skip-pr-checks` label. "Validate PR Metadata" fails any PR without a linked issue, and this label is the only thing that skips it.

### Step 3 — Gather test evidence

Run the relevant commands and capture output. Don't fabricate coverage numbers — run the tools.

**Backend (Java) — unit and integration tests:** PR checks run only the Java unit tests. The
integration tests run **only in the merge queue**, and JavaUIIT/search-it run nightly. So run the
tests the diff impacts locally with the `java-affected-tests` skill:
```bash
make java_affected                          # impacted unit tests + ITs, by bucket, with the commands
make java_affected_run                      # run them; writes target/java-tests/local-pr-results.md
make java_affected_run ARGS="--update-pr"   # once the PR exists: upsert the block in the PR body
```
Before the PR exists, paste `target/java-tests/local-pr-results.md` between the
`local-java-test-results` markers under "Backend integration tests". Resolve every impact-map gap
and every "no unit test references" class the planner lists (the skill says how). Coverage on
changed classes:
```bash
mvn jacoco:report -pl openmetadata-service
# Coverage HTML: openmetadata-service/target/site/jacoco/index.html
```

**Ingestion (Python):** PR checks run only the unit tests (`py-tests` → "Unit Tests & Static
Checks"); `tests/integration/` runs **only in the merge queue**. So if the diff touches `ingestion/`,
you MUST run every unit and integration test that covers a changed file locally before opening the PR.
An integration break you skip here first shows up as a merge-queue ejection.

List those tests: the changed test files, plus every test that imports a changed `src/metadata` module:
```bash
cd ingestion
changed=$(git diff --name-only --diff-filter=d origin/main...HEAD -- . | sed 's|^ingestion/||')
{
  grep -E '^tests/(unit|integration)/.*test_[^/]*\.py$' <<<"$changed"
  for f in $(grep -E '^src/metadata/.*\.py$' <<<"$changed"); do
    mod=$(sed -E 's|^src/||; s|/__init__\.py$||; s|\.py$||; s|/|.|g' <<<"$f")
    grep -rlE --include='*.py' "${mod//./\\.}([^a-zA-Z0-9_]|$)" tests/unit tests/integration
  done
} | sort -u > /tmp/affected-tests.txt
```
This finds `from metadata.x.y import z`. It misses `from metadata.x import y`, so also add the
connector's `tests/integration/<connector>/` directory when you change a connector.

Run them. Integration tests need a local server (`./docker/run_local_docker.sh -m no-ui -i false`) and Docker, for testcontainers:
```bash
source ../env/bin/activate
grep '^tests/unit/' /tmp/affected-tests.txt | xargs -r python -m pytest -n auto --cov=metadata --cov-report=term-missing
grep '^tests/integration/' /tmp/affected-tests.txt | xargs -r python -m pytest
```
Put the commands you ran and their pass/fail counts in the PR body, under "Unit tests" and
"Ingestion integration tests". If the list is very large (you changed a shared module like
`metadata/utils/`), run the full unit suite with `nox --no-venv -s unit-tests`. Then run the
integration directories for the connectors you touched, and say in the PR body that you ran a subset.

**Frontend unit tests (Jest):**
```bash
cd openmetadata-ui/src/main/resources/ui
yarn test <ChangedComponent> --coverage
```

**Playwright (UI E2E):** PR checks run only a targeted subset (smoke, changed specs and
impact-mapped specs; never the full suite, and nothing for fork PRs), and the merge queue runs the
full suite. So run the impact-mapped specs locally and record the results in the PR body:
```bash
make playwright_affected                          # specs selected from .github/playwright/impact-map.json
make playwright_affected_run ARGS="--update-pr"   # run them; writes the results block into the PR body
```
Without `gh`, paste `playwright/output/local-pr-results.md` between the
`local-playwright-results` markers under "Playwright (UI) tests".

For each, note the actual coverage % and test file paths in the PR body.

> Tip: hand off the heavy lifting — `/test-enforcement` produces the same evidence and enforces 90% coverage on changed classes. Run it first if the user hasn't already.

### Step 4 — Collect manual test steps

Ask the user (or recall from the conversation): "What did you do by hand to verify this works?" List concrete, reproducible steps:
- Stack started (`./docker/run_local_docker.sh -m ui -d mysql`)
- Login user / role
- Click path through the UI
- Sample input + observed output
- Negative-path check (error case, permission denial)

### Step 5 — UI screen recording (UI changes only)

If the PR touches the UI, the recording is **required**. Tell the user:
- macOS built-in: `Cmd+Shift+5` → "Record Selected Portion"
- Save as `.mov`, drag-and-drop into the PR description (GitHub uploads it inline)
- Include before/after screenshots for visual changes (toolbar, layout, color)

If the user can't attach the recording yet, mark the section `TODO: attach recording` and don't open the PR until it's added — or open as draft.

### Step 6 — Draft the PR body

Fill in `.github/pull_request_template.md` with everything gathered above. Show the user the full draft for review before creating.

- **List every test run locally.** CI on the PR no longer runs the integration tests and runs only a
  targeted Playwright subset, so the description is the only record of what ran before review. The Java block names each class
  it ran with its counts, and gives a module run in full as counts. Under the other Tests sections, list everything else you ran — pytest
  files, Jest specs, Playwright specs, manual checks — with pass/fail counts, and say what you did
  not run and why.
- **Link the counterpart PR.** When the change needs an openmetadata-collate (or
  openmetadata-nightly) PR too, link each PR from the other's description; each lists the tests run
  in its own repo.

### Step 7 — Create or update the PR

**New PR** (use a HEREDOC so formatting survives):
```bash
gh pr create --base main --title "Fixes #<issue>: <short title>" --body "$(cat <<'EOF'
<filled-in template here>
EOF
)"
```

**New test-fix PR** (no issue): use a descriptive title and add `--label skip-pr-checks`.

**Update existing PR**:
```bash
gh pr edit <number> --body "$(cat <<'EOF'
<filled-in template here>
EOF
)"
```

Return the PR URL when done.

## Quality Gates Before Creating the PR

Refuse to open the PR if any of these are missing — surface them to the user instead:

- [ ] Linked issue exists and is referenced as `Fixes #N`, or the PR is a test fix labelled `skip-pr-checks`
- [ ] PR title matches `Fixes <issue-number>: <short explanation>` (a test fix gets a descriptive title instead)
- [ ] At least one "Type of change" box is checked
- [ ] Large PR has a high-level design section filled in (not `N/A`)
- [ ] Tests section lists actual files and coverage numbers (not placeholders)
- [ ] The description lists every test run locally (the Java block's classes plus every other suite
      run), and links the counterpart Collate PR when there is one
- [ ] UI changes have a screen recording attached or marked as TODO with the PR opened as draft
- [ ] Java / schema / migration / pom changes: the `local-java-test-results` block reads PASSED (or
      NOT NEEDED) for the current commit — a FAILED block or no block means draft, not ready
- [ ] Manual test steps are concrete and reproducible
- [ ] `ingestion/` changes: affected unit **and** integration tests were run locally (Step 3), with results in the PR body
- [ ] Cross-layer checks for the change type pass (`make generate`, `mvn spotless:apply`, `yarn lint`, etc.)

## Common Gaps to Watch For

- Schema change without `make generate` → models out of sync
- Backend API change without integration test in `openmetadata-integration-tests/`
- Integration tests "covered by CI": PR CI no longer runs them; the merge queue is their first run
- New UI feature without Playwright spec
- Bug fix without a regression test that fails before the fix
- Large refactor with `N/A` in the design section — push back and ask for the design
- Coverage % copy-pasted from another PR — re-run the tool
