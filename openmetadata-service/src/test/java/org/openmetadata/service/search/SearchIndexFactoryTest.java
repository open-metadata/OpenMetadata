package org.openmetadata.service.search;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.util.Set;
import java.util.function.Supplier;
import java.util.stream.Stream;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.openmetadata.schema.analytics.ReportData;
import org.openmetadata.schema.entity.ai.AIApplication;
import org.openmetadata.schema.entity.ai.AIGovernancePolicy;
import org.openmetadata.schema.entity.ai.LLMModel;
import org.openmetadata.schema.entity.ai.McpExecution;
import org.openmetadata.schema.entity.ai.McpServer;
import org.openmetadata.schema.entity.ai.PromptTemplate;
import org.openmetadata.schema.entity.classification.Classification;
import org.openmetadata.schema.entity.classification.Tag;
import org.openmetadata.schema.entity.data.APICollection;
import org.openmetadata.schema.entity.data.APIEndpoint;
import org.openmetadata.schema.entity.data.Chart;
import org.openmetadata.schema.entity.data.Container;
import org.openmetadata.schema.entity.data.Dashboard;
import org.openmetadata.schema.entity.data.DashboardDataModel;
import org.openmetadata.schema.entity.data.Database;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Directory;
import org.openmetadata.schema.entity.data.File;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.entity.data.Metric;
import org.openmetadata.schema.entity.data.MlModel;
import org.openmetadata.schema.entity.data.Pipeline;
import org.openmetadata.schema.entity.data.PipelineStatus;
import org.openmetadata.schema.entity.data.Query;
import org.openmetadata.schema.entity.data.QueryCostRecord;
import org.openmetadata.schema.entity.data.Spreadsheet;
import org.openmetadata.schema.entity.data.StoredProcedure;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.data.Topic;
import org.openmetadata.schema.entity.data.Worksheet;
import org.openmetadata.schema.entity.domains.DataProduct;
import org.openmetadata.schema.entity.domains.Domain;
import org.openmetadata.schema.entity.services.ApiService;
import org.openmetadata.schema.entity.services.DashboardService;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.entity.services.DriveService;
import org.openmetadata.schema.entity.services.LLMService;
import org.openmetadata.schema.entity.services.McpService;
import org.openmetadata.schema.entity.services.MessagingService;
import org.openmetadata.schema.entity.services.MetadataService;
import org.openmetadata.schema.entity.services.MlModelService;
import org.openmetadata.schema.entity.services.PipelineService;
import org.openmetadata.schema.entity.services.SearchService;
import org.openmetadata.schema.entity.services.SecurityService;
import org.openmetadata.schema.entity.services.StorageService;
import org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.schema.entity.teams.Team;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.tests.TestCase;
import org.openmetadata.schema.tests.TestSuite;
import org.openmetadata.schema.tests.type.TestCaseResolutionStatus;
import org.openmetadata.schema.tests.type.TestCaseResult;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.TestCaseRepository;
import org.openmetadata.service.search.indexes.APICollectionIndex;
import org.openmetadata.service.search.indexes.APIEndpointIndex;
import org.openmetadata.service.search.indexes.APIServiceIndex;
import org.openmetadata.service.search.indexes.AggregatedCostAnalysisReportDataIndex;
import org.openmetadata.service.search.indexes.AiApplicationIndex;
import org.openmetadata.service.search.indexes.AiGovernancePolicyIndex;
import org.openmetadata.service.search.indexes.ChartIndex;
import org.openmetadata.service.search.indexes.ClassificationIndex;
import org.openmetadata.service.search.indexes.ContainerIndex;
import org.openmetadata.service.search.indexes.DashboardDataModelIndex;
import org.openmetadata.service.search.indexes.DashboardIndex;
import org.openmetadata.service.search.indexes.DashboardServiceIndex;
import org.openmetadata.service.search.indexes.DataProductIndex;
import org.openmetadata.service.search.indexes.DatabaseIndex;
import org.openmetadata.service.search.indexes.DatabaseSchemaIndex;
import org.openmetadata.service.search.indexes.DatabaseServiceIndex;
import org.openmetadata.service.search.indexes.DirectoryIndex;
import org.openmetadata.service.search.indexes.DomainIndex;
import org.openmetadata.service.search.indexes.DriveServiceIndex;
import org.openmetadata.service.search.indexes.EntityReportDataIndex;
import org.openmetadata.service.search.indexes.FileIndex;
import org.openmetadata.service.search.indexes.GlossaryIndex;
import org.openmetadata.service.search.indexes.GlossaryTermIndex;
import org.openmetadata.service.search.indexes.IngestionPipelineIndex;
import org.openmetadata.service.search.indexes.LlmModelIndex;
import org.openmetadata.service.search.indexes.LlmServiceIndex;
import org.openmetadata.service.search.indexes.McpExecutionIndex;
import org.openmetadata.service.search.indexes.McpServerIndex;
import org.openmetadata.service.search.indexes.McpServiceIndex;
import org.openmetadata.service.search.indexes.MessagingServiceIndex;
import org.openmetadata.service.search.indexes.MetadataServiceIndex;
import org.openmetadata.service.search.indexes.MetricIndex;
import org.openmetadata.service.search.indexes.MlModelIndex;
import org.openmetadata.service.search.indexes.MlModelServiceIndex;
import org.openmetadata.service.search.indexes.PipelineExecutionIndex;
import org.openmetadata.service.search.indexes.PipelineIndex;
import org.openmetadata.service.search.indexes.PipelineServiceIndex;
import org.openmetadata.service.search.indexes.PromptTemplateIndex;
import org.openmetadata.service.search.indexes.QueryCostRecordIndex;
import org.openmetadata.service.search.indexes.QueryIndex;
import org.openmetadata.service.search.indexes.RawCostAnalysisReportDataIndex;
import org.openmetadata.service.search.indexes.SearchEntityIndex;
import org.openmetadata.service.search.indexes.SearchIndex;
import org.openmetadata.service.search.indexes.SearchServiceIndex;
import org.openmetadata.service.search.indexes.SecurityServiceIndex;
import org.openmetadata.service.search.indexes.SpreadsheetIndex;
import org.openmetadata.service.search.indexes.StorageServiceIndex;
import org.openmetadata.service.search.indexes.StoredProcedureIndex;
import org.openmetadata.service.search.indexes.TableIndex;
import org.openmetadata.service.search.indexes.TagIndex;
import org.openmetadata.service.search.indexes.TeamIndex;
import org.openmetadata.service.search.indexes.TestCaseIndex;
import org.openmetadata.service.search.indexes.TestCaseResolutionStatusIndex;
import org.openmetadata.service.search.indexes.TestCaseResultIndex;
import org.openmetadata.service.search.indexes.TestSuiteIndex;
import org.openmetadata.service.search.indexes.TopicIndex;
import org.openmetadata.service.search.indexes.UserIndex;
import org.openmetadata.service.search.indexes.WebAnalyticEntityViewReportDataIndex;
import org.openmetadata.service.search.indexes.WebAnalyticUserActivityReportDataIndex;
import org.openmetadata.service.search.indexes.WorksheetIndex;

