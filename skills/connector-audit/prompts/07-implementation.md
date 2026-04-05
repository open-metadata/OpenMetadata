# Prompt 7: Implementation

Execute the refactor plan — implement fixes, write tests, and prepare the PR.

Supports `--dry-run` mode: produce a detailed plan (before/after diffs, tests, risk flags, commit messages) without writing code.

---

**Context:** Read `.claude/connector-audit.json` for the connector name, service type, and source path. Use these for [CONNECTOR_NAME] and [SERVICE_TYPE] throughout.

## Mode Selection

- **Default (no flag)**: Implement the fixes — write code, run tests, create commits.
- **`--dry-run`**: Produce a detailed implementation plan only — exact before/after code diffs, complete test code, risk flags with mitigations, and commit messages. Do NOT write any code or create commits. Save the plan to `.claude/audit-results/07-dry-run-implementation.md`.

Read the implementation plan from `.claude/audit-results/06-refactor-plan.md`.

**Follow the refactor plan's PR structure and work item ordering exactly.** If you disagree with the plan's approach for a specific item, explain why before changing it. If you **drop** an optional item from the plan, note the omission and explain why.

Load the connector standards with /connector-standards, then follow the workflow below.

## Implementation Workflow

### Before Starting

1. **Verify you're in a worktree**: Check `git branch` — you should be on `task/[connector]-reliability`
2. **Run existing tests**: Run the connector's existing tests BEFORE making any changes to establish a baseline:
   `cd ingestion && python -m pytest tests/unit/[relevant_test_files] -v`
3. **Note any pre-existing failures**: Don't fix unrelated test failures in this PR

### For Each Fix (in priority order)

**Priority 1: ❌ Gaps** (broken or missing functionality)
**Priority 2: ⚠️ Partial** (improvements to existing functionality)

For each item in the implementation plan:
1. **Explain** the change before making it — what you're changing, why, and what the expected behavior is
2. **Implement** the change — keep it minimal and focused
3. **Separate concerns**: Bug fixes and refactors go in separate commits, even if they touch the same file
4. **Test**: Write **complete, runnable test code** for any behavioral change — no placeholder comments or pseudocode. Use pytest style (plain `assert`, no TestCase). Include imports, fixtures, and assertions.
5. **Lint**: Run `make py_format` and `make lint` in the ingestion directory after changes

### Commit Strategy

- **One logical change per commit** — don't bundle unrelated fixes
- **Commit message format**: `fix([connector]): [what]` or `refactor([connector]): [what]`
- **Shared code changes get their own commits**: If you modify `common_db_source.py` or `builders.py`, that's a separate commit from connector-specific changes

### Multi-Connector Fixes

If a fix applies to multiple connectors (e.g., a pattern found in the shared base class):
- Fix it ONCE in the shared code for this connector's PR
- Note which other connectors benefit from the shared fix
- Note which other connectors need connector-specific follow-up
- Do NOT fix other connectors in this PR — each connector gets its own PR

### After Implementation

1. **Run full test suite** for this connector:
   `cd ingestion && python -m pytest tests/unit/[relevant_test_files] -v`
2. **Run linter and formatter**:
   `cd ingestion && make py_format && make lint`
3. **Verify no regressions**: Compare test results with the baseline from before your changes
4. **Propose rating updates**: List which standard ratings would change based on post-fix state (e.g., which standards move from ⚠️ to ✅), with justification for each change.

## What NOT to Do

- Do NOT change code that is working correctly just to match a style preference
- Do NOT add comments to code you didn't change
- Do NOT refactor code unrelated to the findings
- Do NOT fix issues in other connectors in this PR
- Do NOT skip tests — if you can't test a change, flag it for manual verification

## After All Fixes

### If `--dry-run`: Present the Plan

For each work item in the refactor plan, produce:
1. **Before/after code diffs** — exact code with file paths and line numbers
2. **Complete test code** — runnable pytest code, not pseudocode
3. **Risk flags** — with proposed verification steps or mitigations
4. **Commit message** — following the `fix([connector]): [what]` format

Present a summary:
1. **PR-by-PR overview** — for each PR: what changes, which files, any disagreements with the plan
2. **Items where you diverged from the plan** — explain why
3. **Test coverage** — what tests you would add and what they validate
4. **Risk flags** — anything that needs manual verification

Ask: *"Ready to save to `.claude/audit-results/07-dry-run-implementation.md`? Any changes?"*

Save after user approval.

### If implementing (default): After All Fixes

Once all fixes are implemented, tested, and passing:

1. **Show before/after summary**:
   ```
   Before: 5.8/10 — 3 blockers, 6 warnings, 4 suggestions
   After:  8.6/10 — 0 blockers, 1 warning, 2 suggestions
   ```
   List each finding and its resolution:
   ```
   #1 HIGH   SSL config not wired to driver   → FIXED: added ssl_args extraction in connection.py
   #2 HIGH   IAM token no refresh              → FIXED: added pool event listener for token regen
   #3 MEDIUM hostPort not validated for IAM    → FIXED: added format validation with clear error
   ```

2. **Run the static analyzer** to verify fixes:
   ```bash
   python skills/connector-review/scripts/analyze_connector.py {service_type} {name}
   ```

3. **Propose rating updates** — list which standard ratings would change and why:
   ```
   Connection Setup: ⚠️ → ✅ (SSL wired, all auth methods tested)
   Fault Tolerance: ❌ → ⚠️ (token refresh added, still no query retry)
   ```

4. **Save implementation report** to `.claude/audit-results/07-implementation.md` with:
   - PR-by-PR overview (what changed, which files, test results)
   - Items where you diverged from the plan (and why)
   - Remaining items deferred (and why)
   - Risk flags with verification steps

Ask: *"Ready to save the implementation report to `.claude/audit-results/07-implementation.md`?"*
