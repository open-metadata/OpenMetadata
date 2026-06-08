package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.apache.hc.core5.http.HttpHost;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;
import org.openmetadata.it.server.SearchTestImages;
import org.openmetadata.service.search.opensearch.OsUtils;
import org.opensearch.testcontainers.OpensearchContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import os.org.opensearch.client.json.jackson.JacksonJsonpMapper;
import os.org.opensearch.client.opensearch.OpenSearchClient;
import os.org.opensearch.client.opensearch.generic.Requests;
import os.org.opensearch.client.transport.httpclient5.ApacheHttpClient5Transport;
import os.org.opensearch.client.transport.httpclient5.ApacheHttpClient5TransportBuilder;

/**
 * Behavioral, per-language guard for the search "consumer contract": rather than asserting a
 * mapping <em>declares</em> a field, this indexes a real document into the actual index mapping for
 * every supported language ({@code en/jp/ru/zh}) and then runs the actual search / filter /
 * aggregation each product feature relies on, asserting it returns the document. A failure is
 * reported as a broken <em>feature</em> in a specific language (e.g. "Domain filter is broken in
 * [jp]"), which is what an operator can act on — not "index is missing a mapping".
 *
 * <p>This is the search-side coverage the suite lacked for non-English languages — without the need
 * to run the whole integration-test suite once per language. The container is built with the
 * language-analysis plugins ({@link SearchTestImages}), so en, ru and jp index with their
 * <em>real</em> analyzers (jp uses {@code kuromoji_tokenizer}); creating the real jp mapping here
 * therefore also catches analyzer drift (fields referencing analyzers the mapping never defined).
 * zh uses the third-party {@code analysis-ik} plugin, which is not installed, so zh alone has its
 * analysis stripped and is validated structurally — the consumer fields are {@code keyword}/{@code
 * nested} and analyzer-independent, so every assertion still holds.
 *
 * <p>It would have caught the {@code jp/topic} mapping dropping top-level {@code domains} (the
 * domain-filter assertion returns zero hits for {@code jp}) and the jp analyzer references that made
 * jp indexes uncreatable. The query types mirror real consumers: a nested query for {@code owners}
 * (RBAC isOwner), term filters for tags/tier/certification/domains (Explore facets, RBAC, Data
 * Quality), a terms aggregation for {@code testCaseResult.testCaseStatus} (the Data Quality
 * execution summary), and a keyword term on {@code fqnParts} (hierarchical search / autocomplete).
 */