class SearchIndexFactoryTest {

  private final SearchIndexFactory factory = new SearchIndexFactory();

  @BeforeAll
  static void setUpSearchRepository() {
    SearchRepository repository = mock(SearchRepository.class);
    when(repository.getSearchClient()).thenReturn(mock(SearchClient.class));
    Entity.setSearchRepository(repository);
  }

  @AfterAll
  static void clearSearchRepository() {
    Entity.setSearchRepository(null);
  }

  @ParameterizedTest
  @MethodSource("supportedIndexMappings")
  void buildIndexReturnsExpectedSearchIndex(
      String entityType, Supplier<Object> entitySupplier, Class<? extends SearchIndex> indexClass) {
    assertInstanceOf(indexClass, factory.buildIndex(entityType, entitySupplier.get()));
  }

  @Test
  void buildIndexRejectsUnknownEntityTypes() {
    IllegalArgumentException exception =
        assertThrows(
            IllegalArgumentException.class, () -> factory.buildIndex("unknownType", new Object()));

    org.junit.jupiter.api.Assertions.assertTrue(exception.getMessage().contains("unknownType"));
  }

  @ParameterizedTest
  @MethodSource("supportedIndexMappings")
  void reindexFieldsProbeSucceedsForEveryEntityType(
      String entityType, Supplier<Object> entitySupplier, Class<? extends SearchIndex> indexClass) {
    // The factory probes each Index with a null entity to read its static field declarations.
    // This asserts every Index constructor is null-safe and that a non-empty field set is returned.
    Set<String> fields = factory.getReindexFieldsFor(entityType);
    assertFalse(
        fields.isEmpty(),
        () -> "Reindex fields for " + entityType + " must not be empty; got " + fields);
  }

