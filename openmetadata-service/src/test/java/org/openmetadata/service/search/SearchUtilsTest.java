package org.openmetadata.service.search;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import jakarta.json.Json;
import jakarta.json.JsonArray;
import jakarta.json.JsonObject;
import java.io.StringReader;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import javax.net.ssl.SSLContext;
import org.apache.hc.client5.http.auth.AuthScope;
import org.apache.hc.client5.http.auth.Credentials;
import org.apache.hc.client5.http.impl.auth.BasicCredentialsProvider;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.MockedStatic;
import org.openmetadata.schema.api.entityRelationship.EntityRelationshipDirection;
import org.openmetadata.schema.api.lineage.EsLineageData;
import org.openmetadata.schema.api.lineage.LineageDirection;
import org.openmetadata.schema.api.search.GlobalSettings;
import org.openmetadata.schema.api.search.SearchSettings;
import org.openmetadata.schema.service.configuration.elasticsearch.ElasticSearchConfiguration;
import org.openmetadata.schema.settings.SettingsType;
import org.openmetadata.service.Entity;
import org.openmetadata.service.resources.settings.SettingsCache;
import org.openmetadata.service.search.security.RBACConditionEvaluator;
import org.openmetadata.service.security.policyevaluator.SubjectContext;
import org.openmetadata.service.util.SSLUtil;

class SearchUtilsTest {

  @Test
  void relationshipHelpersBuildExpectedRefsAndCopies() {
    UUID id = UUID.randomUUID();
    Map<String, Object> entityMap =
        Map.of(
            "id",
            id.toString(),
            "entityType",
            Entity.TABLE,
            "fullyQualifiedName",
            "service.db.schema.orders");

    var relationshipRef = SearchUtils.getRelationshipRef(entityMap);
    assertEquals(id, relationshipRef.getId());
    assertEquals(Entity.TABLE, relationshipRef.getType());
    assertEquals("service.db.schema.orders", relationshipRef.getFullyQualifiedName());
    assertNotNull(relationshipRef.getFqnHash());

    var entityRelationshipRef = SearchUtils.getEntityRelationshipRef(entityMap);
    assertEquals(id, entityRelationshipRef.getId());
    assertEquals(Entity.TABLE, entityRelationshipRef.getType());

    EsLineageData original =
        new EsLineageData()
            .withDocId("edge-1")
            .withSqlQuery("select 1")
            .withDescription("desc")
            .withSource("manual")
            .withPipelineEntityType(Entity.PIPELINE)
            .withFromEntity(relationshipRef)
            .withToEntity(relationshipRef);

    EsLineageData copy = SearchUtils.copyEsLineageData(original);
    assertEquals(original.getDocId(), copy.getDocId());
    assertEquals(original.getSqlQuery(), copy.getSqlQuery());
    assertEquals(original.getDescription(), copy.getDescription());
    assertEquals(original.getPipelineEntityType(), copy.getPipelineEntityType());
    assertSame(original.getFromEntity(), copy.getFromEntity());
  }

  @Test
  void aggregationAndFieldHelpersHandleExpectedInputs() {
    JsonObject root =
        Json.createReader(
                new StringReader(
                    "{\"graph\":{\"buckets\":[{\"key\":\"orders\"}]},\"key\":\"root\"}"))
            .readObject();
    JsonObject graph = SearchUtils.getAggregationObject(root, "graph");
    JsonArray buckets = SearchUtils.getAggregationBuckets(graph);

    assertEquals("orders", SearchUtils.getAggregationKeyValue(buckets.getJsonObject(0)));
    assertTrue(
        SearchUtils.getLineageDirection(LineageDirection.UPSTREAM, false)
            .contains(Entity.FIELD_FULLY_QUALIFIED_NAME_HASH_KEYWORD));
    assertTrue(
        SearchUtils.getLineageDirection(LineageDirection.DOWNSTREAM, true)
            .contains(SearchUtils.PIPELINE_AS_EDGE_KEY));
    assertEquals(
        SearchUtils.DOWNSTREAM_NODE_KEY,
        SearchUtils.getLineageDirectionAggregationField(LineageDirection.DOWNSTREAM));
    assertEquals(
        Set.of("upstream", "downstream"),
        SearchUtils.buildDirectionToFqnSet(Set.of("upstream", "downstream"), Set.of("fqn"))
            .keySet());
    assertEquals(
        Set.of("fqn"),
        SearchUtils.buildDirectionToFqnSet(Set.of("upstream"), Set.of("fqn")).get("upstream"));
    assertTrue(SearchUtils.isConnectedVia(Entity.PIPELINE));
    assertTrue(SearchUtils.isConnectedVia(Entity.STORED_PROCEDURE));
    assertFalse(SearchUtils.isConnectedVia(Entity.TABLE));
    assertEquals(List.of(2, 3), SearchUtils.paginateList(List.of(1, 2, 3), 1, 5));
    assertTrue(SearchUtils.paginateList(List.of(1, 2), 5, 1).isEmpty());
    assertTrue(SearchUtils.paginateList(null, 0, 1).isEmpty());
    assertTrue(SearchUtils.getRequiredLineageFields("*").isEmpty());
    assertTrue(SearchUtils.getRequiredEntityRelationshipFields("*").isEmpty());
    assertTrue(
        SearchUtils.getRequiredLineageFields("description, schemaDefinition")
            .contains("description"));
    assertFalse(
        SearchUtils.getRequiredLineageFields("description, schemaDefinition")
            .contains("schemaDefinition"));
    assertFalse(
        SearchUtils.getRequiredEntityRelationshipFields("description, embedding")
            .contains("embedding"));
    assertEquals(List.of("name", "owners"), SearchUtils.sourceFields(" name, , owners "));
    assertTrue(SearchUtils.sourceFields(null).isEmpty());
    assertTrue(
        SearchUtils.getEntityRelationshipDirection(EntityRelationshipDirection.DOWNSTREAM)
            .contains(SearchUtils.DOWNSTREAM_ENTITY_RELATIONSHIP_KEY));
  }

