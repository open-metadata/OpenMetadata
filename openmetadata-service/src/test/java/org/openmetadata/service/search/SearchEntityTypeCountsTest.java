package org.openmetadata.service.search;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import jakarta.ws.rs.BadRequestException;
import jakarta.ws.rs.core.Response;
import java.io.IOException;
import java.util.List;
import java.util.Map;
import java.util.TreeSet;
import java.util.stream.Stream;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.junit.jupiter.params.provider.NullSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.openmetadata.schema.search.SearchRequest;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.search.IndexMapping;
import org.openmetadata.service.security.policyevaluator.SubjectContext;

class SearchEntityTypeCountsTest {
  private SearchRepository repository;

  @BeforeEach
  void setUp() {
    repository = mock(SearchRepository.class);
    Map<String, IndexMapping> mappings =
        Map.of(
            "table", mapping("table", List.of("all", "dataAsset")),
            "tableColumn", mapping("column", List.of("all", "dataAsset", "table")),
            "databaseSchema", mapping("schema", List.of("all", "dataAsset")),
            "team", mapping("team", List.of("all")),
            "customEntity", mapping("custom", null));
    when(repository.getIndexedEntityTypes()).thenReturn(new TreeSet<>(mappings.keySet()));
    when(repository.getIndexMapping(anyString()))
        .thenAnswer(call -> mappings.get(call.getArgument(0, String.class)));
    when(repository.getIndexOrAliasName(anyString()))
        .thenAnswer(
            call -> {
              String name = call.getArgument(0);
              IndexMapping mapping = mappings.get(name);
              return mapping != null
                  ? mapping.getIndexName("cluster")
                  : name.startsWith("cluster_") ? name : "cluster_" + name;
            });
  }

  @Test
  void mergesExactTotalsAndMetricsWithoutExposingProbeHits() throws IOException {
    SearchEntityTypeCounts counts =
        new SearchEntityTypeCounts(
            repository,
            (request, subject) -> {
              long total = request.getIndex().contains("schema") ? 0 : 12;
              return Response.ok(body(total).toString()).build();
            });

    JsonNode result = search(counts, new SearchRequest().withSize(0), "dataAsset");

    assertEquals(24, result.at("/hits/total/value").longValue());
    assertEquals("eq", result.at("/hits/total/relation").textValue());
    assertTrue(result.at("/hits/hits").isEmpty());
    assertTrue(result.at("/hits/max_score").isNull());
    assertEquals(2, result.at("/aggregations/entityType/buckets").size());
    assertEquals("table", result.at("/aggregations/entityType/buckets/0/key").textValue());
    assertEquals(12, result.at("/aggregations/entityType/buckets/0/doc_count").longValue());
    assertEquals("tableColumn", result.at("/aggregations/entityType/buckets/1/key").textValue());
    assertEquals(21, result.path("took").longValue());
    assertEquals(9, result.at("/_shards/total").longValue());
    assertEquals(9, result.at("/_shards/successful").longValue());
    assertEquals(3, result.at("/_shards/skipped").longValue());
    assertEquals(0, result.at("/_shards/failed").longValue());
    assertFalse(result.path("timed_out").booleanValue());
  }

  @Test
  void zeroIsAValidExactCount() throws IOException {
    JsonNode result =
        search(returning(body(0).toString()), new SearchRequest().withSize(0), "table");
    assertEquals(0, result.at("/hits/total/value").longValue());
    assertTrue(result.at("/aggregations/entityType/buckets").isEmpty());
  }

  @Test
  void preservesLongCounts() throws IOException {
    JsonNode result =
        search(
            returning(body(Long.MAX_VALUE).toString()), new SearchRequest().withSize(0), "table");
    assertEquals(Long.MAX_VALUE, result.at("/hits/total/value").longValue());
  }

