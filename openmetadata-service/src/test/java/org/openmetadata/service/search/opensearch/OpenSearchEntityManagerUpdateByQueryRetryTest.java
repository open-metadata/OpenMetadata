package org.openmetadata.service.search.opensearch;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.function.Function;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.SearchRepository;
import os.org.opensearch.client.opensearch.OpenSearchClient;
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
    UpdateByQueryResponse conflicted = response(0, 1);
    when(client.updateByQuery(any(UpdateByQueryRequest.class))).thenReturn(conflicted);

    new OpenSearchEntityManager(client)
        .updateGlossaryTermByFqnPrefix(
            "table_search_index", "glossary.term", "glossary.term.child", "tags.tagFQN");

    verify(client, times(1)).updateByQuery(any(UpdateByQueryRequest.class));
    verify(indices, never()).refresh(any(Function.class));
  }

  private static UpdateByQueryResponse response(long updated, long versionConflicts) {
    UpdateByQueryResponse response = mock(UpdateByQueryResponse.class);
    when(response.updated()).thenReturn(updated);
    when(response.versionConflicts()).thenReturn(versionConflicts);
    when(response.failures()).thenReturn(List.of());
    return response;
  }
}
