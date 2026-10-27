package org.openmetadata.service.search.opensearch;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.function.Function;
import org.apache.commons.lang3.tuple.Pair;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.MockedStatic;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.SearchRepository;
import os.org.opensearch.client.opensearch.OpenSearchClient;
import os.org.opensearch.client.opensearch._types.Conflicts;
import os.org.opensearch.client.opensearch.core.DeleteByQueryRequest;
import os.org.opensearch.client.opensearch.core.DeleteByQueryResponse;

class OpenSearchEntityManagerDeleteByFieldsTest {

  private OpenSearchClient client;
  private MockedStatic<Entity> entity;

  @BeforeEach
  void setUp() {
    client = mock(OpenSearchClient.class);
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
  @SuppressWarnings("unchecked")
  void deletingChildrenByFieldProceedsPastVersionConflicts() throws Exception {
    DeleteByQueryResponse response = mock(DeleteByQueryResponse.class);
    when(response.deleted()).thenReturn(4L);
    when(response.versionConflicts()).thenReturn(2L);
    when(response.failures()).thenReturn(List.of());
    when(client.deleteByQuery(any(Function.class))).thenCallRealMethod();
    when(client.deleteByQuery(any(DeleteByQueryRequest.class))).thenReturn(response);

    new OpenSearchEntityManager(client)
        .deleteEntityByFields(
            List.of("testCaseResolutionStatus", "testCaseResult"),
            List.of(Pair.of("testCase.id", "dd320125-0576-4a1e-b9b3-bac5fa450147")));

    ArgumentCaptor<DeleteByQueryRequest> request =
        ArgumentCaptor.forClass(DeleteByQueryRequest.class);
    verify(client).deleteByQuery(request.capture());
    assertEquals(Conflicts.Proceed, request.getValue().conflicts());
    assertEquals(List.of("testCaseResolutionStatus", "testCaseResult"), request.getValue().index());
  }
}
