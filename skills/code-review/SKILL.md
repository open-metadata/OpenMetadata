---
name: code-review
description: Use to review code changes with a two-stage process - first checking spec/requirements compliance, then code quality. Works on staged changes, branches, or PRs.
user-invocable: true
argument-hint: "[branch name, PR number, or file paths]"
---

# Code Review for OpenMetadata

Two-stage review process: requirements compliance first, then code quality.

## When to Use

- Before creating a PR
- Reviewing someone else's PR
- Self-checking your own changes before requesting review

## Usage

```
/code-review                    # Review uncommitted changes
/code-review feature-branch     # Review branch diff against main
/code-review #1234              # Review GitHub PR
/code-review path/to/file.java  # Review specific files
```

## Stage 1: Spec Compliance Review

Verify the changes do what they're supposed to do — no more, no less.

### Steps

1. **Understand the goal.** Read the PR description, issue, or ask the user what the change is supposed to accomplish.
2. **Read all changed files.** Use `git diff` to see the full scope:
   ```bash
   git diff main...HEAD          # Branch diff
   git diff --staged             # Staged changes
   gh pr diff <number>           # PR diff
   ```
3. **Check completeness against requirements:**
   - Does every stated requirement have a corresponding code change?
   - Are there missing pieces? (e.g., backend change without migration, API change without UI update)
4. **Check for scope creep:**
   - Are there changes unrelated to the stated goal?
   - Was code "improved" that didn't need to change?
5. **Check the cross-layer contract:**
   - Schema change (`openmetadata-spec/`) + model regeneration (`make generate`)
   - Backend API change + frontend API client update
   - New entity field + database migration (`bootstrap/sql/`)
   - New connection config + `yarn parse-schema` for UI forms

### Report Format (Stage 1)

```
## Spec Compliance: [PASS / FAIL / PARTIAL]

### Requirements Met
- [x] Requirement A — implemented in file.java:42
- [ ] Requirement B — MISSING: no migration for new field

### Scope Issues
- file.java:100-120 — unrelated refactor, consider separate PR

### Cross-Layer Gaps
- Schema updated but `make generate` not run (models out of sync)
```

**If Stage 1 fails, stop here.** Fix compliance issues before reviewing quality.

## Stage 2: Code Quality Review

Now review the implementation quality.

### Checklist

**Architecture:**
- [ ] Follows existing patterns in the module (check similar implementations)
- [ ] No new dependencies that duplicate existing functionality
- [ ] Connector-specific logic stays in connector-specific files (not in shared `builders.py`)

**Java:**
- [ ] No wildcard imports (`import java.util.*`)
- [ ] No unnecessary comments on obvious code
- [ ] `mvn spotless:apply` has been run
- [ ] Integration tests for new API endpoints (in `openmetadata-integration-tests/`)
- [ ] Proper error handling with meaningful messages

**Python:**
- [ ] pytest style (plain `assert`, no `unittest.TestCase`)
- [ ] Type hints on public functions
- [ ] `make py_format && make lint` passes
- [ ] Pydantic 2.x patterns (not v1 compatibility layer)

**TypeScript/React:**
- [ ] No `any` types — use proper types or `unknown` with type guards
- [ ] No MUI imports — use `openmetadata-ui-core-components`
- [ ] Tailwind classes use `tw:` prefix
- [ ] Strings use i18n (`t('label.xxx')`) not string literals
- [ ] CSS custom properties for colors/spacing, no hardcoded values
- [ ] Loading states and error handling with `showErrorToast`/`showSuccessToast`

**Testing (use `/test-enforcement` for full analysis):**
- [ ] 90% line coverage on changed Java classes
- [ ] Integration tests for new/changed API endpoints
- [ ] Jest tests for new/changed React components
- [ ] Playwright E2E tests for new user-facing features
- [ ] Tests verify behavior, not implementation

**Security:**
- [ ] No hardcoded secrets or credentials
- [ ] User input validated at system boundaries
- [ ] No SQL injection vectors (parameterized queries)
- [ ] No XSS vectors in frontend (proper escaping)

### Report Format (Stage 2)

```
## Code Quality: [GOOD / NEEDS WORK / SIGNIFICANT ISSUES]

### Issues (must fix)
- file.java:42 — wildcard import, use specific imports
- Component.tsx:15 — `any` type, use `EntityReference` from generated types

### Suggestions (nice to have)
- connector.py:80 — could use `yield from` instead of loop

### Positive Notes
- Good test coverage for the new endpoint
- Follows existing pagination pattern correctly
```

## Reviewing GitHub PRs

When reviewing a GitHub PR by number:

```bash
# Get PR details
gh pr view <number>

# Get the diff
gh pr diff <number>

# Get review comments
gh api repos/{owner}/{repo}/pulls/<number>/comments

# Check CI status
gh pr checks <number>
```

After review, optionally post findings:
```bash
gh pr review <number> --comment --body "Review findings..."
```
