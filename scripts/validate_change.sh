#!/bin/bash

# Fetch latest from remotes
git fetch --quiet 2>/dev/null

# Auto-detect base branch (upstream/main > origin/main)
if git rev-parse --verify upstream/main &>/dev/null; then
    BASE_BRANCH="upstream/main"
elif git rev-parse --verify origin/main &>/dev/null; then
    BASE_BRANCH="origin/main"
  else
      echo "❌ Could not find main branch on origin or upstream"
      exit 1
fi

echo "📊 Comparing against: ${BASE_BRANCH}"


# Get the diff (staged changes, or last commit, or working directory)
if [ "$1" == "--staged" ]; then
    DIFF=$(git diff --cached --ignore-submodules)
    CONTEXT="staged changes"
elif [ "$1" == "--last-commit" ]; then
    DIFF=$(git diff HEAD~1 --ignore-submodules)
    CONTEXT="last commit: $(git log -1 --pretty=%B)"
elif [ "$1" == "--working" ]; then
    DIFF=$(git diff --ignore-submodules)
    CONTEXT="working directory changes"
else
    # Default: compare current branch to base
    DIFF=$(git diff ${BASE_BRANCH}...HEAD --ignore-submodules --no-color -U3 --minimal)
    CONTEXT="current branch vs ${BASE_BRANCH}"
fi

# Get list of changed files vs base branch
CHANGED_FILES=$(git diff --name-only ${BASE_BRANCH}...HEAD --ignore-submodules 2>/dev/null || git diff --name-only HEAD)

# Current branch name
CURRENT_BRANCH=$(git branch --show-current)

# Exit if no changes
if [ -z "$DIFF" ]; then
    echo "No changes to validate"
    exit 0
fi

# Run Claude Code with the diff as context (-p for non-interactive mode)
claude -p "
## Task: Validate Code Changes

### Context
Branch: ${CURRENT_BRANCH}
Comparing: ${CONTEXT}

### Changed Files:
$CHANGED_FILES

### Diff:
\`\`\`diff
$DIFF
\`\`\`

### Instructions:
1. Analyze which files changed and what functionality was affected
2. Provide a throrough code review of the changes validating for:
   - Code quality
   - Adherence to project conventions
   - Potential bugs or issues
   - Missing tests or documentation
   - Security implications
   - Performance considerations
3. Determine which tests are relevant:
   - Unit tests for changed modules
   - Integration tests if APIs/services changed (for python integration tests assume docker and test DB are available)
   - E2E tests (via Playwright MCP) if UI/flows changed
4. Run the relevant tests:
   - For unit/integration: use the project's test runner (npm test, pytest, etc.)
   - For E2E: use Playwright MCP to validate on http://localhost:8585
5. Report results in this exact format:

## Code Review
[Detailed code review comments by files changed]

## Validation Results

| Test Type | Status | Details |
|-----------|--------|---------|
| Unit      | 🟢/🔴  | X passed, Y failed |
| Integration | 🟢/🔴 | X passed, Y failed |
| E2E       | 🟢/🔴  | Verified: [list] |

### Overall: 🟢 PASS or 🔴 FAIL

[If FAIL, list specific failures and suggested fixes]
" --allowedTools "Bash,mcp__playwright__*" 2>&1

# Capture exit code
EXIT_CODE=$?

exit $EXIT_CODE