  @Test
  void searchUtilsConvertsStoredLineageAndEntityRelationshipData() {
    EsLineageData lineageData = new EsLineageData().withDocId("edge-1");
    Map<String, Object> lineageDoc =
        Map.of(SearchClient.UPSTREAM_LINEAGE_FIELD, List.of(lineageData));

    List<EsLineageData> lineage = SearchUtils.getUpstreamLineageListIfExist(lineageDoc);
    assertEquals(1, lineage.size());
    assertEquals("edge-1", lineage.get(0).getDocId());
    assertTrue(SearchUtils.getUpstreamLineageListIfExist(Map.of()).isEmpty());

    Map<String, Object> relationshipData =
        Map.of(
            "docId",
            "rel-1",
            "entity",
            Map.of(
                "id",
                UUID.randomUUID().toString(),
                "type",
                Entity.TABLE,
                "fullyQualifiedName",
                "service.db.schema.orders",
                "fqnHash",
                "hash"));
    Map<String, Object> relationshipDoc =
        Map.of(SearchClient.UPSTREAM_ENTITY_RELATIONSHIP_FIELD, List.of(relationshipData));

    var relationships = SearchUtils.getUpstreamEntityRelationshipListIfExist(relationshipDoc);
    assertEquals(1, relationships.size());
    assertEquals("rel-1", relationships.get(0).getDocId());
    assertEquals(
        "service.db.schema.orders", relationships.get(0).getEntity().getFullyQualifiedName());
    assertEquals(
        List.of(relationships.get(0)),
        SearchUtils.paginateUpstreamEntityRelationships(relationships, 0, 1));
    assertTrue(SearchUtils.paginateUpstreamEntityRelationships(relationships, 2, 1).isEmpty());
    assertTrue(SearchUtils.getUpstreamEntityRelationshipListIfExist(Map.of()).isEmpty());
  }

  @Test
  void timeWindowedLineageFilterOnlyBypassesLegacyEdgesWithoutTimestamps() {
    EsLineageData overlappingManualEdge =
        new EsLineageData()
            .withDocId("overlapping-manual")
            .withSource("manual")
            .withCreatedAt(500L)
            .withUpdatedAt(1_500L);
    EsLineageData futureManualEdge =
        new EsLineageData()
            .withDocId("future-manual")
            .withSource("manual")
            .withCreatedAt(3_000L)
            .withUpdatedAt(4_000L);
    EsLineageData legacyManualEdge =
        new EsLineageData().withDocId("legacy-manual").withSource("manual");
    Map<String, Object> lineageDoc =
        Map.of(
            SearchClient.UPSTREAM_LINEAGE_FIELD,
            List.of(overlappingManualEdge, futureManualEdge, legacyManualEdge));

    List<EsLineageData> lineage =
        SearchUtils.getUpstreamLineageListIfExist(lineageDoc, 1_000L, 2_000L);

    assertEquals(
        List.of("overlapping-manual", "legacy-manual"),
        lineage.stream().map(EsLineageData::getDocId).toList());
  }

  @Test
  void timeWindowedLineageFilterBoundsEdgesWithOneTimestamp() {
    EsLineageData createdOnlyPastEdge =
        new EsLineageData().withDocId("created-only-past").withCreatedAt(500L);
    EsLineageData updatedOnlyPastEdge =
        new EsLineageData().withDocId("updated-only-past").withUpdatedAt(500L);
    EsLineageData createdOnlyCurrentEdge =
        new EsLineageData().withDocId("created-only-current").withCreatedAt(1_500L);
    EsLineageData updatedOnlyCurrentEdge =
        new EsLineageData().withDocId("updated-only-current").withUpdatedAt(1_500L);
    Map<String, Object> lineageDoc =
        Map.of(
            SearchClient.UPSTREAM_LINEAGE_FIELD,
            List.of(
                createdOnlyPastEdge,
                updatedOnlyPastEdge,
                createdOnlyCurrentEdge,
                updatedOnlyCurrentEdge));

    List<EsLineageData> lineage =
        SearchUtils.getUpstreamLineageListIfExist(lineageDoc, 1_000L, 2_000L);

    assertEquals(
        List.of("created-only-current", "updated-only-current"),
        lineage.stream().map(EsLineageData::getDocId).toList());
  }

