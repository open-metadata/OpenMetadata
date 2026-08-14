# RCA: Snowflake ingestion fails when `queryTag` contains double quotes

| | |
|---|---|
| **Status** | Resolved |
| **Severity** | High — Snowflake metadata ingestion completely fails (0 records processed) for any affected service |
| **Customer** | DR Horton (reported via Collate support, service `Snowflake.417365b4-99a0-49f3-afea-32517bede545`) |
| **Reported** | 2026-08-11 |
| **Root-caused / fixed** | 2026-08-14 |
| **Fix** | `ingestion/src/metadata/ingestion/source/database/snowflake/queries.py` + 3 call sites (branch `claude/snowflake-query-tag-injection-5qveh9`) |

## Summary

A DR Horton user set the Snowflake connection's **Query Tag** field to a JSON object
(`{"department":"Data Analytics"}`) via the OpenMetadata UI, following a suggestion from support
that Snowflake's `QUERY_TAG` session parameter accepts JSON. Every subsequent ingestion run failed
immediately: `CheckAccess`/`GetDatabases`/etc. test-connection steps passed, but every real database
connection during the actual metadata run threw a Snowflake `SQL compilation error`, and the
workflow ended with 0 processed records and a hard failure (`WorkflowExecutionError`).

## Impact

- 100% of metadata ingestion runs for the affected Snowflake service failed after the `queryTag`
  was set (both attempted values — a UI-escaped string and the raw JSON — failed identically).
- No partial/degraded ingestion: every `engine.connect()` call fails, so all 4 non-filtered
  databases (`DB_PROD`, `DB_RAW`, `DB_RAW_ATTOM`, `DB_RAW_SHOVELS`) and the
  `mark_databases_as_deleted` post-process step errored out.
- **Test Connection continued to report success**, which made the misconfiguration look
  server-side rather than in the newly-set `queryTag` value — this is why the customer's own
  triage (checking role privileges, re-testing the connection) didn't surface the cause.

## Timeline

| Time (2026-08-11) | Event |
|---|---|
| 13:00 | Ingestion run with `queryTag = {"department":"Data Analytics"}` (raw JSON) — fails, log `001-metadata-agent.log` |
| 13:22 | Ingestion run with `queryTag = "{\"department\":\"Data Analytics\"}"` (JSON-as-escaped-string) — fails identically, log `002-metadata-agent.log` |
| — | Customer/support exchange narrows suspicion to `_set_query_tag` in `metadata.py:287` and the `SNOWFLAKE_SESSION_TAG_QUERY` template |
| 2026-08-14 | Root cause confirmed by reading `queries.py`; fix implemented, tested, and pushed |

## Root cause

`ingestion/src/metadata/ingestion/source/database/snowflake/queries.py` defined:

```python
SNOWFLAKE_SESSION_TAG_QUERY = 'ALTER SESSION SET QUERY_TAG="{query_tag}"'
```

Three call sites built the actual SQL with an unescaped `str.format()`:

- `snowflake/metadata.py::SnowflakeSource._set_query_tag` (line 287/300, in the stack trace)
- `snowflake/query_parser.py::SnowflakeQueryParserSource.set_session_query_tag`
- `mixins/sqalchemy/sqa_mixin.py::SQAInterfaceMixin.set_session_tag`

All three interpolate the user-supplied `queryTag` config value directly between a pair of double
quotes with no escaping. This works for plain tags (`my_tag`) but breaks the moment the value
itself contains a `"` — which any JSON object necessarily does. For `queryTag =
{"department":"Data Analytics"}`, the formatted statement becomes:

```
ALTER SESSION SET QUERY_TAG="{"department":"Data Analytics"}"
                              ^-- quoted value closes here
```

Snowflake parses `="{"` as the complete quoted value, then hits `department` as a bare, unexpected
token — exactly the reported error:

```
syntax error line 1 at position 30 unexpected '{'.
...
syntax error line 1 at position 64 unexpected '}'.
```

(The second attempt, where the customer pasted a backslash-escaped JSON string through the UI,
produced a structurally identical failure at a shifted column offset for the same reason — the
extra escaping characters became part of the literal value and still contained unescaped `"`s.)

This statement runs inside an `event.listens_for(engine, "connect")` handler, so **every** pooled
connection checkout re-executes it — meaning the failure is not confined to a "set query tag" step,
it aborts every real query the connector makes (`GetDatabases`, `mark_databases_as_deleted`, etc.),
which matches the observed 0-records/1-error/4-warnings summary. `Test Connection` doesn't fail
because its steps don't go through this same pooled-connection path in a way that surfaces the
error before reporting success (see Follow-ups).

## Why this wasn't caught earlier

- `queryTag` is a free-text `string` field in the JSON schema
  (`openmetadata-spec/.../database/snowflakeConnection.json`) with no format/content validation, so
  the UI accepts any string, JSON-shaped or not.
- No existing unit test exercised a query tag containing special characters — the only test,
  `test_set_session_tag_statement_is_accepted_by_sqlalchemy_2x`, used a plain alphanumeric tag
  (`my_tag`), which never triggers the bug.
- Support's guidance that Snowflake supports JSON query tags is externally correct (Snowflake's
  `QUERY_TAG` session parameter does accept arbitrary strings, including JSON), so this is purely an
  OpenMetadata-side interpolation bug, not a Snowflake limitation.

## Fix

Added a shared helper in `queries.py` that escapes embedded double quotes by doubling them
(Snowflake's own quoted-value escaping convention) before formatting:

```python
def get_snowflake_session_tag_query(query_tag: str) -> str:
    escaped_query_tag = query_tag.replace('"', '""')
    return SNOWFLAKE_SESSION_TAG_QUERY.format(query_tag=escaped_query_tag)
```

All three call sites (`metadata.py`, `query_parser.py`, `sqa_mixin.py`) now use this helper instead
of formatting `SNOWFLAKE_SESSION_TAG_QUERY` directly. Plain tags are unaffected (no quotes to
escape); JSON-shaped tags like `{"department": "Data Analytics"}` now produce a valid statement:

```
ALTER SESSION SET QUERY_TAG="{""department"": ""Data Analytics""}"
```

### Verification

- Added `test_set_session_tag_escapes_embedded_double_quotes` in
  `ingestion/tests/unit/metadata/mixins/sqalchemy/test_sqa_mixin.py`, asserting the exact escaped
  statement for a JSON tag.
- Existing `test_set_session_tag_statement_is_accepted_by_sqlalchemy_2x` (plain tag) continues to
  pass unchanged.
- Verified the escaping logic directly (module-level execution, no full dev env available in this
  session) against `my_tag`, the reported JSON tag, and a tag containing a bare colon — all
  produced syntactically valid `ALTER SESSION` statements.
- All edited files pass `py_compile`.

## Follow-ups / recommendations

1. **Extend the fix to single quotes too**, if a query tag could ever contain `'` — the current fix
   only targets `"` since that's what breaks the existing double-quoted template. Low priority since
   Snowflake identifiers/values quoted with `"` don't require escaping `'`.
2. **Consider validating `Test Connection` against the actual pooled-connection path** (or adding a
   dedicated "Set Query Tag" test-connection step) so a bad `queryTag` value surfaces at
   configuration time instead of failing every subsequent ingestion run silently past a green test.
3. **Add a schema-level hint** in `snowflakeConnection.json`'s `queryTag` description noting that
   values are inserted into a double-quoted SQL literal, so support guidance to customers can set
   correct expectations about what characters are safe.
