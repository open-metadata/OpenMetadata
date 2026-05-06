# Playwright TS → Java Migration Tracking

Source: `openmetadata-ui/src/main/resources/ui/playwright/e2e/`
Target: `openmetadata-java-playwright/src/test/java/org/openmetadata/jpw/scenarios/ui/`

**Total: 258 specs across 5 phases**

## Architectural pattern (all phases)

Every Java port follows this pattern — no UI clicks for setup/teardown:

1. `SessionBrowser` — Chromium launched once per JVM, reused across tests
2. `PlaywrightContext` extension — fresh `BrowserContext` per `@Test`, JWT pre-injected
3. SDK-driven setup via `*TestFactory.createSimple(ns)` — no UI clicks
4. Page navigates straight to entity URL — no menu navigation
5. `TestNamespace` SDK cleanup on teardown

Naming: `<TsName>UIIT.java` under `org.openmetadata.jpw.scenarios.ui.<category>`.

Status legend: `todo` · `in-progress` · `blocked` · `done`

---

## Phase 0 — Foundation (no specs; primitives)

| Deliverable | Status |
|---|---|
| `SessionBrowser` singleton + shutdown hook (one Chromium per JVM) | todo |
| `UiSession` JUnit extension (per-test BrowserContext, JWT auto-injected) | todo |
| Auth init-script: skip UI login by seeding `localStorage.app_state` with JWT | todo |
| Page-object base class | todo |
| `ExplorePage`, `EntityDetailsPage`, `LoginPage` reference page objects | todo |
| Resolve broken apps in image (`RdfIndexApp`, `CacheWarmupApplication`) | todo |
| Failsafe wiring: `mvn verify -Dit.test=*UIIT` works zero-config | todo |
| **Parallelism: failsafe `forkCount=2 + parallel.factor=0.5`** | todo |
| **`@ResourceLock` taxonomy doc — global-state vs namespace-isolated tests** | todo |
| **TestNamespace audit — confirm isolation is airtight under concurrency** | todo |
| ✅ ContainerizedServer migrations | done |
| ✅ Bootstrap skip for containerized mode | done (via `skip.embedded.bootstrap=true`) |
| ✅ ReindexHelpers status case fix | done |
| ✅ `PW_HEADED` toggle | done |

### Parallel-safety taxonomy

Default: every UIIT runs in parallel under a unique `TestNamespace`. Tagged exceptions:

| Tag | Why | Affected categories |
|---|---|---|
| `@ResourceLock("GLOBAL_SETTINGS")` | mutates server-wide settings | `customization/*`, `settings/*`, `auth/SSOConfiguration`, `LoginConfiguration`, `OmdURLConfiguration` |
| `@ResourceLock("SEARCH_INDEX_APP")` | re-triggers global reindex | `dataquality/TestSuite*`, `ingestion/SearchIndexApplication`, `LiveIndexingTab` |
| `@ResourceLock("APPS")` | installs/uninstalls applications | `ingestion/App*`, `observability/DataInsightReportApplication` |
| `@ResourceLock("ALERTS")` | mutates global alert config | `observability/{Notification,Observability}Alerts`, `TeamSubscriptions` |
| `@Execution(SAME_THREAD)` | inherently sequential UI flows | `auth/SSORenewal`, `Tour` |

~35 of 258 specs need a tag. The other ~220 run fully concurrent.

---

## Phase 1 — Critical-path smoke (15 specs)

Target package: `scenarios.ui.smoke`

| TS spec | Java target | Status |
|---|---|---|
| `Pages/Login.spec.ts` | `smoke/LoginUIIT.java` | todo |
| `Flow/Navbar.spec.ts` | `smoke/NavbarUIIT.java` | todo |
| `Flow/GlobalSearch.spec.ts` | `smoke/GlobalSearchUIIT.java` | todo |
| `Features/Pagination.spec.ts` | `smoke/PaginationUIIT.java` | todo |
| `Flow/Tour.spec.ts` | `smoke/TourUIIT.java` | todo |
| `Features/Table.spec.ts` | `smoke/TableUIIT.java` | todo |
| `Features/Topic.spec.ts` | `smoke/TopicUIIT.java` | todo |
| `Features/Dashboards.spec.ts` | `smoke/DashboardsUIIT.java` | todo |
| `Features/Container.spec.ts` | `smoke/ContainerUIIT.java` | todo |
| `Pages/Glossary.spec.ts` | `smoke/GlossaryUIIT.java` | todo |
| `Pages/Teams.spec.ts` | `smoke/TeamsUIIT.java` | todo |
| `Pages/Users.spec.ts` | `smoke/UsersUIIT.java` | todo |
| `Pages/Roles.spec.ts` | `smoke/RolesUIIT.java` | todo |
| `Pages/Policies.spec.ts` | `smoke/PoliciesUIIT.java` | todo |
| `Features/ActivityFeed.spec.ts` | `smoke/ActivityFeedUIIT.java` | todo |

