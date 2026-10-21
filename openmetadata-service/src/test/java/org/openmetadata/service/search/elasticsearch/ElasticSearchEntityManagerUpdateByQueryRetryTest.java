package org.openmetadata.service.search.elasticsearch;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import es.co.elastic.clients.elasticsearch.ElasticsearchClient;
import es.co.elastic.clients.elasticsearch._types.Conflicts;
import es.co.elastic.clients.elasticsearch.core.UpdateByQueryRequest;
import es.co.elastic.clients.elasticsearch.core.UpdateByQueryResponse;
import es.co.elastic.clients.elasticsearch.indices.ElasticsearchIndicesClient;
import java.util.List;
import java.util.function.Consumer;
import java.util.function.Function;
import org.apache.commons.lang3.tuple.Pair;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.MockedStatic;
import org.openmetadata.service.Entity;
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

  private static UpdateByQueryResponse response(long updated, long versionConflicts) {
    UpdateByQueryResponse response = mock(UpdateByQueryResponse.class);
    when(response.updated()).thenReturn(updated);
    when(response.versionConflicts()).thenReturn(versionConflicts);
    when(response.failures()).thenReturn(List.of());
    return response;
  }
}
