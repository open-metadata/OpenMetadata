# Test Migration Tracker: openmetadata-service → openmetadata-integration-tests

**Last Updated**: 2025-12-24 (Updated)
**Status**: Compiles Successfully - Tests Migrated
**Branch**: speed_tests

## Recent Progress (2025-12-24)

### Priority Test Migrations Completed ✅
Migrated all priority gap tests in multiple waves:

**Wave 1:**
- **MetricResourceIT**: +9 tests (custom units, reviewers, entity status, description update)
- **ClassificationResourceIT**: +8 tests (auto-classification config, permissions, entity status)
- **APIEndpointResourceIT**: +5 tests (validation, tags, pagination, schema depth)
- **PermissionsResourceIT**: +4 tests (debug permissions for multiple entities)
- **TagResourceIT**: +3 tests (owner inheritance, domain inheritance, classification disable)
- **FeedResourceIT**: Already comprehensive with 47 tests (auth tests not migrated - require complex setup)

**Wave 2:**
- **DatabaseSchemaResourceIT**: +7 tests (inheritance, bulk fetch, entity relationships, CSV import/export)
- **EventSubscriptionResourceIT**: +9 tests (notification template CRUD, system template rejection)
- **SuggestionsResourceIT**: +6 tests (pagination, nested columns, bulk accept, mutually exclusive tags)
- **IngestionPipelineResourceIT**: +4 tests (validation, DBT encryption, provider filtering)
- **APICollectionResourceIT**: +5 tests (bulk API, tag merge, description preservation)
- **DatabaseServiceResourceIT**: +4 tests (connection updates, test connection results)
- **DatabaseResourceIT**: +1 test (field fetchers for service and name)

### Compilation Fixed ✅
All SDK and integration test compilation errors have been resolved:
- Added `withOrdinalPosition()` to ColumnBuilder
- Added `upsert(CreateDataProduct)` to DataProductService
- Added `setDomain()`/`withDomain()` to ListParams
- Fixed type mismatches (LONGTEXT→TEXT, ROWTYPE→STRUCT, Long→Integer)
- Fixed LOG→log (Lombok @Slf4j)
- Fixed ListParams usage (setDatabase instead of setAdditionalParams)
- Fixed ApiException import path

### Import/Export Support Added ✅
Added comprehensive import/export support to SDK and BaseEntityIT:

**SDK Changes (EntityServiceBase.java):**
- `exportCsv(name)` / `exportCsv(name, recursive)`
- `importCsv(name, csvData)` / `importCsv(name, csvData, dryRun, recursive)`
- Async variants for both

**BaseEntityIT Changes:**
- Added `supportsImportExport` flag (defaults to false)
- Added `getEntityService()` abstract method
- Added `getImportExportContainerName()` abstract method
- Added 3 import/export tests: `test_exportCsv`, `test_importCsvDryRun`, `test_importExportRoundTrip`

**Entity Tests with Import/Export Enabled:**
- ✅ DatabaseResourceIT
- ✅ DatabaseSchemaResourceIT
- ✅ TableResourceIT
- ✅ GlossaryResourceIT
- ✅ GlossaryTermResourceIT
- ✅ TeamResourceIT
- ✅ UserResourceIT
- ✅ TestCaseResourceIT

---

## Executive Summary

| Metric | Count |
|--------|-------|
| Source Test Classes (openmetadata-service) | 86 |
| Target Test Classes (openmetadata-integration-tests) | 91 |
| Source @Test Methods | 1,497 |
| Target @Test Methods | 1,804 |
| Base Class Tests (EntityResourceTest → BaseEntityIT) | 93 → 116 |

**Note**: Target has more @Test annotations due to expanded BaseEntityIT coverage. However, many entity-specific tests still need migration.

---

## Migration Status By Entity Class