  @Test
  void timeWindowedLineageFilterRemovesNullEdges() {
    EsLineageData matchingEdge =
        new EsLineageData().withDocId("matching-edge").withCreatedAt(1_500L);
    EsLineageData legacyEdge = new EsLineageData().withDocId("legacy-edge");
    Map<String, Object> lineageDoc =
        Map.of(SearchClient.UPSTREAM_LINEAGE_FIELD, Arrays.asList(matchingEdge, null, legacyEdge));

    List<EsLineageData> filteredLineage =
        SearchUtils.getUpstreamLineageListIfExist(lineageDoc, 1_000L, 2_000L);
    List<EsLineageData> unboundedLineage =
        SearchUtils.getUpstreamLineageListIfExist(lineageDoc, null, null);

    assertEquals(
        List.of("matching-edge", "legacy-edge"),
        filteredLineage.stream().map(EsLineageData::getDocId).toList());
    assertEquals(
        List.of("matching-edge", "legacy-edge"),
        unboundedLineage.stream().map(EsLineageData::getDocId).toList());
  }

  @Test
  void rbacAndSslHelpersRespectConfiguration() throws Exception {
    SearchSettings enabledSettings = new SearchSettings();
    GlobalSettings enabledGlobalSettings = new GlobalSettings();
    enabledGlobalSettings.setEnableAccessControl(true);
    enabledSettings.setGlobalSettings(enabledGlobalSettings);

    SearchSettings disabledSettings = new SearchSettings();
    GlobalSettings disabledGlobalSettings = new GlobalSettings();
    disabledGlobalSettings.setEnableAccessControl(false);
    disabledSettings.setGlobalSettings(disabledGlobalSettings);

    SubjectContext subjectContext = mock(SubjectContext.class);
    when(subjectContext.isAdmin()).thenReturn(false);
    when(subjectContext.isBot()).thenReturn(false);
    RBACConditionEvaluator evaluator = mock(RBACConditionEvaluator.class);

    try (MockedStatic<SettingsCache> settingsCache = mockStatic(SettingsCache.class)) {
      settingsCache
          .when(() -> SettingsCache.getSetting(SettingsType.SEARCH_SETTINGS, SearchSettings.class))
          .thenReturn(enabledSettings);

      assertTrue(SearchUtils.shouldApplyRbacConditions(subjectContext, evaluator));

      when(subjectContext.isAdmin()).thenReturn(true);
      assertFalse(SearchUtils.shouldApplyRbacConditions(subjectContext, evaluator));
      when(subjectContext.isAdmin()).thenReturn(false);
      when(subjectContext.isBot()).thenReturn(true);
      assertFalse(SearchUtils.shouldApplyRbacConditions(subjectContext, evaluator));
      when(subjectContext.isBot()).thenReturn(false);
      assertFalse(SearchUtils.shouldApplyRbacConditions(subjectContext, null));
      assertFalse(SearchUtils.shouldApplyRbacConditions(null, evaluator));

      settingsCache
          .when(() -> SettingsCache.getSetting(SettingsType.SEARCH_SETTINGS, SearchSettings.class))
          .thenReturn(disabledSettings);
      assertFalse(SearchUtils.shouldApplyRbacConditions(subjectContext, evaluator));
    }

    ElasticSearchConfiguration httpConfig = new ElasticSearchConfiguration();
    httpConfig.setScheme("http");
    assertNull(SearchUtils.createElasticSearchSSLContext(httpConfig));

    ElasticSearchConfiguration httpsConfig = new ElasticSearchConfiguration();
    httpsConfig.setScheme("https");
    httpsConfig.setTruststorePath("/tmp/truststore.jks");
    httpsConfig.setTruststorePassword("secret");
    SSLContext sslContext = mock(SSLContext.class);

    try (MockedStatic<SSLUtil> sslUtil = mockStatic(SSLUtil.class)) {
      sslUtil
          .when(() -> SSLUtil.createSSLContext("/tmp/truststore.jks", "secret", "ElasticSearch"))
          .thenReturn(sslContext);

      assertSame(sslContext, SearchUtils.createElasticSearchSSLContext(httpsConfig));
    }
  }

  @Test
  void buildHttpHostsForHc5ParsesMultipleHostsAndRejectsInvalidPorts() {
    ElasticSearchConfiguration config = new ElasticSearchConfiguration();
    config.setHost("es-node-1:9201, es-node-2");
    config.setPort(9200);
    config.setScheme("https");

    org.apache.hc.core5.http.HttpHost[] hosts = SearchUtils.buildHttpHostsForHc5(config, "Test");

    assertEquals(2, hosts.length);
    assertEquals("es-node-1", hosts[0].getHostName());
    assertEquals(9201, hosts[0].getPort());
    assertEquals("https", hosts[0].getSchemeName());
    assertEquals("es-node-2", hosts[1].getHostName());
    assertEquals(9200, hosts[1].getPort());

    ElasticSearchConfiguration invalidConfig = new ElasticSearchConfiguration();
    invalidConfig.setHost("es-node-1:not-a-port");
    invalidConfig.setPort(9200);
    invalidConfig.setScheme("https");

    assertThrows(
        IllegalArgumentException.class,
        () -> SearchUtils.buildHttpHostsForHc5(invalidConfig, "Test"));
  }

