# A new test case is checked against its definition's options and column types

- **Status:** Accepted
- **Revisions:** v1 2026-10-12 (initial)
- **Deciders:** Shreyansh Verma
- **Guard:** `TestCaseDefinitionConformanceTest`, `TestCaseResourceIT` (`post_testWithUnofferedOptionValue_4xx`, `post_testOnUnsupportedColumnType_4xx`, `patch_doesNotRecheckDefinitionConformance`)
- **Related:** open-metadata/ai-platform#1650, #35274, #35276 (2.0 line)

## Context

`validateTestParameters` checked parameter names, required parameters and min/max rules. Nothing
compared a value with the parameter's optionValues, or the column's type with the definition's
supportedDataTypes (used only to filter the definition listing). Test cases that ingestion then
aborted on (`'SUM' is not a valid Strategy`) or that measured nothing were stored as sent.

## Decision

`prepare()` rejects, when `update` is false, a test case that:

- gives a parameter with optionValues a value that is none of them (compared case-insensitively,
  as `TestCaseThresholdValidator` reads thresholdUnit; a null, empty or whitespace value is unset);
- targets a column whose dataType is not in a non-empty supportedDataTypes (an empty list means
  every type, as the listing filter reads it; a column with no dataType is accepted). The column is
  found case-insensitively, as `validateColumnTestCase` finds it.

The gate is the one the disabled-definition check uses, so a row stored before these rules stays
editable by PATCH and PUT.

useDynamicAssertion is not checked against supportsDynamicAssertion: a client can still send it on
a definition without dynamic support (the Collate UI does, from a toggle left on), and rejecting it
would break that client. Test generation already sends it only where it is supported.

## Consequences

The UI, MCP `CreateTestCaseTool`, ODCS materialization and API clients all get these checks. ODCS
materialization catches the `IllegalArgumentException` and records the rule as skipped. PUT
`createOrUpdate` prepares with `update` true even for a new row, and the non-dry-run CSV import does
not call `prepare()`, so neither is covered yet; both are follow-ups. The ai-platform test generator
applies the same reading before it sends a request (ADR:ai-platform/2026-10-12-generated-test-parameters-conform-to-their-definition),
so a server rejection there means the two have drifted.
