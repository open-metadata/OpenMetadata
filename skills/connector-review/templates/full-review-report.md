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

| Category | Score | Notes |
|----------|-------|-------|
| Schema & Registration | {{SCORE_SCHEMA}}/10 | |
| Connection & Auth | {{SCORE_CONNECTION}}/10 | |
| Source & Topology | {{SCORE_SOURCE}}/10 | |
| Test Quality | {{SCORE_TESTS}}/10 | |
| Code Quality & Style | {{SCORE_CODE}}/10 | |

## Findings

### Blockers (Must Fix)

{{BLOCKERS}}

### Warnings (Should Fix)

{{WARNINGS}}

### Suggestions (Optional)

{{SUGGESTIONS}}

## Schema & Registration

- [ ] JSON Schema has correct structure ($id, javaType, definitions, additionalProperties: false)
- [ ] All $ref paths resolve
- [ ] Capability flags match implementation
- [ ] Test connection JSON steps match test_fn keys
- [ ] Registered in service schema enum and oneOf
- [ ] UI utils updated with schema import and switch case
- [ ] i18n keys added

{{SCHEMA_DETAILS}}

## Connection & Auth

- [ ] Connection pattern matches service type
- [ ] No swallowed exceptions
- [ ] Secrets handled with SecretStr / format: "password"
- [ ] Error messages include context
- [ ] Test connection steps are meaningful

{{CONNECTION_DETAILS}}

## Source & Topology

- [ ] Correct base class for service type
- [ ] create() validates config type
- [ ] ServiceSpec uses correct spec class
- [ ] Yield methods return Either
- [ ] Filter patterns applied

{{SOURCE_DETAILS}}

## Test Quality

- [ ] Uses pytest style (no unittest.TestCase)
- [ ] Tests real behavior, not just mock wiring
- [ ] MOCK_CONFIG has correct sourceConfig type
- [ ] Integration tests present (or justified absence)
- [ ] Error paths tested

{{TEST_DETAILS}}

## Code Quality & Style

- [ ] Copyright header on all files
- [ ] No unnecessary comments
- [ ] Proper import ordering
- [ ] Type annotations present
- [ ] Uses ingestion_logger()

{{CODE_DETAILS}}
