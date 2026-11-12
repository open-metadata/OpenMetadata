package org.openmetadata.service.search.elasticsearch;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import es.co.elastic.clients.elasticsearch.ElasticsearchClient;
import es.co.elastic.clients.elasticsearch._types.FieldValue;
import es.co.elastic.clients.elasticsearch._types.aggregations.CompositeBucket;
import es.co.elastic.clients.elasticsearch._types.query_dsl.Query;
import es.co.elastic.clients.elasticsearch.core.SearchRequest;
import es.co.elastic.clients.elasticsearch.core.SearchResponse;
import es.co.elastic.clients.json.JsonData;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.openmetadata.schema.entity.context.ContextMemoryStatus;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.service.search.indexes.ContextMemoryIndex;
import org.openmetadata.service.security.policyevaluator.SubjectContext;

class ElasticSearchMemoryListingAnchorsTest {
  private static final String INDEX = "context_memory_search_index";
  private static final String FIELD = ContextMemoryIndex.FIELD_ANCHOR_ID;
  private final ElasticsearchClient client = mock(ElasticsearchClient.class);
  private final ElasticSearchSearchManager manager =
      new ElasticSearchSearchManager(client, null, "", null);

  @Test
  void matchingAnchorsUseListingTextAssetAndStatusAcrossCompositePages() throws Exception {
    List<SearchRequest> requests = new ArrayList<>();
    when(client.search(any(SearchRequest.class), eq(JsonData.class)))
        .thenAnswer(
            invocation -> {
              requests.add(invocation.getArgument(0));
              return page(requests.size() == 1 ? "first" : "last", requests.size() == 1, false, 0);
            });
    var listing =
        new ElasticSearchRequestBuilder()
            .query(Query.of(q -> q.term(t -> t.field("question").value(FieldValue.of("refund")))))
            .postFilter(
                Query.of(
                    q ->
                        q.term(
                            t ->
                                t.field("primaryEntity.id")
                                    .value(FieldValue.of("selected-asset")))));

    Set<String> anchors =
        manager.matchingListingAnchors(
            INDEX,
            listing,
            subject(false),
            List.of(ContextMemoryStatus.APPROVED, ContextMemoryStatus.DRAFT));

    assertEquals(Set.of("first", "last"), anchors);
    assertEquals(2, requests.size());
    String query = requests.getFirst().query().toString();
    assertTrue(query.contains("refund"));
    assertTrue(query.contains("selected-asset"));
    assertTrue(query.contains("Approved"));
    assertTrue(query.contains("Entity"));
    assertTrue(query.contains("Public"));
    assertFalse(query.contains("Draft"));
    assertFalse(query.contains("Private"));
    assertTrue(requests.stream().allMatch(request -> request.size() == 0));
    assertEquals(100, requests.getFirst().aggregations().get(FIELD).composite().size());
    assertTrue(requests.getFirst().aggregations().get(FIELD).composite().after().isEmpty());
    assertEquals(
        "first",
        requests.getLast().aggregations().get(FIELD).composite().after().get(FIELD).stringValue());
  }

  @Test
  void adminAndPendingOnlyListingsDoNotQueryAnchors() throws Exception {
    assertEquals(
        Set.of(),
        manager.matchingListingAnchors(
            INDEX,
            new ElasticSearchRequestBuilder(),
            subject(true),
            List.of(ContextMemoryStatus.APPROVED)));
    assertEquals(
        Set.of(),
        manager.matchingListingAnchors(
            INDEX,
            new ElasticSearchRequestBuilder(),
            subject(false),
            List.of(ContextMemoryStatus.DRAFT)));
  }

  @ParameterizedTest
  @ValueSource(booleans = {false, true})
  void incompleteAnchorSearchFailsInsteadOfReturningAnUndercount(boolean timedOut)
      throws Exception {
    when(client.search(any(SearchRequest.class), eq(JsonData.class)))
        .thenReturn(page("first", false, timedOut, timedOut ? 0 : 1));
    assertThrows(
        IOException.class,
        () ->
            manager.matchingListingAnchors(
                INDEX,
                new ElasticSearchRequestBuilder(),
                subject(false),
                List.of(ContextMemoryStatus.APPROVED)));
  }

  private SubjectContext subject(boolean admin) {
    return new SubjectContext(
        new User().withId(UUID.randomUUID()).withName("reader").withIsAdmin(admin), null);
  }

  private SearchResponse<JsonData> page(
      String anchor, boolean more, boolean timedOut, int failedShards) {
    return SearchResponse.of(
        response ->
            response
                .took(1)
                .timedOut(timedOut)
                .shards(shards -> shards.total(1).successful(1 - failedShards).failed(failedShards))
                .hits(hits -> hits.hits(List.of()))
                .aggregations(
                    FIELD,
                    aggregate ->
                        aggregate.composite(
                            composite ->
                                composite
                                    .afterKey(
                                        more ? Map.of(FIELD, FieldValue.of(anchor)) : Map.of())
                                    .buckets(
                                        buckets ->
                                            buckets.array(
                                                List.of(
                                                    CompositeBucket.of(
                                                        bucket ->
                                                            bucket
                                                                .key(
                                                                    Map.of(
                                                                        FIELD,
                                                                        FieldValue.of(anchor)))
                                                                .docCount(1))))))));
  }
}
