package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import es.co.elastic.clients.transport.rest5_client.low_level.Rest5Client;
import java.io.IOException;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.junit.jupiter.api.parallel.Isolated;
import org.openmetadata.it.factories.ShortStackFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.dataInsight.custom.DataInsightCustomChart;
import org.openmetadata.schema.dataInsight.custom.LineChart;
import org.openmetadata.schema.dataInsight.custom.LineChartMetric;
import org.openmetadata.schema.dataInsight.custom.SummaryCard;
import org.openmetadata.schema.dataInsight.custom.SummaryChartMetric;
import org.openmetadata.schema.entity.app.App;
import org.openmetadata.schema.entity.applications.configuration.internal.AppAnalyticsConfig;
import org.openmetadata.schema.entity.applications.configuration.internal.CostAnalysisConfig;
import org.openmetadata.schema.entity.applications.configuration.internal.DataAssetsConfig;
import org.openmetadata.schema.entity.applications.configuration.internal.DataInsightsAppConfig;
import org.openmetadata.schema.entity.applications.configuration.internal.ModuleConfiguration;
import org.openmetadata.schema.entity.applications.configuration.internal.ServiceFilter;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.service.configuration.elasticsearch.ElasticSearchConfiguration;
import org.openmetadata.schema.tests.TestCase;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.fluent.Tables;
import org.openmetadata.sdk.fluent.builders.TestCaseBuilder;
import org.openmetadata.service.Entity;
import org.openmetadata.service.apps.bundles.insights.DataInsightsApp;
import org.openmetadata.service.apps.bundles.insights.search.DataInsightsSearchInterface;
import org.openmetadata.service.apps.bundles.insights.search.elasticsearch.ElasticSearchDataInsightsClient;
import org.openmetadata.service.apps.bundles.insights.search.opensearch.OpenSearchDataInsightsClient;
import org.openmetadata.service.apps.bundles.insights.utils.TimestampUtils;
import org.openmetadata.service.apps.bundles.insights.workflows.dataAssets.DataAssetsWorkflow;
import org.openmetadata.service.apps.bundles.insights.workflows.dataAssets.TestCaseSnapshotStore;
import org.openmetadata.service.search.SearchClient;
import org.openmetadata.service.search.SearchRepository;

@ExtendWith(TestNamespaceExtension.class)
@Isolated("Exercises the upgrade from the shared live alias to a snapshot data stream")
@Execution(ExecutionMode.SAME_THREAD)
class DataInsightTestCaseCoverageIT {
  private static SearchRepository repository;
  private static SearchClient search;
  private static DataInsightsSearchInterface insights;
  private static TestCaseSnapshotStore store;
  private final OpenMetadataClient client = SdkClients.adminClient();

  @BeforeAll
  static void setup() throws IOException {
    SdkClients.adminClient();
    repository = Entity.getSearchRepository();
    search = repository.getSearchClient();
    insights =
        repository.getSearchType() == ElasticSearchConfiguration.SearchType.ELASTICSEARCH
            ? new ElasticSearchDataInsightsClient(
                (Rest5Client) search.getLowLevelClient(), repository.getClusterAlias())
            : new OpenSearchDataInsightsClient(
                search.getHighLevelClient(), repository.getClusterAlias());
    store = new TestCaseSnapshotStore(search, repository.getClusterAlias());
    store.detachLiveAlias();
    prepareStream(Entity.TEST_CASE);
    prepareStream(Entity.TABLE);
  }