---

## Phase 2 — Cross-cutting features (~50 specs)

### Tasks (17 specs)
Target package: `scenarios.ui.tasks`

| TS spec | Java target | Status |
|---|---|---|
| `Features/Tasks/ActivityFeed.spec.ts` | `tasks/TaskActivityFeedUIIT.java` | todo |
| `Features/Tasks/DomainFiltering.spec.ts` | `tasks/TaskDomainFilteringUIIT.java` | todo |
| `Features/Tasks/TaskAllEntities.spec.ts` | `tasks/TaskAllEntitiesUIIT.java` | todo |
| `Features/Tasks/TaskAssigneeManagement.spec.ts` | `tasks/TaskAssigneeManagementUIIT.java` | todo |
| `Features/Tasks/TaskComments.spec.ts` | `tasks/TaskCommentsUIIT.java` | todo |
| `Features/Tasks/TaskContainerEntity.spec.ts` | `tasks/TaskContainerEntityUIIT.java` | todo |
| `Features/Tasks/TaskCreation.spec.ts` | `tasks/TaskCreationUIIT.java` | todo |
| `Features/Tasks/TaskCustomFormWorkflow.spec.ts` | `tasks/TaskCustomFormWorkflowUIIT.java` | todo |
| `Features/Tasks/TaskDashboardEntity.spec.ts` | `tasks/TaskDashboardEntityUIIT.java` | todo |
| `Features/Tasks/TaskEntityResolution.spec.ts` | `tasks/TaskEntityResolutionUIIT.java` | todo |
| `Features/Tasks/TaskNavigation.spec.ts` | `tasks/TaskNavigationUIIT.java` | todo |
| `Features/Tasks/TaskNestedFields.spec.ts` | `tasks/TaskNestedFieldsUIIT.java` | todo |
| `Features/Tasks/TaskPermissions.spec.ts` | `tasks/TaskPermissionsUIIT.java` | todo |
| `Features/Tasks/TaskPipelineEntity.spec.ts` | `tasks/TaskPipelineEntityUIIT.java` | todo |
| `Features/Tasks/TaskResolution.spec.ts` | `tasks/TaskResolutionUIIT.java` | todo |
| `Features/Tasks/TaskSuggestionAPIs.spec.ts` | `tasks/TaskSuggestionAPIsUIIT.java` | todo |
| `Features/Tasks/TaskTopicEntity.spec.ts` | `tasks/TaskTopicEntityUIIT.java` | todo |
| `Features/Tasks/TeamActivity.spec.ts` | `tasks/TeamActivityUIIT.java` | todo |
| `Features/Tasks.spec.ts` | `tasks/TasksOverviewUIIT.java` | todo |
| `Pages/Tasks.spec.ts` | `tasks/TasksPageUIIT.java` | todo |
| `Pages/TasksUIFlow.spec.ts` | `tasks/TasksUIFlowUIIT.java` | todo |
| `Pages/TaskComments.spec.ts` | `tasks/TaskCommentsPageUIIT.java` | todo |
| `Pages/TaskFormSettings.spec.ts` | `tasks/TaskFormSettingsUIIT.java` | todo |

### Lineage (7 specs)
Target package: `scenarios.ui.lineage`

| TS spec | Java target | Status |
|---|---|---|
| `Pages/Lineage/DataAssetLineage.spec.ts` | `lineage/DataAssetLineageUIIT.java` | todo |
| `Pages/Lineage/LineageControls.spec.ts` | `lineage/LineageControlsUIIT.java` | todo |
| `Pages/Lineage/LineageFilters.spec.ts` | `lineage/LineageFiltersUIIT.java` | todo |
| `Pages/Lineage/LineageInteraction.spec.ts` | `lineage/LineageInteractionUIIT.java` | todo |
| `Pages/Lineage/LineageNodePagination.spec.ts` | `lineage/LineageNodePaginationUIIT.java` | todo |
| `Pages/Lineage/LineageRightPanel.spec.ts` | `lineage/LineageRightPanelUIIT.java` | todo |
| `Pages/Lineage/PlatformLineage.spec.ts` | `lineage/PlatformLineageUIIT.java` | todo |
| `Flow/PlatformLineage.spec.ts` | `lineage/PlatformLineageFlowUIIT.java` | todo |
| `Flow/LineageSettings.spec.ts` | `lineage/LineageSettingsUIIT.java` | todo |
| `Features/LineagePipelineAnnotator.spec.ts` | `lineage/LineagePipelineAnnotatorUIIT.java` | todo |
| `Features/ImpactAnalysis.spec.ts` | `lineage/ImpactAnalysisUIIT.java` | todo |

### Permissions (5 specs)
Target package: `scenarios.ui.permissions`

