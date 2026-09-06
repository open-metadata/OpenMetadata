package org.openmetadata.it.tests.search;

import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
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
 * Engine-level reproduction of the {@code fieldNames} aggregation misconfiguration (and its fix)
 * for topic and apiEndpoint, against the real shipped English index mappings in an OpenSearch
 * container. Confirms:
 *
 * <ul>
 *   <li>G1 — a terms aggregation on the mapped {@code fieldNames} keyword array returns buckets from
 *       the flattened schema-field names the writer produces.
 *   <li>G2 — {@code requestFieldNames}/{@code responseFieldNames} aggregations return buckets from
 *       the mapped camelCase keyword fields.
 *   <li>G3 — the UI facet source aggregations ({@code messageSchema.schemaFields.name.keyword},
 *       {@code requestSchema.schemaFields.name.keyword}, {@code responseSchema.schemaFields.name.keyword})
 *       still return buckets.
 *   <li>Negative control — a terms aggregation on the misspelled {@code fieldsNames} field returns
 *       no buckets, reproducing the original bug mechanism (terms agg over an unmapped field).
 * </ul>
 */
@Testcontainers
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class FieldNamesAggregationIT {

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
            .setHttpClientConfigCallback(
                httpClientBuilder -> {
                  // See SearchConsumerFieldBehaviorIT for the disableContentCompression rationale.
                  httpClientBuilder.disableContentCompression();
                  return httpClientBuilder;
                })
            .build();
    openSearchClient = new OpenSearchClient(transport);
    mapper = new ObjectMapper();

    createIndex("topic_agg_en", "/elasticsearch/en/topic_index_mapping.json");
    createIndex("api_endpoint_agg_en", "/elasticsearch/en/api_endpoint_index_mapping.json");
    indexDocument("topic_agg_en", "topic-1", topicDocument());
    indexDocument("api_endpoint_agg_en", "endpoint-1", apiEndpointDocument());
  }

  @AfterAll
  void tearDown() throws Exception {
    openSearchClient._transport().close();
  }

  @Test
  void topicFieldNamesAggregationReturnsBuckets() throws Exception {
    List<String> keys = bucketKeys("topic_agg_en", termsAggregation("fieldNames", "fieldNames"));
    assertTrue(
        keys.contains("customer"),
        "fieldNames aggregation must surface the top-level schema field; got " + keys);
    assertTrue(
        keys.contains("customer.loyalty"),
        "fieldNames aggregation must surface the flattened nested field name; got " + keys);
  }

  @Test
  void topicMessageSchemaFieldNameAggregationStillReturnsBuckets() throws Exception {
    List<String> keys =
        bucketKeys(
            "topic_agg_en",
            termsAggregation("schemaFields", "messageSchema.schemaFields.name.keyword"));
    assertTrue(
        keys.contains("customer"),
        "messageSchema.schemaFields.name.keyword (UI facet source) must still return buckets; got "
            + keys);
  }

  @Test
  void topicMisspelledFieldsNamesAggregationReturnsNoBuckets() throws Exception {
    // Negative control reproducing the original bug: a terms aggregation over an unmapped field
    // returns no buckets without raising an error.
    List<String> keys = bucketKeys("topic_agg_en", termsAggregation("typo", "fieldsNames"));
    assertTrue(
        keys.isEmpty(),
        "the misspelled 'fieldsNames' field is unmapped, so its aggregation must be empty (this is "
            + "the silent bug the fix corrects); got "
            + keys);
  }

  @Test
  void apiEndpointRequestResponseFieldNamesAggregationsReturnBuckets() throws Exception {
    List<String> requestKeys =
        bucketKeys(
            "api_endpoint_agg_en", termsAggregation("requestFieldNames", "requestFieldNames"));
    assertTrue(
        requestKeys.contains("order"),
        "requestFieldNames aggregation must surface the top-level request schema field; got "
            + requestKeys);
    assertTrue(
        requestKeys.contains("order.tracking"),
        "requestFieldNames aggregation must surface the flattened nested request field; got "
            + requestKeys);

    List<String> responseKeys =
        bucketKeys(
            "api_endpoint_agg_en", termsAggregation("responseFieldNames", "responseFieldNames"));
    assertTrue(
        responseKeys.contains("result"),
        "responseFieldNames aggregation must surface the top-level response schema field; got "
            + responseKeys);
    assertTrue(
        responseKeys.contains("result.responseCode"),
        "responseFieldNames aggregation must surface the flattened nested response field; got "
            + responseKeys);
  }

  @Test
  void apiEndpointSchemaFieldNameAggregationsStillReturnBuckets() throws Exception {
    List<String> requestKeys =
        bucketKeys(
            "api_endpoint_agg_en",
            termsAggregation("reqSchemaFields", "requestSchema.schemaFields.name.keyword"));
    assertTrue(
        requestKeys.contains("order"),
        "requestSchema.schemaFields.name.keyword (UI facet source) must still return buckets; got "
            + requestKeys);
    List<String> responseKeys =
        bucketKeys(
            "api_endpoint_agg_en",
            termsAggregation("respSchemaFields", "responseSchema.schemaFields.name.keyword"));
    assertTrue(
        responseKeys.contains("result"),
        "responseSchema.schemaFields.name.keyword (UI facet source) must still return buckets; got "
            + responseKeys);
  }

  private List<String> bucketKeys(String index, String aggBody) throws Exception {
    List<String> keys = new java.util.ArrayList<>();
    JsonNode buckets =
        runSearch(index, aggBody).path("aggregations").path(aggNameOf(aggBody)).path("buckets");
    for (JsonNode bucket : buckets) {
      keys.add(bucket.path("key").asText());
    }
    return keys;
  }

  private String aggNameOf(String aggBody) throws Exception {
    JsonNode aggs = mapper.readTree(aggBody).path("aggs");
    return aggs.fieldNames().next();
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

  private String termsAggregation(String aggName, String field) throws Exception {
    return mapper.writeValueAsString(
        Map.of("size", 0, "aggs", Map.of(aggName, Map.of("terms", Map.of("field", field)))));
  }

  private void createIndex(String index, String mappingResource) throws Exception {
    String rawMapping;
    try (InputStream in = getClass().getResourceAsStream(mappingResource)) {
      assertNotNull(in, "Mapping resource not found on classpath: " + mappingResource);
      rawMapping = new String(in.readAllBytes(), StandardCharsets.UTF_8);
    }
    String enriched = OsUtils.enrichIndexMappingForOpenSearch(rawMapping);
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
            Map.entry("id", "topic-1"),
            Map.entry("name", "events"),
            Map.entry("fullyQualifiedName", "svc.events"),
            Map.entry("deleted", false),
            Map.entry("entityType", "topic"),
            // The writer's flattened keyword array (TopicIndex writes this from
            // FlattenSchemaField).
            Map.entry("fieldNames", List.of("customer", "customer.loyalty")),
            // The nested-schema-field UI facet source (SearchIndex writes messageSchema).
            Map.entry(
                "messageSchema",
                Map.of(
                    "schemaFields",
                    List.of(
                        Map.of("name", "customer", "dataType", "record"),
                        Map.of("name", "customer.loyalty", "dataType", "string")))));
    return mapper.writeValueAsString(document);
  }

  private String apiEndpointDocument() throws Exception {
    Map<String, Object> document =
        Map.ofEntries(
            Map.entry("id", "endpoint-1"),
            Map.entry("name", "orders"),
            Map.entry("fullyQualifiedName", "svc.orders"),
            Map.entry("deleted", false),
            Map.entry("entityType", "apiEndpoint"),
            // The writer's flattened keyword arrays (APIEndpointIndex now writes these camelCase).
            Map.entry("requestFieldNames", List.of("order", "order.tracking")),
            Map.entry("responseFieldNames", List.of("result", "result.responseCode")),
            Map.entry(
                "requestSchema",
                Map.of(
                    "schemaFields",
                    List.of(
                        Map.of("name", "order", "dataType", "record"),
                        Map.of("name", "order.tracking", "dataType", "string")))),
            Map.entry(
                "responseSchema",
                Map.of(
                    "schemaFields",
                    List.of(
                        Map.of("name", "result", "dataType", "record"),
                        Map.of("name", "result.responseCode", "dataType", "string")))));
    return mapper.writeValueAsString(document);
  }
}
