package org.openmetadata.service.search.elasticsearch;

import static org.junit.jupiter.api.Assertions.assertEquals;
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

import es.co.elastic.clients.elasticsearch.ElasticsearchClient;
import es.co.elastic.clients.elasticsearch._types.Conflicts;
import es.co.elastic.clients.elasticsearch._types.aggregations.StringTermsBucket;
import es.co.elastic.clients.elasticsearch.core.SearchResponse;
import es.co.elastic.clients.elasticsearch.core.UpdateByQueryRequest;
import es.co.elastic.clients.elasticsearch.core.UpdateByQueryResponse;
import es.co.elastic.clients.elasticsearch.indices.ElasticsearchIndicesClient;
import es.co.elastic.clients.json.JsonData;
import java.util.Arrays;
import java.util.List;
import java.util.function.Consumer;
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

class ElasticSearchEntityManagerUpdateByQueryRetryTest {

  private ElasticsearchClient client;
  private ElasticsearchIndicesClient indices;
  private MockedStatic<Entity> entity;

  @BeforeEach
  void setUp() {
    client = mock(ElasticsearchClient.class);
    indices = mock(ElasticsearchIndicesClient.class);
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

    new ElasticSearchEntityManager(client).updateDataProductReferences("dp.old", "dp.renamed");

    verify(client, times(2)).updateByQuery(any(UpdateByQueryRequest.class));
    verify(indices).refresh(any(Function.class));
  }

  @Test
  void theHelpersThatAbortedOnAConflictNowProceed() throws Exception {
    indicesHoldingMatches("table_search_index");
    UpdateByQueryResponse clean = response(1, 0);
    when(client.updateByQuery(any(UpdateByQueryRequest.class))).thenReturn(clean);
    ElasticSearchEntityManager entityManager = new ElasticSearchEntityManager(client);
    List<Consumer<ElasticSearchEntityManager>> helpers =
        List.of(
            manager ->
                manager.updateGlossaryTermByFqnPrefix(
                    "table_search_index", "glossary.old", "glossary.new", "tags.tagFQN"),
            manager ->
                manager.updateClassificationTagByFqnPrefix(
                    "table_search_index", "pii.old", "pii.new", "tags.tagFQN"),
            manager -> manager.updateDataProductReferences("dp.old", "dp.new"));

    helpers.forEach(helper -> helper.accept(entityManager));

    ArgumentCaptor<UpdateByQueryRequest> requests =
        ArgumentCaptor.forClass(UpdateByQueryRequest.class);
    verify(client, times(helpers.size())).updateByQuery(requests.capture());
    requests
        .getAllValues()
        .forEach(request -> assertEquals(Conflicts.Proceed, request.conflicts()));
  }

  // #37466: an update-by-query on the global alias opens a scroll context on every shard even when
  // nothing matches, and on a busy node the engine retries that rejection for about a minute.
  @Test
  void aGlossaryPrefixRenameNothingIsTaggedWithRunsNoUpdateByQuery() throws Exception {
    indicesHoldingMatches();

    new ElasticSearchEntityManager(client)
        .updateGlossaryTermByFqnPrefix("all", "glossary.term", "glossary.moved", "tags.tagFQN");

    verify(client, never()).updateByQuery(any(UpdateByQueryRequest.class));
  }

  @Test
  void aGlossaryPrefixRenameRewritesOnlyTheIndicesHoldingATaggedDocument() throws Exception {
    indicesHoldingMatches("table_search_index", "dashboard_search_index");
    UpdateByQueryResponse rewritten = response(2, 0);
    when(client.updateByQuery(any(UpdateByQueryRequest.class))).thenReturn(rewritten);

    new ElasticSearchEntityManager(client)
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
      new ElasticSearchEntityManager(client)
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
        IntStream.range(0, ElasticSearchEntityManager.MAX_MATCHING_INDICES)
            .mapToObj("index_%d"::formatted)
            .toArray(String[]::new));
    UpdateByQueryResponse rewritten = response(1, 0);
    when(client.updateByQuery(any(UpdateByQueryRequest.class))).thenReturn(rewritten);

    new ElasticSearchEntityManager(client)
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

    new ElasticSearchEntityManager(client)
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

  private void indicesHoldingMatches(String... names) throws Exception {
    matchingIndicesSearch(0, names);
  }

  private void matchingIndicesSearch(int failedShards, String... names) throws Exception {
    List<StringTermsBucket> buckets =
        Arrays.stream(names)
            .map(name -> StringTermsBucket.of(bucket -> bucket.key(name).docCount(1)))
            .toList();
    SearchResponse<JsonData> matches =
        new SearchResponse.Builder<JsonData>()
            .took(1)
            .timedOut(false)
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