  @Test
  void snapshotsCountOldDefinitionsAndBackfillUsesCapturedHistory(TestNamespace ns)
      throws Exception {
    final Table covered = ShortStackFactory.table(ns);
    final Table uncovered =
        Tables.create()
            .name(ns.shortPrefix("uncovered"))
            .inSchema(covered.getDatabaseSchema().getFullyQualifiedName())
            .withColumns(covered.getColumns())
            .execute();
    final long firstDay = TimestampUtils.getStartOfDayTimestamp(System.currentTimeMillis());
    final long nextDay = TimestampUtils.addDays(firstDay, 1);
    final TestCase tableTest = testCase(ns, covered, false);
    final TestCase columnTest = testCase(ns, covered, true);
    makeOld(tableTest, firstDay);
    makeOld(columnTest, firstDay);
    run(covered, firstDay, Optional.empty());

    assertCoverage(covered, firstDay, 2, 1);
    assertCoverage(uncovered, firstDay, 0, 0);
    assertEquals(2, testCaseSnapshots(covered, firstDay));
    assertEquals(50.0, uncoveredPercentage(covered, firstDay));
    assertEquals(2.0, testCountChart(covered, firstDay));
    assertEquals(2.0, summaryTestCount(covered, firstDay));
    assertEquals(2.0, dateTestCount(covered, firstDay));

    client.testCases().delete(tableTest.getId().toString());
    client.testCases().delete(columnTest.getId().toString());
    run(covered, nextDay, Optional.empty());
    assertCoverage(covered, nextDay, 0, 0);
    assertEquals(0, testCaseSnapshots(covered, nextDay));
    assertEquals(2, testCaseSnapshots(covered, firstDay));

    testCase(ns, covered, false);
    final String date = TimestampUtils.timestampToString(firstDay, "yyyy-MM-dd");
    run(covered, nextDay, Optional.of(new DataInsightsApp.Backfill(date, date)));
    assertCoverage(covered, firstDay, 2, 1);
    assertCoverage(uncovered, firstDay, 0, 0);
    assertEquals(2, testCaseSnapshots(covered, firstDay));
    assertEquals(50.0, uncoveredPercentage(covered, firstDay));
    assertTrue(
        store
            .loadCoverage(List.of(covered), TimestampUtils.subtractDays(firstDay, 1), firstDay - 1)
            .counts()
            .isEmpty());
  }

  @Test
  void incompleteCaptureDoesNotTurnMissingHistoryIntoZeroCoverage(TestNamespace ns)
      throws Exception {
    final Table table = ShortStackFactory.table(ns);
    final long day = TimestampUtils.getStartOfDayTimestamp(System.currentTimeMillis());
    testCase(ns, table, false);
    run(table, day, Optional.empty());
    assertFalse(store.loadCoverage(List.of(table), day, day).counts().isEmpty());
    store.beginCapture(day, table.getService().getName(), 90);
    assertTrue(store.loadCoverage(List.of(table), day, day).counts().isEmpty());
  }

  @Test
  void upgradingDetachesOnlyTheAliasAndLeavesLiveDefinitionsIntact(TestNamespace ns)
      throws Exception {
    final Table table = ShortStackFactory.table(ns);
    final TestCase definition = testCase(ns, table, false);
    final String stream = stream(Entity.TEST_CASE);
    insights.deleteDataAssetDataStream(stream);
    final String live =
        repository.getIndexMapping(Entity.TEST_CASE).getIndexName(repository.getClusterAlias());
    final Set<String> resolved = search.getIndicesByAlias(live);
    final String concrete = resolved.isEmpty() ? live : resolved.iterator().next();
    request(
        "POST",
        "/_aliases",
        Map.of("actions", List.of(Map.of("add", Map.of("index", concrete, "alias", stream)))));
    try {
      final DataInsightsApp application =
          new DataInsightsApp(Entity.getCollectionDAO(), repository);
      application.init(
          new App()
              .withName(ns.shortPrefix("snapshot_upgrade"))
              .withAppConfiguration(
                  JsonUtils.getMap(
                      new DataInsightsAppConfig()
                          .withModuleConfiguration(
                              new ModuleConfiguration()
                                  .withDataAssets(new DataAssetsConfig())
                                  .withAppAnalytics(new AppAnalyticsConfig().withEnabled(false))
                                  .withCostAnalysis(
                                      new CostAnalysisConfig().withEnabled(false))))));
      application.createOrUpdateDataAssetsDataStream();
      store.clearCheckpoints();
      assertTrue(search.getIndicesByAlias(stream).isEmpty());
      assertEquals(
          definition.getId(), client.testCases().get(definition.getId().toString()).getId());
      assertTrue(search.indexExists(live));
      final long day = TimestampUtils.getStartOfDayTimestamp(System.currentTimeMillis());
      run(table, day, Optional.empty());
      assertCoverage(table, day, 1, 1);
    } finally {
      store.detachLiveAlias();
      prepareStream(Entity.TEST_CASE);
    }
  }