### Legend
- ✅ **Complete**: All entity-specific tests migrated
- 🔄 **Partial**: Some tests migrated, more needed
- ⚠️ **Stub**: Only BaseEntityIT inherited tests, no entity-specific logic
- ❌ **Not Started**: Class doesn't exist in target
- 🔧 **SDK Missing**: Requires SDK class to be created first

### Entity Resource Tests

| Source Class | Source Tests | Target Class | Target Tests | Status | Gap |
|--------------|--------------|--------------|--------------|--------|-----|
| EntityResourceTest | 93 | BaseEntityIT | 116 | ✅ | +23 |
| DataContractResourceTest | 100 | DataContractResourceIT | 80 | 🔧🔄 | -20 |
| TestCaseResourceTest | 92 | TestCaseResourceIT | 95 | ✅ | +3 |
| TableResourceTest | 92 | TableResourceIT | 92 | 🔧🔄 | 0 |
| GlossaryTermResourceTest | 68 | GlossaryTermResourceIT | 71 | ✅ | +3 |
| UserResourceTest | 54 | UserResourceIT | 52 | 🔧🔄 | -2 |
| FeedResourceTest | 50 | FeedResourceIT | 47 | ✅ | -3 (auth) |
| NotificationTemplateResourceTest | 45 | NotificationTemplateResourceIT | 52 | ✅ | +7 |
| EventSubscriptionResourceTest | 40 | EventSubscriptionResourceIT | 48 | ✅ | +8 |
| SearchResourceTest | 35 | SearchResourceIT | 55 | ✅ | +20 |
| TeamResourceTest | 30 | TeamResourceIT | 32 | ✅ | +2 |
| ColumnResourceTest | 29 | ColumnResourceIT | 27 | 🔧🔄 | -2 |
| SystemResourceTest | 26 | SystemResourceIT | 33 | ✅ | +7 |
| MlModelResourceTest | 26 | MlModelResourceIT | 38 | ✅ | +12 |
| IngestionPipelineResourceTest | 25 | IngestionPipelineResourceIT | 27 | ✅ | +2 |
| WorkflowDefinitionResourceTest | 24 | WorkflowDefinitionResourceIT | 24 | ✅ | 0 |
| PipelineResourceTest | 24 | PipelineResourceIT | 36 | ✅ | +12 |
| ContainerResourceTest | 23 | ContainerResourceIT | 34 | ✅ | +11 |
| OpenLineageResourceTest | 21 | OpenLineageResourceIT | 21 | 🔧🔄 | 0 |
| TestSuiteResourceTest | 19 | TestSuiteResourceIT | 26 | ✅ | +7 |
| TagResourceTest | 19 | TagResourceIT | 19 | ✅ | 0 |
| SuggestionsResourceTest | 17 | SuggestionsResourceIT | 22 | ✅ | +5 |
| SpreadsheetResourceTest | 17 | SpreadsheetResourceIT | 14 | 🔧🔄 | -3 |
| MetricResourceTest | 17 | MetricResourceIT | 20 | ✅ | +3 |
| DashboardResourceTest | 17 | DashboardResourceIT | 29 | ✅ | +12 |
| UsageResourceTest | 16 | UsageResourceIT | 16 | 🔧🔄 | 0 |
| TopicResourceTest | 16 | TopicResourceIT | 38 | ✅ | +22 |
| SearchIndexResourceTest | 16 | SearchIndexResourceIT | 17 | ✅ | +1 |
| LineageResourceTest | 16 | LineageResourceIT | 25 | ✅ | +9 |
| AppsResourceTest | 16 | AppsResourceIT | 14 | 🔧🔄 | -2 |
| WorksheetResourceTest | 15 | WorksheetResourceIT | 13 | 🔧🔄 | -2 |
| GlossaryResourceTest | 15 | GlossaryResourceIT | 35 | ✅ | +20 |
| DatabaseSchemaResourceTest | 15 | DatabaseSchemaResourceIT | 16 | ✅ | +1 |
| DatabaseResourceTest | 15 | DatabaseResourceIT | 14 | ✅ | -1 (bulk) |
| PermissionsResourceTest | 14 | PermissionsResourceIT | 14 | ✅ | 0 |
| FileResourceTest | 14 | FileResourceIT | 14 | 🔧🔄 | 0 |
| EntityProfileResourceTest | 14 | EntityProfileResourceIT | 13 | 🔧🔄 | -1 |
| DirectoryResourceTest | 14 | DirectoryResourceIT | 15 | 🔧✅ | +1 |
| QueryResourceTest | 13 | QueryResourceIT | 21 | ✅ | +8 |
| DomainResourceTest | 13 | DomainResourceIT | 13 | ✅ | 0 |
| PolicyResourceTest | 12 | PolicyResourceIT | 13 | ✅ | +1 |
| DashboardDataModelResourceTest | 12 | DashboardDataModelResourceIT | 13 | ✅ | +1 |
| ChartResourceTest | 11 | ChartResourceIT | 25 | ✅ | +14 |
| StoredProcedureResourceTest | 10 | StoredProcedureResourceIT | 14 | ✅ | +4 |
| DataProductResourceTest | 10 | DataProductResourceIT | 11 | ✅ | +1 |
| ChangeEventParserResourceTest | 10 | ChangeEventParserResourceIT | 10 | ✅ | 0 |
| APIEndpointResourceTest | 10 | APIEndpointResourceIT | 10 | ✅ | 0 |
| IngestionPipelineLogStreamingResourceTest | 9 | IngestionPipelineLogStreamingResourceIT | 9 | ✅ | 0 |
| DatabaseServiceResourceTest | 9 | DatabaseServiceResourceIT | 12 | ✅ | +3 |
| ClassificationResourceTest | 9 | ClassificationResourceIT | 12 | ✅ | +3 |
| UserMetricsResourceTest | 8 | UserMetricsResourceIT | 8 | ✅ | 0 |
| TypeResourceTest | 8 | TypeResourceIT | 17 | ✅ | +9 |
| LLMModelResourceTest | 8 | LLMModelResourceIT | 16 | ✅ | +8 |
| K8sIngestionPipelineResourceTest | 8 | K8sIngestionPipelineResourceIT | 9 | ✅ | +1 |
| AIApplicationResourceTest | 8 | AIApplicationResourceIT | 17 | 🔧✅ | +9 |
| PersonaResourceTest | 7 | PersonaResourceIT | 5 | 🔧🔄 | -2 |
| DocStoreResourceTest | 7 | DocStoreResourceIT | 11 | ✅ | +4 |
| ConfigResourceTest | 7 | ConfigResourceIT | 11 | ✅ | +4 |
| PromptTemplateResourceTest | 6 | PromptTemplateResourceIT | 19 | 🔧✅ | +13 |
| PipelineServiceResourceTest | 6 | PipelineServiceResourceIT | 6 | ✅ | 0 |
| APICollectionResourceTest | 6 | APICollectionResourceIT | 9 | ✅ | +3 |
| TestDefinitionResourceTest | 5 | TestDefinitionResourceIT | 5 | ✅ | 0 |
| RoleResourceTest | 5 | RoleResourceIT | 11 | 🔧✅ | +6 |
| MetadataServiceResourceTest | 5 | MetadataServiceResourceIT | 11 | ✅ | +6 |
| DriveServiceResourceTest | 5 | DriveServiceResourceIT | 11 | ✅ | +6 |
| BotResourceTest | 5 | BotResourceIT | 5 | ✅ | 0 |
| AIGovernancePolicyResourceTest | 5 | AIGovernancePolicyResourceIT | 13 | 🔧✅ | +8 |
| WebAnalyticEventResourceTest | 4 | WebAnalyticEventResourceIT | 7 | ✅ | +3 |
| StorageServiceResourceTest | 4 | StorageServiceResourceIT | 6 | ✅ | +2 |
| SecurityServiceResourceTest | 4 | SecurityServiceResourceIT | 11 | ✅ | +7 |
| SearchServiceResourceTest | 4 | SearchServiceResourceIT | 8 | ✅ | +4 |
| ReportDataResourceTest | 4 | ReportDataResourceIT | 6 | ✅ | +2 |
| RdfResourceTest | 4 | RdfResourceIT | 4 | ✅ | 0 |
| MlModelServiceResourceTest | 4 | MlModelServiceResourceIT | 6 | ✅ | +2 |
| MessagingServiceResourceTest | 4 | MessagingServiceResourceIT | 7 | ✅ | +3 |
| LLMServiceResourceTest | 4 | LLMServiceResourceIT | 11 | 🔧✅ | +7 |
| DataInsightChartResourceTest | 4 | DataInsightChartResourceIT | 11 | 🔧✅ | +7 |
| DashboardServiceResourceTest | 4 | DashboardServiceResourceIT | 8 | ✅ | +4 |
| APIServiceResourceTest | 4 | APIServiceResourceIT | 7 | ✅ | +3 |
| PrometheusResourceTest | 3 | PrometheusResourceIT | 3 | ✅ | 0 |
| KpiResourceTest | 3 | KpiResourceIT | 11 | 🔧✅ | +8 |
| AgentExecutionResourceTest | 3 | AgentExecutionResourceIT | 5 | ✅ | +2 |
| TestConnectionDefinitionResourceTest | 2 | TestConnectionDefinitionResourceIT | 8 | ✅ | +6 |
| WorkflowResourceTest | 1 | WorkflowResourceIT | 15 | ✅ | +14 |
| ServiceResourceTest | 1 | BaseServiceIT | 0 | ⚠️ | -1 |
| AppMarketPlaceResourceTest | 0 | AppMarketPlaceResourceIT | 12 | ✅ | +12 |