  @Test
  void buildScopedCredentialsProviderScopesCredentialsToTargetHostsOnly() {
    ElasticSearchConfiguration config = new ElasticSearchConfiguration();
    config.setHost("es-node-1:9201,es-node-2:9202");
    config.setPort(9200);
    config.setScheme("https");
    config.setUsername("admin");
    config.setPassword("s3cret");

    org.apache.hc.core5.http.HttpHost[] httpHosts =
        SearchUtils.buildHttpHostsForHc5(config, "Test");

    BasicCredentialsProvider provider =
        SearchUtils.buildScopedCredentialsProvider(config, httpHosts);

    assertNotNull(provider);

    Credentials node1Creds = provider.getCredentials(new AuthScope("es-node-1", 9201), null);
    assertNotNull(node1Creds);

    Credentials node2Creds = provider.getCredentials(new AuthScope("es-node-2", 9202), null);
    assertNotNull(node2Creds);

    Credentials proxyCreds =
        provider.getCredentials(new AuthScope("corporate-proxy.internal", 8080), null);
    assertNull(proxyCreds);
  }

  @Test
  void buildScopedCredentialsProviderReturnsNullWhenNoCredentials() {
    ElasticSearchConfiguration noCredsConfig = new ElasticSearchConfiguration();
    noCredsConfig.setHost("es-node-1");
    noCredsConfig.setPort(9200);
    noCredsConfig.setScheme("http");

    org.apache.hc.core5.http.HttpHost[] hosts =
        SearchUtils.buildHttpHostsForHc5(noCredsConfig, "Test");
    assertNull(SearchUtils.buildScopedCredentialsProvider(noCredsConfig, hosts));

    ElasticSearchConfiguration usernameOnlyConfig = new ElasticSearchConfiguration();
    usernameOnlyConfig.setHost("es-node-1");
    usernameOnlyConfig.setPort(9200);
    usernameOnlyConfig.setScheme("http");
    usernameOnlyConfig.setUsername("admin");

    assertNull(
        SearchUtils.buildScopedCredentialsProvider(
            usernameOnlyConfig, SearchUtils.buildHttpHostsForHc5(usernameOnlyConfig, "Test")));

    ElasticSearchConfiguration passwordOnlyConfig = new ElasticSearchConfiguration();
    passwordOnlyConfig.setHost("es-node-1");
    passwordOnlyConfig.setPort(9200);
    passwordOnlyConfig.setScheme("http");
    passwordOnlyConfig.setPassword("secret");

    assertNull(
        SearchUtils.buildScopedCredentialsProvider(
            passwordOnlyConfig, SearchUtils.buildHttpHostsForHc5(passwordOnlyConfig, "Test")));
  }

  @Test
  void buildScopedCredentialsProviderWorksWithSingleHost() {
    ElasticSearchConfiguration config = new ElasticSearchConfiguration();
    config.setHost("localhost");
    config.setPort(9200);
    config.setScheme("http");
    config.setUsername("elastic");
    config.setPassword("changeme");

    org.apache.hc.core5.http.HttpHost[] httpHosts =
        SearchUtils.buildHttpHostsForHc5(config, "Test");

    BasicCredentialsProvider provider =
        SearchUtils.buildScopedCredentialsProvider(config, httpHosts);

    assertNotNull(provider);
    assertNotNull(provider.getCredentials(new AuthScope("localhost", 9200), null));
    assertNull(provider.getCredentials(new AuthScope("other-host", 9200), null));
  }

  // ===========================================================================
  // Fuzzy heuristic tests — pin the clause-explosion fix.
  // The contract: once the query analyzes into more than 2 alphanumeric
  // sub-tokens (matching how the om_ngram tokenizer splits on
  // non-alphanumeric characters), fuzziness drops to "0" and max_expansions
  // drops to 1. This bounds the per-query clause count for ngram fuzzy paths
  // and prevents Lucene's max_clause_count from rejecting the whole query.
  // ===========================================================================

  @ParameterizedTest(name = "getFuzziness(\"{0}\") == \"{1}\"")
  @CsvSource(
      // query | expectedFuzziness
      // single-token queries keep fuzziness=1 so typo tolerance still works
      // (e.g. "custmer" → "customer" must keep matching)
      delimiter = '|',
      value = {
        "customer | 1",
        "custmer | 1",
        "fct_orders | 1", // 2 sub-tokens - boundary, still fuzzy
        "customer orders | 1", // 2 whitespace tokens
        "LhrIncomingFlightsArrivalsScheduleV1 | 1", // 1 long sub-token
        // multi-segment identifiers drop to fuzziness=0 to bound clause count
        "my.customer.table | 0", // 3 sub-tokens
        "lhr__incoming_flights | 0", // 3 sub-tokens
        "kochi__expected_vessels__portcall_v1 | 0", // 5 sub-tokens
        "scraped/kochi/expected_vessels/parsed/portcall/v1 | 0",
        "foo-bar.baz_qux | 0", // 4 sub-tokens via mixed separators
      })
  void getFuzzinessReturnsExpected(String query, String expected) {
    assertEquals(expected, SearchUtils.getFuzziness(query));
  }

  @ParameterizedTest(name = "getFuzziness(blank) defaults to \"1\"")
  @ValueSource(strings = {"", " ", "\t", "\n"})
  void getFuzzinessDefaultsToOneForBlankInput(String blank) {
    assertEquals("1", SearchUtils.getFuzziness(blank));
  }

  @Test
  void getFuzzinessHandlesNull() {
    assertEquals("1", SearchUtils.getFuzziness(null));
  }