| TS spec | Java target | Status |
|---|---|---|
| `Features/Permissions/DataProductPermissions.spec.ts` | `permissions/DataProductPermissionsUIIT.java` | todo |
| `Features/Permissions/DomainPermissions.spec.ts` | `permissions/DomainPermissionsUIIT.java` | todo |
| `Features/Permissions/EntityPermissions.spec.ts` | `permissions/EntityPermissionsUIIT.java` | todo |
| `Features/Permissions/GlossaryPermissions.spec.ts` | `permissions/GlossaryPermissionsUIIT.java` | todo |
| `Features/Permissions/ServiceEntityPermissions.spec.ts` | `permissions/ServiceEntityPermissionsUIIT.java` | todo |
| `Features/Permission.spec.ts` | `permissions/PermissionOverviewUIIT.java` | todo |
| `Flow/ConditionalPermissions.spec.ts` | `permissions/ConditionalPermissionsUIIT.java` | todo |
| `Flow/SearchRBAC.spec.ts` | `permissions/SearchRBACUIIT.java` | todo |
| `Flow/ServiceCreationPermissions.spec.ts` | `permissions/ServiceCreationPermissionsUIIT.java` | todo |
| `Pages/EntityDataConsumer.spec.ts` | `permissions/EntityDataConsumerUIIT.java` | todo |
| `Pages/EntityDataSteward.spec.ts` | `permissions/EntityDataStewardUIIT.java` | todo |
| `Flow/AddRoleAndAssignToUser.spec.ts` | `permissions/AddRoleAndAssignToUserUIIT.java` | todo |

### Domains, DataProducts, Tags (cross-cutting)
Target package: `scenarios.ui.domain`

| TS spec | Java target | Status |
|---|---|---|
| `Pages/Domains.spec.ts` | `domain/DomainsUIIT.java` | todo |
| `Pages/DomainAdvanced.spec.ts` | `domain/DomainAdvancedUIIT.java` | todo |
| `Pages/DomainDataProductsRightPanel.spec.ts` | `domain/DomainDataProductsRightPanelUIIT.java` | todo |
| `Pages/DomainUIInteractions.spec.ts` | `domain/DomainUIInteractionsUIIT.java` | todo |
| `Features/DomainFilterQueryFilter.spec.ts` | `domain/DomainFilterQueryFilterUIIT.java` | todo |
| `Features/DomainTierCertificationVoting.spec.ts` | `domain/DomainTierCertificationVotingUIIT.java` | todo |
| `Pages/DataProducts.spec.ts` | `domain/DataProductsUIIT.java` | todo |
| `Pages/DataProductAndSubdomains.spec.ts` | `domain/DataProductAndSubdomainsUIIT.java` | todo |
| `Pages/SubDomainPagination.spec.ts` | `domain/SubDomainPaginationUIIT.java` | todo |
| `Features/DataProductDomainMigration.spec.ts` | `domain/DataProductDomainMigrationUIIT.java` | todo |
| `Features/DataProductPersonaCustomization.spec.ts` | `domain/DataProductPersonaCustomizationUIIT.java` | todo |
| `Features/DataProductRename.spec.ts` | `domain/DataProductRenameUIIT.java` | todo |
| `Features/DataProductRenameConsolidation.spec.ts` | `domain/DataProductRenameConsolidationUIIT.java` | todo |
| `Pages/Tags.spec.ts` | `domain/TagsUIIT.java` | todo |
| `Pages/Tag.spec.ts` | `domain/TagUIIT.java` | todo |
| `Pages/TagPageRightPanel.spec.ts` | `domain/TagPageRightPanelUIIT.java` | todo |
| `Features/TagsSuggestion.spec.ts` | `domain/TagsSuggestionUIIT.java` | todo |
| `Pages/ClassificationConditionalRendering.spec.ts` | `domain/ClassificationConditionalRenderingUIIT.java` | todo |
| `Features/SystemCertificationTags.spec.ts` | `domain/SystemCertificationTagsUIIT.java` | todo |
| `Features/CertificationDropdown.spec.ts` | `domain/CertificationDropdownUIIT.java` | todo |
| `Features/MutuallyExclusiveColumnTags.spec.ts` | `domain/MutuallyExclusiveColumnTagsUIIT.java` | todo |

### Landing Page Widgets (4 specs)
Target package: `scenarios.ui.landing`

| TS spec | Java target | Status |
|---|---|---|
| `Features/LandingPageWidgets/DataAssetsWidget.spec.ts` | `landing/DataAssetsWidgetUIIT.java` | todo |
| `Features/LandingPageWidgets/DomainDataProductsWidgets.spec.ts` | `landing/DomainDataProductsWidgetsUIIT.java` | todo |
| `Features/LandingPageWidgets/DomainWidgetFilter.spec.ts` | `landing/DomainWidgetFilterUIIT.java` | todo |
| `Features/LandingPageWidgets/FollowingWidget.spec.ts` | `landing/FollowingWidgetUIIT.java` | todo |
| `Pages/LearningResources.spec.ts` | `landing/LearningResourcesUIIT.java` | todo |
| `Features/RecentlyViewed.spec.ts` | `landing/RecentlyViewedUIIT.java` | todo |