  @Test
  void replacingServiceAndGlobalCapturesInvalidatesOnlyTrustworthyCoverage(TestNamespace ns)
      throws Exception {
    final Table first = ShortStackFactory.table(ns);
    final Table second = ShortStackFactory.table(ns);
    final List<Table> tables = List.of(first, second);
    final long day = TimestampUtils.getStartOfDayTimestamp(System.currentTimeMillis());
    store.beginCapture(day, null, 90);
    store.completeCapture(day, null);
    assertEquals(2, store.loadCoverage(tables, day, day).counts().size());

    store.beginCapture(day, first.getService().getName(), 90);
    assertTrue(store.loadCoverage(tables, day, day).counts().isEmpty());
    store.completeCapture(day, first.getService().getName());
    assertEquals(1, store.loadCoverage(tables, day, day).counts().size());
    assertTrue(store.loadCoverage(List.of(second), day, day).counts().isEmpty());

    store.beginCapture(day, null, 90);
    assertTrue(store.loadCoverage(tables, day, day).counts().isEmpty());
  }

  @Test
  void fieldCatalogExposesDefinitionGroupingAndTableCoverage() {
    final List<Map<String, String>> fields = search.fetchDIChartFields();
    for (String name :
        List.of(
            "originEntityFQN",
            "testSuite.fullyQualifiedName",
            "testDefinition.fullyQualifiedName")) {
      assertTrue(
          fields.stream()
              .anyMatch(
                  field ->
                      Entity.TEST_CASE.equals(field.get("entityType"))
                          && name.equals(field.get("name"))),
          name);
    }
    for (String name : List.of("testCaseCount", "hasTestCases")) {
      assertTrue(
          fields.stream()
              .anyMatch(
                  field ->
                      Entity.TABLE.equals(field.get("entityType"))
                          && name.equals(field.get("name"))),
          name);
    }
  }

  private static void prepareStream(String type) throws IOException {
    if (!insights.dataAssetDataStreamExists(stream(type))) {
      insights.createDataAssetsDataStream(
          stream(type), type, repository.getIndexMapping(type), "en", 90);
    } else {
      insights.updateDataAssetsDataStream(
          stream(type), type, repository.getIndexMapping(type), "en");
    }
  }

  private void run(Table table, long day, Optional<DataInsightsApp.Backfill> backfill)
      throws Exception {
    final DataAssetsConfig config =
        new DataAssetsConfig()
            .withEntities(Set.of(Entity.TABLE))
            .withServiceFilter(
                new ServiceFilter()
                    .withServiceType(Entity.DATABASE_SERVICE)
                    .withServiceName(table.getService().getName()));
    final DataAssetsWorkflow workflow =
        new DataAssetsWorkflow(
            config,
            day + 1000,
            100,
            backfill,
            Set.of(Entity.TABLE, Entity.TEST_CASE),
            Entity.getCollectionDAO(),
            repository,
            insights);
    workflow.process();
    assertFalse(
        workflow.getWorkflowStats().hasFailed(), JsonUtils.pojoToJson(workflow.getWorkflowStats()));
    request("POST", "/" + stream(Entity.TABLE) + "/_refresh", null);
  }

  private TestCase testCase(TestNamespace ns, Table table, boolean column) {
    final TestCaseBuilder builder =
        TestCaseBuilder.create(client)
            .name((column ? "column_test_" : "table_test_") + ns.uniqueShortId());
    return column
        ? builder.forColumn(table, "id").testDefinition("columnValuesToBeNotNull").create()
        : builder
            .forTable(table)
            .testDefinition("tableRowCountToEqual")
            .parameter("value", "100")
            .create();
  }

  private static void makeOld(TestCase testCase, long day) {
    testCase.setUpdatedAt(TimestampUtils.subtractDays(day, 90));
    Entity.getCollectionDAO().testCaseDAO().update(testCase);
  }

  private static void assertCoverage(Table table, long day, long count, int hasTests)
      throws IOException {
    final JsonNode result =
        request(
            "POST",
            "/" + stream(Entity.TABLE) + "/_search",
            Map.of(
                "query",
                Map.of(
                    "bool",
                    Map.of(
                        "filter",
                        List.of(
                            Map.of("term", Map.of("id.keyword", table.getId().toString())),
                            Map.of("term", Map.of("@timestamp", day)))))));
    assertEquals(1, result.path("hits").path("total").path("value").asInt());
    final JsonNode snapshot = result.path("hits").path("hits").get(0).path("_source");
    assertTrue(snapshot.has("testCaseCount"));
    assertEquals(count, snapshot.path("testCaseCount").asLong());
    assertEquals(hasTests, snapshot.path("hasTestCases").asInt());
  }

