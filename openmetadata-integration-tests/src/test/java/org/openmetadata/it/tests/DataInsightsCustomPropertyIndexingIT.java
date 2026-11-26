/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */
package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.service.apps.bundles.insights.utils.TimestampUtils.END_TIMESTAMP_KEY;
import static org.openmetadata.service.apps.bundles.insights.utils.TimestampUtils.START_TIMESTAMP_KEY;
import static org.openmetadata.service.apps.bundles.insights.workflows.dataAssets.DataAssetsWorkflow.DATA_STREAM_KEY;
import static org.openmetadata.service.apps.bundles.insights.workflows.dataAssets.DataAssetsWorkflow.ENTITY_TYPE_FIELDS_KEY;
import static org.openmetadata.service.workflows.searchIndex.ReindexingUtil.ENTITY_TYPE_KEY;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import es.co.elastic.clients.transport.rest5_client.low_level.Request;
import es.co.elastic.clients.transport.rest5_client.low_level.Response;
import es.co.elastic.clients.transport.rest5_client.low_level.Rest5Client;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.apache.hc.core5.http.ContentType;
import org.apache.hc.core5.http.io.entity.StringEntity;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.openmetadata.it.bootstrap.SharedEntities;
import org.openmetadata.it.bootstrap.TestSuiteBootstrap;
import org.openmetadata.it.factories.DashboardServiceTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.data.CreateDashboard;
import org.openmetadata.schema.entity.Type;
import org.openmetadata.schema.entity.data.Dashboard;
import org.openmetadata.schema.entity.services.DashboardService;
import org.openmetadata.schema.entity.teams.Team;
import org.openmetadata.schema.entity.type.CustomProperty;
import org.openmetadata.schema.service.configuration.elasticsearch.ElasticSearchConfiguration.SearchType;
import org.openmetadata.schema.type.CustomPropertyConfig;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.exceptions.InvalidRequestException;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.service.Entity;
import org.openmetadata.service.TypeRegistry;
import org.openmetadata.service.apps.bundles.insights.search.DataInsightsSearchInterface;
import org.openmetadata.service.apps.bundles.insights.search.elasticsearch.ElasticSearchDataInsightsClient;
import org.openmetadata.service.apps.bundles.insights.search.opensearch.OpenSearchDataInsightsClient;
import org.openmetadata.service.apps.bundles.insights.utils.TimestampUtils;
import org.openmetadata.service.apps.bundles.insights.workflows.dataAssets.processors.DataInsightsElasticSearchProcessor;
import org.openmetadata.service.apps.bundles.insights.workflows.dataAssets.processors.DataInsightsEntityEnricherProcessor;
import org.openmetadata.service.apps.bundles.insights.workflows.dataAssets.processors.DataInsightsOpenSearchProcessor;
import org.openmetadata.service.exception.SearchIndexException;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.search.elasticsearch.ElasticSearchIndexSink;
import org.openmetadata.service.search.opensearch.OpenSearchIndexSink;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.workflows.interfaces.Processor;
import org.openmetadata.service.workflows.interfaces.Sink;
import org.openmetadata.service.workflows.interfaces.TaggedOperation;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Regression for #36819: Data Insights copies custom properties into the dynamically mapped {@code
 * dashboardCustomProperty} twin, so a 1.x plain string left in a Team ({@code entityReference})
 * property typed the sub-field as {@code text} and every later Team object was rejected with {@code
 * document_parsing_exception}. Each test drives the production path — enricher, engine processor,
 * engine sink — into its own data stream built from the real Data Insights templates.
 */
@ExtendWith(TestNamespaceExtension.class)
class DataInsightsCustomPropertyIndexingIT {

  private static final String DASHBOARD = Entity.DASHBOARD;
  private static final String LEGACY_TEAM = "legacy-team";
  private static final String TWIN = DASHBOARD + "CustomProperty";
  private static final Logger LOG =
      LoggerFactory.getLogger(DataInsightsCustomPropertyIndexingIT.class);

  private static DataInsightsEntityEnricherProcessor enricher;

  private String teamProperty;

  @BeforeAll
  static void setup() {
    SdkClients.adminClient();
    enricher = new DataInsightsEntityEnricherProcessor(0);
  }

  @AfterEach
  void removeTeamProperty() {
    if (teamProperty != null) {
      deleteDashboardProperty(teamProperty);
    }
  }

