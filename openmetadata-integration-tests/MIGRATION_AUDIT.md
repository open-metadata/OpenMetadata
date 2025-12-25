# Test Migration Audit Report

## Executive Summary

**CRITICAL: 87% of entity-specific tests have NOT been migrated**

| Metric | Count | Percentage |
|--------|-------|------------|
| Total entity-specific tests in old module | 1,144 | 100% |
| Covered (in new module or BaseEntityIT) | 147 | 12.8% |
| **Missing (not migrated)** | **997** | **87.2%** |

## What's Working

The new `openmetadata-integration-tests` module has:
- **BaseEntityIT.java**: 114 common tests inherited by all entity classes
- **86 test classes**: One for each entity type
- **Parallel execution**: Tests run concurrently for faster execution
- **Testcontainers**: PostgreSQL, Elasticsearch, Fuseki containers

## What's Missing

The new module is missing entity-specific test logic. The tests in the new module are mostly:
1. Inherited common CRUD tests from `BaseEntityIT`
2. Basic entity-specific setup

But the old module has extensive entity-specific tests that verify:
- Entity-specific validation rules
- Complex business logic
- Permission/authorization scenarios
- Edge cases and error handling
- Integration between entities

## Top 20 Classes with Missing Tests

| Class | Missing Tests | Priority |
|-------|---------------|----------|
| TestCaseResourceTest | 77 | HIGH |
| GlossaryTermResourceTest | 58 | HIGH |
| UserResourceTest | 51 | HIGH |
| NotificationTemplateResourceTest | 45 | MEDIUM |
| EventSubscriptionResourceTest | 39 | HIGH |
| TeamResourceTest | 29 | HIGH |
| ColumnResourceTest | 28 | MEDIUM |
| SearchResourceTest | 27 | HIGH |
| MlModelResourceTest | 25 | MEDIUM |
| PipelineResourceTest | 24 | MEDIUM |
| IngestionPipelineResourceTest | 24 | HIGH |
| FeedResourceTest | 22 | MEDIUM |
| ContainerResourceTest | 20 | MEDIUM |
| OpenLineageResourceTest | 20 | MEDIUM |
| SpreadsheetResourceTest | 17 | LOW |
| TagResourceTest | 17 | MEDIUM |
| DashboardResourceTest | 16 | MEDIUM |
| TestSuiteResourceTest | 16 | HIGH |
| MetricResourceTest | 15 | LOW |
| UsageResourceTest | 15 | MEDIUM |

## Classes Not Yet Migrated

The following test classes from `openmetadata-service` have no corresponding class in `openmetadata-integration-tests`:

1. **EntityResourceTest** (24 tests) - Base class, migrated as BaseEntityIT
2. **IngestionPipelineLogStreamingResourceTest** (0 tests)
3. **K8sIngestionPipelineResourceTest** (0 tests)
4. **PrometheusResourceTest** (3 tests)
5. **ServiceResourceTest** (1 test)
6. **UserMetricsResourceTest** (8 tests)

## Comparison: BaseEntityIT vs EntityResourceTest

| Old (EntityResourceTest) | New (BaseEntityIT) | Status |
|--------------------------|--------------------|---------|
| 24 test methods | 114 test methods | ✅ Expanded |

The base class has been significantly enhanced with more comprehensive common tests.

## Recommendations

### Immediate Actions

1. **Do NOT deprecate old tests yet** - They still provide critical coverage
2. **Run both test suites in CI** - Until migration is complete
3. **Prioritize HIGH priority classes** - TestCase, GlossaryTerm, User, Team, EventSubscription, IngestionPipeline, Search, TestSuite

### Migration Strategy

For each entity class, you need to:

1. **Read the old test class** in `openmetadata-service`
2. **Identify entity-specific tests** (not inherited from EntityResourceTest)
3. **Port test logic** to the new IT class using SDK APIs
4. **Verify coverage** is equivalent

### Example Migration Pattern

**Old Test (openmetadata-service):**
```java
@Test
void post_validUsageByNameAsAdmin_200() {
  // Uses WebTarget, direct HTTP calls
  WebTarget target = getResource("usage/table/" + table.getName());
  Response response = target.request().post(Entity.entity(usage, MediaType.APPLICATION_JSON));
  assertEquals(200, response.getStatus());
}
```

**New Test (openmetadata-integration-tests):**
```java
@Test
void post_validUsageByNameAsAdmin_200(TestNamespace ns) {
  // Uses SDK client, fluent API
  OpenMetadataClient client = SdkClients.adminClient();
  Table table = TableTestFactory.create(ns);
  Usage usage = createUsage();
  client.tables().reportUsage(table.getName(), usage);
  // Assert...
}
```

## Files to Reference

- **Old base class**: `openmetadata-service/src/test/java/org/openmetadata/service/resources/EntityResourceTest.java`
- **New base class**: `openmetadata-integration-tests/src/test/java/org/openmetadata/it/tests/BaseEntityIT.java`
- **Test factories**: `openmetadata-integration-tests/src/test/java/org/openmetadata/it/factories/`

## Next Steps

1. Create tracking issue for test migration
2. Assign engineers to priority classes
3. Set milestone for 100% migration
4. Update CI to run both test suites
