package org.openmetadata.service.search.opensearch;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.stream.IntStream;
import org.junit.jupiter.api.Test;
import org.openmetadata.sdk.exception.SearchException;
import os.org.opensearch.client.json.JsonpMapper;
import os.org.opensearch.client.json.jackson.JacksonJsonpMapper;
import os.org.opensearch.client.opensearch._types.ShardFailure;
import os.org.opensearch.client.opensearch._types.ShardStatistics;
import os.org.opensearch.client.opensearch.core.SearchRequest;
import os.org.opensearch.client.opensearch.core.SearchResponse;
import os.org.opensearch.client.opensearch.core.search.Hit;
import os.org.opensearch.client.opensearch.core.search.TotalHitsRelation;
import os.org.opensearch.client.transport.Endpoint;
import os.org.opensearch.client.transport.OpenSearchTransport;
import os.org.opensearch.client.transport.TransportOptions;

/**
 * The guard has to hold for both {@code search(...)} overloads. The builder-lambda one is {@code
 * final} in the vendor client and so cannot be overridden — it is only covered because it compiles
 * to a call on the overridable one. That is an assumption about someone else's bytecode, so it is
 * asserted here rather than reasoned about.
 */
class ShardFailureAwareOpenSearchClientTest {

  private static final String INDEX = "table_search_index";

  @Test
  void healthySearchIsReturnedUnchanged() {
    ShardFailureAwareOpenSearchClient client = clientReturning(response(24, 24, 0, 3L));

    SearchResponse<Object> response =
        assertDoesNotThrow(() -> client.search(request(), Object.class));

    assertEquals(3L, response.hits().total().value());
  }

  @Test
  void degradedSearchThatStillFoundSomethingIsReturned() {
    ShardFailureAwareOpenSearchClient client = clientReturning(response(24, 19, 5, 12L));

    SearchResponse<Object> response =
        assertDoesNotThrow(() -> client.search(request(), Object.class));

    assertEquals(12L, response.hits().total().value());
  }

  /** #32255: 19 of 24 shards answered, the 5 holding data threw, engine reported 200 with 0 hits. */
  @Test
  void partialFailureWithNoHitsIsRejected() {
    ShardFailureAwareOpenSearchClient client = clientReturning(response(24, 19, 5, 0L));

    SearchException thrown =
        assertThrows(SearchException.class, () -> client.search(request(), Object.class));

    assertTrue(
        thrown.getMessage().contains("null_pointer_exception")
            && thrown.getMessage().contains(INDEX),
        "expected the engine's own failure reason and index: " + thrown.getMessage());
  }

  @Test
  void builderLambdaOverloadIsGuardedToo() {
    ShardFailureAwareOpenSearchClient client = clientReturning(response(24, 19, 5, 0L));

    assertThrows(
        SearchException.class,
        () -> client.search(builder -> builder.index(INDEX).size(10), Object.class));
  }

  /**
   * Every aggregation and data-insight query issues {@code size: 0} and carries its payload in the
   * buckets, so a zero hit count there is normal and says nothing about trustworthiness. Rejecting
   * it would 500 those dashboards on any transient shard failure — the very case this guard
   * deliberately keeps non-fatal.
   */
  @Test
  void aggregationOnlyRequestIsNotRejectedForHavingNoHits() {
    ShardFailureAwareOpenSearchClient client = clientReturning(response(24, 19, 5, 0L));

    assertDoesNotThrow(
        () -> client.search(SearchRequest.of(b -> b.index(INDEX).size(0)), Object.class));
  }

  /**
   * With no total reported, an empty page at a deep offset is indistinguishable from an empty
   * result set, so it is not evidence that results went missing.
   */
  @Test
  void responseWithoutTotalHitsIsNotRejected() {
    ShardFailureAwareOpenSearchClient client = clientReturning(responseWithoutTotal(List.of()));

    assertDoesNotThrow(() -> client.search(request(), Object.class));
  }

  private static SearchResponse<Object> responseWithoutTotal(List<Hit<Object>> hits) {
    return SearchResponse.<Object>searchResponseOf(
        builder ->
            builder.took(1).timedOut(false).shards(shards(24, 19, 5)).hits(h -> h.hits(hits)));
  }

  private static SearchRequest request() {
    return SearchRequest.of(builder -> builder.index(INDEX).size(10));
  }

  private static SearchResponse<Object> response(
      int totalShards, int successfulShards, int failedShards, long hits) {
    return SearchResponse.<Object>searchResponseOf(
        builder ->
            builder
                .took(1)
                .timedOut(false)
                .shards(shards(totalShards, successfulShards, failedShards))
                .hits(
                    h ->
                        h.hits(List.of())
                            .total(t -> t.value(hits).relation(TotalHitsRelation.Eq))));
  }

  private static ShardStatistics shards(int total, int successful, int failed) {
    List<ShardFailure> failures =
        IntStream.range(0, failed)
            .mapToObj(
                shard ->
                    ShardFailure.of(
                        f ->
                            f.index(INDEX)
                                .shard(shard)
                                .reason(cause -> cause.type("null_pointer_exception"))))
            .toList();
    return ShardStatistics.of(
        builder ->
            builder
                .total(total)
                .successful(successful)
                .skipped(0)
                .failed(failed)
                .failures(failures));
  }

  private static ShardFailureAwareOpenSearchClient clientReturning(SearchResponse<Object> canned) {
    return new ShardFailureAwareOpenSearchClient(new CannedTransport(canned));
  }

  /** Stands in for the HTTP boundary; every search resolves to one canned engine response. */
  private record CannedTransport(SearchResponse<Object> canned) implements OpenSearchTransport {

    @Override
    @SuppressWarnings("unchecked")
    public <RequestT, ResponseT, ErrorT> ResponseT performRequest(
        RequestT request,
        Endpoint<RequestT, ResponseT, ErrorT> endpoint,
        TransportOptions options) {
      return (ResponseT) canned;
    }

    @Override
    public <RequestT, ResponseT, ErrorT> CompletableFuture<ResponseT> performRequestAsync(
        RequestT request,
        Endpoint<RequestT, ResponseT, ErrorT> endpoint,
        TransportOptions options) {
      return CompletableFuture.completedFuture(performRequest(request, endpoint, options));
    }

    @Override
    public JsonpMapper jsonpMapper() {
      return new JacksonJsonpMapper();
    }

    @Override
    public TransportOptions options() {
      return null;
    }

    @Override
    public void close() throws IOException {
      // nothing to release; the canned response is held in memory
    }
  }
}