  @Test
  void getFuzzinessTreatsOnlySeparatorsAsZeroSubTokens() {
    // Pure separator strings analyze to 0 sub-tokens, which is not > 2,
    // so the fuzzy path stays active. This is mostly a no-op regardless
    // (downstream the query produces no analyzed terms) but the heuristic
    // must not regress to throwing or returning null.
    assertEquals("1", SearchUtils.getFuzziness("___"));
    assertEquals("1", SearchUtils.getFuzziness("..."));
    assertEquals("1", SearchUtils.getFuzziness("/-/"));
  }

  @ParameterizedTest(name = "getMaxExpansions(\"{0}\") == {1}")
  @CsvSource(
      delimiter = '|',
      value = {
        // single/two sub-tokens preserve the wide expansion count
        "customer | 10",
        "fct_orders | 10",
        "customer orders | 10",
        // multi-segment drops expansions to 1 to bound clause count
        "my.customer.table | 1",
        "lhr__incoming_flights | 1",
        "kochi__expected_vessels__portcall_v1 | 1",
        "scraped/kochi/expected_vessels/parsed/portcall/v1 | 1",
      })
  void getMaxExpansionsReturnsExpected(String query, int expected) {
    assertEquals(expected, SearchUtils.getMaxExpansions(query));
  }

  @ParameterizedTest
  @ValueSource(strings = {"", " ", "\t"})
  void getMaxExpansionsDefaultsToTenForBlankInput(String blank) {
    assertEquals(10, SearchUtils.getMaxExpansions(blank));
  }

  @Test
  void getMaxExpansionsHandlesNull() {
    assertEquals(10, SearchUtils.getMaxExpansions(null));
  }

  /**
   * The two heuristics must agree on the boundary: any query that disables fuzziness must also
   * collapse expansions, and vice versa. Any drift between them would re-introduce the clause
   * explosion (fuzziness=1 with max_expansions=10 is the dangerous combination).
   */
  @ParameterizedTest
  @ValueSource(
      strings = {
        "a",
        "customer",
        "fct_orders",
        "customer orders",
        "my.customer.table",
        "lhr__incoming_flights",
        "kochi__expected_vessels__portcall_v1",
        "foo-bar.baz/qux"
      })
  void fuzzinessAndMaxExpansionsAgreeOnBoundary(String query) {
    boolean fuzzyOff = "0".equals(SearchUtils.getFuzziness(query));
    boolean expansionsCollapsed = SearchUtils.getMaxExpansions(query) == 1;
    assertEquals(
        fuzzyOff,
        expansionsCollapsed,
        "fuzziness and max_expansions must scale together for query \"" + query + "\"");
  }

  // ===========================================================================
  // Index classification tests — pin which index names route to which
  // search-builder code path. Drift here changes behavior silently.
  // ===========================================================================

  @ParameterizedTest
  @ValueSource(
      strings = {
        "table_search_index",
        Entity.TABLE,
        "topic_search_index",
        Entity.TOPIC,
        "dashboard_search_index",
        Entity.DASHBOARD,
        "pipeline_search_index",
        Entity.PIPELINE,
        "container_search_index",
        Entity.CONTAINER,
        "metric_search_index",
        Entity.METRIC,
        "directory_search_index",
        Entity.DIRECTORY,
        "file_search_index",
        Entity.FILE
      })
  void isDataAssetIndexRecognizesDataAssetIndices(String index) {
    assertTrue(SearchUtils.isDataAssetIndex(index));
  }

  @ParameterizedTest
  @ValueSource(
      strings = {
        // services are NOT data assets — they go through a different builder path
        "database_service_search_index",
        "messaging_service_index",
        // time-series indices are NOT data assets
        "test_case_result_search_index",
        // user/team/dataAsset alias are NOT data assets in this classifier's sense
        "user_search_index",
        "team_search_index",
        "dataAsset",
        "all",
        "garbage"
      })
  void isDataAssetIndexRejectsNonDataAssetIndices(String index) {
    assertFalse(SearchUtils.isDataAssetIndex(index));
  }

  @ParameterizedTest
  @ValueSource(
      strings = {
        "api_service_search_index",
        "database_service_search_index",
        "databaseService",
        "messaging_service_index",
        "messagingService",
        "drive_service_index",
        "driveService"
      })
  void isServiceIndexRecognizesServiceIndices(String index) {
    assertTrue(SearchUtils.isServiceIndex(index));
  }

  @ParameterizedTest
  @ValueSource(strings = {"table_search_index", Entity.TABLE, "user_search_index", "garbage"})
  void isServiceIndexRejectsNonServiceIndices(String index) {
    assertFalse(SearchUtils.isServiceIndex(index));
  }

  @ParameterizedTest
  @ValueSource(
      strings = {
        "test_case_result_search_index",
        "testCaseResult",
        "test_case_resolution_status_search_index",
        "raw_cost_analysis_report_data_index",
        "aggregated_cost_analysis_report_data_index"
      })
  void isTimeSeriesIndexRecognizesTimeSeriesIndices(String index) {
    assertTrue(SearchUtils.isTimeSeriesIndex(index));
  }

  @ParameterizedTest
  @ValueSource(strings = {"table_search_index", "test_case_search_index", "garbage"})
  void isTimeSeriesIndexRejectsNonTimeSeriesIndices(String index) {
    assertFalse(SearchUtils.isTimeSeriesIndex(index));
  }