### New Test Classes (No Source Equivalent)

| Target Class | Tests | Notes |
|--------------|-------|-------|
| DataContractPermissionIT | 11 | Permission-specific tests |
| PaginationIT | 1 | Pagination utility tests |
| DatabaseHierarchyIT | 1 | Hierarchy tests |
| DatabaseSmokeIT | 1 | Smoke tests |
| AlertsRuleEvaluatorResourceIT | 8 | Alerts tests |

---

## SDK Classes Missing (Blocking Migration)

These SDK fluent API classes need to be created in `openmetadata-java-sdk`:

| Missing SDK Class | Required By | Priority |
|-------------------|-------------|----------|
| `AIApplications` | AIApplicationResourceIT, SdkClients | HIGH |
| `AIGovernancePolicies` | AIGovernancePolicyResourceIT | HIGH |
| `Apps` | AppsResourceIT, SdkClients | HIGH |
| `Columns` | ColumnResourceIT | HIGH |
| `DataContracts` | DataContractResourceIT | HIGH |
| `Directories` | DirectoryResourceIT, SdkClients | MEDIUM |
| `Files` | FileResourceIT, SdkClients | MEDIUM |
| `LLMServices` | LLMServiceResourceIT | MEDIUM |
| `OpenLineage` | OpenLineageResourceIT | MEDIUM |
| `Personas` | PersonaResourceIT, UserResourceIT, SdkClients | HIGH |
| `PromptTemplates` | PromptTemplateResourceIT | LOW |
| `Roles` | SdkClients | HIGH |
| `Spreadsheets` | SpreadsheetResourceIT, SdkClients | MEDIUM |
| `Usage` | UsageResourceIT, SdkClients | HIGH |
| `Worksheets` | WorksheetResourceIT, SdkClients | MEDIUM |

