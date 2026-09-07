# Test Migration Tracker: openmetadata-service → openmetadata-integration-tests

**Last Updated**: 2025-12-26
**Status**: All Tests Passing - Migration Complete
**Branch**: faster_tests_2

## Recent Progress (2025-12-26)

### MySQL Deadlock Fix ✅
- Fixed MySQL deadlock issue in `TagUsageDAO.applyTagsBatchInternal`
- Changed from `INSERT IGNORE` to `INSERT ... ON DUPLICATE KEY UPDATE`
- PostgreSQL unchanged (`ON CONFLICT DO NOTHING` - no deadlock issue)

### Flaky Test Fixes ✅
- **AppsResourceIT**: Changed to `SAME_THREAD` execution mode
  - Multiple tests trigger `SearchIndexingApplication` which is a shared resource
  - Added `waitForAppJobCompletion()` to tests that trigger apps
- **TableResourceIT.test_multipleDomainInheritance**: Used Awaitility for search index wait
  - Replaced `Thread.sleep(2000)` with proper Awaitility polling
  - Waits up to 30 seconds for table to appear in search index

### Maven Profiles Added ✅
- `mysql-elasticsearch` (default)
- `postgres-opensearch`
- `postgres-elasticsearch`
- `mysql-opensearch`

### GitHub Workflows Created ✅
- `integration-tests-mysql-elasticsearch.yml`
- `integration-tests-postgres-opensearch.yml`

### Code Cleanup ✅
- Removed wildcard imports from 85+ files
- Added comprehensive README.md documentation

---

## Executive Summary

| Metric | Count |
|--------|-------|
| Total Test Classes | 91 |
| Total @Test Methods | ~2,100 |
| Base Class Tests (BaseEntityIT) | 119 |

---

## Migration Status By Entity Class

### Legend
- ✅ **Complete**: All tests migrated and passing
- 🔄 **Partial**: Some tests need attention
- ⚠️ **Stub**: Only BaseEntityIT inherited tests

### Entity Resource Tests (Sorted by Test Count)

| Target Class | Tests | Status |
|--------------|-------|--------|
| BaseEntityIT | 119 | ✅ |
| TestCaseResourceIT | 95 | ✅ |
| TableResourceIT | 92 | ✅ |
| DataContractResourceIT | 92 | ✅ |
| GlossaryTermResourceIT | 71 | ✅ |
| UserResourceIT | 66 | ✅ |
| SearchResourceIT | 55 | ✅ |
| NotificationTemplateResourceIT | 52 | ✅ |
| EventSubscriptionResourceIT | 48 | ✅ |
| ConversationResourceIT | 10 | ✅ |
| TopicResourceIT | 38 | ✅ |
| MlModelResourceIT | 38 | ✅ |
| PipelineResourceIT | 36 | ✅ |
| GlossaryResourceIT | 35 | ✅ |
| ContainerResourceIT | 34 | ✅ |
| SystemResourceIT | 33 | ✅ |
| TeamResourceIT | 32 | ✅ |
| DashboardResourceIT | 29 | ✅ |
| SpreadsheetResourceIT | 27 | ✅ |
| IngestionPipelineResourceIT | 27 | ✅ |
| ColumnResourceIT | 27 | ✅ |
| AppsResourceIT | 27 | ✅ |
| TestSuiteResourceIT | 26 | ✅ |
| LineageResourceIT | 25 | ✅ |
| ChartResourceIT | 25 | ✅ |
| WorkflowDefinitionResourceIT | 24 | ✅ |
| SuggestionsResourceIT | 22 | ✅ |
| QueryResourceIT | 21 | ✅ |
| OpenLineageResourceIT | 21 | ✅ |
| MetricResourceIT | 20 | ✅ |
| WorksheetResourceIT | 19 | ✅ |
| TagResourceIT | 19 | ✅ |
| PromptTemplateResourceIT | 19 | ✅ |
| TypeResourceIT | 17 | ✅ |
| SearchIndexResourceIT | 17 | ✅ |
| AIApplicationResourceIT | 17 | ✅ |
| UsageResourceIT | 16 | ✅ |
| LLMModelResourceIT | 16 | ✅ |
| DatabaseSchemaResourceIT | 16 | ✅ |
| WorkflowResourceIT | 15 | ✅ |
| DirectoryResourceIT | 15 | ✅ |
| StoredProcedureResourceIT | 14 | ✅ |
| PermissionsResourceIT | 14 | ✅ |
| FileResourceIT | 14 | ✅ |
| EntityProfileResourceIT | 14 | ✅ |
| DatabaseResourceIT | 14 | ✅ |
| PolicyResourceIT | 13 | ✅ |
| DomainResourceIT | 13 | ✅ |
| DashboardDataModelResourceIT | 13 | ✅ |
| AIGovernancePolicyResourceIT | 13 | ✅ |
| DatabaseServiceResourceIT | 12 | ✅ |
| ClassificationResourceIT | 12 | ✅ |
| AppMarketPlaceResourceIT | 12 | ✅ |
| SecurityServiceResourceIT | 11 | ✅ |
| RoleResourceIT | 11 | ✅ |
| PersonaResourceIT | 11 | ✅ |
| MetadataServiceResourceIT | 11 | ✅ |
| LLMServiceResourceIT | 11 | ✅ |
| KpiResourceIT | 11 | ✅ |
| DriveServiceResourceIT | 11 | ✅ |
| DocStoreResourceIT | 11 | ✅ |
| DataProductResourceIT | 11 | ✅ |
| DataInsightChartResourceIT | 11 | ✅ |
| DataContractPermissionIT | 11 | ✅ |
| ConfigResourceIT | 11 | ✅ |
| ChangeEventParserResourceIT | 10 | ✅ |
| APIEndpointResourceIT | 10 | ✅ |
| K8sIngestionPipelineResourceIT | 9 | ✅ |
| IngestionPipelineLogStreamingResourceIT | 9 | ✅ |
| APICollectionResourceIT | 9 | ✅ |
| UserMetricsResourceIT | 8 | ✅ |
| TestConnectionDefinitionResourceIT | 8 | ✅ |
| SearchServiceResourceIT | 8 | ✅ |
| DashboardServiceResourceIT | 8 | ✅ |
| AlertsRuleEvaluatorResourceIT | 8 | ✅ |
| WebAnalyticEventResourceIT | 7 | ✅ |
| MessagingServiceResourceIT | 7 | ✅ |
| APIServiceResourceIT | 7 | ✅ |
| StorageServiceResourceIT | 6 | ✅ |
| ReportDataResourceIT | 6 | ✅ |
| PipelineServiceResourceIT | 6 | ✅ |
| MlModelServiceResourceIT | 6 | ✅ |
| TestDefinitionResourceIT | 5 | ✅ |
| BotResourceIT | 5 | ✅ |
| AgentExecutionResourceIT | 5 | ✅ |
| RdfResourceIT | 4 | ✅ |
| PrometheusResourceIT | 3 | ✅ |
| PaginationIT | 1 | ✅ |
| DatabaseSmokeIT | 1 | ✅ |
| DatabaseHierarchyIT | 1 | ✅ |
| BaseServiceIT | 1 | ✅ |