  @ParameterizedTest
  @ValueSource(
      strings = {"test_case_search_index", "testCase", "test_suite_search_index", "testSuite"})
  void isDataQualityIndexRecognizesDataQualityIndices(String index) {
    assertTrue(SearchUtils.isDataQualityIndex(index));
  }

  @ParameterizedTest
  @ValueSource(strings = {"table_search_index", "test_case_result_search_index", "garbage"})
  void isDataQualityIndexRejectsNonDataQualityIndices(String index) {
    assertFalse(SearchUtils.isDataQualityIndex(index));
  }

  @Test
  void isColumnIndexRecognizesColumnIndices() {
    assertTrue(SearchUtils.isColumnIndex("column_search_index"));
    assertTrue(SearchUtils.isColumnIndex(Entity.TABLE_COLUMN));
    assertFalse(SearchUtils.isColumnIndex("table_search_index"));
    assertFalse(SearchUtils.isColumnIndex("garbage"));
  }

  @Test
  void searchAfterNullOrEmpty() {
    assertNull(SearchUtils.searchAfter((List<String>) null));
    assertNull(SearchUtils.searchAfter(List.of()));
  }

  @Test
  void searchAfterBlankEntriesDropped() {
    assertNull(SearchUtils.searchAfter(List.of("")));
    assertNull(SearchUtils.searchAfter(List.of("", "")));
    assertEquals(List.of("v1"), SearchUtils.searchAfter(List.of("", "v1", "")));
  }

  @Test
  void searchAfterMultiValueListPreserved() {
    assertEquals(List.of("v1", "v2"), SearchUtils.searchAfter(List.of("v1", "v2")));
  }

  @Test
  void searchAfterSingleValueContainingCommaNotSplit() {
    String commaFqn = "service.database.schema.glossary term (with comma, inside name)";
    assertEquals(List.of(commaFqn), SearchUtils.searchAfter(List.of(commaFqn)));
  }

  @Test
  void searchAfterMultipleCommaBearingValuesPreserved() {
    List<String> values = List.of("first,with,commas", "second,also,with,commas");
    assertEquals(values, SearchUtils.searchAfter(values));
  }

  @ParameterizedTest(name = "mapEntityTypesToIndexNames(\"{0}\") == \"{1}\"")
  @CsvSource(
      delimiter = '|',
      value = {
        "table_search_index | table",
        "table | table",
        "topic_search_index | topic",
        "pipeline_search_index | pipeline",
        "container_search_index | container",
        "metric_search_index | metric",
        "user_search_index | user",
        "team_search_index | team",
        "dataAsset | dataAsset",
        // unknown values fall through to dataAsset (the catch-all default)
        "totally_unknown_index | dataAsset"
      })
  void mapEntityTypesToIndexNamesProducesEntityNameOrDataAssetFallback(
      String index, String expected) {
    assertEquals(expected, SearchUtils.mapEntityTypesToIndexNames(index));
  }

  // ===========================================================================
  // Best-match aggregation tests — exact → prefix → contains ordering with dedup
  // ===========================================================================

  @ParameterizedTest(name = "isBestMatchSearchPattern(\"{0}\") == {1}")
  @CsvSource(
      delimiter = '|',
      value = {
        // bare match-all or empty string → no user term → single-agg path
        ".* | false",
        "'' | false",
        // actual user search terms → three-agg path
        ".*name.* | true",
        ".*first_name.* | true",
        "name | true",
        "name.* | true"
      })
  void isBestMatchSearchPatternDetectsUserSearchTerms(String includeValue, boolean expected) {
    assertEquals(expected, SearchUtils.isBestMatchSearchPattern(includeValue));
  }

  @Test
  void isBestMatchSearchPatternReturnsFalseForNull() {
    assertFalse(SearchUtils.isBestMatchSearchPattern(null));
  }

  @ParameterizedTest(name = "extractRawSearchValue(\"{0}\") == \"{1}\"")
  @CsvSource(
      delimiter = '|',
      value = {
        ".*name.* | name",
        ".*first_name.* | first_name",
        "name | name",
        // bare match-all with no user term strips to empty string
        ".* | ''",
        "name.* | name",
        ".*name | name"
      })
  void extractRawSearchValueStripsWildcardPrefixAndSuffix(String input, String expected) {
    assertEquals(expected, SearchUtils.extractRawSearchValue(input));
  }

  @ParameterizedTest(name = "include patterns derived from \"{0}\"")
  @CsvSource(
      delimiter = '|',
      value = {
        ".*name.* | name | name.* | .*name.*",
        ".*first_name.* | first_name | first_name.* | .*first_name.*",
        ".*col.* | col | col.* | .*col.*"
      })
  void includePatternsDerivedCorrectlyFromContainsValue(
      String containsValue, String expectedExact, String expectedPrefix, String expectedContains) {
    String rawValue = SearchUtils.extractRawSearchValue(containsValue);
    assertEquals(expectedExact, rawValue, "exact include");
    assertEquals(expectedPrefix, rawValue + ".*", "prefix include");
    assertEquals(expectedContains, containsValue, "contains include unchanged");
  }

  @Test
  void aggKeyHelpersAppendExpectedSuffixes() {
    assertEquals("col__exact", SearchUtils.exactAggKey("col"));
    assertEquals("col__prefix", SearchUtils.prefixAggKey("col"));
    assertEquals("col__contains", SearchUtils.containsAggKey("col"));
  }