### Missing SDK Service Classes

| Missing SDK Service | Required By | Priority |
|--------------------|-------------|----------|
| `PolicyService` | SharedEntities | HIGH |
| `RoleService` | SharedEntities | HIGH |
| `DataInsightChartService` | DataInsightChartResourceIT | MEDIUM |
| `KpiService` | KpiResourceIT | MEDIUM |
| `DriveServiceService` | WorksheetResourceIT | MEDIUM |

### Missing SDK Model Classes

| Missing Model | Required By |
|---------------|-------------|
| `TableColumnList` | TableResourceIT |
| `HttpResponseException` | EntityProfileResourceIT |

---

## Priority Test Gaps (Classes with Negative Gap)

These classes have FEWER tests in target than source and need attention:

| Class | Source | Target | Gap | Priority |
|-------|--------|--------|-----|----------|
| DataContractResourceTest | 100 | 80 | -20 | **CRITICAL** |
| DatabaseSchemaResourceTest | 15 | 9 | -6 | HIGH |
| MetricResourceTest | 17 | 6 | -6 | HIGH |
| ClassificationResourceTest | 9 | 4 | -5 | HIGH |
| APIEndpointResourceTest | 10 | 5 | -5 | HIGH |
| PermissionsResourceTest | 14 | 10 | -4 | MEDIUM |
| TagResourceTest | 19 | 16 | -3 | MEDIUM |
| SpreadsheetResourceTest | 17 | 14 | -3 | MEDIUM |
| FeedResourceTest | 50 | 47 | -3 | MEDIUM |
| UserResourceTest | 54 | 52 | -2 | MEDIUM |
| ColumnResourceTest | 29 | 27 | -2 | MEDIUM |
| PersonaResourceTest | 7 | 5 | -2 | LOW |
| APICollectionResourceTest | 6 | 4 | -2 | LOW |
| WorksheetResourceTest | 15 | 13 | -2 | LOW |
| AppsResourceTest | 16 | 14 | -2 | LOW |
| DatabaseResourceTest | 15 | 13 | -2 | LOW |
| IngestionPipelineResourceTest | 25 | 23 | -2 | LOW |

