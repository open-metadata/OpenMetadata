package org.openmetadata.service.search.opensearch;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;

import java.util.List;
import java.util.Map;
import org.apache.commons.lang3.tuple.Pair;
import org.junit.jupiter.api.Test;
import os.org.opensearch.client.opensearch._types.Refresh;
import os.org.opensearch.client.opensearch.core.UpdateByQueryRequest;

class OpenSearchEntityManagerUpdateChildrenTest {

  private final OpenSearchEntityManager entityManager = new OpenSearchEntityManager(null);

  /**
   * Inherited-field propagation must submit the update-by-query as a background task
   * ({@code wait_for_completion=false}). A synchronous update-by-query over a large child set (e.g.
   * a test suite with thousands of test cases) holds one socket open for the whole scan and trips
   * {@code socketTimeoutSecs} with a {@code SocketTimeoutException} — the reported failure. This is
   * the regression guard: it fails if the async submission is reverted to the blocking default.
   */
  @Test
  void updateChildrenSubmitsAsyncTask() {
    UpdateByQueryRequest request =
        entityManager.buildUpdateChildrenRequest(
            List.of("test_case_search_index"),
            Pair.of("testSuite.id", "11111111-1111-1111-1111-111111111111"),
            Pair.of("ctx._source.owners = params.owners;", Map.of("owners", List.of())));

    assertNotNull(
        request.waitForCompletion(),
        "waitForCompletion must be set explicitly, not left to the blocking default");
    assertFalse(
        request.waitForCompletion(),
        "child propagation must run as an async task so a large child set cannot trip socketTimeoutSecs");
    assertEquals(
        Refresh.True,
        request.refresh(),
        "children must still be refreshed once the async task completes");
  }
}