---

## Phase 3 — Heavy domains (~55 specs)

### Data Quality (18 specs)
Target package: `scenarios.ui.dataquality`

| TS spec | Java target | Status |
|---|---|---|
| `Features/DataQuality/AddTestCaseNewFlow.spec.ts` | `dataquality/AddTestCaseNewFlowUIIT.java` | todo |
| `Features/DataQuality/BundleSuiteBulkOperations.spec.ts` | `dataquality/BundleSuiteBulkOperationsUIIT.java` | todo |
| `Features/DataQuality/ColumnLevelTests.spec.ts` | `dataquality/ColumnLevelTestsUIIT.java` | todo |
| `Features/DataQuality/DataObservabilityGovernanceTab.spec.ts` | `dataquality/DataObservabilityGovernanceTabUIIT.java` | todo |
| `Features/DataQuality/DataQuality.spec.ts` | `dataquality/DataQualityUIIT.java` | todo |
| `Features/DataQuality/DataQualityDashboard.spec.ts` | `dataquality/DataQualityDashboardUIIT.java` | todo |
| `Features/DataQuality/DataQualityPermissions.spec.ts` | `dataquality/DataQualityPermissionsUIIT.java` | todo |
| `Features/DataQuality/Dimensionality.spec.ts` | `dataquality/DimensionalityUIIT.java` | todo |
| `Features/DataQuality/IncidentManagerDateFilter.spec.ts` | `dataquality/IncidentManagerDateFilterUIIT.java` | todo |
| `Features/DataQuality/Profiler.spec.ts` | `dataquality/ProfilerUIIT.java` | todo |
| `Features/DataQuality/TableLevelTests.spec.ts` | `dataquality/TableLevelTestsUIIT.java` | todo |
| `Features/DataQuality/TestCaseImportExportBasic.spec.ts` | `dataquality/TestCaseImportExportBasicUIIT.java` | todo |
| `Features/DataQuality/TestCaseImportExportE2eFlow.spec.ts` | `dataquality/TestCaseImportExportE2eFlowUIIT.java` | todo |
| `Features/DataQuality/TestCaseIncidentPermissions.spec.ts` | `dataquality/TestCaseIncidentPermissionsUIIT.java` | todo |
| `Features/DataQuality/TestCaseResultPermissions.spec.ts` | `dataquality/TestCaseResultPermissionsUIIT.java` | todo |
| `Features/DataQuality/TestDefinitionFilters.spec.ts` | `dataquality/TestDefinitionFiltersUIIT.java` | todo |
| `Features/DataQuality/TestDefinitionPermissions.spec.ts` | `dataquality/TestDefinitionPermissionsUIIT.java` | todo |
| `Features/DataQuality/TestLibrary.spec.ts` | `dataquality/TestLibraryUIIT.java` | todo |
| `Pages/TestSuite.spec.ts` | `dataquality/TestSuiteUIIT.java` | todo |
| `Pages/TestSuiteDetailsPage.spec.ts` | `dataquality/TestSuiteDetailsPageUIIT.java` | todo |
| `Features/TestSuiteMultiPipeline.spec.ts` | `dataquality/TestSuiteMultiPipelineUIIT.java` | todo |
| `Features/TestSuitePipelineRedeploy.spec.ts` | `dataquality/TestSuitePipelineRedeployUIIT.java` | todo |
| `Features/IncidentManager.spec.ts` | `dataquality/IncidentManagerUIIT.java` | todo |
| `Features/CustomMetric.spec.ts` | `dataquality/CustomMetricUIIT.java` | todo |
| `Features/MetricCustomUnitFlow.spec.ts` | `dataquality/MetricCustomUnitFlowUIIT.java` | todo |
| `Flow/Metric.spec.ts` | `dataquality/MetricUIIT.java` | todo |
| `Flow/MetricSearch.spec.ts` | `dataquality/MetricSearchUIIT.java` | todo |
| `Pages/ProfilerConfigurationPage.spec.ts` | `dataquality/ProfilerConfigurationPageUIIT.java` | todo |
| `Features/FailedTestCaseSampleData.spec.ts` | `dataquality/FailedTestCaseSampleDataUIIT.java` | todo |

### Glossary (18 specs)
Target package: `scenarios.ui.glossary`