  @Test
  void legacyStringInTeamPropertyDoesNotRejectTeamSnapshots(TestNamespace ns) throws Exception {
    String property = addTeamProperty(ns);
    DashboardService service = DashboardServiceTestFactory.createMetabase(ns);
    Dashboard legacy = createDashboard(ns, service, "legacy", null);
    storeLegacyTeamValue(legacy, property);
    Dashboard current = createDashboard(ns, service, "current", teamValue(property));
    List<Map<String, Object>> legacySnapshots = enrichToday(legacy);
    assertEquals(LEGACY_TEAM, extensionValue(legacySnapshots.getFirst(), property));

    try (SnapshotStream stream = new SnapshotStream(ns)) {
      stream.create();
      assertDoesNotThrow(() -> stream.write(legacy, legacySnapshots));
      assertDoesNotThrow(() -> stream.write(current, enrichToday(current)));

      assertEquals(0, stream.failedRecords());
      assertEquals(1, stream.countTeamValues(property), "the Team snapshot is indexed");
    }
  }

  @Test
  void legacyStringInVersionHistoryDoesNotRejectCurrentSnapshot(TestNamespace ns) throws Exception {
    String property = addTeamProperty(ns);
    DashboardService service = DashboardServiceTestFactory.createMetabase(ns);
    Dashboard dashboard = createDashboard(ns, service, "history", null);
    setTeamValue(dashboard, property);
    rewriteFirstVersionWithLegacyTeamValue(dashboard, property);
    List<Map<String, Object>> snapshots = enrichSinceYesterday(dashboard);
    assertTrue(
        snapshots.stream().anyMatch(s -> LEGACY_TEAM.equals(extensionValue(s, property))),
        "precondition: yesterday's raw version snapshot replays the 1.x string");
    assertTrue(
        snapshots.stream().anyMatch(s -> extensionValue(s, property) instanceof Map),
        "precondition: today's snapshot carries the Team object");

    try (SnapshotStream stream = new SnapshotStream(ns)) {
      stream.create();
      assertDoesNotThrow(() -> stream.write(dashboard, snapshots));

      assertEquals(0, stream.failedRecords());
      assertEquals(1, stream.countTeamValues(property), "today's Team snapshot is indexed");
    }
  }

  @Test
  void rolloverHealsStreamPoisonedBeforeUpgrade(TestNamespace ns) throws Exception {
    String property = addTeamProperty(ns);
    DashboardService service = DashboardServiceTestFactory.createMetabase(ns);
    Dashboard legacy = createDashboard(ns, service, "legacy", null);
    storeLegacyTeamValue(legacy, property);
    Dashboard current = createDashboard(ns, service, "current", teamValue(property));

    try (SnapshotStream stream = new SnapshotStream(ns)) {
      stream.create();
      stream.writeRawTwin(property, "written-before-the-upgrade");
      SearchIndexException poisoned =
          assertThrows(
              SearchIndexException.class, () -> stream.write(current, enrichToday(current)));
      assertTrue(
          poisoned.getMessage().contains(TWIN + "." + property),
          "the write index mapped the sub-field as text before the upgrade: "
              + poisoned.getMessage());

      stream.rollover();
      assertDoesNotThrow(() -> stream.write(legacy, enrichToday(legacy)));
      assertDoesNotThrow(() -> stream.write(current, enrichToday(current)));
      assertEquals(1, stream.countTeamValues(property), "the new write index accepts Teams");
    }
  }

  private String addTeamProperty(TestNamespace ns) throws Exception {
    String property = ns.shortPrefix() + "teamreviewer";
    teamProperty = property;
    OpenMetadataClient client = SdkClients.adminClient();
    CustomProperty teamProperty =
        new CustomProperty()
            .withName(property)
            .withDescription("Team-typed property for DataInsightsCustomPropertyIndexingIT")
            .withPropertyType(typeByName(client, "entityReference").getEntityReference())
            .withCustomPropertyConfig(new CustomPropertyConfig().withConfig(List.of("team")));
    client
        .getHttpClient()
        .execute(
            HttpMethod.PUT,
            "/v1/metadata/types/" + typeByName(client, DASHBOARD).getId(),
            teamProperty,
            Type.class);
    return property;
  }

  private static void deleteDashboardProperty(final String property) {
    // Other tests edit the shared dashboard type, so guard the property index and retry if it
    // moves.
    Awaitility.await("delete custom property " + property)
        .atMost(Duration.ofSeconds(30))
        .ignoreException(InvalidRequestException.class)
        .untilAsserted(() -> removeDashboardPropertyAtItsCurrentIndex(property));
  }

  private static void removeDashboardPropertyAtItsCurrentIndex(final String property)
      throws Exception {
    final OpenMetadataClient client = SdkClients.adminClient();
    final Type type = typeByName(client, DASHBOARD + "?fields=customProperties");
    final List<CustomProperty> properties = type.getCustomProperties();
    for (int index = 0; index < properties.size(); index++) {
      if (property.equals(properties.get(index).getName())) {
        client
            .getHttpClient()
            .execute(
                HttpMethod.PATCH,
                "/v1/metadata/types/" + type.getId(),
                guardedRemoval(index, property),
                Type.class);
        return;
      }
    }
  }

