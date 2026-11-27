package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import es.co.elastic.clients.transport.rest5_client.low_level.Rest5Client;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Isolated;
import org.openmetadata.it.factories.LLMServiceTestFactory;
import org.openmetadata.it.factories.ShortStackFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.api.ai.CreateAIApplication;
import org.openmetadata.schema.api.ai.CreateLLMModel;
import org.openmetadata.schema.api.ai.CreateMcpServer;
import org.openmetadata.schema.api.services.CreateMcpService;
import org.openmetadata.schema.dataInsight.custom.DataInsightCustomChart;
import org.openmetadata.schema.dataInsight.custom.DataInsightCustomChartResultList;
import org.openmetadata.schema.dataInsight.custom.LineChart;
import org.openmetadata.schema.dataInsight.custom.LineChartMetric;
import org.openmetadata.schema.entity.ai.ApplicationType;
import org.openmetadata.schema.entity.ai.McpServerType;
import org.openmetadata.schema.entity.app.App;
import org.openmetadata.schema.entity.applications.configuration.internal.AppAnalyticsConfig;
import org.openmetadata.schema.entity.applications.configuration.internal.CostAnalysisConfig;
import org.openmetadata.schema.entity.applications.configuration.internal.DataAssetsConfig;
import org.openmetadata.schema.entity.applications.configuration.internal.DataInsightsAppConfig;
import org.openmetadata.schema.entity.applications.configuration.internal.ModuleConfiguration;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.services.McpService;
import org.openmetadata.schema.service.configuration.elasticsearch.ElasticSearchConfiguration;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.service.Entity;
import org.openmetadata.service.apps.bundles.insights.DataInsightsApp;
import org.openmetadata.service.apps.bundles.insights.search.DataInsightsSearchInterface;
import org.openmetadata.service.apps.bundles.insights.search.elasticsearch.ElasticSearchDataInsightsClient;
import org.openmetadata.service.apps.bundles.insights.search.opensearch.OpenSearchDataInsightsClient;
import org.openmetadata.service.apps.bundles.insights.utils.TimestampUtils;
import org.openmetadata.service.apps.bundles.insights.workflows.dataAssets.DataAssetsWorkflow;
import org.openmetadata.service.search.SearchClient;
import org.openmetadata.service.search.SearchRepository;

@ExtendWith(TestNamespaceExtension.class)
@Isolated("Recreates AI asset snapshot streams and runs the Data Insights workflow")
class DataInsightAiAssetCoverageIT {
  private static final List<String> AI_TYPES =
      List.of(Entity.LLM_MODEL, Entity.MCP_SERVER, Entity.AI_APPLICATION);
  private static final Set<String> FIXTURE_TYPES =
      Set.of(Entity.TABLE, Entity.LLM_MODEL, Entity.MCP_SERVER, Entity.AI_APPLICATION);
  private static final String TIER_ONE = "Tier.Tier1";
  private static final String TIER_TWO = "Tier.Tier2";
  private static final String DESCRIPTION = "An AI asset captured by Data Insights";

  private final OpenMetadataClient client = SdkClients.adminClient();
  private final SearchRepository repository = Entity.getSearchRepository();
  private final SearchClient search = repository.getSearchClient();
  private final DataInsightsSearchInterface insights = searchInterface();

  @Test
  void newAiSnapshotsJoinExistingAssetsAndCountEachTierOnce(TestNamespace ns) throws Exception {
    final Table table = ShortStackFactory.table(ns);
    table.setTags(tags(TIER_ONE));
    client.tables().update(table.getId().toString(), table);
    final long day = TimestampUtils.getStartOfDayTimestamp(System.currentTimeMillis());
    prepareTableStream();
    runSnapshots(Set.of(Entity.TABLE), day);
    final String tableFilter = fixtureFilter(List.of(table));
    assertEquals(1, countByTier(tableFilter, day, TIER_ONE));

    final List<EntityInterface<?>> assets = new ArrayList<>(List.of(table));
    assets.addAll(createAiAssets(ns));
    removeAiSnapshotStreams();
    final DataInsightsApp app = initializeApp(ns);
    assertEquals(1, countByTier(tableFilter, day, TIER_ONE), "existing snapshots survive init");
    for (String type : AI_TYPES) {
      assertTrue(insights.dataAssetDataStreamExists(stream(type)), type);
      assertTrue(app.getDataAssetTypes().contains(type), type);
      assertTrue(
          repository.getIndexMapping(type).getDataInsightAliases() == null
              || repository.getIndexMapping(type).getDataInsightAliases().isEmpty());
    }

    runSnapshots(app.getDataAssetTypes(), day);
    assertFixtureCounts(assets, day);
    for (EntityInterface<?> asset : assets.subList(1, 4)) {
      assertSnapshotFields(asset, day);
    }
    assertFieldCatalog();
    app.createOrUpdateDataAssetsDataStream();
    runSnapshots(app.getDataAssetTypes(), day);
    assertFixtureCounts(assets, day);
  }

