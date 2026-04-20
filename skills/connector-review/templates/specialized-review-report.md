# Specialized Review Report

## Summary

| Field | Value |
|-------|-------|
| **Connector** | {{CONNECTOR_NAME}} |
| **Focus Area** | {{FOCUS_AREA}} |
| **Reviewer** | AI Review (OpenMetadata Skills) |
| **Date** | {{DATE}} |
| **Verdict** | {{VERDICT}} |
| **Score** | {{SCORE}}/10 |

## Scope

This review focused on **{{FOCUS_AREA}}** only. Other aspects of the connector were not evaluated.

## Findings

### Blockers (Must Fix)

{{BLOCKERS}}

### Warnings (Should Fix)

{{WARNINGS}}

### Suggestions (Optional)

{{SUGGESTIONS}}

## {{FOCUS_AREA}} Analysis

{{#IF FOCUS_AREA == "Schema & Registration"}}
- [ ] JSON Schema has correct structure ($id, javaType, definitions, additionalProperties: false)
- [ ] All $ref paths resolve
- [ ] Capability flags match implementation
- [ ] Test connection JSON steps match test_fn keys
- [ ] Registered in service schema enum and oneOf
- [ ] UI utils updated with schema import and switch case
- [ ] i18n keys added
{{/IF}}

{{#IF FOCUS_AREA == "Connection & Auth"}}
- [ ] Connection pattern matches service type
- [ ] No swallowed exceptions
- [ ] Secrets handled with SecretStr / format: "password"
- [ ] Error messages include context
- [ ] Test connection steps are meaningful
- [ ] Rate limiting handled for REST APIs
- [ ] SSL configuration supported if applicable
{{/IF}}

{{#IF FOCUS_AREA == "Source & Topology"}}
- [ ] Correct base class for service type
- [ ] create() validates config type
- [ ] ServiceSpec uses correct spec class
- [ ] Yield methods return Either
- [ ] Filter patterns applied
- [ ] No N+1 query patterns
- [ ] Pagination implemented for large result sets
{{/IF}}

{{#IF FOCUS_AREA == "Test Quality"}}
- [ ] Uses pytest style (no unittest.TestCase)
- [ ] Tests real behavior, not just mock wiring
- [ ] MOCK_CONFIG has correct sourceConfig type
- [ ] Integration tests present (or justified absence)
- [ ] Error paths tested
- [ ] Edge cases covered (empty results, auth failures, timeouts)
{{/IF}}

{{#IF FOCUS_AREA == "Code Quality & Style"}}
- [ ] Copyright header on all files
- [ ] No unnecessary comments
- [ ] Proper import ordering
- [ ] Type annotations present
- [ ] Uses ingestion_logger()
- [ ] No hardcoded secrets
- [ ] No `any` types without justification
{{/IF}}

{{#IF FOCUS_AREA == "Security"}}
- [ ] Secrets use SecretStr / format: "password" in schema
- [ ] No secrets logged or printed
- [ ] No secrets in error messages or stack traces
- [ ] Connection URLs don't expose credentials
- [ ] SSL/TLS configuration available
- [ ] Auth tokens properly scoped
- [ ] No command injection in dynamic queries
{{/IF}}

{{#IF FOCUS_AREA == "Performance"}}
- [ ] Every client list method implements pagination (BLOCKER if API paginates but method doesn't)
- [ ] No single-page fetch on paginated APIs (silent data loss)
- [ ] Lookups inside loops use dicts, not list iteration (O(1) vs O(n*m))
- [ ] Connection reuse via shared requests.Session (no per-request creation)
- [ ] Batch API calls where supported (no N+1 pattern)
- [ ] Rate limiting with retry/backoff for REST APIs
- [ ] Lazy loading — details fetched only after filters applied
- [ ] Test stubs are real tests with assertions, not empty `pass` bodies
{{/IF}}

{{#IF FOCUS_AREA == "Memory"}}
- [ ] No .read() / .readall() on files without size check (BLOCKER — OOM on large files)
- [ ] Large objects (raw responses, file contents, DataFrames) del'd after processing
- [ ] gc.collect() called after processing large batches
- [ ] All caches bounded (lru_cache maxsize) or cleared between scopes
- [ ] Yield methods use generators, not list accumulation
- [ ] Database cursors and file handles closed explicitly (context managers or finally)
- [ ] Query results use .fetchmany() or streaming, not .all() on large tables
- [ ] Storage connectors use framework streaming readers, not raw .read()
- [ ] json.load(stream) used instead of json.loads(stream.read()) where possible
- [ ] No unbounded list growth in loops (e.g., appending inside pagination without yielding)
{{/IF}}

{{#IF FOCUS_AREA == "Lineage"}}
- [ ] Query log SQL template has time window placeholders
- [ ] Filters select only lineage-relevant queries (DML, CTAS, MERGE)
- [ ] Dialect mapping registered in lineage/models.py
- [ ] LineageSource subclass with correct sql_stmt and filters
- [ ] QueryParserSource with get_sql_statement() override
- [ ] GetQueries test connection step present
{{/IF}}

{{DETAILS}}