  /** The test op makes the removal fail, and the await retry, if the property moved meanwhile. */
  private static JsonNode guardedRemoval(final int index, final String property) {
    return JsonUtils.readTree(
        """
        [{"op":"test","path":"/customProperties/%1$d/name","value":"%2$s"},
         {"op":"remove","path":"/customProperties/%1$d"}]
        """
            .formatted(index, property));
  }

  private static Type typeByName(OpenMetadataClient client, String name) throws Exception {
    String response =
        client
            .getHttpClient()
            .executeForString(HttpMethod.GET, "/v1/metadata/types/name/" + name, null);
    return JsonUtils.readValue(response, Type.class);
  }

  private static Team team() {
    return SharedEntities.get().TEAM11;
  }

  /** A reference as the UI sends it; it is stored and indexed as sent. */
  private static Map<String, Object> teamValue(String property) {
    Team team = team();
    return Map.of(
        property,
        Map.of(
            "id",
            team.getId().toString(),
            "type",
            Entity.TEAM,
            "name",
            team.getName(),
            "fullyQualifiedName",
            team.getFullyQualifiedName()));
  }

  private static Dashboard createDashboard(
      TestNamespace ns, DashboardService service, String name, Map<String, Object> extension)
      throws Exception {
    CreateDashboard request =
        new CreateDashboard()
            .withName(ns.prefix(name))
            .withService(service.getFullyQualifiedName())
            .withExtension(extension);
    return SdkClients.adminClient().dashboards().create(request);
  }

  private static void setTeamValue(Dashboard dashboard, String property) throws Exception {
    JsonNode patch =
        JsonUtils.valueToTree(
            List.of(Map.of("op", "add", "path", "/extension", "value", teamValue(property))));
    SdkClients.adminClient().dashboards().patch(dashboard.getId(), patch);
  }

  /** The row a 1.x server stored for a Team property set to a plain string. */
  private static void storeLegacyTeamValue(Dashboard dashboard, String property) {
    Entity.getCollectionDAO()
        .entityExtensionDAO()
        .insert(
            dashboard.getId(),
            TypeRegistry.getCustomPropertyFQN(DASHBOARD, property),
            "customFieldSchema",
            JsonUtils.pojoToJson(LEGACY_TEAM));
    EntityRepository.invalidateCacheForEntity(
        DASHBOARD, dashboard.getId(), dashboard.getFullyQualifiedName());
  }

  /** Makes version 0.1 a snapshot from yesterday that still carries the 1.x string. */
  private static void rewriteFirstVersionWithLegacyTeamValue(Dashboard dashboard, String property) {
    String versionKey = EntityUtil.getVersionExtension(DASHBOARD, 0.1);
    var extensions = Entity.getCollectionDAO().entityExtensionDAO();
    ObjectNode version =
        (ObjectNode) JsonUtils.readTree(extensions.getExtension(dashboard.getId(), versionKey));
    version.set("extension", JsonUtils.valueToTree(Map.of(property, LEGACY_TEAM)));
    version.put("updatedAt", TimestampUtils.subtractDays(System.currentTimeMillis(), 1));
    extensions.insert(dashboard.getId(), versionKey, DASHBOARD, JsonUtils.pojoToJson(version));
  }

  private static Object extensionValue(Map<String, Object> snapshot, String property) {
    return ((Map<?, ?>) snapshot.get("extension")).get(property);
  }

  private static List<Map<String, Object>> enrichToday(Dashboard dashboard)
      throws SearchIndexException {
    long now = System.currentTimeMillis();
    return enrich(dashboard, TimestampUtils.getStartOfDayTimestamp(now), now);
  }

  private static List<Map<String, Object>> enrichSinceYesterday(Dashboard dashboard)
      throws SearchIndexException {
    long now = System.currentTimeMillis();
    long yesterday = TimestampUtils.subtractDays(now, 1);
    return enrich(dashboard, TimestampUtils.getStartOfDayTimestamp(yesterday), now);
  }

  private static List<Map<String, Object>> enrich(
      final Dashboard dashboard, final long start, final long end) throws SearchIndexException {
    return enricher.enrichSingle(loadWithAllFields(dashboard), enrichmentContext(start, end));
  }

  @SuppressWarnings("unchecked")
  private static Dashboard loadWithAllFields(final Dashboard dashboard) {
    final EntityRepository<Dashboard> repository =
        (EntityRepository<Dashboard>) Entity.getEntityRepository(DASHBOARD);
    final Dashboard loaded = repository.find(dashboard.getId(), Include.NON_DELETED, false);
    repository.setFieldsInBulk(repository.getFields("*"), List.of(loaded));
    return loaded;
  }

