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
import jakarta.json.spi.JsonProvider;
import jakarta.ws.rs.BadRequestException;
import jakarta.ws.rs.core.Response;
import java.io.IOException;
import java.io.StringReader;
import java.util.List;
import java.util.Map;
import java.util.TreeSet;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.stream.Stream;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.junit.jupiter.params.provider.NullSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.openmetadata.schema.api.search.AssetTypeConfiguration;
import org.openmetadata.schema.api.search.RankingConfiguration;
import org.openmetadata.schema.api.search.RankingStage;
import org.openmetadata.schema.api.search.SearchSettings;
import org.openmetadata.schema.search.SearchRequest;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.search.IndexMapping;

class SearchEntityTypeCountsTest {
  private SearchRepository repository;
  private final SearchSettings ranked =
      new SearchSettings()
          .withDefaultConfiguration(
              new AssetTypeConfiguration()
                  .withRanking(
                      new RankingConfiguration()
                          .withStages(
                              List.of(
                                  new RankingStage()
                                      .withName("exact")
                                      .withMatchType(RankingStage.MatchType.EXACT),
                                  new RankingStage()
                                      .withName("fuzzy")
                                      .withMatchType(RankingStage.MatchType.FUZZY)))));

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
  void serializesEngineDocumentsWithTheirOwnJsonProviders() {
    var elasticMapper = new es.co.elastic.clients.json.jackson.JacksonJsonpMapper();
    var openMapper = new os.org.opensearch.client.json.jackson.JacksonJsonpMapper();
    Map<String, String> document = Map.of("name", "customer");
    ObjectNode elastic =
        SearchEntityTypeCounts.toJson(
            elasticMapper.jsonProvider(),
            generator ->
                es.co.elastic.clients.json.JsonData.of(document)
                    .serialize(generator, elasticMapper));
    ObjectNode open =
        SearchEntityTypeCounts.toJson(
            openMapper.jsonProvider(),
            generator ->
                os.org.opensearch.client.json.JsonData.of(document)
                    .serialize(generator, openMapper));
    assertEquals("customer", elastic.path("name").asText());
    assertEquals(elastic, open);
  }

  @Test
  void countsMultipleTypesWithOneEngineRequest() throws IOException {
    AtomicInteger searches = new AtomicInteger();
    SearchEntityTypeCounts counts =
        counts(
            (body, index) -> {
              searches.incrementAndGet();
              assertEquals("cluster_schema_search_index,cluster_table_search_index", index);
              assertEquals(0, body.path("size").intValue());
              assertFalse(body.path("track_total_hits").booleanValue());
              assertEquals(2, body.at("/query/bool/should").size());
              assertEquals(
                  "cluster_schema_search_index",
                  body.at("/query/bool/should/0/bool/filter/term/_index").textValue());
              assertEquals(
                  "customer", body.at("/query/bool/should/0/bool/must/term/name").textValue());
              assertEquals(10, body.at("/aggs/table/aggs/probe/top_hits/size").intValue());
              assertEquals(
                  prepared(new SearchRequest(), ranked).path("sort"),
                  body.at("/aggs/table/aggs/probe/top_hits/sort"));
              assertEngineAggregations(body.path("aggs"));
              return response(body);
            });
    JsonNode result = search(counts, request(), "table,databaseSchema", ranked);
    assertEquals(1, searches.get());
    assertEquals(4, result.at("/hits/total/value").longValue());
    assertEquals("eq", result.at("/hits/total/relation").textValue());
    assertTrue(result.at("/hits/hits").isEmpty());
    assertFalse(result.toString().contains("private probe"));
    assertEquals(2, result.at("/aggregations/entityType/buckets").size());
    assertEquals(7, result.path("took").intValue());
    assertEquals(3, result.at("/_shards/total").intValue());
  }

  @Test
  void precisionIsSelectedIndependentlyForEachType() throws IOException {
    SearchEntityTypeCounts counts =
        counts(
            (body, index) -> {
              ObjectNode result = response(body);
              ((ObjectNode) result.at("/aggregations/table/probe/hits/hits/0/_source"))
                  .put("name", "custoner");
              return result;
            });
    JsonNode result = search(counts, request(), "table,databaseSchema", ranked);
    assertEquals(2, result.at("/aggregations/entityType/buckets/0/doc_count").longValue());
    assertEquals(3, result.at("/aggregations/entityType/buckets/1/doc_count").longValue());
  }

