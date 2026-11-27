package org.openmetadata.service.search.opensearch;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.util.List;
import org.apache.commons.lang3.tuple.Pair;
import org.junit.jupiter.api.Test;
import os.org.opensearch.client.opensearch._types.Conflicts;
import os.org.opensearch.client.opensearch._types.Refresh;
import os.org.opensearch.client.opensearch._types.query_dsl.TermQuery;
import os.org.opensearch.client.opensearch.core.DeleteByQueryRequest;

class OpenSearchEntityManagerDeleteByFieldsTest {

  private final OpenSearchEntityManager entityManager = new OpenSearchEntityManager(null);

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
    assertEquals(Refresh.True, request.refresh());
    assertEquals(List.of("test_case_result_search_index"), request.index());
    List<TermQuery> terms = request.query().bool().must().stream().map(q -> q.term()).toList();
    assertEquals(1, terms.size());
    assertEquals("testCase.fullyQualifiedName", terms.get(0).field());
    assertEquals("svc.db.schema.table.test", terms.get(0).value().stringValue());
  }
}