  @ParameterizedTest
  @MethodSource("supportedIndexMappings")
  void commonReindexFieldsPresentForEveryEntityType(
      String entityType, Supplier<Object> entitySupplier, Class<? extends SearchIndex> indexClass) {
    Set<String> fields = factory.getReindexFieldsFor(entityType);
    for (String common : SearchIndex.COMMON_REINDEX_FIELDS) {
      assertTrue(
          fields.contains(common),
          () -> entityType + " reindex fields missing common field '" + common + "': " + fields);
    }
  }

  @Test
  void reindexFieldsIncludeKnownOverrides() {
    // Regression guard: every Index class that adds its own fields via getRequiredReindexFields
    // must continue to surface those fields through the factory probe.
    assertTrue(factory.getReindexFieldsFor(Entity.TABLE).contains("columns"));
    assertTrue(factory.getReindexFieldsFor(Entity.CONTAINER).contains("dataModel"));
    assertTrue(factory.getReindexFieldsFor(Entity.SPREADSHEET).contains("worksheets"));
    assertTrue(factory.getReindexFieldsFor(Entity.INGESTION_PIPELINE).contains("pipelineStatuses"));
    assertTrue(factory.getReindexFieldsFor(Entity.DATABASE).contains("usageSummary"));
    assertTrue(factory.getReindexFieldsFor(Entity.DASHBOARD).contains("charts"));
    assertTrue(factory.getReindexFieldsFor(Entity.PIPELINE).contains("tasks"));
    assertTrue(factory.getReindexFieldsFor(Entity.GLOSSARY_TERM).contains("relatedTerms"));
    assertTrue(factory.getReindexFieldsFor(Entity.TEAM).contains("parents"));
    Set<String> userFields = factory.getReindexFieldsFor(Entity.USER);
    assertTrue(userFields.contains("teams"));
    assertTrue(userFields.contains("roles"));
    assertTrue(userFields.contains("inheritedRoles"));
    Set<String> testCaseFields = factory.getReindexFieldsFor(Entity.TEST_CASE);
    assertTrue(testCaseFields.contains(TestCaseRepository.TEST_SUITE_FIELD));
    assertTrue(testCaseFields.contains(Entity.FIELD_TEST_SUITES));
    assertTrue(testCaseFields.contains(TestCaseRepository.TEST_DEFINITION_FIELD));
    // Regression: testCaseResult/incidentId are stripped from storage JSON and
    // only fetched by setFieldsInBulk when explicitly requested. Reindex without
    // them produces docs missing testCaseStatus, blanking statuses in the UI.
    assertTrue(testCaseFields.contains(Entity.TEST_CASE_RESULT));
    assertTrue(testCaseFields.contains(TestCaseRepository.INCIDENTS_FIELD));
    // TestSuiteRepository registers a fetcher for "summary" that populates
    // testCaseResultSummary. The DQ TestSuites list page sorts by the
    // top-level lastResultTimestamp field (computed in TestSuiteIndex from
    // that summary) and renders a success-% column per row. Without
    // "summary" the fetcher never runs and the ES doc has neither field.
    assertTrue(factory.getReindexFieldsFor(Entity.TEST_SUITE).contains("summary"));
  }