| TS spec | Java target | Status |
|---|---|---|
| `Features/Glossary/GlossaryAdvancedOperations.spec.ts` | `glossary/GlossaryAdvancedOperationsUIIT.java` | todo |
| `Features/Glossary/GlossaryAssets.spec.ts` | `glossary/GlossaryAssetsUIIT.java` | todo |
| `Features/Glossary/GlossaryBulkOperations.spec.ts` | `glossary/GlossaryBulkOperationsUIIT.java` | todo |
| `Features/Glossary/GlossaryCRUDOperations.spec.ts` | `glossary/GlossaryCRUDOperationsUIIT.java` | todo |
| `Features/Glossary/GlossaryExpandAllWithStatusFilter.spec.ts` | `glossary/GlossaryExpandAllWithStatusFilterUIIT.java` | todo |
| `Features/Glossary/GlossaryHierarchy.spec.ts` | `glossary/GlossaryHierarchyUIIT.java` | todo |
| `Features/Glossary/GlossaryMiscOperations.spec.ts` | `glossary/GlossaryMiscOperationsUIIT.java` | todo |
| `Features/Glossary/GlossaryMutualExclusivity.spec.ts` | `glossary/GlossaryMutualExclusivityUIIT.java` | todo |
| `Features/Glossary/GlossaryNavigation.spec.ts` | `glossary/GlossaryNavigationUIIT.java` | todo |
| `Features/Glossary/GlossaryP2Tests.spec.ts` | `glossary/GlossaryP2TestsUIIT.java` | todo |
| `Features/Glossary/GlossaryP3Tests.spec.ts` | `glossary/GlossaryP3TestsUIIT.java` | todo |
| `Features/Glossary/GlossaryPagination.spec.ts` | `glossary/GlossaryPaginationUIIT.java` | todo |
| `Features/Glossary/GlossaryRemoveOperations.spec.ts` | `glossary/GlossaryRemoveOperationsUIIT.java` | todo |
| `Features/Glossary/GlossaryStatusFilterLargeDataset.spec.ts` | `glossary/GlossaryStatusFilterLargeDatasetUIIT.java` | todo |
| `Features/Glossary/GlossaryStatusFilterNestedTerms.spec.ts` | `glossary/GlossaryStatusFilterNestedTermsUIIT.java` | todo |
| `Features/Glossary/GlossaryTermDetails.spec.ts` | `glossary/GlossaryTermDetailsUIIT.java` | todo |
| `Features/Glossary/GlossaryVoting.spec.ts` | `glossary/GlossaryVotingUIIT.java` | todo |
| `Features/Glossary/GlossaryWorkflow.spec.ts` | `glossary/GlossaryWorkflowUIIT.java` | todo |
| `Features/Glossary/LargeGlossaryPerformance.spec.ts` | `glossary/LargeGlossaryPerformanceUIIT.java` | todo |
| `Features/Glossary/MUIGlossaryMutualExclusivity.spec.ts` | `glossary/MUIGlossaryMutualExclusivityUIIT.java` | todo |
| `Pages/GlossaryFormValidation.spec.ts` | `glossary/GlossaryFormValidationUIIT.java` | todo |
| `Pages/GlossaryImportExport.spec.ts` | `glossary/GlossaryImportExportUIIT.java` | todo |
| `Pages/GlossaryTermRightPanel.spec.ts` | `glossary/GlossaryTermRightPanelUIIT.java` | todo |

### Service ingestion + Bulk Import (heavy)
Target package: `scenarios.ui.ingestion`

| TS spec | Java target | Status |
|---|---|---|
| `Features/AutoPilot.spec.ts` | `ingestion/AutoPilotUIIT.java` | todo |
| `Features/BulkEditEntity.spec.ts` | `ingestion/BulkEditEntityUIIT.java` | todo |
| `Features/BulkImport.spec.ts` | `ingestion/BulkImportUIIT.java` | todo |
| `Features/BulkImportWithDotInName.spec.ts` | `ingestion/BulkImportWithDotInNameUIIT.java` | todo |
| `Features/CronValidations.spec.ts` | `ingestion/CronValidationsUIIT.java` | todo |
| `Pages/ServiceEntity.spec.ts` | `ingestion/ServiceEntityUIIT.java` | todo |
| `Pages/ServiceListing.spec.ts` | `ingestion/ServiceListingUIIT.java` | todo |
| `Flow/ServiceForm.spec.ts` | `ingestion/ServiceFormUIIT.java` | todo |
| `Flow/ServiceDocPanel.spec.ts` | `ingestion/ServiceDocPanelUIIT.java` | todo |
| `Pages/PipelineExecution.spec.ts` | `ingestion/PipelineExecutionUIIT.java` | todo |
| `Pages/LogsViewer.spec.ts` | `ingestion/LogsViewerUIIT.java` | todo |
| `Features/Workflows/WorkflowOssRestrictions.spec.ts` | `ingestion/WorkflowOssRestrictionsUIIT.java` | todo |
| `Flow/IngestionBot.spec.ts` | `ingestion/IngestionBotUIIT.java` | todo |
| `Pages/Bots.spec.ts` | `ingestion/BotsUIIT.java` | todo |
| `Pages/AppStopRunModal.spec.ts` | `ingestion/AppStopRunModalUIIT.java` | todo |
| `Pages/SearchIndexApplication.spec.ts` | `ingestion/SearchIndexApplicationUIIT.java` | todo |
| `Flow/AppBasic.spec.ts` | `ingestion/AppBasicUIIT.java` | todo |
| `Flow/Collect.spec.ts` | `ingestion/CollectUIIT.java` | todo |
| `Flow/PersonaFlow.spec.ts` | `ingestion/PersonaFlowUIIT.java` | todo |
| `Flow/PersonaDeletionUserProfile.spec.ts` | `ingestion/PersonaDeletionUserProfileUIIT.java` | todo |
| `Pages/UserCreationWithPersona.spec.ts` | `ingestion/UserCreationWithPersonaUIIT.java` | todo |

