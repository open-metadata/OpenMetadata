package org.openmetadata.service.search;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotSame;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.google.common.util.concurrent.Uninterruptibles;
import jakarta.json.spi.JsonProvider;
import jakarta.ws.rs.BadRequestException;
import jakarta.ws.rs.core.Response;
import java.io.IOException;
import java.io.StringReader;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.RejectedExecutionException;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.openmetadata.schema.api.search.AssetTypeConfiguration;
import org.openmetadata.schema.api.search.RankingConfiguration;
import org.openmetadata.schema.api.search.RankingStage;
import org.openmetadata.schema.api.search.SearchSettings;
import org.openmetadata.schema.search.SearchRequest;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.monitoring.RequestLatencyContext;
import org.slf4j.MDC;

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
    when(repository.getEntityTypesForIndex(anyString())).thenReturn(List.of());
    when(repository.getEntityTypesForIndex("table")).thenReturn(List.of("table"));
    when(repository.getEntityTypesForIndex("table,databaseSchema"))
        .thenReturn(List.of("databaseSchema", "table"));
    Map<String, String> indexes =
        Map.of(
            "table", "cluster_table_search_index",
            "databaseSchema", "cluster_schema_search_index",
            "dataAsset", "cluster_dataAsset");
    when(repository.getIndexOrAliasName(anyString()))
        .thenAnswer(call -> indexes.get(call.getArgument(0, String.class)));
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
                  JsonUtils.getObjectMapper().valueToTree(SearchRankingHelper.identityFields()),
                  body.at("/aggs/table/aggs/probe/top_hits/_source/includes"));
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
            .withApplyDomainFilter(true)
            .withFrom(15)
            .withSearchAfter(List.of("cursor"))
            .withFetchSource(false)
            .withIncludeSourceFields(List.of("entityType"))
            .withExcludeSourceFields(List.of("name"));
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
              assertEquals(0, request.getFrom());
              assertNull(request.getSearchAfter());
              assertNull(request.getExcludeSourceFields());
              assertTrue(request.getFetchSource());
              ObjectNode prepared = prepared(request, settings);
              prepared.putObject("query").putObject("term").put("target", request.getIndex());
              return prepared;
            },
            (body, index) -> {
              JsonNode filter = JsonUtils.readTree(original.getPostFilter());
              List<String> types = List.of("databaseSchema", "table");
              for (int i = 0; i < types.size(); i++) {
                String target = repository.getIndexOrAliasName(types.get(i));
                JsonNode broad = body.at("/query/bool/should/" + i + "/bool/must/bool");
                JsonNode precise = body.at("/aggs/" + types.get(i) + "/aggs/precise/filter/bool");
                assertEquals(filter, broad.path("filter"));
                assertEquals(filter, precise.path("filter"));
                assertEquals(target, broad.at("/must/term/target").asText());
                assertEquals(target, precise.at("/must/term/target").asText());
              }
              assertFalse(body.has("post_filter"));
              return response(body);
            },
            this::unexpectedHint);
    search(counts, original, "table,databaseSchema", ranked);
    assertEquals(before, JsonUtils.pojoToJson(original));
  }

  @Test
  void startsTheHintBeforeTheAggregationCompletes() throws IOException {
    CountDownLatch hintStarted = new CountDownLatch(1);
    SearchEntityTypeCounts counts =
        new SearchEntityTypeCounts(
            repository,
            this::prepared,
            (body, index) -> {
              try {
                assertTrue(hintStarted.await(5, TimeUnit.SECONDS), "hint must overlap aggregation");
              } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                throw new IOException(e);
              }
              return response(body);
            },
            hint -> {
              hintStarted.countDown();
              return Response.ok(envelope().toString()).build();
            });
    assertEquals(
        2, search(counts, request().withSize(1), "table", ranked).at("/hits/total/value").asLong());
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
  void preservesRequestContextWhileOnlyThePreparedAggregationRunsOffThread() throws Exception {
    Thread caller = Thread.currentThread();
    RequestLatencyContext.startRequest("search-counts-test", "GET");
    var context = RequestLatencyContext.getContext();
    Map<String, String> previousLogging = MDC.getCopyOfContextMap();
    MDC.put("count-test-trace", "request-one");
    try (var worker = Executors.newSingleThreadExecutor()) {
      var executor = new SearchEntityTypeCounts.AggregationExecutor(worker, 1);
      SearchEntityTypeCounts counts =
          new SearchEntityTypeCounts(
              repository,
              (request, settings) -> {
                assertSame(caller, Thread.currentThread());
                return prepared(request, settings);
              },
              (body, index) -> {
                assertNotSame(caller, Thread.currentThread());
                assertSame(context, RequestLatencyContext.getContext());
                assertEquals("request-one", MDC.get("count-test-trace"));
                return response(body);
              },
              hint -> {
                assertSame(caller, Thread.currentThread());
                assertSame(context, RequestLatencyContext.getContext());
                return Response.ok(envelope().toString()).build();
              },
              executor);
      assertEquals(
          2,
          search(counts, request().withSize(1), "table", ranked).at("/hits/total/value").asLong());
      assertSame(context, RequestLatencyContext.getContext());
      assertEquals("request-one", MDC.get("count-test-trace"));
      assertEquals(
          List.of(true, true),
          worker
              .submit(
                  () ->
                      List.of(
                          RequestLatencyContext.getContext() == null,
                          MDC.get("count-test-trace") == null))
              .get());
    } finally {
      RequestLatencyContext.clearContext();
      if (previousLogging == null) {
        MDC.clear();
      } else {
        MDC.setContextMap(previousLogging);
      }
    }
  }

  @Test
  void fallsBackToSequentialSearchWhenCapacityIsExhaustedOrExecutorRejects() throws IOException {
    for (int capacity : List.of(0, 1)) {
      var executor =
          new SearchEntityTypeCounts.AggregationExecutor(
              task -> {
                throw new RejectedExecutionException("shutdown");
              },
              capacity);
      List<String> operations = new ArrayList<>();
      SearchEntityTypeCounts counts =
          new SearchEntityTypeCounts(
              repository,
              this::prepared,
              (body, index) -> {
                operations.add("counts");
                return response(body);
              },
              hint -> {
                operations.add("hint");
                return Response.ok(envelope().toString()).build();
              },
              executor);
      assertEquals(
          2,
          search(counts, request().withSize(1), "table", ranked).at("/hits/total/value").asLong());
      assertEquals(List.of("counts", "hint"), operations);
    }
  }

  @Test
  void cancellationHoldsCapacityUntilTheWorkerActuallyExits() throws Exception {
    CountDownLatch started = new CountDownLatch(1);
    CountDownLatch release = new CountDownLatch(1);
    try (var worker = Executors.newSingleThreadExecutor()) {
      var executor = new SearchEntityTypeCounts.AggregationExecutor(worker, 1);
      var pending =
          executor.submit(
              () -> {
                started.countDown();
                Uninterruptibles.awaitUninterruptibly(release);
                return envelope();
              });
      try {
        assertTrue(started.await(5, TimeUnit.SECONDS));
        pending.cancel(true);
        assertNull(executor.submit(SearchEntityTypeCountsTest::envelope));
      } finally {
        release.countDown();
      }
      worker.submit(() -> {}).get();
      assertEquals(envelope(), executor.submit(SearchEntityTypeCountsTest::envelope).get());
    }
  }

  @Test
  void rejectedSubmissionReleasesCapacityForTheNextRequest() throws Exception {
    try (var worker = Executors.newSingleThreadExecutor()) {
      AtomicInteger submissions = new AtomicInteger();
      var executor =
          new SearchEntityTypeCounts.AggregationExecutor(
              task -> {
                if (submissions.getAndIncrement() == 0) {
                  throw new RejectedExecutionException("temporarily unavailable");
                }
                worker.execute(task);
              },
              1);
      assertNull(executor.submit(SearchEntityTypeCountsTest::envelope));
      assertEquals(envelope(), executor.submit(SearchEntityTypeCountsTest::envelope).get());
    }
  }

  @Test
  void failedHintCancelsTheAggregationAndPropagatesTheOriginalFailure() throws Exception {
    CountDownLatch started = new CountDownLatch(1);
    CountDownLatch interrupted = new CountDownLatch(1);
    IOException failure = new IOException("hint unavailable");
    SearchEntityTypeCounts counts =
        new SearchEntityTypeCounts(
            repository,
            this::prepared,
            (body, index) -> interruptedAggregation(body, started, interrupted),
            hint -> {
              awaitStarted(started);
              throw failure;
            });
    assertSame(
        failure,
        assertThrows(
            IOException.class, () -> search(counts, request().withSize(1), "table", ranked)));
    assertTrue(interrupted.await(5, TimeUnit.SECONDS));
  }

  @Test
  void interruptionPreservesTheFlagAndCancelsOutstandingAggregation() throws Exception {
    CountDownLatch started = new CountDownLatch(1);
    CountDownLatch interrupted = new CountDownLatch(1);
    SearchEntityTypeCounts counts =
        new SearchEntityTypeCounts(
            repository,
            this::prepared,
            (body, index) -> interruptedAggregation(body, started, interrupted),
            hint -> {
              awaitStarted(started);
              Thread.currentThread().interrupt();
              return Response.ok(envelope().toString()).build();
            });
    try {
      assertThrows(IOException.class, () -> search(counts, request().withSize(1), "table", ranked));
      assertTrue(Thread.currentThread().isInterrupted());
    } finally {
      Thread.interrupted();
    }
    assertTrue(interrupted.await(5, TimeUnit.SECONDS));
  }

  @Test
  void asynchronousAggregationPreservesCheckedAndUncheckedFailures() {
    for (Throwable failure :
        List.of(
            new IOException("engine unavailable"),
            new IllegalArgumentException("engine rejected query"),
            new AssertionError("engine assertion"))) {
      SearchEntityTypeCounts counts =
          new SearchEntityTypeCounts(
              repository,
              this::prepared,
              (body, index) -> {
                if (failure instanceof IOException io) {
                  throw io;
                }
                if (failure instanceof RuntimeException runtime) {
                  throw runtime;
                }
                throw (Error) failure;
              },
              hint -> Response.ok(envelope().toString()).build());
      assertSame(
          failure,
          assertThrows(
              failure.getClass(), () -> search(counts, request().withSize(1), "table", ranked)));
    }
  }

  @ParameterizedTest
  @ValueSource(strings = {"name", "fullyQualifiedName"})
  void countsRecognizeEverySharedIdentityField(String field) throws IOException {
    SearchEntityTypeCounts counts =
        counts(
            (body, index) -> {
              ObjectNode response = response(body);
              ((ObjectNode) response.at("/aggregations/table/probe/hits/hits/0/_source"))
                  .removeAll()
                  .put(field, "customer");
              return response;
            });
    assertEquals(2, search(counts, request(), "table", ranked).at("/hits/total/value").asLong());
  }

  private ObjectNode interruptedAggregation(
      ObjectNode body, CountDownLatch started, CountDownLatch interrupted) throws IOException {
    started.countDown();
    try {
      new CountDownLatch(1).await(5, TimeUnit.SECONDS);
    } catch (InterruptedException e) {
      interrupted.countDown();
      Thread.currentThread().interrupt();
      throw new IOException(e);
    }
    return response(body);
  }

  private static void awaitStarted(CountDownLatch started) throws IOException {
    try {
      assertTrue(started.await(5, TimeUnit.SECONDS));
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
      throw new IOException(e);
    }
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
              if (failure.equals("timed_out")) {
                response.put("timed_out", true);
              } else if (failure.equals("failed_shards")) {
                ((ObjectNode) response.path("_shards")).put("failed", 1);
              } else {
                response.remove(failure);
              }
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
              for (JsonNode bucket : response.path("aggregations")) {
                ((ObjectNode) bucket).put("doc_count", Long.MAX_VALUE);
              }
              return response;
            });
    assertThrows(IOException.class, () -> search(counts, request(), "table,databaseSchema", null));
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
    if (request.getPostFilter() != null) {
      body.set("post_filter", JsonUtils.readTree(request.getPostFilter()));
    }
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
              for (String name : List.of("customer", "customer_archive", "private probe")) {
                hits.addObject().putObject("_source").put("name", name);
              }
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
}