  @Test
  void preservesFiltersAndSubjectWithoutMutatingTheOriginalRequest() throws IOException {
    SubjectContext subject = mock(SubjectContext.class);
    SearchRequest original =
        new SearchRequest()
            .withQuery("customer")
            .withIndex("dataAsset")
            .withSize(0)
            .withFrom(0)
            .withFetchSource(false)
            .withTrackTotalHits(true)
            .withDeleted(true)
            .withQueryFilter("{\"query\":{\"match_all\":{}}}")
            .withPostFilter("{\"term\":{\"service.name\":\"example\"}}")
            .withDomains(List.of(new EntityReference().withType("domain").withName("finance")))
            .withApplyDomainFilter(true)
            .withIncludeAggregations(false);
    String before = JsonUtils.pojoToJson(original);
    SearchEntityTypeCounts counts =
        new SearchEntityTypeCounts(
            repository,
            (request, actualSubject) -> {
              assertSame(subject, actualSubject);
              assertEquals("cluster_table_search_index", request.getIndex());
              assertEquals(SearchRankingHelper.identityProbeSize(), request.getSize());
              assertTrue(request.getFetchSource());
              assertEquals(List.of("name", "fullyQualifiedName"), request.getIncludeSourceFields());
              SearchRequest expected = JsonUtils.deepCopy(original, SearchRequest.class);
              expected
                  .withIndex(request.getIndex())
                  .withSize(request.getSize())
                  .withFetchSource(true)
                  .withIncludeSourceFields(request.getIncludeSourceFields());
              assertEquals(JsonUtils.pojoToJson(expected), JsonUtils.pojoToJson(request));
              return Response.ok(body(12).toString()).build();
            });

    try (Response response = counts.search(original, "table", subject)) {
      assertEquals(
          12,
          JsonUtils.readTree((String) response.getEntity()).at("/hits/total/value").longValue());
    }
    assertEquals(before, JsonUtils.pojoToJson(original));
  }

  @Test
  void retainsTheOptionalTabHintButReplacesItsGlobalCount() throws IOException {
    SearchEntityTypeCounts counts =
        new SearchEntityTypeCounts(
            repository,
            (request, subject) -> {
              ObjectNode response = body(12);
              if (request.getIndex().equals("cluster_dataAsset")) {
                assertEquals(1, request.getSize());
                assertTrue(request.getFetchSource());
                assertEquals(List.of("entityType"), request.getIncludeSourceFields());
                response = body(87);
                ((ObjectNode) response.at("/hits/hits/0/_source"))
                    .removeAll()
                    .put("entityType", "table");
              }
              return Response.ok(response.toString()).build();
            });

    JsonNode result = search(counts, new SearchRequest().withSize(1), "table");
    assertEquals(12, result.at("/hits/total/value").longValue());
    assertEquals(1, result.at("/hits/hits").size());
    assertEquals("table", result.at("/hits/hits/0/_source/entityType").textValue());
    assertEquals(1, result.at("/hits/hits/0/_source").size());
    assertEquals(14, result.path("took").longValue());
    assertEquals(6, result.at("/_shards/total").longValue());
  }

  @ParameterizedTest
  @MethodSource("indexTargets")
  void selectsOnlyTheRequestedEntityTypes(String index, List<String> expected) throws IOException {
    JsonNode result = search(returning(body(1).toString()), new SearchRequest().withSize(0), index);
    JsonNode buckets = result.at("/aggregations/entityType/buckets");
    assertEquals(expected.size(), buckets.size());
    for (int i = 0; i < expected.size(); i++) {
      assertEquals(expected.get(i), buckets.get(i).path("key").textValue());
    }
  }

  static Stream<Arguments> indexTargets() {
    return Stream.of(
        Arguments.of("table", List.of("table")),
        Arguments.of("table_search_index", List.of("table")),
        Arguments.of("cluster_table_search_index", List.of("table")),
        Arguments.of("table, table_search_index, table", List.of("table")),
        Arguments.of(" table , databaseSchema ", List.of("databaseSchema", "table")),
        Arguments.of("dataAsset", List.of("databaseSchema", "table", "tableColumn")),
        Arguments.of("cluster_dataAsset", List.of("databaseSchema", "table", "tableColumn")),
        Arguments.of("all", List.of("databaseSchema", "table", "tableColumn", "team")),
        Arguments.of("customEntity", List.of("customEntity")));
  }