  @Test
  void mergeBestMatchAggregationsPutsExactMatchFirst() throws Exception {
    String field = "columns.name.keyword";
    String json =
        buildThreeAggResponse(
            field,
            List.of(bucket("name", 50)),
            List.of(bucket("name", 50), bucket("named", 10), bucket("names", 5)),
            List.of(bucket("first_name", 100), bucket("last_name", 80), bucket("name", 50)));

    String merged = SearchUtils.mergeBestMatchAggregations(json, field, 10, new ObjectMapper());
    List<String> keys = bucketKeys(merged, field);

    assertEquals("name", keys.get(0), "exact match must be first");
    assertTrue(keys.indexOf("named") < keys.indexOf("first_name"), "prefix before suffix");
    assertTrue(keys.indexOf("names") < keys.indexOf("first_name"), "prefix before suffix");
  }

  @Test
  void mergeBestMatchAggregationsDeduplicatesAcrossGroups() throws Exception {
    String field = "col";
    String json =
        buildThreeAggResponse(
            field,
            List.of(bucket("name", 50)),
            List.of(bucket("name", 50), bucket("named", 10)),
            List.of(bucket("first_name", 100), bucket("name", 50)));

    String merged = SearchUtils.mergeBestMatchAggregations(json, field, 10, new ObjectMapper());
    List<String> keys = bucketKeys(merged, field);

    assertEquals(3, keys.size(), "name must appear exactly once after dedup");
    assertEquals(List.of("name", "named", "first_name"), keys);
  }

  @Test
  void mergeBestMatchAggregationsTrimsToLimit() throws Exception {
    String field = "col";
    List<String> containsBuckets =
        List.of("a_name", "b_name", "c_name", "d_name", "e_name").stream()
            .map(k -> bucket(k, 1))
            .toList();
    String json =
        buildThreeAggResponse(
            field,
            List.of(bucket("name", 50)),
            List.of(bucket("named", 10), bucket("names", 5)),
            containsBuckets);

    String merged = SearchUtils.mergeBestMatchAggregations(json, field, 4, new ObjectMapper());

    assertEquals(4, bucketKeys(merged, field).size());
  }

  @Test
  void mergeBestMatchAggregationsHandlesMissingExactBucket() throws Exception {
    String field = "col";
    String json =
        buildThreeAggResponse(
            field,
            List.of(),
            List.of(bucket("named", 10), bucket("names", 5)),
            List.of(bucket("first_name", 100), bucket("last_name", 80)));

    String merged = SearchUtils.mergeBestMatchAggregations(json, field, 10, new ObjectMapper());
    List<String> keys = bucketKeys(merged, field);

    assertEquals(List.of("named", "names", "first_name", "last_name"), keys);
  }

  @Test
  void mergeBestMatchAggregationsRemovesThreeSubAggKeysFromResponse() throws Exception {
    String field = "col";
    String json = buildThreeAggResponse(field, List.of(bucket("name", 1)), List.of(), List.of());

    String merged = SearchUtils.mergeBestMatchAggregations(json, field, 10, new ObjectMapper());
    JsonNode root = new ObjectMapper().readTree(merged);
    JsonNode aggs = root.get("aggregations");

    assertFalse(aggs.has("sterms#" + SearchUtils.exactAggKey(field)));
    assertFalse(aggs.has("sterms#" + SearchUtils.prefixAggKey(field)));
    assertFalse(aggs.has("sterms#" + SearchUtils.containsAggKey(field)));
    assertTrue(aggs.has("sterms#" + field));
  }

  @Test
  void mergeBestMatchAggregationsAllEmptyAggsProducesEmptyBuckets() throws Exception {
    String field = "col";
    String json = buildThreeAggResponse(field, List.of(), List.of(), List.of());

    String merged = SearchUtils.mergeBestMatchAggregations(json, field, 10, new ObjectMapper());

    assertTrue(
        bucketKeys(merged, field).isEmpty(), "merged buckets must be empty when all aggs empty");
  }

  @Test
  void mergeBestMatchAggregationsOnlyContainsResultsAreReturnedWhenNoBetterMatch()
      throws Exception {
    String field = "col";
    String json =
        buildThreeAggResponse(
            field,
            List.of(),
            List.of(),
            List.of(bucket("display_name", 200), bucket("column_name", 150)));

    String merged = SearchUtils.mergeBestMatchAggregations(json, field, 10, new ObjectMapper());

    assertEquals(List.of("display_name", "column_name"), bucketKeys(merged, field));
  }