  private static Map<String, Object> enrichmentContext(final long start, final long end)
      throws SearchIndexException {
    final DataInsightsSearchInterface searchInterface = SnapshotStream.searchInterface();
    final List<String> fields =
        searchInterface.getEntityAttributeFields(
            searchInterface.readDataInsightsSearchConfiguration(), DASHBOARD);
    return Map.of(
        ENTITY_TYPE_KEY,
        DASHBOARD,
        START_TIMESTAMP_KEY,
        start,
        END_TIMESTAMP_KEY,
        TimestampUtils.getEndOfDayTimestamp(end),
        ENTITY_TYPE_FIELDS_KEY,
        new ArrayList<>(fields));
  }

  /**
   * A data stream built from the real Data Insights dashboard templates, written through the same
   * engine processor and sink {@code DataAssetsWorkflow} uses, and deleted with its templates.
   */
  @SuppressWarnings({"rawtypes", "unchecked"})
  private static final class SnapshotStream implements AutoCloseable {
    private final String name;
    private final Rest5Client client = TestSuiteBootstrap.createSearchClient();
    private final Processor processor;
    private final Sink sink;

    SnapshotStream(TestNamespace ns) {
      SearchRepository repository = Entity.getSearchRepository();
      long payloadSize = repository.getSearchConfiguration().getPayLoadSize();
      boolean openSearch = repository.getSearchType() == SearchType.OPENSEARCH;
      this.name = "it-" + ns.shortPrefix() + "-di-data-assets-" + DASHBOARD;
      this.processor =
          openSearch
              ? new DataInsightsOpenSearchProcessor(0)
              : new DataInsightsElasticSearchProcessor(0);
      this.sink =
          openSearch
              ? new OpenSearchIndexSink(repository, 0, payloadSize)
              : new ElasticSearchIndexSink(repository, 0, payloadSize);
    }

    static DataInsightsSearchInterface searchInterface() {
      SearchRepository repository = Entity.getSearchRepository();
      return repository.getSearchType() == SearchType.OPENSEARCH
          ? new OpenSearchDataInsightsClient(
              repository.getSearchClient().getHighLevelClient(), repository.getClusterAlias())
          : new ElasticSearchDataInsightsClient(
              (Rest5Client) repository.getSearchClient().getLowLevelClient(),
              repository.getClusterAlias());
    }

    void create() throws IOException {
      SearchRepository repository = Entity.getSearchRepository();
      searchInterface()
          .createDataAssetsDataStream(
              name, DASHBOARD, repository.getIndexMapping(DASHBOARD), "en", 7);
    }

    void write(Dashboard dashboard, List<Map<String, Object>> snapshots)
        throws SearchIndexException {
      List<?> operations = (List<?>) processor.process(snapshots, Map.of(DATA_STREAM_KEY, name));
      sink.write(
          operations.stream()
              .map(op -> new TaggedOperation<>(op, dashboard.getEntityReference()))
              .toList());
    }

    int failedRecords() {
      return sink.getStats().getFailedRecords();
    }

    void writeRawTwin(String property, String value) throws IOException {
      Map<String, Object> document =
          Map.of("@timestamp", System.currentTimeMillis(), TWIN, Map.of(property, value));
      send("POST", "/" + name + "/_doc?refresh=true", JsonUtils.pojoToJson(document));
    }

    void rollover() throws IOException {
      searchInterface().rolloverDataStream(name);
    }

    long countTeamValues(String property) throws IOException {
      send("POST", "/" + name + "/_refresh", null);
      String field = TWIN + "." + property + ".fullyQualifiedName.keyword";
      Map<String, Object> query =
          Map.of("query", Map.of("term", Map.of(field, team().getFullyQualifiedName())));
      String body = send("POST", "/" + name + "/_count", JsonUtils.pojoToJson(query));
      return JsonUtils.readTree(body).path("count").asLong();
    }

    private String send(String method, String path, String json) throws IOException {
      Request request = new Request(method, path);
      if (json != null) {
        request.setEntity(new StringEntity(json, ContentType.APPLICATION_JSON));
      }
      Response response = client.performRequest(request);
      return response.getEntity() == null
          ? ""
          : new String(response.getEntity().getContent().readAllBytes(), StandardCharsets.UTF_8);
    }

    @Override
    public void close() throws IOException {
      try (client) {
        deleteQuietly("/_data_stream/" + name);
        deleteQuietly("/_index_template/" + name);
        deleteQuietly("/_component_template/" + name + "-mapping");
      }
    }

    private void deleteQuietly(String path) {
      try {
        send("DELETE", path, null);
      } catch (IOException e) {
        LOG.warn("Could not delete {}: {}", path, e.getMessage());
      }
    }
  }
}