---

## Phase 4 — Long tail (~120 specs)

### Auth / SSO
Target package: `scenarios.ui.auth`

| TS spec | Java target | Status |
|---|---|---|
| `Auth/SSOAuthentication.spec.ts` | `auth/SSOAuthenticationUIIT.java` | todo |
| `Auth/SSOLogin.spec.ts` | `auth/SSOLoginUIIT.java` | todo |
| `Auth/SSORenewal.spec.ts` | `auth/SSORenewalUIIT.java` | todo |
| `Features/SSOConfiguration.spec.ts` | `auth/SSOConfigurationUIIT.java` | todo |
| `Pages/LoginConfiguration.spec.ts` | `auth/LoginConfigurationUIIT.java` | todo |
| `Pages/OmdURLConfiguration.spec.ts` | `auth/OmdURLConfigurationUIIT.java` | todo |

### Search & Explore
Target package: `scenarios.ui.search`

| TS spec | Java target | Status |
|---|---|---|
| `Features/AdvancedSearch.spec.ts` | `search/AdvancedSearchUIIT.java` | todo |
| `Features/AdvancedSearchSuggestions.spec.ts` | `search/AdvancedSearchSuggestionsUIIT.java` | todo |
| `Features/GlobalSearchSuggestions.spec.ts` | `search/GlobalSearchSuggestionsUIIT.java` | todo |
| `Features/ExploreQuickFilters.spec.ts` | `search/ExploreQuickFiltersUIIT.java` | todo |
| `Features/ExploreSortOrderFilter.spec.ts` | `search/ExploreSortOrderFilterUIIT.java` | todo |
| `Features/SchemaSearch.spec.ts` | `search/SchemaSearchUIIT.java` | todo |
| `Features/TableSearch.spec.ts` | `search/TableSearchUIIT.java` | todo |
| `Features/TableSorting.spec.ts` | `search/TableSortingUIIT.java` | todo |
| `Features/SearchExport.spec.ts` | `search/SearchExportUIIT.java` | todo |
| `Pages/SearchSettings.spec.ts` | `search/SearchSettingsUIIT.java` | todo |
| `Pages/ExplorePageRightPanel.spec.ts` | `search/ExplorePageRightPanelUIIT.java` | todo |
| `Pages/ExploreTree.spec.ts` | `search/ExploreTreeUIIT.java` | todo |
| `Flow/ExploreAggregationCountsMatching.spec.ts` | `search/ExploreAggregationCountsMatchingUIIT.java` | todo |
| `Flow/ExploreDiscovery.spec.ts` | `search/ExploreDiscoveryUIIT.java` | todo |
| `Features/CuratedAssets.spec.ts` | `search/CuratedAssetsUIIT.java` | todo |
| `Features/Pagination.spec.ts` already in Phase 1 | - | - |
| `Features/GlobalPageSize.spec.ts` | `search/GlobalPageSizeUIIT.java` | todo |
| `Pages/LiveIndexingTab.spec.ts` | `search/LiveIndexingTabUIIT.java` | todo |

### Customization & Theming
Target package: `scenarios.ui.customization`

| TS spec | Java target | Status |
|---|---|---|
| `Pages/CustomThemeConfig.spec.ts` | `customization/CustomThemeConfigUIIT.java` | todo |
| `Pages/CustomProperties.spec.ts` | `customization/CustomPropertiesUIIT.java` | todo |
| `Features/CustomizeDetailPage.spec.ts` | `customization/CustomizeDetailPageUIIT.java` | todo |
| `Flow/CustomizeLandingPage.spec.ts` | `customization/CustomizeLandingPageUIIT.java` | todo |
| `Flow/CustomizeWidgets.spec.ts` | `customization/CustomizeWidgetsUIIT.java` | todo |
| `Features/LanguageOverride.spec.ts` | `customization/LanguageOverrideUIIT.java` | todo |
| `Features/RTL.spec.ts` | `customization/RTLUIIT.java` | todo |
| `Features/Markdown.spec.ts` | `customization/MarkdownUIIT.java` | todo |

### Data Contracts & ODCS
Target package: `scenarios.ui.contracts`

