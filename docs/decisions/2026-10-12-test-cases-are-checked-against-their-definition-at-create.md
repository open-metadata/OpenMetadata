# A new test case is checked against its definition's options and column types

- **Status:** Accepted
- **Revisions:** v1 2026-10-12 (initial); v2 2026-10-16 (every create path, and what an update changes)
- **Deciders:** Shreyansh Verma
- **Guard:** `TestCaseDefinitionConformanceTest`, `TestCaseResourceIT` (`post_testWithUnofferedOptionValue_4xx`, `post_testOnUnsupportedColumnType_4xx`, `put_createWithUnofferedOptionValue_4xx`, `put_createOnUnsupportedColumnType_4xx`, `patch_toUnofferedOptionValue_4xx`, `createMany_withOneUnofferedOptionValue_createsNone`, `patch_keepsATestOnARetypedColumnEditable`, `post_rejectedForConformance_leavesNoTestSuite`, `put_rejectedForConformance_leavesNoTestSuite`)
- **Related:** open-metadata/ai-platform#1650, #35274, #35276 (2.0 line)

## Context

`validateTestParameters` checked parameter names, required parameters and min/max rules. Nothing
compared a value with the parameter's optionValues, or the column's type with the definition's
supportedDataTypes (used only to filter the definition listing). Test cases that ingestion then
aborted on (`'SUM' is not a valid Strategy`) or that measured nothing were stored as sent.

## Decision

A new test case is rejected when it:

- gives a parameter with optionValues a value that is none of them (compared case-insensitively,
  as `TestCaseThresholdValidator` reads thresholdUnit; a null, empty or whitespace value is unset);
- targets a column whose dataType is not in a non-empty supportedDataTypes (an empty list means
  every type, as the listing filter reads it; a column with no dataType is accepted). The column is
  found case-insensitively, as `validateColumnTestCase` finds it.

`prepare()` checks a new row before it creates the table's basic test suite, so a rejected create
leaves nothing behind. A row is new when `update` is false (POST) or when no test case has its
FQN yet: a PUT that creates a row prepares with `update` true. `createNewEntity`, which every
create reaches, checks again, because the CSV import never calls `prepare()`. `createManyTestCases`
checks a whole `createMany` batch before any of it is prepared or stored, so one invalid test fails
the batch with nothing written (`createMany` prepares one test at a time, creating suites as it
goes, and stores in chunks of 100, each in its own transaction).

An update is checked only for what it changes (`TestUpdater`, through
`TestCaseDefinitionConformance.validateUpdate`): a parameter value it changes must be one of that
parameter's options, and a test moved to another column or definition is checked in full. A row
stored before these rules, or one whose column ingestion has since retyped, stays editable.

useDynamicAssertion is not checked against supportsDynamicAssertion: a client can still send it on
a definition without dynamic support (the Collate UI does, from a toggle left on), and rejecting it
would break that client. Test generation already sends it only where it is supported.

## Consequences

The UI, MCP `CreateTestCaseTool`, ODCS materialization, ingestion (dbt, Great Expectations and the
SDKs create by PUT), the CSV import and API clients all get these checks. ODCS materialization
catches the `IllegalArgumentException` and records the rule as skipped. dbt and Great Expectations
create their own definitions with no supportedDataTypes or optionValues, so their test cases pass;
a definition from the test library is held to the types and options its author declared.

The CSV import creates a row's basic test suite before it validates anything, in a dry run too,
so a row this check rejects can still leave an empty basic suite on a table that had none, as any
other import row that fails does. A dry run does not create, so it does not report these
rejections. Checking import rows before their suite would mean telling new rows from existing
ones in the import, which only `createOrUpdateForImport` does today; that is left to a change of
the import itself. The ai-platform test generator
applies the same reading before it sends a request (ADR:ai-platform/2026-10-12-generated-test-parameters-conform-to-their-definition),
so a server rejection there means the two have drifted.
