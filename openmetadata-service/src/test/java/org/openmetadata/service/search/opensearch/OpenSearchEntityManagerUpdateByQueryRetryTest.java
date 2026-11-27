package org.openmetadata.service.search.opensearch;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.io.IOException;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.IntStream;
import org.apache.commons.lang3.tuple.Pair;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.MockedStatic;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.SearchIndexRetryQueue;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.search.UpdateByQueryReconciler;
import os.org.opensearch.client.json.JsonData;
import os.org.opensearch.client.opensearch.OpenSearchClient;
import os.org.opensearch.client.opensearch._types.BulkByScrollFailure;
import os.org.opensearch.client.opensearch._types.Conflicts;
import os.org.opensearch.client.opensearch._types.Refresh;
import os.org.opensearch.client.opensearch._types.aggregations.StringTermsBucket;
import os.org.opensearch.client.opensearch.core.SearchResponse;
import os.org.opensearch.client.opensearch.core.UpdateByQueryRequest;
import os.org.opensearch.client.opensearch.core.UpdateByQueryResponse;
import os.org.opensearch.client.opensearch.indices.OpenSearchIndicesClient;

class OpenSearchEntityManagerUpdateByQueryRetryTest {

  private OpenSearchClient client;
  private OpenSearchIndicesClient indices;
  private MockedStatic<Entity> entity;

  @BeforeEach
  void setUp() {
    client = mock(OpenSearchClient.class);
    indices = mock(OpenSearchIndicesClient.class);
    when(client.indices()).thenReturn(indices);
    SearchRepository searchRepository = mock(SearchRepository.class);
    when(searchRepository.getIndexOrAliasName(anyString())).thenAnswer(call -> call.getArgument(0));
    entity = mockStatic(Entity.class);
    entity.when(Entity::getSearchRepository).thenReturn(searchRepository);
  }

  @AfterEach
  void tearDown() {
    entity.close();
  }

  @Test
  void aVersionConflictIsRetriedAgainstARefreshedIndex() throws Exception {
    UpdateByQueryResponse conflicted = response(0, 1);
    UpdateByQueryResponse clean = response(1, 0);
    when(client.updateByQuery(any(UpdateByQueryRequest.class))).thenReturn(conflicted, clean);

    new OpenSearchEntityManager(client).updateDataProductReferences("dp.old", "dp.renamed");

    verify(client, times(2)).updateByQuery(any(UpdateByQueryRequest.class));
    verify(indices).refresh(any(Function.class));
  }

  @Test
  void aPrefixRenameNestingUnderItselfIsNotReplayed() throws Exception {
    indicesHoldingMatches("table_search_index");
    UpdateByQueryResponse conflicted = response(0, 1);
    when(client.updateByQuery(any(UpdateByQueryRequest.class))).thenReturn(conflicted);

    new OpenSearchEntityManager(client)
        .updateGlossaryTermByFqnPrefix(
            "table_search_index", "glossary.term", "glossary.term.child", "tags.tagFQN");

    verify(client, times(1)).updateByQuery(any(UpdateByQueryRequest.class));
    verify(indices, never()).refresh(any(Function.class));
  }

  // #37466: an update-by-query on the global alias opens a scroll context on every shard even when
  // nothing matches, and on a busy node the engine retries that rejection for about a minute.
  @Test
  void aGlossaryPrefixRenameNothingIsTaggedWithRunsNoUpdateByQuery() throws Exception {
    indicesHoldingMatches();

    new OpenSearchEntityManager(client)
        .updateGlossaryTermByFqnPrefix("all", "glossary.term", "glossary.moved", "tags.tagFQN");

    verify(client, never()).updateByQuery(any(UpdateByQueryRequest.class));
  }

  @Test
  void aGlossaryPrefixRenameRewritesOnlyTheIndicesHoldingATaggedDocument() throws Exception {
    indicesHoldingMatches("table_search_index", "dashboard_search_index");
    UpdateByQueryResponse rewritten = response(2, 0);
    when(client.updateByQuery(any(UpdateByQueryRequest.class))).thenReturn(rewritten);

    new OpenSearchEntityManager(client)
        .updateGlossaryTermByFqnPrefix("all", "glossary.term", "glossary.moved", "tags.tagFQN");

    ArgumentCaptor<UpdateByQueryRequest> request =
        ArgumentCaptor.forClass(UpdateByQueryRequest.class);
    verify(client).updateByQuery(request.capture());
    assertEquals(
        List.of("table_search_index", "dashboard_search_index"), request.getValue().index());
  }