---

## Test Infrastructure

### Feed V1 retirement traceability

The removed `FeedResourceIT` and `FeedTaskAuthzIT` cases are split by their runtime owner:

| Legacy coverage | Replacement suite |
|---|---|
| Conversation root/reply CRUD, validation, reactions, resolution, filters, pagination, permissions, domains, concurrency, and cleanup | `ConversationResourceIT` |
| Activity-backed reply creation, isolation, concurrency, mutation, permissions, deleted-target behavior, and reactions | `ActivityResourceIT` |
| Task creation, assignment, status, comments, authorization, concurrency, and bot restrictions | `TaskResourceIT` and `TaskCommentsIT` |
| Announcement CRUD, validation, activation windows, and entity scoping | `AnnouncementResourceIT` |
| Chatbot feed cases | Removed with the Chatbot feature; legacy rows remain only in the archived migration source |

`ConversationSchemaMigrationIT` replays the exact `2.1.0` Conversation V2 DDL twice against the
active database profile, verifies generated columns, and proves reply/reaction/mention/domain rows
cascade with their root. CI runs the same test under the MySQL and PostgreSQL profiles; the existing
`ContinuousMigrationIT` covers checksum-based current-version reprocessing for both profiles.

### Available Profiles

| Profile | Database | Search Engine |
|---------|----------|---------------|
| `mysql-elasticsearch` (default) | MySQL 8.3.0 | Elasticsearch 8.11.4 |
| `postgres-opensearch` | PostgreSQL 15 | OpenSearch 2.19.0 |
| `postgres-elasticsearch` | PostgreSQL 15 | Elasticsearch 8.11.4 |
| `mysql-opensearch` | MySQL 8.3.0 | OpenSearch 2.19.0 |

### Running Tests

```bash
# Run all tests with MySQL + Elasticsearch (default)
mvn test -pl :openmetadata-integration-tests

# Run with PostgreSQL + OpenSearch
mvn test -pl :openmetadata-integration-tests -Ppostgres-opensearch

# Run a specific test
mvn test -pl :openmetadata-integration-tests -Dtest="TableResourceIT"
```

---

## SDK Fluent APIs Added

The following fluent API classes were added to support the integration tests:

| SDK Class | Location |
|-----------|----------|
| `Columns` | `openmetadata-sdk/.../fluent/Columns.java` |
| `DataContracts` | `openmetadata-sdk/.../fluent/DataContracts.java` |
| `TestCases` | `openmetadata-sdk/.../fluent/TestCases.java` |
| `Usage` | `openmetadata-sdk/.../fluent/Usage.java` |

### SDK Services Added

| Service | Purpose |
|---------|---------|
| `TestCaseResolutionStatusService` | Test case resolution status operations |
| `TestCaseResultService` | Test case result operations |
| `DataContractService` | Data contract CRUD + bulk operations |

---

## Key Files

- `README.md` - Comprehensive documentation on writing tests
- `BaseEntityIT.java` - Base class with 119 inherited tests
- `TestSuiteBootstrap.java` - Test infrastructure (Testcontainers)
- `TestNamespace.java` - Test isolation utility
- `SdkClients.java` - Pre-configured SDK clients

---

## CI/CD Integration

GitHub workflows run on every PR:

- `integration-tests-mysql-elasticsearch.yml` - MySQL + Elasticsearch
- `integration-tests-postgres-opensearch.yml` - PostgreSQL + OpenSearch

Tests require the "safe to test" label on PRs (uses `pull_request_target`).

---

## Performance

| Metric | Value |
|--------|-------|
| Full test suite | ~20 minutes locally |
| Parallel execution | Yes (JUnit 5 parallel) |
| Test isolation | TestNamespace prefixes |
| Container startup | ~30 seconds |

---

## Recent Fixes

### MySQL Deadlock Fix (2025-12-26)
Changed `TagUsageDAO.applyTagsBatchInternal` from:
```sql
INSERT IGNORE INTO tag_usage ...
```
To:
```sql
INSERT INTO tag_usage ... ON DUPLICATE KEY UPDATE ...
```

This prevents deadlocks from MySQL's gap locking behavior during concurrent tag updates.
