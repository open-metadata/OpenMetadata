# Test Migration Audit: openmetadata-service → openmetadata-integration-tests

## Summary (Updated: 2025-12-21)

**Total Tests: 2,792 passing in ~3:14 min (parallel execution)**

---

## Migration Status Overview

| Category | Original | Migrated | Remaining | Coverage |
|----------|----------|----------|-----------|----------|
| Entity Resource Tests | 45 | 26 | 19 | 58% |
| Service Resource Tests | 12 | 0 | 12 | 0% |
| Non-Entity Resource Tests | 18 | 0 | 18 | 0% |
| **Total** | **75** | **26** | **49** | **35%** |

---

## Migrated Entity Tests (26 classes) ✅

| Original Test | Migrated IT | Status | Inherited Tests |
|---------------|-------------|--------|-----------------|
| ChartResourceTest | ChartResourceIT | ✅ Complete | 96+ |
| ClassificationResourceTest | ClassificationResourceIT | ✅ Complete | 96+ |
| ContainerResourceTest | ContainerResourceIT | ✅ Complete | 96+ |
| DashboardResourceTest | DashboardResourceIT | ✅ Complete | 96+ |
| DatabaseResourceTest | DatabaseResourceIT | ✅ Complete | 96+ |
| DatabaseSchemaResourceTest | DatabaseSchemaResourceIT | ✅ Complete | 96+ |
| DataProductResourceTest | DataProductResourceIT | ✅ Complete | 96+ |
| DomainResourceTest | DomainResourceIT | ✅ Complete | 96+ |
| GlossaryResourceTest | GlossaryResourceIT | ✅ Complete | 96+ |
| GlossaryTermResourceTest | GlossaryTermResourceIT | ✅ Complete | 96+ |
| MetricResourceTest | MetricResourceIT | ✅ Complete | 96+ |
| MlModelResourceTest | MlModelResourceIT | ✅ Complete | 96+ |
| PipelineResourceTest | PipelineResourceIT | ✅ Complete | 96+ |
| PolicyResourceTest | PolicyResourceIT | ✅ Complete | 96+ |
| QueryResourceTest | QueryResourceIT | ✅ Complete | 96+ |
| RoleResourceTest | RoleResourceIT | ✅ Complete | 96+ |
| SearchIndexResourceTest | SearchIndexResourceIT | ✅ Complete | 96+ |
| StoredProcedureResourceTest | StoredProcedureResourceIT | ✅ Complete | 96+ |
| TableResourceTest | TableResourceIT | ✅ Complete | 96+ |
| TagResourceTest | TagResourceIT | ✅ Complete | 96+ |
| TeamResourceTest | TeamResourceIT | ✅ Complete | 96+ |
| TestCaseResourceTest | TestCaseResourceIT | ✅ Complete | 96+ |
| TestDefinitionResourceTest | TestDefinitionResourceIT | ✅ Complete | 96+ |
| TestSuiteResourceTest | TestSuiteResourceIT | ✅ Complete | 96+ |
| TopicResourceTest | TopicResourceIT | ✅ Complete | 96+ |
| UserResourceTest | UserResourceIT | ✅ Complete | 96+ |

---

## Remaining Entity Tests (19 classes) - Priority: MEDIUM

| Original Test | Priority | Notes |
|---------------|----------|-------|
| APICollectionResourceTest | MEDIUM | API entity |
| APIEndpointResourceTest | MEDIUM | API entity |
| BotResourceTest | MEDIUM | System entity |
| PersonaResourceTest | MEDIUM | Team entity |
| EventSubscriptionResourceTest | MEDIUM | Events |
| IngestionPipelineResourceTest | MEDIUM | Ingestion |
| KpiResourceTest | MEDIUM | Analytics |
| DashboardDataModelResourceTest | MEDIUM | Dashboard child |
| DataInsightChartResourceTest | LOW | Analytics |
| DataContractResourceTest | LOW | Data contract |
| TypeResourceTest | LOW | Metadata types |
| WorkflowResourceTest | LOW | Automations |
| AppsResourceTest | LOW | Applications |
| AppMarketPlaceResourceTest | LOW | App marketplace |
| DocStoreResourceTest | LOW | Doc store |
| NotificationTemplateResourceTest | LOW | Notifications |
| DirectoryResourceTest | LOW | Drive entities |
| FileResourceTest | LOW | Drive entities |
| SpreadsheetResourceTest | LOW | Drive entities |
| WorksheetResourceTest | LOW | Drive entities |
| FeedResourceTest | LOW | Activity feeds |
| SuggestionsResourceTest | LOW | Suggestions |

---

## Remaining Service Tests (12 classes) - Priority: MEDIUM

| Original Test | Notes |
|---------------|-------|
| DatabaseServiceResourceTest | Service CRUD |
| DashboardServiceResourceTest | Service CRUD |
| MessagingServiceResourceTest | Service CRUD |
| PipelineServiceResourceTest | Service CRUD |
| MlModelServiceResourceTest | Service CRUD |
| StorageServiceResourceTest | Service CRUD |
| SearchServiceResourceTest | Service CRUD |
| APIServiceResourceTest | Service CRUD |
| MetadataServiceResourceTest | Service CRUD |
| DriveServiceResourceTest | Service CRUD |
| SecurityServiceResourceTest | Security |
| TestConnectionDefinitionResourceTest | Connection testing |

---

## Remaining Non-Entity Tests (18 classes) - Priority: LOW