  @Test
  void noPrunableRankingDoesNotFetchProbesOrBuildPreciseQueries() throws IOException {
    AtomicInteger builds = new AtomicInteger();
    SearchEntityTypeCounts counts =
        new SearchEntityTypeCounts(
            repository,
            (request, settings) -> {
              builds.incrementAndGet();
              return prepared(request, settings);
            },
            (body, index) -> {
              assertFalse(body.at("/aggs/table").has("aggs"));
              return response(body);
            },
            this::unexpectedHint);
    JsonNode result = search(counts, request(), "table", null);
    assertEquals(1, builds.get());
    assertEquals(3, result.at("/hits/total/value").longValue());
  }

  @Test
  void postFilterAndRequestContextArePreservedWithoutMutatingInput() throws IOException {
    SearchRequest original =
        request()
            .withIndex("dataAsset")
            .withDeleted(true)
            .withQueryFilter("{\"match_all\":{}}")
            .withPostFilter("{\"term\":{\"service.name\":\"example\"}}")
            .withDomains(List.of(new EntityReference().withType("domain").withName("finance")))
            .withApplyDomainFilter(true);
    String before = JsonUtils.pojoToJson(original);
    SearchEntityTypeCounts counts =
        new SearchEntityTypeCounts(
            repository,
            (request, settings) -> {
              assertEquals(original.getDomains(), request.getDomains());
              assertEquals(original.getQueryFilter(), request.getQueryFilter());
              assertTrue(request.getApplyDomainFilter());
              assertTrue(request.getDeleted());
              assertEquals(List.of("name", "fullyQualifiedName"), request.getIncludeSourceFields());
              assertEquals(10, request.getSize());
              return prepared(request, settings);
            },
            (body, index) -> {
              JsonNode filter = JsonUtils.readTree(original.getPostFilter());
              assertEquals(filter, body.at("/query/bool/should/0/bool/must/bool/filter"));
              assertEquals(filter, body.at("/aggs/table/aggs/precise/filter/bool/filter"));
              assertFalse(body.has("post_filter"));
              return response(body);
            },
            this::unexpectedHint);
    search(counts, original, "table", ranked);
    assertEquals(before, JsonUtils.pojoToJson(original));
  }

  @Test
  void retainsTheGlobalHintWithoutUsingItsCountOrLeakingProbeFields() throws IOException {
    AtomicInteger hints = new AtomicInteger();
    SearchEntityTypeCounts counts =
        new SearchEntityTypeCounts(
            repository,
            this::prepared,
            (body, index) -> response(body),
            hint -> {
              hints.incrementAndGet();
              assertEquals("cluster_dataAsset", hint.getIndex());
              assertEquals(List.of("entityType"), hint.getIncludeSourceFields());
              assertEquals(1, hint.getSize());
              ObjectNode body = envelope();
              body.putObject("hits")
                  .put("max_score", 10)
                  .putArray("hits")
                  .addObject()
                  .putObject("_source")
                  .put("entityType", "table");
              return Response.ok(body.toString()).build();
            });
    JsonNode result = search(counts, request().withSize(1), "table", ranked);
    assertEquals(1, hints.get());
    assertEquals(2, result.at("/hits/total/value").longValue());
    assertEquals("table", result.at("/hits/hits/0/_source/entityType").textValue());
    assertEquals(1, result.at("/hits/hits/0/_source").size());
    assertEquals(14, result.path("took").longValue());
    assertEquals(6, result.at("/_shards/total").longValue());
  }

  @Test
  void handlesTypedAggregationKeys() throws IOException {
    SearchEntityTypeCounts counts =
        counts(
            (body, index) -> {
              ObjectNode response = response(body);
              ObjectNode aggregations = (ObjectNode) response.path("aggregations");
              ObjectNode table = (ObjectNode) aggregations.remove("table");
              table.set("filter#precise", table.remove("precise"));
              table.set("top_hits#probe", table.remove("probe"));
              aggregations.set("filter#table", table);
              return response;
            });
    assertEquals(2, search(counts, request(), "table", ranked).at("/hits/total/value").longValue());
  }