  private static int testCaseSnapshots(Table table, long day) throws IOException {
    return request(
            "POST",
            "/" + stream(Entity.TEST_CASE) + "/_count",
            Map.of(
                "query",
                Map.of(
                    "bool",
                    Map.of(
                        "filter",
                        List.of(
                            Map.of(
                                "term",
                                Map.of(
                                    "originEntityFQN",
                                    table
                                        .getFullyQualifiedName()
                                        .toLowerCase(java.util.Locale.ROOT))),
                            Map.of("term", Map.of("@timestamp", day)))))))
        .path("count")
        .asInt();
  }

  private static double uncoveredPercentage(Table table, long day) throws IOException {
    return chart(
        table,
        day,
        "100 * count(k='id.keyword',q='entityType: table AND hasTestCases: 0') / count(k='id.keyword',q='entityType: table AND hasTestCases: *')");
  }

  private static double testCountChart(Table table, long day) throws IOException {
    return chart(table, day, "count(k='id.keyword',q='entityType: testCase')");
  }

  private static double chart(Table table, long day, String formula) throws IOException {
    final LineChart details =
        new LineChart()
            .withxAxisField("service.name.keyword")
            .withMetrics(
                List.of(
                    new LineChartMetric()
                        .withFormula(formula)
                        .withFilter(
                            JsonUtils.pojoToJson(
                                Map.of(
                                    "query",
                                    Map.of(
                                        "term",
                                        Map.of(
                                            "service.name.keyword",
                                            table.getService().getName())))))));
    final DataInsightCustomChart chart =
        new DataInsightCustomChart()
            .withName("coverage_it")
            .withChartDetails(JsonUtils.getMap(details));
    return search
        .buildDIChart(chart, day, TimestampUtils.getEndOfDayTimestamp(day))
        .getResults()
        .stream()
        .mapToDouble(result -> result.getCount())
        .sum();
  }

  private static double summaryTestCount(Table table, long day) throws IOException {
    final SummaryCard details =
        new SummaryCard()
            .withMetrics(
                List.of(
                    new SummaryChartMetric()
                        .withFormula("count(k='id.keyword',q='entityType: testCase')")
                        .withFilter(serviceQuery(table))));
    final DataInsightCustomChart chart =
        new DataInsightCustomChart()
            .withName("test_summary_it")
            .withChartDetails(JsonUtils.getMap(details));
    return search
        .buildDIChart(chart, day, TimestampUtils.getEndOfDayTimestamp(day))
        .getResults()
        .getFirst()
        .getCount();
  }

  private static double dateTestCount(Table table, long day) throws IOException {
    final LineChart details =
        new LineChart()
            .withxAxisField("@timestamp")
            .withMetrics(
                List.of(
                    new LineChartMetric()
                        .withFormula("count(k='id.keyword',q='entityType: testCase')")
                        .withFilter(serviceQuery(table))));
    final DataInsightCustomChart chart =
        new DataInsightCustomChart()
            .withName("test_dates_it")
            .withChartDetails(JsonUtils.getMap(details));
    return search
        .buildDIChart(chart, day, TimestampUtils.getEndOfDayTimestamp(day))
        .getResults()
        .stream()
        .mapToDouble(result -> result.getCount())
        .sum();
  }

  private static String serviceQuery(Table table) {
    return JsonUtils.pojoToJson(
        Map.of(
            "query", Map.of("term", Map.of("service.name.keyword", table.getService().getName()))));
  }

  private static String stream(String type) {
    return DataInsightsApp.getDataStreamName(repository.getClusterAlias(), type);
  }

  private static JsonNode request(String method, String path, Map<String, Object> body)
      throws IOException {
    final SearchClient.RawSearchResponse response =
        search.rawSearchRequest(method, path, body == null ? null : JsonUtils.pojoToJson(body));
    assertTrue(response.statusCode() < 300, response.body());
    return JsonUtils.readTree(response.body());
  }
}