| Original Test | Notes |
|---------------|-------|
| LineageResourceTest | Lineage API |
| SearchResourceTest | Search API |
| FeedResourceTest | Activity feeds |
| RdfResourceTest | RDF/SPARQL |
| UsageResourceTest | Usage stats |
| PermissionsResourceTest | Permissions API |
| EntityProfileResourceTest | Entity profiles |
| ColumnResourceTest | Column operations |
| ConfigResourceTest | Config API |
| SystemResourceTest | System API |
| PrometheusResourceTest | Metrics |
| UserMetricsResourceTest | User metrics |
| WebAnalyticEventResourceTest | Web analytics |
| ReportDataResourceTest | Reports |
| ChangeEventParserResourceTest | Event parsing |
| IngestionPipelineLogStreamingResourceTest | Log streaming |
| ServiceResourceTest | Base service tests |

---

## BaseEntityIT Tests (96+ tests per entity)

Each migrated entity inherits these tests from BaseEntityIT:

### CRUD Tests (15):
- post_entityCreate_200_OK
- post_duplicateEntity_409
- post_entityCreateWithInvalidName_400
- get_entity_200_OK
- get_entityByName_200_OK
- get_entityNotFound_404
- get_entityWithDifferentFields_200_OK
- get_entityListWithPagination_200
- get_entityIncludeDeleted_200
- get_entityVersionHistory_200
- get_specificVersion_200
- put_entityCreate_200
- put_entityUpdateWithNoChange_200
- delete_entity_soft_200
- delete_restore_entity_200

### Patch Tests (20):
- patch_entityDescription_200_OK
- patch_entityUpdateOwner_200
- patch_entityDomain_200
- patch_dataProducts_200
- patch_versionTracking_200
- patch_concurrentUpdates_optimisticLock
- ... and more

### Tag Tests (4):
- test_entityWithInvalidTag
- test_tagUpdateOptimization_PUT
- test_tagUpdateOptimization_PATCH
- test_tagUpdateOptimization_LargeScale

### Follower Tests (3):
- put_addDeleteFollower_200
- put_addFollowerDeleteEntity_200
- put_addDeleteInvalidFollower_4xx

### ETag/Concurrency Tests (5):
- patch_etag_in_get_response
- patch_with_valid_etag
- patch_with_stale_etag
- patch_concurrent_updates_with_etag
- patch_concurrentUpdates_dataLossTest

### SDK Tests (9):
- test_sdkCRUDOperations
- test_sdkDeleteWithOptions
- test_sdkEntityWithTags
- test_sdkEntityWithOwners
- test_sdkEntityWithDomainAndDataProducts
- testListFluentAPI
- testAutoPaginationFluentAPI
- testBulkFluentAPI
- ... and more

---

## Feature Flags per Entity

| Entity | supportsFollowers | supportsTags | supportsDataProducts | supportsNameLengthValidation | supportsSoftDelete | supportsPatchDomains |
|--------|-------------------|--------------|----------------------|------------------------------|--------------------|-----------------------|
| Classification | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| DataProduct | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ |
| GlossaryTerm | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Metric | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Query | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ |
| TestSuite | ❌ | ✅ | ❌ | ✅ | ✅ | ✅ |
| TestDefinition | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| TestCase | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| All others | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

---

## SDK Services Status

| Service | Status | Notes |
|---------|--------|-------|
| TableService | ✅ | Full CRUD |
| DatabaseService | ✅ | Full CRUD |
| DatabaseSchemaService | ✅ | Full CRUD |
| UserService | ✅ | Full CRUD |
| TeamService | ✅ | Full CRUD |
| RoleService | ✅ | Full CRUD |
| PolicyService | ✅ | Full CRUD |
| DomainService | ✅ | Full CRUD |
| GlossaryService | ✅ | Full CRUD |
| ClassificationService | ✅ | Full CRUD |
| TagService | ✅ | Full CRUD |
| TopicService | ✅ | Full CRUD |
| ChartService | ✅ | Full CRUD |
| DashboardService | ✅ | Full CRUD |
| PipelineService | ✅ | Full CRUD |
| MlModelService | ✅ | Full CRUD |
| ContainerService | ✅ | Full CRUD |
| SearchIndexService | ✅ | Full CRUD |
| StoredProcedureService | ✅ | Full CRUD |
| TestSuiteService | ✅ | Full CRUD |
| TestDefinitionService | ✅ | Full CRUD |
| TestCaseService | ✅ | Custom PATCH |

---

## Latest Test Run (2025-12-21)

```
Tests run: 2792, Failures: 0, Errors: 0, Skipped: 0
BUILD SUCCESS
Time: 3:14 min (parallel execution)
```

---

## Next Migration Priorities

### Phase 1: ✅ COMPLETED - High Priority Entity Tests
1. ✅ GlossaryTermResourceTest → GlossaryTermResourceIT
2. ✅ DataProductResourceTest → DataProductResourceIT
3. ✅ QueryResourceTest → QueryResourceIT
4. ✅ MetricResourceTest → MetricResourceIT

### Phase 2: Medium Priority Entity Tests
5. APICollectionResourceTest → APICollectionResourceIT
6. APIEndpointResourceTest → APIEndpointResourceIT
7. BotResourceTest → BotResourceIT
8. PersonaResourceTest → PersonaResourceIT
9. EventSubscriptionResourceTest → EventSubscriptionResourceIT
10. IngestionPipelineResourceTest → IngestionPipelineResourceIT
11. KpiResourceTest → KpiResourceIT
12. DashboardDataModelResourceTest → DashboardDataModelResourceIT

### Phase 3: Service Tests
13. DatabaseServiceResourceTest → DatabaseServiceResourceIT
14. DashboardServiceResourceTest → DashboardServiceResourceIT
... (all service tests)

### Phase 4: Non-Entity Tests
- LineageResourceTest
- SearchResourceTest
- FeedResourceTest
- ... (remaining non-entity tests)
