package org.openmetadata.service.search.elasticsearch;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import es.co.elastic.clients.elasticsearch._types.Conflicts;
import es.co.elastic.clients.elasticsearch._types.query_dsl.TermQuery;
import es.co.elastic.clients.elasticsearch.core.DeleteByQueryRequest;
import java.util.List;
import org.apache.commons.lang3.tuple.Pair;
import org.junit.jupiter.api.Test;

class ElasticSearchEntityManagerDeleteByFieldsTest {

  private final ElasticSearchEntityManager entityManager = new ElasticSearchEntityManager(null);

  /**
   * Hard-deleting a test case while a reindex rewrites its child docs made delete_by_query hit
   * version conflicts; with the default conflicts=abort the cleanup failed with 409.
   */
  @Test
  void deleteByFieldsProceedsOnVersionConflicts() {
    DeleteByQueryRequest request =
        entityManager.buildDeleteByFieldsRequest(
            List.of("test_case_result_search_index"),
            List.of(Pair.of("testCase.fullyQualifiedName", "svc.db.schema.table.test")));

    assertEquals(Conflicts.Proceed, request.conflicts());
    assertTrue(request.refresh());
    assertEquals(List.of("test_case_result_search_index"), request.index());
    List<TermQuery> terms = request.query().bool().must().stream().map(q -> q.term()).toList();
    assertEquals(1, terms.size());
    assertEquals("testCase.fullyQualifiedName", terms.get(0).field());
    assertEquals("svc.db.schema.table.test", terms.get(0).value().stringValue());
  }
}