| TS spec | Java target | Status |
|---|---|---|
| `Pages/DataContracts.spec.ts` | `contracts/DataContractsUIIT.java` | todo |
| `Pages/DataContractInheritance.spec.ts` | `contracts/DataContractInheritanceUIIT.java` | todo |
| `Pages/DataContractsSemanticRules.spec.ts` | `contracts/DataContractsSemanticRulesUIIT.java` | todo |
| `Features/DataAssetRulesDisabled.spec.ts` | `contracts/DataAssetRulesDisabledUIIT.java` | todo |
| `Features/DataAssetRulesEnabled.spec.ts` | `contracts/DataAssetRulesEnabledUIIT.java` | todo |
| `Pages/ODCSImportExport.spec.ts` | `contracts/ODCSImportExportUIIT.java` | todo |
| `Pages/ODCSImportExportPermissions.spec.ts` | `contracts/ODCSImportExportPermissionsUIIT.java` | todo |
| `Features/CSVImportWithQuotesAndCommas.spec.ts` already → in `Pages` | - | - |
| `Pages/CSVImportWithQuotesAndCommas.spec.ts` | `contracts/CSVImportWithQuotesAndCommasUIIT.java` | todo |

### Data Marketplace
Target package: `scenarios.ui.marketplace`

| TS spec | Java target | Status |
|---|---|---|
| `Pages/DataMarketplace.spec.ts` | `marketplace/DataMarketplaceUIIT.java` | todo |
| `Pages/DataMarketplaceAnnouncements.spec.ts` | `marketplace/DataMarketplaceAnnouncementsUIIT.java` | todo |
| `Pages/DataMarketplacePermissions.spec.ts` | `marketplace/DataMarketplacePermissionsUIIT.java` | todo |
| `Features/Announcements/AnnouncementEntity.spec.ts` | `marketplace/AnnouncementEntityUIIT.java` | todo |

### Data Insight & Observability
Target package: `scenarios.ui.observability`

| TS spec | Java target | Status |
|---|---|---|
| `Pages/DataInsight.spec.ts` | `observability/DataInsightUIIT.java` | todo |
| `Pages/DataInsightSettings.spec.ts` | `observability/DataInsightSettingsUIIT.java` | todo |
| `Pages/DataInsightReportApplication.spec.ts` | `observability/DataInsightReportApplicationUIIT.java` | todo |
| `Pages/AuditLogs.spec.ts` | `observability/AuditLogsUIIT.java` | todo |
| `Pages/HealthCheck.spec.ts` | `observability/HealthCheckUIIT.java` | todo |
| `Flow/NotificationAlerts.spec.ts` | `observability/NotificationAlertsUIIT.java` | todo |
| `Flow/ObservabilityAlerts.spec.ts` | `observability/ObservabilityAlertsUIIT.java` | todo |
| `Features/TeamSubscriptions.spec.ts` | `observability/TeamSubscriptionsUIIT.java` | todo |
| `Features/OnlineUsers.spec.ts` | `observability/OnlineUsersUIIT.java` | todo |
| `Features/UserProfileOnlineStatus.spec.ts` | `observability/UserProfileOnlineStatusUIIT.java` | todo |

### Entity-level features (long tail)
Target package: `scenarios.ui.entity`

| TS spec | Java target | Status |
|---|---|---|
| `Pages/Entity.spec.ts` | `entity/EntityUIIT.java` | todo |
| `Features/EntityRenameConsolidation.spec.ts` | `entity/EntityRenameConsolidationUIIT.java` | todo |
| `Features/EntityRightCollapsablePanel.spec.ts` | `entity/EntityRightCollapsablePanelUIIT.java` | todo |
| `Features/EntitySummaryPanel.spec.ts` | `entity/EntitySummaryPanelUIIT.java` | todo |
| `Features/MultipleRename.spec.ts` | `entity/MultipleRenameUIIT.java` | todo |
| `Features/RestoreEntityInheritedFields.spec.ts` | `entity/RestoreEntityInheritedFieldsUIIT.java` | todo |
| `Features/ChangeSummaryBadge.spec.ts` | `entity/ChangeSummaryBadgeUIIT.java` | todo |
| `Features/ColumnBulkOperations.spec.ts` | `entity/ColumnBulkOperationsUIIT.java` | todo |
| `Features/ColumnSorting.spec.ts` | `entity/ColumnSortingUIIT.java` | todo |
| `Features/NavigationBlocker.spec.ts` | `entity/NavigationBlockerUIIT.java` | todo |
| `Features/NestedColumnsExpandCollapse.spec.ts` | `entity/NestedColumnsExpandCollapseUIIT.java` | todo |
| `Features/DescriptionSuggestion.spec.ts` | `entity/DescriptionSuggestionUIIT.java` | todo |
| `Pages/DescriptionVisibility.spec.ts` | `entity/DescriptionVisibilityUIIT.java` | todo |
| `Pages/InputOutputPorts.spec.ts` | `entity/InputOutputPortsUIIT.java` | todo |
| `Pages/SchemaTable.spec.ts` | `entity/SchemaTableUIIT.java` | todo (Flow path) |
| `Flow/SchemaTable.spec.ts` | `entity/SchemaTableFlowUIIT.java` | todo |
| `Flow/NestedChildrenUpdates.spec.ts` | `entity/NestedChildrenUpdatesUIIT.java` | todo |
| `Flow/FrequentlyJoined.spec.ts` | `entity/FrequentlyJoinedUIIT.java` | todo |
| `Features/SampleDataDomainDataProduct.spec.ts` | `entity/SampleDataDomainDataProductUIIT.java` | todo |
| `Features/SampleDataTableOperations.spec.ts` | `entity/SampleDataTableOperationsUIIT.java` | todo |
| `Features/SchemaDefinition.spec.ts` | `entity/SchemaDefinitionUIIT.java` | todo |
| `Features/QueryEntity.spec.ts` | `entity/QueryEntityUIIT.java` | todo |
| `Features/Container.spec.ts` already in Phase 1 | - | - |
| `Features/TableConstraint.spec.ts` | `entity/TableConstraintUIIT.java` | todo |
| `Features/Topic.spec.ts` already in Phase 1 | - | - |
| `Features/Dashboards.spec.ts` already in Phase 1 | - | - |