---

## DataContract Missing Tests Detail

Based on user summary, DataContract has 35 missing test categories:

### Security/Permissions (14 tests)
- [ ] testTableOwnerCanCreateDataContract
- [ ] testRegularUserCannotCreateDataContractForOthersTable
- [ ] testUserWithCreateDataContractPermissionCanCreate
- [ ] testTableOwnerCanUpdateTheirDataContract
- [ ] testRegularUserCannotUpdateOthersDataContract
- [ ] testTableOwnerCanPatchTheirDataContract
- [ ] testRegularUserCannotPatchOthersDataContract
- [ ] testTableOwnerCanDeleteTheirDataContract
- [ ] testRegularUserCannotDeleteOthersDataContract
- [ ] testAllUsersCanReadDataContracts
- [ ] testUserWithoutPermissionsCannotCreateDataContract
- [ ] testContractSecurityWith* tests (3+)

### ODCS Export/Import (7 tests)
- [ ] testExportDataContractToODCS
- [ ] testExportDataContractToODCSYaml
- [ ] testExportDataContractToODCSByFqn
- [ ] testImportDataContractFromODCS
- [ ] testImportDataContractFromODCSYaml
- [ ] testCreateOrUpdateDataContractFromODCS
- [ ] testODCSRoundTrip
- [ ] testODCSExportWithSLA

### Entity-specific constraints (8 tests)
- [ ] testDashboardEntityConstraints
- [ ] testTopicEntityConstraints
- [ ] testApiEndpointEntityConstraints
- [ ] testDashboardDataModelEntityConstraints
- [ ] testTableEntityConstraints
- [ ] test*SchemaValidationFailure tests (3+)

### Quality expectations (6 tests)
- [ ] testCreateDataContractWithQualityExpectations_TestSuiteCreated
- [ ] testUpdateDataContractQualityExpectations_TestSuiteUpdated
- [ ] testDeleteDataContractWithDQExpectationsDoesNotDeleteTestCases
- [ ] Additional quality tests (3+)