  private List<EntityInterface<?>> createAiAssets(TestNamespace ns) {
    final String llmService =
        ns.trackRoot(Entity.LLM_SERVICE, LLMServiceTestFactory.createOpenAI(ns))
            .getFullyQualifiedName();
    final McpService mcpService =
        client
            .getHttpClient()
            .execute(
                HttpMethod.POST,
                "/v1/services/mcpServices",
                new CreateMcpService()
                    .withName(ns.shortPrefix("mcp"))
                    .withServiceType(CreateMcpService.McpServiceType.Mcp),
                McpService.class);
    ns.trackRoot(Entity.MCP_SERVICE, mcpService);
    final EntityReference owner = client.users().getByName("admin").getEntityReference();
    final List<EntityInterface<?>> assets = new ArrayList<>();
    for (String tier : List.of(TIER_ONE, TIER_TWO, "")) {
      assets.addAll(
          createAiAssets(ns, llmService, mcpService.getFullyQualifiedName(), owner, tier));
    }
    final List<EntityInterface<?>> deleted =
        createAiAssets(ns, llmService, mcpService.getFullyQualifiedName(), owner, TIER_ONE);
    client.llmModels().delete(deleted.get(0).getId().toString());
    client.mcpServers().delete(deleted.get(1).getId().toString());
    client.aiApplications().delete(deleted.get(2).getId().toString());
    assets.addAll(deleted);
    return assets;
  }

  private List<EntityInterface<?>> createAiAssets(
      TestNamespace ns, String llmService, String mcpService, EntityReference owner, String tier) {
    final String name = ns.uniqueShortId();
    return List.of(
        client
            .llmModels()
            .create(
                new CreateLLMModel()
                    .withName("model_" + name)
                    .withService(llmService)
                    .withBaseModel("fixture-model")
                    .withModelProvider("OpenAI")
                    .withDescription(DESCRIPTION)
                    .withOwners(List.of(owner))
                    .withTags(tags(tier))),
        client
            .mcpServers()
            .create(
                new CreateMcpServer()
                    .withName("mcp_" + name)
                    .withService(mcpService)
                    .withServerType(McpServerType.DataAccess)
                    .withDescription(DESCRIPTION)
                    .withOwners(List.of(owner))
                    .withTags(tags(tier))),
        ns.trackRoot(
            Entity.AI_APPLICATION,
            client
                .aiApplications()
                .create(
                    new CreateAIApplication()
                        .withName("app_" + name)
                        .withApplicationType(ApplicationType.Chatbot)
                        .withDescription(DESCRIPTION)
                        .withOwners(List.of(owner))
                        .withTags(tags(tier)))));
  }

  private static List<TagLabel> tags(String tier) {
    return tier.isEmpty()
        ? List.of()
        : List.of(
            new TagLabel()
                .withTagFQN(tier)
                .withSource(TagLabel.TagSource.CLASSIFICATION)
                .withLabelType(TagLabel.LabelType.MANUAL)
                .withState(TagLabel.State.CONFIRMED));
  }

  private DataInsightsApp initializeApp(TestNamespace ns) {
    final DataInsightsApp app = new DataInsightsApp(Entity.getCollectionDAO(), repository);
    app.init(
        new App()
            .withName(ns.shortPrefix("ai_insights"))
            .withAppConfiguration(
                JsonUtils.getMap(
                    new DataInsightsAppConfig()
                        .withModuleConfiguration(
                            new ModuleConfiguration()
                                .withDataAssets(new DataAssetsConfig())
                                .withAppAnalytics(new AppAnalyticsConfig().withEnabled(false))
                                .withCostAnalysis(new CostAnalysisConfig().withEnabled(false))))));
    return app;
  }

  private void prepareTableStream() throws IOException {
    if (!insights.dataAssetDataStreamExists(stream(Entity.TABLE))) {
      insights.createDataAssetsDataStream(
          stream(Entity.TABLE), Entity.TABLE, repository.getIndexMapping(Entity.TABLE), "en", 90);
    }
  }

  private void removeAiSnapshotStreams() throws IOException {
    for (String type : AI_TYPES) {
      if (insights.dataAssetDataStreamExists(stream(type))) {
        insights.deleteDataAssetDataStream(stream(type));
      }
    }
  }

  private void runSnapshots(Set<String> types, long day) throws Exception {
    final DataAssetsWorkflow workflow =
        new DataAssetsWorkflow(
            new DataAssetsConfig().withEntities(FIXTURE_TYPES),
            day + 1000,
            100,
            Optional.empty(),
            types,
            Entity.getCollectionDAO(),
            repository,
            insights);
    workflow.process();
    assertFalse(
        workflow.getWorkflowStats().hasFailed(), JsonUtils.pojoToJson(workflow.getWorkflowStats()));
    request("POST", "/" + stream("*") + "/_refresh", null);
  }

