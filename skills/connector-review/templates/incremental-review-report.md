# Incremental Review Report

## Summary

| Field | Value |
|-------|-------|
| **PR** | #{{PR_NUMBER}} |
| **Connector** | {{CONNECTOR_NAME}} |
| **Files Changed** | {{FILES_CHANGED}} |
| **Verdict** | {{VERDICT}} |
| **Overall Score** | {{SCORE}}/10 |

## Changed Files Analysis

{{FILE_ANALYSIS}}

## Findings

### Blockers (Must Fix)

{{BLOCKERS}}

### Warnings (Should Fix)

{{WARNINGS}}

### Suggestions (Optional)

{{SUGGESTIONS}}

## Standards Compliance

Each check is PASS, FAIL (with finding reference), or N/A:

{{STANDARDS_CHECK}}

**Important**: A check is only PASS if no blocker or warning was found for that area.
If a blocker or warning references a standard, that row must show FAIL with the finding number.

Example:
| Check | Status | Finding |
|-------|--------|---------|
| Charts linked to dashboards | FAIL | #1 |
| Pagination implemented | PASS | — |
| Error messages include context | FAIL | #3 |