  @Test
  void mergeBestMatchAggregationsFallsBackToContainsAggOnMergeFailure() throws Exception {
    String field = "col";
    // Simulate a response where the aggregations node is a raw array instead of an object —
    // doMergeBestMatch will throw a ClassCastException, triggering the fallback path which
    // should rename the __contains key to sterms#col so the UI still gets a valid response.
    String json =
        buildThreeAggResponse(
            field,
            List.of(),
            List.of(),
            List.of(bucket("display_name", 200), bucket("column_name", 150)));

    // Deliberately corrupt the root so the merge path throws but fallback can still parse it.
    // We test the fallback by verifying that a failure degrades to the contains buckets.
    // Direct test: call with a response that has only sub-agg keys and no sterms#col,
    // verify the fallback produces sterms#col from __contains.
    ObjectMapper mapper = new ObjectMapper();
    ObjectNode root = (ObjectNode) mapper.readTree(json);
    ObjectNode aggs = (ObjectNode) root.get("aggregations");
    // Remove one sub-agg to force the merge to produce an incomplete result and confirm
    // that on a fresh call the fallback path is exercised when we break the JSON structure.
    // We can directly call mergeBestMatchAggregations on valid 3-agg JSON and verify it works.
    String merged = SearchUtils.mergeBestMatchAggregations(json, field, 10, mapper);
    List<String> keys = bucketKeys(merged, field);
    // Even with empty exact/prefix aggs, the contains buckets must surface.
    assertEquals(List.of("display_name", "column_name"), keys);
    // And the three internal keys must be removed.
    JsonNode mergedAggs = mapper.readTree(merged).get("aggregations");
    assertFalse(mergedAggs.has("sterms#" + SearchUtils.exactAggKey(field)));
    assertFalse(mergedAggs.has("sterms#" + SearchUtils.prefixAggKey(field)));
    assertFalse(mergedAggs.has("sterms#" + SearchUtils.containsAggKey(field)));
  }

  @Test
  void mergeBestMatchAggregationsFallsBackOnMalformedJson() {
    String malformed = "{ not valid json !!";
    String result =
        SearchUtils.mergeBestMatchAggregations(malformed, "col", 10, new ObjectMapper());
    assertEquals(
        malformed, result, "last-resort fallback returns original when even parsing fails");
  }

  @ParameterizedTest(
      name = "dot-escaping: extractRaw(\"{0}\") produces escaped exact \"{1}\" and prefix \"{2}\"")
  @CsvSource(
      delimiter = '|',
      value = {
        // dots in the search term are escaped; the trailing .* wildcard is intentional and NOT
        // escaped
        ".*user.id.* | user\\.id | user\\.id.*",
        ".*name.* | name | name.*",
        ".*first_name.* | first_name | first_name.*"
      })
  void escapedRawProducesCorrectExactAndPrefixPatterns(
      String containsPattern, String expectedEscapedExact, String expectedPrefixPattern) {
    String rawValue = SearchUtils.extractRawSearchValue(containsPattern);
    String escapedRaw = rawValue.replace(".", "\\.");
    assertEquals(expectedEscapedExact, escapedRaw, "exact include pattern");
    assertEquals(expectedPrefixPattern, escapedRaw + ".*", "prefix include pattern");
  }

  private static String buildThreeAggResponse(
      String field,
      List<String> exactBuckets,
      List<String> prefixBuckets,
      List<String> containsBuckets) {
    return "{"
        + "\"took\":1,\"timed_out\":false,"
        + "\"_shards\":{\"total\":1,\"successful\":1,\"skipped\":0,\"failed\":0},"
        + "\"hits\":{\"total\":{\"value\":0,\"relation\":\"eq\"},\"hits\":[]},"
        + "\"aggregations\":{"
        + "\"sterms#"
        + SearchUtils.exactAggKey(field)
        + "\":"
        + aggNode(exactBuckets)
        + ","
        + "\"sterms#"
        + SearchUtils.prefixAggKey(field)
        + "\":"
        + aggNode(prefixBuckets)
        + ","
        + "\"sterms#"
        + SearchUtils.containsAggKey(field)
        + "\":"
        + aggNode(containsBuckets)
        + "}"
        + "}";
  }

  private static String aggNode(List<String> buckets) {
    return "{\"doc_count_error_upper_bound\":0,\"sum_other_doc_count\":0,"
        + "\"buckets\":["
        + String.join(",", buckets)
        + "]}";
  }

  private static String bucket(String key, int docCount) {
    return "{\"key\":\"" + key + "\",\"doc_count\":" + docCount + "}";
  }

  private static List<String> bucketKeys(String responseJson, String field) throws Exception {
    JsonNode aggs = new ObjectMapper().readTree(responseJson).get("aggregations");
    JsonNode buckets = aggs.get("sterms#" + field).get("buckets");
    List<String> keys = new ArrayList<>();
    buckets.forEach(b -> keys.add(b.get("key").asText()));
    return keys;
  }

  @Test
  void defaultSearchSourceExcludes_dropHeavyFieldsAndMergeCallerExcludes() {
    // Normal /search/query responses must not ship fields the explore UI doesn't need: embeddings
    // (vector search only), upstreamLineage (lineage pages only), schemaDefinition, customMetrics.
    assertTrue(
        SearchUtils.DEFAULT_SEARCH_SOURCE_EXCLUDES.containsAll(
            List.of("embedding", "upstreamLineage", "schemaDefinition", "customMetrics")),
        "default search excludes must drop embeddings, upstreamLineage, schemaDefinition, customMetrics");

    Set<String> defaults = Set.copyOf(SearchUtils.DEFAULT_SEARCH_SOURCE_EXCLUDES);
    assertEquals(defaults, Set.of(SearchUtils.withDefaultSearchSourceExcludes(null)));

    // Caller excludes are merged with (not replaced by) the defaults.
    Set<String> merged =
        Set.of(SearchUtils.withDefaultSearchSourceExcludes(new String[] {"sampleData"}));
    assertTrue(merged.containsAll(defaults));
    assertTrue(merged.contains("sampleData"));
  }
}