  @Test
  void aGlossaryPrefixRenameWhoseSearchMissedAShardGoesToTheRetryQueue() throws Exception {
    matchingIndicesSearch(1);

    try (MockedStatic<SearchIndexRetryQueue> retryQueue = mockStatic(SearchIndexRetryQueue.class)) {
      retryQueue
          .when(() -> SearchIndexRetryQueue.failureReason(anyString(), any()))
          .thenAnswer(call -> call.<Throwable>getArgument(1).getMessage());
      new OpenSearchEntityManager(client)
          .updateGlossaryTermByFqnPrefix("all", "glossary.term", "glossary.moved", "tags.tagFQN");

      retryQueue.verify(
          () ->
              SearchIndexRetryQueue.enqueue(
                  isNull(String.class),
                  eq("glossary.moved"),
                  argThat(reason -> reason.contains("failed on 1 shards"))));
    }
    verify(client, never()).updateByQuery(any(UpdateByQueryRequest.class));
  }

  @Test
  void aGlossaryPrefixRenameMatchingAFullPageOfIndicesRewritesTheWholeAlias() throws Exception {
    indicesHoldingMatches(
        IntStream.range(0, OpenSearchEntityManager.MAX_MATCHING_INDICES)
            .mapToObj("index_%d"::formatted)
            .toArray(String[]::new));
    UpdateByQueryResponse rewritten = response(1, 0);
    when(client.updateByQuery(any(UpdateByQueryRequest.class))).thenReturn(rewritten);

    new OpenSearchEntityManager(client)
        .updateGlossaryTermByFqnPrefix("all", "glossary.term", "glossary.moved", "tags.tagFQN");

    ArgumentCaptor<UpdateByQueryRequest> request =
        ArgumentCaptor.forClass(UpdateByQueryRequest.class);
    verify(client).updateByQuery(request.capture());
    assertEquals(List.of("all"), request.getValue().index());
  }

  @Test
  void softDeletingChildrenProceedsPastAConflictAndRetriesIt() throws Exception {
    UpdateByQueryResponse conflicted = response(1, 1);
    UpdateByQueryResponse clean = response(1, 0);
    when(client.updateByQuery(any(UpdateByQueryRequest.class))).thenReturn(conflicted, clean);

    new OpenSearchEntityManager(client)
        .softDeleteOrRestoreChildren(
            List.of("table_search_index"),
            "ctx._source.put('deleted', true)",
            List.of(Pair.of("databaseSchema.id", "schema-id")));

    ArgumentCaptor<UpdateByQueryRequest> requests =
        ArgumentCaptor.forClass(UpdateByQueryRequest.class);
    verify(client, times(2)).updateByQuery(requests.capture());
    assertEquals(Conflicts.Proceed, requests.getValue().conflicts());
    verify(indices).refresh(any(Function.class));
  }

  @Test
  void removingAnAbsentLineageEdgeRunsNoUpdateByQuery() throws Exception {
    indicesHoldingMatches();
    final UpdateByQueryResponse clean = response(0, 0);
    when(client.updateByQuery(any(UpdateByQueryRequest.class))).thenReturn(clean);
    new OpenSearchEntityManager(client)
        .updateChildren(
            List.of("all"),
            "upstreamLineage.docUniqueId",
            List.of("from--->to"),
            Pair.of("ctx._source.remove('upstreamLineage')", Map.of()));
    verify(client, never()).updateByQuery(any(UpdateByQueryRequest.class));
  }

  @Test
  void removingLineageTargetsOnlyMatchingIndicesAndRefreshesThem() throws Exception {
    indicesHoldingMatches("table_search_index", "table_search_index_rebuild");
    final UpdateByQueryResponse conflicted = response(2, 1);
    final UpdateByQueryResponse clean = response(1, 0);
    when(client.updateByQuery(any(UpdateByQueryRequest.class))).thenReturn(conflicted, clean);
    new OpenSearchEntityManager(client)
        .updateChildren(
            List.of("all", "staged"),
            "upstreamLineage.docUniqueId",
            List.of("from--->to"),
            Pair.of("ctx._source.remove('upstreamLineage')", Map.of()));
    final ArgumentCaptor<UpdateByQueryRequest> requests =
        ArgumentCaptor.forClass(UpdateByQueryRequest.class);
    verify(client, times(2)).updateByQuery(requests.capture());
    for (final UpdateByQueryRequest request : requests.getAllValues()) {
      assertEquals(List.of("table_search_index", "table_search_index_rebuild"), request.index());
      assertEquals(Conflicts.Proceed, request.conflicts());
      assertEquals(Refresh.True, request.refresh());
      assertTrue(request.waitForCompletion() == null || request.waitForCompletion());
    }
    verify(indices).refresh(any(Function.class));
  }