  @ParameterizedTest
  @MethodSource("indexTargets")
  void selectsOnlyTheRequestedEntityTypes(String index, List<String> expected) throws IOException {
    JsonNode result = search(counts((body, target) -> response(body)), request(), index, ranked);
    JsonNode buckets = result.at("/aggregations/entityType/buckets");
    assertEquals(expected.size(), buckets.size());
    for (int i = 0; i < expected.size(); i++)
      assertEquals(expected.get(i), buckets.get(i).path("key").textValue());
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
        () -> search(counts((body, target) -> response(body)), request(), index, ranked));
  }

  @ParameterizedTest
  @ValueSource(strings = {"null", "{}", "\"12\"", "true", "1.5", "-1", "9223372036854775808"})
  void rejectsMalformedAggregationCounts(String count) {
    SearchEntityTypeCounts counts =
        counts(
            (body, index) -> {
              ObjectNode response = response(body);
              ((ObjectNode) response.at("/aggregations/table"))
                  .set("doc_count", JsonUtils.readTree(count));
              return response;
            });
    assertThrows(IOException.class, () -> search(counts, request(), "table", ranked));
  }

  @ParameterizedTest
  @ValueSource(strings = {"doc_count", "precise", "probe"})
  void rejectsMissingCountsAndIncompleteProbes(String field) {
    SearchEntityTypeCounts counts =
        counts(
            (body, index) -> {
              ObjectNode response = response(body);
              ((ObjectNode) response.at("/aggregations/table")).remove(field);
              return response;
            });
    assertThrows(IOException.class, () -> search(counts, request(), "table", ranked));
  }

  @ParameterizedTest
  @ValueSource(strings = {"timed_out", "failed_shards", "hits", "_shards"})
  void rejectsIncompleteResponses(String failure) {
    SearchEntityTypeCounts counts =
        counts(
            (body, index) -> {
              ObjectNode response = response(body);
              if (failure.equals("timed_out")) response.put("timed_out", true);
              else if (failure.equals("failed_shards"))
                ((ObjectNode) response.path("_shards")).put("failed", 1);
              else response.remove(failure);
              return response;
            });
    assertThrows(IOException.class, () -> search(counts, request(), "table", ranked));
  }

  @Test
  void acceptsZeroAndLongCountsAndRejectsOverflowingSum() throws IOException {
    for (long total : List.of(0L, Long.MAX_VALUE)) {
      SearchEntityTypeCounts counts =
          counts(
              (body, index) -> {
                ObjectNode response = response(body);
                ((ObjectNode) response.at("/aggregations/table")).put("doc_count", total);
                return response;
              });
      JsonNode result = search(counts, request(), "table", null);
      assertEquals(total, result.at("/hits/total/value").longValue());
      assertEquals(total == 0 ? 0 : 1, result.at("/aggregations/entityType/buckets").size());
    }
    SearchEntityTypeCounts counts =
        counts(
            (body, index) -> {
              ObjectNode response = response(body);
              for (JsonNode bucket : response.path("aggregations"))
                ((ObjectNode) bucket).put("doc_count", Long.MAX_VALUE);
              return response;
            });
    assertThrows(IOException.class, () -> search(counts, request(), "dataAsset", null));
  }

  @ParameterizedTest
  @NullSource
  @ValueSource(strings = {"", "null", "[]", "{}", "not-json"})
  void rejectsMalformedHintResponses(String json) {
    SearchEntityTypeCounts counts =
        new SearchEntityTypeCounts(
            repository,
            this::prepared,
            (body, index) -> response(body),
            hint -> Response.ok(json).build());
    assertThrows(IOException.class, () -> search(counts, request().withSize(1), "table", ranked));
  }

  @Test
  void rejectsFailedHintStatus() {
    SearchEntityTypeCounts counts =
        new SearchEntityTypeCounts(
            repository,
            this::prepared,
            (body, index) -> response(body),
            hint -> Response.status(503).build());
    assertThrows(IOException.class, () -> search(counts, request().withSize(1), "table", ranked));
  }

  @Test
  void propagatesTransportFailure() {
    IOException failure = new IOException("Search unavailable");
    assertSame(
        failure,
        assertThrows(
            IOException.class,
            () ->
                search(
                    counts(
                        (body, index) -> {
                          throw failure;
                        }),
                    request(),
                    "table",
                    ranked)));
  }

  @Test
  void serializesEngineObjectsWithoutLosingTheQuery() {
    assertEquals(
        "customer",
        SearchEntityTypeCounts.toJson(
                JsonProvider.provider(),
                generator -> generator.writeStartObject().write("query", "customer").writeEnd())
            .path("query")
            .textValue());
  }

  private SearchEntityTypeCounts counts(SearchEntityTypeCounts.Aggregate aggregate) {
    return new SearchEntityTypeCounts(repository, this::prepared, aggregate, this::unexpectedHint);
  }

  private static void assertEngineAggregations(JsonNode aggregations) {
    var elasticMapper = new es.co.elastic.clients.json.jackson.JacksonJsonpMapper();
    var openMapper = new os.org.opensearch.client.json.jackson.JacksonJsonpMapper();
    for (JsonNode aggregation : aggregations) {
      try (var parser =
          elasticMapper.jsonProvider().createParser(new StringReader(aggregation.toString()))) {
        var parsed =
            es.co.elastic.clients.elasticsearch._types.aggregations.Aggregation._DESERIALIZER
                .deserialize(parser, elasticMapper);
        assertTrue(parsed.isFilter());
        assertEquals(10, parsed.aggregations().get("probe").topHits().size());
      }
      try (var parser =
          openMapper.jsonProvider().createParser(new StringReader(aggregation.toString()))) {
        var parsed =
            os.org.opensearch.client.opensearch._types.aggregations.Aggregation._DESERIALIZER
                .deserialize(parser, openMapper);
        assertTrue(parsed.isFilter());
        assertEquals(10, parsed.aggregations().get("probe").topHits().size());
      }
    }
  }

  private Response unexpectedHint(SearchRequest request) {
    throw new AssertionError("Count-only requests must not run a hint search");
  }

  private ObjectNode prepared(SearchRequest request, SearchSettings settings) {
    ObjectNode body = JsonUtils.getObjectMapper().createObjectNode();
    body.putObject("query")
        .putObject("term")
        .put(
            "name",
            SearchRankingHelper.hasPrunableFuzzyStage(settings) ? "customer" : "customer_precise");
    body.set(
        "sort",
        JsonUtils.readTree(
            "[{\"_score\":{\"order\":\"desc\"}},{\"name.keyword\":{\"order\":\"asc\"}},{\"id.keyword\":{\"order\":\"asc\"}}]"));
    if (request.getPostFilter() != null)
      body.set("post_filter", JsonUtils.readTree(request.getPostFilter()));
    return body;
  }

  private ObjectNode response(ObjectNode request) {
    ObjectNode response = envelope();
    ObjectNode aggregations = response.putObject("aggregations");
    request
        .path("aggs")
        .fieldNames()
        .forEachRemaining(
            type -> {
              ObjectNode bucket = aggregations.putObject(type).put("doc_count", 3);
              bucket.putObject("precise").put("doc_count", 2);
              var hits = bucket.putObject("probe").putObject("hits").putArray("hits");
              for (String name : List.of("customer", "customer_archive", "private probe"))
                hits.addObject().putObject("_source").put("name", name);
            });
    return response;
  }

  private static ObjectNode envelope() {
    ObjectNode response = JsonUtils.getObjectMapper().createObjectNode();
    response.put("took", 7).put("timed_out", false);
    response
        .putObject("_shards")
        .put("total", 3)
        .put("successful", 3)
        .put("skipped", 1)
        .put("failed", 0);
    response.putObject("hits").putArray("hits");
    return response;
  }

  private SearchRequest request() {
    return new SearchRequest()
        .withQuery("customer")
        .withSize(0)
        .withFrom(0)
        .withIncludeAggregations(false);
  }

  private JsonNode search(
      SearchEntityTypeCounts counts, SearchRequest request, String index, SearchSettings settings)
      throws IOException {
    try (Response response = counts.search(request, index, settings)) {
      assertEquals(200, response.getStatus());
      return JsonUtils.readTree((String) response.getEntity());
    }
  }

  private static IndexMapping mapping(String name, List<String> parents) {
    return IndexMapping.builder().indexName(name + "_search_index").parentAliases(parents).build();
  }
}