  @Test
  void queryReindexFieldsIncludeQueryUsedIn() {
    // Regression: queryUsedIn is stripped from storage JSON (QueryRepository
    // getFieldsStrippedFromStorageJson returns ["queryUsedIn", "users"]) and is only
    // populated by setFieldsInBulk when explicitly requested. Without it in the reindex field
    // set, QueryRepository.clearFields nulls queryUsedIn out and QueryIndex writes a doc with
    // no queryUsedIn array. Reload of Table → Queries tab then shows the "Add new query" empty
    // state even though the tab counter still says "1".
    Set<String> queryFields = factory.getReindexFieldsFor(Entity.QUERY);
    assertTrue(
        queryFields.contains("queryUsedIn"),
        () -> "Query reindex fields must include 'queryUsedIn'; got " + queryFields);
  }

  @Test
  void worksheetReindexFieldsIncludeColumns() {
    // Regression: WorksheetRepository.clearFields nulls columns when "columns" is not in the
    // fields set. WorksheetIndex.buildSearchIndexDocInternal then sees null and skips writing
    // columnNames / columnNamesFuzzy / columnDescriptionStatus / child tags. Column-name search
    // in Explore → Worksheets returns "No result found" for any worksheet after a reindex.
    Set<String> worksheetFields = factory.getReindexFieldsFor(Entity.WORKSHEET);
    assertTrue(
        worksheetFields.contains("columns"),
        () -> "Worksheet reindex fields must include 'columns'; got " + worksheetFields);
  }

  @Test
  void fileReindexFieldsIncludeColumns() {
    // Regression: FileRepository.clearFields nulls columns when "columns" is not in the fields
    // set, same pattern as Worksheet. File column-name search breaks after reindex.
    Set<String> fileFields = factory.getReindexFieldsFor(Entity.FILE);
    assertTrue(
        fileFields.contains("columns"),
        () -> "File reindex fields must include 'columns'; got " + fileFields);
  }

  @Test
  void reindexFieldsOmitKnownFanOutFields() {
    // These are the "blow up the heap" relationships we explicitly do NOT want fetched during
    // reindex. They either live in the Index's getExcludedFields() (stripped post-hoc) or
    // aren't read by buildSearchIndexDocInternal. Either way, asking setFields to load them
    // would be wasted work and risks OOM on large parents.
    assertFalse(factory.getReindexFieldsFor(Entity.DATABASE_SCHEMA).contains("tables"));
    assertFalse(factory.getReindexFieldsFor(Entity.DATABASE).contains("databaseSchemas"));
    assertFalse(factory.getReindexFieldsFor(Entity.TEAM).contains("users"));
    assertFalse(factory.getReindexFieldsFor(Entity.CONTAINER).contains("children"));
    assertFalse(factory.getReindexFieldsFor(Entity.API_COLLECTION).contains("apiEndpoints"));
    assertFalse(factory.getReindexFieldsFor(Entity.DASHBOARD).contains("dataModels"));
    assertFalse(factory.getReindexFieldsFor(Entity.GLOSSARY_TERM).contains("children"));
  }

  @Test
  void reindexFieldsUnknownEntityTypeFallsBackToCommon() {
    // Graceful degradation: if a new entity type is added and the factory can't probe it,
    // the reindex path still works with the common set rather than throwing.
    Set<String> fields = factory.getReindexFieldsFor("nonExistentEntityType");
    org.junit.jupiter.api.Assertions.assertEquals(SearchIndex.COMMON_REINDEX_FIELDS, fields);
  }