  @Test
  void removingLineageDoesNotSilentlyIgnoreAnUnreachableShard() throws Exception {
    matchingIndicesSearch(1);
    assertThrows(
        IOException.class,
        () ->
            new OpenSearchEntityManager(client)
                .updateChildren(
                    List.of("all"),
                    "upstreamLineage.docUniqueId",
                    List.of("from--->to"),
                    Pair.of("ctx._source.remove('upstreamLineage')", Map.of())));
    verify(client, never()).updateByQuery(any(UpdateByQueryRequest.class));
  }

  @Test
  void removingLineageRejectsTimedOutMatchingIndexSearch() throws Exception {
    matchingIndicesSearch(true, 0);
    assertThrows(
        IOException.class,
        () ->
            new OpenSearchEntityManager(client)
                .updateChildren(
                    List.of("all"),
                    "upstreamLineage.docUniqueId",
                    List.of("from--->to"),
                    Pair.of("ctx._source.remove('upstreamLineage')", Map.of())));
    verify(client, never()).updateByQuery(any(UpdateByQueryRequest.class));
  }

  @Test
  void removingLineageReportsExhaustedConflicts() throws Exception {
    assertIncompleteRemoval(response(0, 1), "version conflict");
    verify(client, times(UpdateByQueryReconciler.MAX_ATTEMPTS))
        .updateByQuery(any(UpdateByQueryRequest.class));
  }

  @Test
  void removingLineageReportsAnUpdateTimeout() throws Exception {
    final var result = response(0, 0);
    when(result.timedOut()).thenReturn(true);
    assertIncompleteRemoval(result, "timed out");
  }

  @Test
  void removingLineageReportsAnUpdateShardFailure() throws Exception {
    final var failure =
        BulkByScrollFailure.of(
            f ->
                f.index("tables")
                    .id("to")
                    .status(403)
                    .cause(c -> c.type("cluster_block_exception").reason("writes blocked")));
    final var result = response(0, 0);
    when(result.failures()).thenReturn(List.of(failure));
    assertIncompleteRemoval(result, "writes blocked");
  }

  private void assertIncompleteRemoval(final UpdateByQueryResponse result, final String reason)
      throws Exception {
    indicesHoldingMatches("tables");
    when(client.updateByQuery(any(UpdateByQueryRequest.class))).thenReturn(result);
    final var failure =
        assertThrows(
            IOException.class,
            () ->
                new OpenSearchEntityManager(client)
                    .updateChildren(
                        List.of("all"),
                        "upstreamLineage.docUniqueId",
                        List.of("from--->to"),
                        Pair.of("ctx._source.remove('upstreamLineage')", Map.of())));
    assertTrue(failure.getMessage().contains(reason), failure::getMessage);
  }

  private void indicesHoldingMatches(String... names) throws Exception {
    matchingIndicesSearch(0, names);
  }

  private void matchingIndicesSearch(int failedShards, String... names) throws Exception {
    matchingIndicesSearch(false, failedShards, names);
  }

  private void matchingIndicesSearch(
      final boolean timedOut, final int failedShards, final String... names) throws Exception {
    List<StringTermsBucket> buckets =
        Arrays.stream(names)
            .map(name -> StringTermsBucket.of(bucket -> bucket.key(name).docCount(1)))
            .toList();
    SearchResponse<JsonData> matches =
        new SearchResponse.Builder<JsonData>()
            .took(1)
            .timedOut(timedOut)
            .shards(shards -> shards.total(2).successful(2 - failedShards).failed(failedShards))
            .hits(hits -> hits.hits(List.of()))
            .aggregations(
                "matchingIndices",
                aggregate ->
                    aggregate.sterms(
                        terms ->
                            terms
                                .buckets(list -> list.array(buckets))
                                .sumOtherDocCount(0L)
                                .docCountErrorUpperBound(0L)))
            .build();
    doReturn(matches).when(client).search(any(Function.class), eq(JsonData.class));
  }

  private static UpdateByQueryResponse response(long updated, long versionConflicts) {
    UpdateByQueryResponse response = mock(UpdateByQueryResponse.class);
    when(response.updated()).thenReturn(updated);
    when(response.versionConflicts()).thenReturn(versionConflicts);
    when(response.failures()).thenReturn(List.of());
    return response;
  }
}