  private void assertFixtureCounts(List<EntityInterface<?>> assets, long day) throws IOException {
    final String filter = fixtureFilter(assets);
    assertEquals(4, countByTier(filter, day, TIER_ONE));
    assertEquals(3, countByTier(filter, day, TIER_TWO));
    assertEquals(3, countByTier(filter, day, "NoTier"));
    final Map<String, Double> byType = countByType(filter, day);
    assertEquals(
        Map.of(
            Entity.TABLE,
            1.0,
            Entity.LLM_MODEL,
            3.0,
            Entity.MCP_SERVER,
            3.0,
            Entity.AI_APPLICATION,
            3.0),
        byType);
  }

  private double countByTier(String filter, long day, String tier) throws IOException {
    return chart(
            filter,
            day,
            "entityType.keyword",
            "count(k='id.keyword',q='tier.keyword: " + tier + "')")
        .getResults()
        .stream()
        .mapToDouble(result -> result.getCount())
        .sum();
  }

  private Map<String, Double> countByType(String filter, long day) throws IOException {
    return chart(filter, day, "entityType.keyword", "count(k='id.keyword')").getResults().stream()
        .collect(Collectors.toMap(result -> result.getTerm(), result -> result.getCount()));
  }

  private DataInsightCustomChartResultList chart(
      String filter, long day, String axis, String formula) throws IOException {
    final LineChart details =
        new LineChart()
            .withxAxisField(axis)
            .withMetrics(List.of(new LineChartMetric().withFormula(formula).withFilter(filter)));
    return search.buildDIChart(
        new DataInsightCustomChart()
            .withName("ai_asset_counts")
            .withChartDetails(JsonUtils.getMap(details)),
        day,
        TimestampUtils.getEndOfDayTimestamp(day));
  }

  private void assertSnapshotFields(EntityInterface<?> asset, long day) throws IOException {
    final JsonNode result =
        request(
            "POST",
            "/" + stream(Entity.getEntityTypeFromObject(asset)) + "/_search",
            Map.of(
                "query",
                Map.of(
                    "bool",
                    Map.of(
                        "filter",
                        List.of(
                            Map.of("term", Map.of("id.keyword", asset.getId().toString())),
                            Map.of("term", Map.of("@timestamp", day)))))));
    assertEquals(1, result.path("hits").path("total").path("value").asInt());
    final JsonNode snapshot = result.path("hits").path("hits").get(0).path("_source");
    assertEquals(TIER_ONE, snapshot.path("tier").asText());
    assertEquals(1, snapshot.path("hasDescription").asInt());
    assertEquals("admin", snapshot.path("ownerName").get(0).asText());
  }

  private void assertFieldCatalog() {
    final List<Map<String, String>> fields = search.fetchDIChartFields();
    for (String type : AI_TYPES) {
      // MCP owner names use the default text mapping; the other AI mappings use keyword.
      final String ownerField = Entity.MCP_SERVER.equals(type) ? "ownerName.keyword" : "ownerName";
      for (String name :
          List.of("tier.keyword", ownerField, "hasDescription", "entityType.keyword")) {
        assertTrue(
            fields.stream()
                .anyMatch(
                    field ->
                        type.equals(field.get("entityType")) && name.equals(field.get("name"))),
            () -> type + ":" + name + " missing from " + fields);
      }
    }
  }

  private static String fixtureFilter(List<? extends EntityInterface<?>> assets) {
    return JsonUtils.pojoToJson(
        Map.of(
            "query",
            Map.of(
                "bool",
                Map.of(
                    "filter",
                        List.of(
                            Map.of(
                                "terms",
                                Map.of(
                                    "id.keyword",
                                    assets.stream()
                                        .map(asset -> asset.getId().toString())
                                        .toList()))),
                    "must_not", List.of(Map.of("term", Map.of("deleted", true)))))));
  }

  private DataInsightsSearchInterface searchInterface() {
    return repository.getSearchType() == ElasticSearchConfiguration.SearchType.ELASTICSEARCH
        ? new ElasticSearchDataInsightsClient(
            (Rest5Client) search.getLowLevelClient(), repository.getClusterAlias())
        : new OpenSearchDataInsightsClient(
            search.getHighLevelClient(), repository.getClusterAlias());
  }

  private String stream(String type) {
    return DataInsightsApp.getDataStreamName(repository.getClusterAlias(), type);
  }

  private JsonNode request(String method, String path, Map<String, Object> body)
      throws IOException {
    final SearchClient.RawSearchResponse response =
        search.rawSearchRequest(method, path, body == null ? null : JsonUtils.pojoToJson(body));
    assertTrue(response.statusCode() < 300, response.body());
    return JsonUtils.readTree(response.body());
  }
}