@Testcontainers
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class SearchConsumerFieldBehaviorIT {

  private static final List<String> LANGUAGES = List.of("en", "jp", "ru", "zh");

  private static final String TAG_FQN = "PII.Sensitive";
  private static final String TIER_FQN = "Tier.Tier1";
  private static final String CERTIFICATION_FQN = "Certification.Gold";
  private static final String DOMAIN_FQN = "Finance";
  private static final String FQN_PART = "svc.ns";
  private static final String OWNER_ID = "11111111-1111-1111-1111-111111111111";
  private static final String DOMAIN_ID = "22222222-2222-2222-2222-222222222222";
  private static final String TOPIC_ID = "33333333-3333-3333-3333-333333333333";
  private static final String TOPIC_FQN = "svc.ns.orders";
  private static final String TEST_CASE_ID = "44444444-4444-4444-4444-444444444444";
  private static final String TEST_CASE_FQN = "svc.ns.orders.columns.amount.notNull";
  private static final String TEST_CASE_STATUS = "Success";

  @Container
  static OpensearchContainer<?> opensearch =
      new OpensearchContainer<>(
              SearchTestImages.openSearchWithAnalysisPlugins("opensearchproject/opensearch:3.4.0"))
          .withStartupTimeout(Duration.ofMinutes(5))
          .withEnv("discovery.type", "single-node")
          .withEnv("OPENSEARCH_INITIAL_ADMIN_PASSWORD", "Test@12345")
          .withEnv("DISABLE_SECURITY_PLUGIN", "true")
          .withEnv("DISABLE_INSTALL_DEMO_CONFIG", "true")
          .withEnv("OPENSEARCH_JAVA_OPTS", "-Xms512m -Xmx512m");

  private OpenSearchClient openSearchClient;
  private ObjectMapper mapper;

  @BeforeAll
  void setUp() throws Exception {
    HttpHost httpHost = new HttpHost("http", opensearch.getHost(), opensearch.getMappedPort(9200));
    ApacheHttpClient5Transport transport =
        ApacheHttpClient5TransportBuilder.builder(httpHost)
            .setMapper(new JacksonJsonpMapper())
            .build();
    openSearchClient = new OpenSearchClient(transport);
    mapper = new ObjectMapper();

    for (String language : LANGUAGES) {
      boolean stripAnalysis = needsAnalysisStrip(language);
      createIndex(
          topicIndex(language),
          "/elasticsearch/" + language + "/topic_index_mapping.json",
          stripAnalysis);
      indexDocument(topicIndex(language), TOPIC_ID, topicDocument());
      createIndex(
          testCaseIndex(language),
          "/elasticsearch/" + language + "/test_case_index_mapping.json",
          stripAnalysis);
      indexDocument(testCaseIndex(language), TEST_CASE_ID, testCaseDocument());
    }
  }

  @AfterAll
  void tearDown() throws Exception {
    if (openSearchClient != null) {
      openSearchClient._transport().close();
    }
  }

  @Test
  void tagFilterReturnsAssetInAllLanguages() throws Exception {
    assertFeatureWorksInAllLanguages(
        "Tag filter (Explore tag facet, Data Quality tag filter, RBAC tag rules)",
        language -> hits(topicIndex(language), termQuery("tags.tagFQN", TAG_FQN)) == 1);
  }

  @Test
  void tierAggregationHasBucketInAllLanguages() throws Exception {
    assertFeatureWorksInAllLanguages(
        "Tier aggregation (Explore tier facet, Data Quality tier widget)",
        language ->
            aggregationHasBucket(
                topicIndex(language), termsAggregation("tier", "tier.tagFQN"), "tier", TIER_FQN));
  }

  @Test
  void certificationFilterReturnsAssetInAllLanguages() throws Exception {
    assertFeatureWorksInAllLanguages(
        "Certification filter (Explore + Data Quality certification filter, RBAC certification)",
        language ->
            hits(
                    topicIndex(language),
                    termQuery("certification.tagLabel.tagFQN", CERTIFICATION_FQN))
                == 1);
  }

  @Test
  void ownerNestedRbacQueryReturnsAssetInAllLanguages() throws Exception {
    assertFeatureWorksInAllLanguages(
        "Owner RBAC nested query (isOwner access control, owners facet)",
        language ->
            hits(topicIndex(language), nestedTermQuery("owners", "owners.id", OWNER_ID)) == 1);
  }

  @Test
  void domainFilterReturnsAssetInAllLanguages() throws Exception {
    assertFeatureWorksInAllLanguages(
        "Domain filter (RBAC hasDomain, Data Quality/Incident domain filter, domain asset counts)",
        language ->
            hits(topicIndex(language), termQuery("domains.fullyQualifiedName", DOMAIN_FQN)) == 1);
  }

  @Test
  void fqnPartsTermReturnsAssetInAllLanguages() throws Exception {
    assertFeatureWorksInAllLanguages(
        "Hierarchical search / autocomplete (fqnParts)",
        language -> hits(topicIndex(language), termQuery("fqnParts", FQN_PART)) == 1);
  }

  @Test
  void dataQualityStatusAggregationHasBucketInAllLanguages() throws Exception {
    assertFeatureWorksInAllLanguages(
        "Data Quality status aggregation (Test Suite execution summary, DQ status filter)",
        language ->
            aggregationHasBucket(
                testCaseIndex(language),
                termsAggregation("status", "testCaseResult.testCaseStatus"),
                "status",
                TEST_CASE_STATUS));
  }

  @Test
  void japaneseAnalysisPluginIsInstalled() throws Exception {
    try (var response =
        openSearchClient
            .generic()
            .execute(Requests.builder().method("GET").endpoint("/_cat/plugins").build())) {
      String plugins = response.getBody().map(b -> b.bodyAsString()).orElse("");
      assertTrue(
          plugins.contains("analysis-kuromoji"),
          "The integration-test OpenSearch image must ship analysis-kuromoji so jp mappings index "
              + "with their real kuromoji analyzer instead of a stripped fallback. Installed: "
              + plugins);
    }
  }

  @FunctionalInterface
  private interface LanguageProbe {
    boolean passes(String language) throws Exception;
  }

  private void assertFeatureWorksInAllLanguages(String feature, LanguageProbe probe)
      throws Exception {
    List<String> broken = new ArrayList<>();
    for (String language : LANGUAGES) {
      if (!probe.passes(language)) {
        broken.add(language);
      }
    }
    assertTrue(
        broken.isEmpty(),
        feature
            + " is broken in language(s): "
            + broken
            + ". The search/filter/aggregation this feature relies on did not return the indexed "
            + "asset for those languages — the index mapping or analyzer for that language does not "
            + "support the query (missing field, wrong type, or wrong analyzer).");
  }

  private int hits(String index, String queryBody) throws Exception {
    return runSearch(index, queryBody).path("hits").path("hits").size();
  }

  /**
   * Whether an aggregation produced a bucket for {@code expected}, compared case-insensitively. A
   * keyword field may carry {@code lowercase_normalizer} (e.g. {@code testCaseResult.testCaseStatus}
   * in every language, {@code tier.tagFQN} in en only), which lowercases the stored value and hence
   * the bucket key; the feature still works — a bucket exists for our asset — so either case passes.
   * A missing field or value produces no bucket at all and still fails the assertion.
   */
  private boolean aggregationHasBucket(
      String index, String aggBody, String aggName, String expected) throws Exception {
    for (String key : bucketKeys(index, aggBody, aggName)) {
      if (key.equalsIgnoreCase(expected)) {
        return true;
      }
    }
    return false;
  }

  private List<String> bucketKeys(String index, String aggBody, String aggName) throws Exception {
    List<String> keys = new ArrayList<>();
    JsonNode buckets = runSearch(index, aggBody).path("aggregations").path(aggName).path("buckets");
    for (JsonNode bucket : buckets) {
      keys.add(bucket.path("key").asText());
    }
    return keys;
  }

  private JsonNode runSearch(String index, String body) throws Exception {
    try (var response =
        openSearchClient
            .generic()
            .execute(
                Requests.builder()
                    .method("POST")
                    .endpoint("/" + index + "/_search")
                    .json(body)
                    .build())) {
      String raw = response.getBody().map(b -> b.bodyAsString()).orElse("{}");
      return mapper.readTree(raw);
    }
  }

  private void createIndex(String index, String mappingResource, boolean stripAnalysis)
      throws Exception {
    String rawMapping;
    try (InputStream in = getClass().getResourceAsStream(mappingResource)) {
      assertNotNull(in, "Mapping resource not found on classpath: " + mappingResource);
      rawMapping = new String(in.readAllBytes(), StandardCharsets.UTF_8);
    }
    String enriched = OsUtils.enrichIndexMappingForOpenSearch(rawMapping);
    if (stripAnalysis) {
      enriched = stripLanguageAnalysis(enriched);
    }
    try (var response =
        openSearchClient
            .generic()
            .execute(
                Requests.builder().method("PUT").endpoint("/" + index).json(enriched).build())) {
      if (response.getStatus() >= 400) {
        throw new IOException(
            "Failed to create index "
                + index
                + ": "
                + response.getBody().map(b -> b.bodyAsString()).orElse("no body"));
      }
    }
  }

  private void indexDocument(String index, String id, String document) throws Exception {
    try (var response =
        openSearchClient
            .generic()
            .execute(
                Requests.builder()
                    .method("PUT")
                    .endpoint("/" + index + "/_doc/" + id + "?refresh=true")
                    .json(document)
                    .build())) {
      if (response.getStatus() >= 400) {
        throw new IOException(
            "Failed to index document into "
                + index
                + ": "
                + response.getBody().map(b -> b.bodyAsString()).orElse("no body"));
      }
    }
  }

  private String topicDocument() throws Exception {
    Map<String, Object> document =
        Map.ofEntries(
            Map.entry("id", TOPIC_ID),
            Map.entry("name", "orders"),
            Map.entry("displayName", "Orders"),
            Map.entry("fullyQualifiedName", TOPIC_FQN),
            Map.entry("deleted", false),
            Map.entry("entityType", "topic"),
            Map.entry("fqnParts", List.of("svc", "ns", FQN_PART)),
            Map.entry("tags", List.of(tagLabel(TAG_FQN))),
            Map.entry("tier", tagLabel(TIER_FQN)),
            Map.entry("certification", Map.of("tagLabel", Map.of("tagFQN", CERTIFICATION_FQN))),
            Map.entry("owners", List.of(Map.of("id", OWNER_ID, "type", "user", "name", "alice"))),
            Map.entry(
                "domains",
                List.of(
                    Map.of(
                        "id",
                        DOMAIN_ID,
                        "type",
                        "domain",
                        "name",
                        DOMAIN_FQN,
                        "fullyQualifiedName",
                        DOMAIN_FQN))));
    return mapper.writeValueAsString(document);
  }

  private String testCaseDocument() throws Exception {
    Map<String, Object> document =
        Map.of(
            "id",
            TEST_CASE_ID,
            "name",
            "amount_not_null",
            "fullyQualifiedName",
            TEST_CASE_FQN,
            "deleted",
            false,
            "entityType",
            "testCase",
            "testCaseResult",
            Map.of("testCaseStatus", TEST_CASE_STATUS, "timestamp", 1700000000000L));
    return mapper.writeValueAsString(document);
  }

  private Map<String, Object> tagLabel(String tagFqn) {
    return Map.of(
        "tagFQN", tagFqn,
        "labelType", "Manual",
        "source", "Classification",
        "state", "Confirmed");
  }

  private String termQuery(String field, String value) throws Exception {
    return mapper.writeValueAsString(Map.of("query", Map.of("term", Map.of(field, value))));
  }

  private String nestedTermQuery(String path, String field, String value) throws Exception {
    return mapper.writeValueAsString(
        Map.of(
            "query",
            Map.of("nested", Map.of("path", path, "query", Map.of("term", Map.of(field, value))))));
  }

  private String termsAggregation(String aggName, String field) throws Exception {
    return mapper.writeValueAsString(
        Map.of("size", 0, "aggs", Map.of(aggName, Map.of("terms", Map.of("field", field)))));
  }

  private String topicIndex(String language) {
    return "behavior_topic_" + language;
  }

  private String testCaseIndex(String language) {
    return "behavior_testcase_" + language;
  }

  /**
   * Languages whose analyzers are available in the IT image keep their real analysis (en/ru are
   * built-in, jp uses the installed {@code analysis-kuromoji}). Only zh — which needs the
   * uninstalled third-party {@code analysis-ik} — has its analysis stripped, so its index is still
   * creatable for structural validation. The consumer fields asserted here are {@code keyword}/{@code
   * nested} and analyzer-independent, so stripping zh does not weaken any assertion.
   */
  private boolean needsAnalysisStrip(String language) {
    return "zh".equals(language);
  }

  /**
   * Remove every analysis setting and field-level {@code analyzer}/{@code search_analyzer}/{@code
   * normalizer} reference so an index is creatable without its language-analysis plugin (used only
   * for zh). What remains is the real field structure, so structural drift — e.g. a language mapping
   * dropping a top-level field — is still caught.
   */
  private String stripLanguageAnalysis(String mappingJson) throws Exception {
    JsonNode root = mapper.readTree(mappingJson);
    if (root.path("settings") instanceof ObjectNode settings) {
      settings.remove("analysis");
      if (settings.path("index") instanceof ObjectNode indexSettings) {
        indexSettings.remove("analysis");
      }
    }
    stripAnalysisReferences(root.path("mappings"));
    return mapper.writeValueAsString(root);
  }

  private void stripAnalysisReferences(JsonNode node) {
    if (node instanceof ObjectNode object) {
      object.remove("analyzer");
      object.remove("search_analyzer");
      object.remove("normalizer");
      object.forEach(this::stripAnalysisReferences);
    } else if (node.isArray()) {
      node.forEach(this::stripAnalysisReferences);
    }
  }
}
