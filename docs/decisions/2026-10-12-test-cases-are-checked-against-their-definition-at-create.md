# A new test case is checked against its definition's options and column types

- **Status:** Accepted
- **Revisions:** v1 2026-10-12 (initial); v2 2026-10-16 (checked before the basic test suite is created, and an update checked for what it changes)
- **Deciders:** Shreyansh Verma
- **Guard:** `TestCaseDefinitionConformanceTest`, `TestCaseResourceIT` (`post_testWithUnofferedOptionValue_4xx`, `post_testOnUnsupportedColumnType_4xx`, `patch_toUnofferedOptionValue_4xx`, `createMany_withOneUnofferedOptionValue_createsNone`, `patch_keepsATestOnARetypedColumnEditable`, `post_rejectedForConformance_leavesNoTestSuite`)
- **Related:** open-metadata/ai-platform#1650, #35274, #35276 (2.0 line)

## Context

`validateTestParameters` checked parameter names, required parameters and min/max rules. Nothing
compared a value with the parameter's optionValues, or the column's type with the definition's
supportedDataTypes, which no test case was checked against. Test cases that ingestion then
aborted on (`'SUM' is not a valid Strategy`) or that measured nothing were stored as sent.

## Decision

A new test case is rejected when it:

- gives a parameter with optionValues a value that is none of them (compared case-insensitively,
  as `TestCaseThresholdValidator` reads thresholdUnit; a null, empty or whitespace value is unset);
- targets a column whose dataType is not in a non-empty supportedDataTypes (an empty list means
  every type, as the listing filter reads it; a column with no dataType is accepted). The column is
  found case-insensitively, as `validateColumnTestCase` finds it.

`prepare()` checks a test case when `update` is false, before it creates the table's basic test
suite, the gate the disabled-definition check uses. PUT-create and the CSV import miss that gate
for both checks: `createOrUpdate` prepares with `update` true, and the CSV import does not call
`prepare()`. #35667 fixes those callers.

An update is checked only for what it changes (`TestUpdater`, through
`TestCaseDefinitionConformance.validateUpdate`): a parameter value it changes must be one of that
parameter's options, and a test moved to another column or definition is checked in full. A row
stored before these rules, or one whose column ingestion has since retyped, stays editable.

useDynamicAssertion is not checked against supportsDynamicAssertion: a client can still send it on
a definition without dynamic support (the Collate UI does, from a toggle left on), and rejecting it
would break that client. Test generation already sends it only where it is supported.

## Consequences

Creates by POST (the UI and API clients), `createMany`, MCP `CreateTestCaseTool` and ODCS
materialization get these checks. Ingestion (dbt, Great Expectations and the Python client's
`create_or_update` create by PUT) and the CSV import get them once #35667 lands. ODCS
materialization catches the `IllegalArgumentException` and records the rule as skipped. dbt and
Great Expectations create their own definitions with no supportedDataTypes or optionValues, so
their test cases pass; a definition from the test library is held to the types and options its
author declared.

`createMany` prepares every test of a batch before it stores any, so one rejected test fails the
batch with no test case stored. A basic test suite that an earlier test's `prepare()` created is
not rolled back, as with any other `prepare()` rejection in a batch: no transaction spans
`createMany`.

The ai-platform test generator
applies the same reading before it sends a request (ADR:ai-platform/2026-10-12-generated-test-parameters-conform-to-their-definition),
so a server rejection there means the two have drifted.