### API Service & APIs
Target package: `scenarios.ui.apis`

| TS spec | Java target | Status |
|---|---|---|
| `Flow/ApiCollection.spec.ts` | `apis/ApiCollectionUIIT.java` | todo |
| `Flow/ApiDocs.spec.ts` | `apis/ApiDocsUIIT.java` | todo |
| `Flow/ApiServiceRest.spec.ts` | `apis/ApiServiceRestUIIT.java` | todo |
| `Features/ActivityAPI.spec.ts` | `apis/ActivityAPIUIIT.java` | todo |
| `Features/ActivityStream.spec.ts` | `apis/ActivityStreamUIIT.java` | todo |

### Teams (long tail beyond Phase 1)
Target package: `scenarios.ui.teams`

| TS spec | Java target | Status |
|---|---|---|
| `Features/TeamsDragAndDrop.spec.ts` | `teams/TeamsDragAndDropUIIT.java` | todo |
| `Features/TeamsHierarchy.spec.ts` | `teams/TeamsHierarchyUIIT.java` | todo |
| `Pages/TeamAssetsRightPanel.spec.ts` | `teams/TeamAssetsRightPanelUIIT.java` | todo |
| `Pages/UserDetails.spec.ts` | `teams/UserDetailsUIIT.java` | todo |
| `Flow/UsersPagination.spec.ts` | `teams/UsersPaginationUIIT.java` | todo |

### Ontology
Target package: `scenarios.ui.ontology`

| TS spec | Java target | Status |
|---|---|---|
| `Features/OntologyExplorer.spec.ts` | `ontology/OntologyExplorerUIIT.java` | todo |
| `Features/OntologyExplorerFilters.spec.ts` | `ontology/OntologyExplorerFiltersUIIT.java` | todo |
| `Features/OntologyExplorerIntegration.spec.ts` | `ontology/OntologyExplorerIntegrationUIIT.java` | todo |
| `Features/KnowledgeGraph.spec.ts` | `ontology/KnowledgeGraphUIIT.java` | todo |

### Settings & misc
Target package: `scenarios.ui.settings`

| TS spec | Java target | Status |
|---|---|---|
| `Features/SettingsNavigationPage.spec.ts` | `settings/SettingsNavigationPageUIIT.java` | todo |

### Version Pages (5 specs)
Target package: `scenarios.ui.versions`

| TS spec | Java target | Status |
|---|---|---|
| `VersionPages/ClassificationVersionPage.spec.ts` | `versions/ClassificationVersionPageUIIT.java` | todo |
| `VersionPages/EntityVersionPages.spec.ts` | `versions/EntityVersionPagesUIIT.java` | todo |
| `VersionPages/GlossaryVersionPage.spec.ts` | `versions/GlossaryVersionPageUIIT.java` | todo |
| `VersionPages/ServiceEntityVersionPage.spec.ts` | `versions/ServiceEntityVersionPageUIIT.java` | todo |
| `VersionPages/TestCaseVersionPage.spec.ts` | `versions/TestCaseVersionPageUIIT.java` | todo |

### Nightly-only (2 specs)
Target package: `scenarios.ui.nightly`

| TS spec | Java target | Status |
|---|---|---|
| `nightly/AutoClassification.spec.ts` | `nightly/AutoClassificationUIIT.java` | todo |
| `nightly/ServiceIngestion.spec.ts` | `nightly/ServiceIngestionUIIT.java` | todo |

---

## Phase 5 — Cutover

- Run TS + Java suites in parallel for 2 sprints
- Parity dashboard: pass-rate per spec, side-by-side
- Retire each TS spec when its Java counterpart has been green for 2 weeks of nightlies
- Delete the `playwright/` TS directory once Phase 5 is complete
