package org.openmetadata.service.search.elasticsearch;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import es.co.elastic.clients.elasticsearch.ElasticsearchClient;
import es.co.elastic.clients.elasticsearch._types.Conflicts;
import es.co.elastic.clients.elasticsearch.core.DeleteByQueryRequest;
import es.co.elastic.clients.elasticsearch.core.DeleteByQueryResponse;
import java.util.List;
import java.util.function.Function;
import org.apache.commons.lang3.tuple.Pair;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

class ElasticSearchEntityManagerDeleteByFieldsTest {

  @Test
  @SuppressWarnings("unchecked")
  void deletingChildrenByFieldProceedsPastVersionConflicts() throws Exception {
    ElasticsearchClient client = mock(ElasticsearchClient.class);
    DeleteByQueryResponse response = mock(DeleteByQueryResponse.class);
    when(response.deleted()).thenReturn(4L);
    when(response.versionConflicts()).thenReturn(2L);
    when(response.failures()).thenReturn(List.of());
    when(client.deleteByQuery(any(Function.class))).thenCallRealMethod();
    when(client.deleteByQuery(any(DeleteByQueryRequest.class))).thenReturn(response);

    new ElasticSearchEntityManager(client)
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