  private static Stream<Arguments> supportedIndexMappings() {
    return Stream.of(
        Arguments.of(Entity.TABLE, (Supplier<Object>) Table::new, TableIndex.class),
        Arguments.of(Entity.DASHBOARD, (Supplier<Object>) Dashboard::new, DashboardIndex.class),
        Arguments.of(Entity.TOPIC, (Supplier<Object>) Topic::new, TopicIndex.class),
        Arguments.of(Entity.PIPELINE, (Supplier<Object>) Pipeline::new, PipelineIndex.class),
        Arguments.of(
            Entity.INGESTION_PIPELINE,
            (Supplier<Object>) IngestionPipeline::new,
            IngestionPipelineIndex.class),
        Arguments.of(Entity.USER, (Supplier<Object>) User::new, UserIndex.class),
        Arguments.of(Entity.TEAM, (Supplier<Object>) Team::new, TeamIndex.class),
        Arguments.of(Entity.METRIC, (Supplier<Object>) Metric::new, MetricIndex.class),
        Arguments.of(Entity.GLOSSARY, (Supplier<Object>) Glossary::new, GlossaryIndex.class),
        Arguments.of(
            Entity.GLOSSARY_TERM, (Supplier<Object>) GlossaryTerm::new, GlossaryTermIndex.class),
        Arguments.of(Entity.MLMODEL, (Supplier<Object>) MlModel::new, MlModelIndex.class),
        Arguments.of(Entity.LLM_MODEL, (Supplier<Object>) LLMModel::new, LlmModelIndex.class),
        Arguments.of(
            Entity.AI_APPLICATION, (Supplier<Object>) AIApplication::new, AiApplicationIndex.class),
        Arguments.of(
            Entity.PROMPT_TEMPLATE,
            (Supplier<Object>) PromptTemplate::new,
            PromptTemplateIndex.class),
        Arguments.of(
            Entity.AI_GOVERNANCE_POLICY,
            (Supplier<Object>) AIGovernancePolicy::new,
            AiGovernancePolicyIndex.class),
        Arguments.of(Entity.TAG, (Supplier<Object>) Tag::new, TagIndex.class),
        Arguments.of(
            Entity.CLASSIFICATION,
            (Supplier<Object>) Classification::new,
            ClassificationIndex.class),
        Arguments.of(Entity.QUERY, (Supplier<Object>) Query::new, QueryIndex.class),
        Arguments.of(
            Entity.QUERY_COST_RECORD,
            (Supplier<Object>) QueryCostRecord::new,
            QueryCostRecordIndex.class),
        Arguments.of(Entity.CONTAINER, (Supplier<Object>) Container::new, ContainerIndex.class),
        Arguments.of(Entity.DATABASE, (Supplier<Object>) Database::new, DatabaseIndex.class),
        Arguments.of(
            Entity.DATABASE_SCHEMA,
            (Supplier<Object>) DatabaseSchema::new,
            DatabaseSchemaIndex.class),
        Arguments.of(Entity.TEST_CASE, (Supplier<Object>) TestCase::new, TestCaseIndex.class),
        Arguments.of(Entity.TEST_SUITE, (Supplier<Object>) TestSuite::new, TestSuiteIndex.class),
        Arguments.of(Entity.CHART, (Supplier<Object>) Chart::new, ChartIndex.class),
        Arguments.of(
            Entity.DASHBOARD_DATA_MODEL,
            (Supplier<Object>) DashboardDataModel::new,
            DashboardDataModelIndex.class),
        Arguments.of(
            Entity.API_COLLECTION, (Supplier<Object>) APICollection::new, APICollectionIndex.class),
        Arguments.of(
            Entity.API_ENDPOINT, (Supplier<Object>) APIEndpoint::new, APIEndpointIndex.class),
        Arguments.of(
            Entity.DASHBOARD_SERVICE,
            (Supplier<Object>) DashboardService::new,
            DashboardServiceIndex.class),
        Arguments.of(
            Entity.DATABASE_SERVICE,
            (Supplier<Object>) DatabaseService::new,
            DatabaseServiceIndex.class),
        Arguments.of(
            Entity.MESSAGING_SERVICE,
            (Supplier<Object>) MessagingService::new,
            MessagingServiceIndex.class),
        Arguments.of(
            Entity.MLMODEL_SERVICE,
            (Supplier<Object>) MlModelService::new,
            MlModelServiceIndex.class),
        Arguments.of(Entity.LLM_SERVICE, (Supplier<Object>) LLMService::new, LlmServiceIndex.class),
        Arguments.of(Entity.MCP_SERVER, (Supplier<Object>) McpServer::new, McpServerIndex.class),
        Arguments.of(
            Entity.MCP_EXECUTION, (Supplier<Object>) McpExecution::new, McpExecutionIndex.class),
        Arguments.of(Entity.MCP_SERVICE, (Supplier<Object>) McpService::new, McpServiceIndex.class),
        Arguments.of(
            Entity.SEARCH_SERVICE, (Supplier<Object>) SearchService::new, SearchServiceIndex.class),
        Arguments.of(
            Entity.SECURITY_SERVICE,
            (Supplier<Object>) SecurityService::new,
            SecurityServiceIndex.class),
        Arguments.of(Entity.API_SERVICE, (Supplier<Object>) ApiService::new, APIServiceIndex.class),
        Arguments.of(
            Entity.SEARCH_INDEX,
            (Supplier<Object>) org.openmetadata.schema.entity.data.SearchIndex::new,
            SearchEntityIndex.class),
        Arguments.of(
            Entity.PIPELINE_SERVICE,
            (Supplier<Object>) PipelineService::new,
            PipelineServiceIndex.class),
        Arguments.of(
            Entity.STORAGE_SERVICE,
            (Supplier<Object>) StorageService::new,
            StorageServiceIndex.class),
        Arguments.of(
            Entity.DRIVE_SERVICE, (Supplier<Object>) DriveService::new, DriveServiceIndex.class),
        Arguments.of(Entity.DOMAIN, (Supplier<Object>) Domain::new, DomainIndex.class),
        Arguments.of(
            Entity.STORED_PROCEDURE,
            (Supplier<Object>) StoredProcedure::new,
            StoredProcedureIndex.class),
        Arguments.of(Entity.DIRECTORY, (Supplier<Object>) Directory::new, DirectoryIndex.class),
        Arguments.of(Entity.FILE, (Supplier<Object>) File::new, FileIndex.class),
        Arguments.of(
            Entity.SPREADSHEET, (Supplier<Object>) Spreadsheet::new, SpreadsheetIndex.class),
        Arguments.of(Entity.WORKSHEET, (Supplier<Object>) Worksheet::new, WorksheetIndex.class),
        Arguments.of(
            Entity.DATA_PRODUCT, (Supplier<Object>) DataProduct::new, DataProductIndex.class),
        Arguments.of(
            Entity.METADATA_SERVICE,
            (Supplier<Object>) MetadataService::new,
            MetadataServiceIndex.class),
        Arguments.of(
            Entity.ENTITY_REPORT_DATA,
            reportData(ReportData.ReportDataType.ENTITY_REPORT_DATA),
            EntityReportDataIndex.class),
        Arguments.of(
            Entity.WEB_ANALYTIC_ENTITY_VIEW_REPORT_DATA,
            reportData(ReportData.ReportDataType.WEB_ANALYTIC_ENTITY_VIEW_REPORT_DATA),
            WebAnalyticEntityViewReportDataIndex.class),
        Arguments.of(
            Entity.WEB_ANALYTIC_USER_ACTIVITY_REPORT_DATA,
            reportData(ReportData.ReportDataType.WEB_ANALYTIC_USER_ACTIVITY_REPORT_DATA),
            WebAnalyticUserActivityReportDataIndex.class),
        Arguments.of(
            Entity.RAW_COST_ANALYSIS_REPORT_DATA,
            reportData(ReportData.ReportDataType.RAW_COST_ANALYSIS_REPORT_DATA),
            RawCostAnalysisReportDataIndex.class),
        Arguments.of(
            Entity.AGGREGATED_COST_ANALYSIS_REPORT_DATA,
            reportData(ReportData.ReportDataType.AGGREGATED_COST_ANALYSIS_REPORT_DATA),
            AggregatedCostAnalysisReportDataIndex.class),
        Arguments.of(
            Entity.TEST_CASE_RESOLUTION_STATUS,
            (Supplier<Object>) TestCaseResolutionStatus::new,
            TestCaseResolutionStatusIndex.class),
        Arguments.of(
            Entity.TEST_CASE_RESULT,
            (Supplier<Object>) TestCaseResult::new,
            TestCaseResultIndex.class),
        Arguments.of(
            Entity.PIPELINE_EXECUTION,
            (Supplier<Object>)
                () ->
                    new PipelineExecutionIndex.PipelineExecutionData(
                        new Pipeline(), new PipelineStatus()),
            PipelineExecutionIndex.class));
  }

  private static Supplier<Object> reportData(ReportData.ReportDataType type) {
    return () -> new ReportData().withReportDataType(type);
  }
}
