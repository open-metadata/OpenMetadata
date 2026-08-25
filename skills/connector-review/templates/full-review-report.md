# Connector Review Report

## Summary

| Field | Value |
|-------|-------|
| **Connector** | {{CONNECTOR_NAME}} |
| **Service Type** | {{SERVICE_TYPE}} |
| **Connection Type** | {{CONNECTION_TYPE}} |
| **Reviewer** | AI Review (OpenMetadata Skills) |
| **Date** | {{DATE}} |
| **Verdict** | {{VERDICT}} |
| **Overall Score** | {{SCORE}}/10 |

## Score Breakdown

| Category | Score | Confidence | Notes |
|----------|-------|------------|-------|
| Schema & Registration | {{SCORE_SCHEMA}}/10 | {{CONFIDENCE_SCHEMA}}% | |
| Connection & Auth | {{SCORE_CONNECTION}}/10 | {{CONFIDENCE_CONNECTION}}% | |
| Source, Topology & Performance | {{SCORE_SOURCE}}/10 | {{CONFIDENCE_SOURCE}}% | |
| Test Quality | {{SCORE_TESTS}}/10 | {{CONFIDENCE_TESTS}}% | |
| Code Quality & Style | {{SCORE_CODE}}/10 | {{CONFIDENCE_CODE}}% | |

## Findings

### Blockers (Must Fix)

{{BLOCKERS}}

### Warnings (Should Fix)

{{WARNINGS}}

### Suggestions (Optional)

{{SUGGESTIONS}}

*Findings with confidence < 60% are suppressed. Confidence scores shown for transparency.*

## Standards Compliance

Mark each check as PASS or FAIL. **If a blocker or warning was found for an area, that check is FAIL** with the finding number — not PASS. A "PASS" table with blockers above it is contradictory and misleading.

### Schema & Registration

| Check | Status | Finding |
|-------|--------|---------|
| JSON Schema structure ($id, javaType, definitions, additionalProperties: false) | | |
| All $ref paths resolve | | |
| Capability flags match implementation | | |
| Auth fields required when service mandates authentication | | |
| SSL/TLS config included for HTTPS connectors | | |
| Test connection JSON steps match test_fn keys | | |
| Test connection steps are distinct (no duplicate functions) | | |
| Registered in service schema enum and oneOf | | |
| UI utils updated with schema import and switch case | | |
| i18n keys added | | |

{{SCHEMA_DETAILS}}

### Connection & Auth

| Check | Status | Finding |
|-------|--------|---------|
| Connection pattern matches service type | | |
| No swallowed exceptions (empty except blocks) | | |
| Error messages include exception context at warning level | | |
| Secrets handled with SecretStr / format: "password" | | |
| Pydantic models have populate_by_name=True when using aliases | | |
| No scaffolding artifacts (CONNECTOR_CONTEXT.md) committed | | |

{{CONNECTION_DETAILS}}

### Source, Topology & Performance

| Check | Status | Finding |
|-------|--------|---------|
| Correct base class for service type | | |
| create() validates config type with isinstance | | |
| ServiceSpec uses correct spec class | | |
| Yield methods return Either | | |
| Filter patterns applied | | |
| Dashboard charts linked to parent dashboard | | |
| Every client list method implements pagination | | |
| No O(n*m) list iteration lookups | | |
| REST client uses shared requests.Session | | |
| No N+1 API call patterns | | |
| No wildcard lineage (table_name="*") | | |
| No unbounded .read() on files without size checks | | |
| Large objects del'd after use | | |
| Caches bounded or cleared between scopes | | |
| Yield methods use generators, not list accumulation | | |

{{SOURCE_DETAILS}}

### Test Quality

| Check | Status | Finding |
|-------|--------|---------|
| Uses pytest style (no unittest.TestCase) | | |
| Tests real behavior, not just mock wiring | | |
| MOCK_CONFIG has correct sourceConfig type | | |
| Integration tests present (or justified absence) | | |
| Error paths tested | | |
| Pagination tested across multiple pages | | |
| No empty test stubs (pass-only methods) | | |
| Fixtures return real objects, not None | | |

{{TEST_DETAILS}}

### Code Quality & Style

| Check | Status | Finding |
|-------|--------|---------|
| Copyright header on all files | | |
| No unnecessary comments | | |
| Proper import ordering | | |
| Type annotations present | | |
| Uses ingestion_logger() | | |
| No dead code (unused imports, unreachable methods) | | |

{{CODE_DETAILS}}