  @ParameterizedTest
  @ValueSource(strings = {"unknown", "", " , "})
  void rejectsTargetsWithNoRegisteredEntities(String index) {
    assertThrows(
        BadRequestException.class,
        () -> search(returning(body(1).toString()), new SearchRequest().withSize(0), index));
  }

  @ParameterizedTest
  @ValueSource(
      strings = {
        "null",
        "{}",
        "{\"value\":null,\"relation\":\"eq\"}",
        "{\"value\":\"12\",\"relation\":\"eq\"}",
        "{\"value\":true,\"relation\":\"eq\"}",
        "{\"value\":1.5,\"relation\":\"eq\"}",
        "{\"value\":-1,\"relation\":\"eq\"}",
        "{\"value\":9223372036854775808,\"relation\":\"eq\"}",
        "{\"value\":12,\"relation\":\"gte\"}",
        "{\"value\":12}",
        "12"
      })
  void rejectsInvalidOrInexactTotals(String total) throws IOException {
    ObjectNode response = body(12);
    ((ObjectNode) response.path("hits")).set("total", JsonUtils.readTree(total));
    assertInvalidResponse(response.toString());
  }

  @Test
  void rejectsMissingTotalRatherThanReportingZero() {
    ObjectNode response = body(12);
    ((ObjectNode) response.path("hits")).remove("total");
    assertInvalidResponse(response.toString());
  }

  @ParameterizedTest
  @NullSource
  @ValueSource(strings = {"", "null", "[]", "{}", "{\"hits\":[]}", "{\"hits\":{}}", "not-json"})
  void rejectsMalformedResponseBodies(String response) {
    assertInvalidResponse(response);
  }

  @ParameterizedTest
  @ValueSource(strings = {"timed_out", "failed_shards"})
  void rejectsPartialSearchResponses(String failure) {
    ObjectNode response = body(12);
    if (failure.equals("timed_out")) {
      response.put("timed_out", true);
    } else {
      ((ObjectNode) response.path("_shards")).put("failed", 1);
    }
    assertInvalidResponse(response.toString());
  }

  @Test
  void rejectsFailedSearchStatus() {
    SearchEntityTypeCounts counts =
        new SearchEntityTypeCounts(repository, (request, subject) -> Response.status(503).build());
    IOException error =
        assertThrows(
            IOException.class, () -> search(counts, new SearchRequest().withSize(0), "table"));
    assertTrue(error.getMessage().contains("cluster_table_search_index"));
  }

  @Test
  void propagatesSearchFailure() {
    IOException failure = new IOException("Search unavailable");
    SearchEntityTypeCounts counts =
        new SearchEntityTypeCounts(
            repository,
            (request, subject) -> {
              throw failure;
            });
    assertSame(
        failure,
        assertThrows(
            IOException.class, () -> search(counts, new SearchRequest().withSize(0), "table")));
  }

  private void assertInvalidResponse(String response) {
    IOException error =
        assertThrows(
            IOException.class,
            () -> search(returning(response), new SearchRequest().withSize(0), "table"));
    assertTrue(error.getMessage().contains("cluster_table_search_index"));
  }

  private SearchEntityTypeCounts returning(String response) {
    return new SearchEntityTypeCounts(
        repository, (request, subject) -> Response.ok(response).build());
  }

  private JsonNode search(SearchEntityTypeCounts counts, SearchRequest request, String index)
      throws IOException {
    try (Response response = counts.search(request, index, null)) {
      assertEquals(200, response.getStatus());
      return JsonUtils.readTree((String) response.getEntity());
    }
  }

  private static ObjectNode body(long total) {
    ObjectNode response = JsonUtils.getObjectMapper().createObjectNode();
    response.put("took", 7).put("timed_out", false);
    response
        .putObject("_shards")
        .put("total", 3)
        .put("successful", 3)
        .put("skipped", 1)
        .put("failed", 0);
    ObjectNode hits = response.putObject("hits");
    hits.putObject("total").put("value", total).put("relation", "eq");
    hits.putArray("hits").addObject().putObject("_source").put("name", "private probe");
    return response;
  }

  private static IndexMapping mapping(String name, List<String> parents) {
    return IndexMapping.builder().indexName(name + "_search_index").parentAliases(parents).build();
  }
}
