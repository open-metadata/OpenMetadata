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

1. **Linked issue** — `Fixes #<issue-number>` (GitHub auto-links). No issue → open one first.
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
- **Touches `ingestion/src/metadata/ingestion/source/`** → ingestion tests required.
- **>5 files changed, or new feature / refactor / breaking change** → high-level design required.
- **Single-file fix with obvious scope** → small change, design section can be `N/A`.

### Step 2 — Confirm the linked issue

Ask the user for the issue number if not obvious from the branch name or commit messages. Verify it exists:

```bash
gh issue view <issue-number>
```

If no issue exists, stop and ask the user to open one before continuing.

### Step 3 — Gather test evidence

Run the relevant commands and capture output. Don't fabricate coverage numbers — run the tools.

**Backend (Java):**
```bash
mvn test -pl openmetadata-service -Dtest=<ChangedTestClass>
mvn jacoco:report -pl openmetadata-service
# Coverage HTML: openmetadata-service/target/site/jacoco/index.html
```

**Backend integration tests:**
```bash
mvn test -pl openmetadata-integration-tests -Dtest=<NewIT>
```

**Ingestion (Python):**
```bash
source env/bin/activate
cd ingestion
make unit_ingestion_dev_env
python -m pytest tests/unit/<changed_path>/ --cov=metadata.<module> --cov-report=term-missing
```

**Frontend unit tests (Jest):**
```bash
cd openmetadata-ui/src/main/resources/ui
yarn test <ChangedComponent> --coverage
```

**Playwright (UI E2E):**
```bash
cd openmetadata-ui/src/main/resources/ui
yarn playwright:run --grep "<feature name>"
```

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

### Step 7 — Create or update the PR

**New PR** (use a HEREDOC so formatting survives):
```bash
gh pr create --base main --title "Fixes #<issue>: <short title>" --body "$(cat <<'EOF'
<filled-in template here>
EOF
)"
```

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

- [ ] Linked issue exists and is referenced as `Fixes #N`
- [ ] PR title matches `Fixes <issue-number>: <short explanation>`
- [ ] At least one "Type of change" box is checked
- [ ] Large PR has a high-level design section filled in (not `N/A`)
- [ ] Tests section lists actual files and coverage numbers (not placeholders)
- [ ] UI changes have a screen recording attached or marked as TODO with the PR opened as draft
- [ ] Manual test steps are concrete and reproducible
- [ ] Cross-layer checks for the change type pass (`make generate`, `mvn spotless:apply`, `yarn lint`, etc.)

## Common Gaps to Watch For

- Schema change without `make generate` → models out of sync
- Backend API change without integration test in `openmetadata-integration-tests/`
- New UI feature without Playwright spec
- Bug fix without a regression test that fails before the fix
- Large refactor with `N/A` in the design section — push back and ask for the design
- Coverage % copy-pasted from another PR — re-run the tool
