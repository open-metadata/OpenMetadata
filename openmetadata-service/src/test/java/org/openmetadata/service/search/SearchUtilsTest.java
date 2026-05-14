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

import jakarta.json.Json;
import jakarta.json.JsonArray;
import jakarta.json.JsonObject;
import java.io.StringReader;
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
    assertEquals(List.of("cursorA", "cursorB"), SearchUtils.searchAfter("cursorA,cursorB"));
    assertNull(SearchUtils.searchAfter(null));
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
}
