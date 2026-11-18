package org.openmetadata.service.search.opensearch;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import os.org.opensearch.client.opensearch._types.Conflicts;
import os.org.opensearch.client.opensearch._types.Refresh;
import os.org.opensearch.client.opensearch.core.DeleteByQueryRequest;

class OpenSearchEntityManagerDeleteByScriptTest {

  private final OpenSearchEntityManager entityManager = new OpenSearchEntityManager(null);

  /**
   * Deleting a test case's results while a reindex writes the same index can find matched docs
   * already gone; with the default conflicts=abort the whole request failed with 409.
   */
  @Test
  void deleteByScriptProceedsOnVersionConflicts() {
    DeleteByQueryRequest request =
        entityManager.buildDeleteByScriptRequest(
            "test_case_result_search_index",
            "params.fqns.contains(doc['testCaseFQN.keyword'].value)",
            Map.of("fqns", List.of("svc.db.schema.table.test")));

    assertEquals(Conflicts.Proceed, request.conflicts());
    assertEquals(Refresh.True, request.refresh());
    assertEquals(List.of("test_case_result_search_index"), request.index());
  }
}