---

## DatabaseSchema Missing Tests Detail

Source has 15 tests, Target has 9 tests (6 missing):

- [ ] test_bulkFetchWithOwners_pagination
- [ ] test_bulkFetchWithTablesAndProfilerConfig_pagination
- [ ] test_inheritedFieldsWithPagination
- [ ] test_schemaEntityRelationship
- [ ] test_retentionPolicy
- [ ] test_customProperties

---

## Compilation Blockers

Current compilation errors in openmetadata-integration-tests:

1. `SharedEntities.java` - Missing PolicyService, RoleService
2. `AIApplicationResourceIT.java` - Missing AIApplications
3. `AIGovernancePolicyResourceIT.java` - Missing AIGovernancePolicies
4. `AppsResourceIT.java` - Missing Apps
5. `ColumnResourceIT.java` - Missing Columns
6. `DataContractResourceIT.java` - Missing DataContracts
7. `DataInsightChartResourceIT.java` - Missing DataInsightChartService
8. `DirectoryResourceIT.java` - Missing Directories
9. `EntityProfileResourceIT.java` - Missing HttpResponseException
10. `FileResourceIT.java` - Missing Files
11. `KpiResourceIT.java` - Missing KpiService
12. `LLMServiceResourceIT.java` - Missing LLMServices
13. `OpenLineageResourceIT.java` - Missing OpenLineage
14. `PromptTemplateResourceIT.java` - Missing PromptTemplates
15. `SpreadsheetResourceIT.java` - Missing Spreadsheets
16. `TableResourceIT.java` - Missing TableColumnList
17. `UsageResourceIT.java` - Missing Usage
18. `UserResourceIT.java` - Missing Personas
19. `WorksheetResourceIT.java` - Missing DriveServiceService
20. `SdkClients.java` - Multiple missing imports

---

## Migration Roadmap

### Phase 1: SDK Completion (Blocking)
1. Create missing fluent API classes in openmetadata-java-sdk
2. Create missing service classes
3. Fix compilation errors

### Phase 2: Critical Gap Tests
1. DataContractResourceIT - Add 35 missing tests
2. DatabaseSchemaResourceIT - Add 6 missing tests
3. MetricResourceIT - Add 6 missing tests

### Phase 3: High Priority Gaps
4. ClassificationResourceIT
5. APIEndpointResourceIT
6. PermissionsResourceIT

### Phase 4: Medium Priority Gaps
7. TagResourceIT
8. FeedResourceIT
9. UserResourceIT
10. ColumnResourceIT

### Phase 5: Validation & Cleanup
11. Remove deprecated old tests
12. Update CI/CD to use new module only
13. Archive old test module

---

## How to Use This Document

1. **Before starting work**: Check the migration status table for the entity you're working on
2. **When adding tests**: Update the Target Tests count and Status column
3. **When creating SDK classes**: Remove from "SDK Classes Missing" section
4. **Weekly**: Run the test count scripts to refresh numbers

### Refresh Test Counts

```bash
# Old module
find openmetadata-service/src/test/java/org/openmetadata/service/resources -name "*ResourceTest.java" \
  -exec sh -c 'echo "$(basename "$1" .java):$(grep -c "@Test" "$1")"' _ {} \; | sort -t: -k2 -rn

# New module
find openmetadata-integration-tests/src/test/java/org/openmetadata/it/tests -name "*IT.java" \
  -exec sh -c 'echo "$(basename "$1" .java):$(grep -c "@Test" "$1")"' _ {} \; | sort -t: -k2 -rn
```

---

## Related Files

- `MIGRATION_AUDIT.md` - Detailed audit report
- `TEST_MIGRATION_AUDIT.md` - Historical migration tracking
- `MIGRATION_STATUS.md` - Implementation approach documentation
- `SDK_CAPABILITIES_ANALYSIS.md` - SDK gap analysis
