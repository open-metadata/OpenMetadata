/*
 *  Copyright 2021 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */
package org.openmetadata.service.search;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.openmetadata.service.search.SearchIndexRetryQueue.STATUS_FAILED;
import static org.openmetadata.service.search.SearchIndexRetryQueue.STATUS_PENDING_RETRY_1;
import static org.openmetadata.service.search.SearchIndexRetryQueue.STATUS_PENDING_RETRY_2;

import es.co.elastic.clients.elasticsearch._types.ElasticsearchException;
import java.io.IOException;
import org.junit.jupiter.api.Test;
import org.openmetadata.service.jdbi3.CollectionDAO;

class SearchIndexRetryWorkerTest {

  private final SearchIndexRetryWorker worker =
      new SearchIndexRetryWorker(mock(CollectionDAO.class), mock(SearchRepository.class));

  @Test
  void retryableNextStatus_escalatesThenCapsAtFailed() {
    assertEquals(STATUS_PENDING_RETRY_1, worker.retryableNextStatus(0));
    assertEquals(STATUS_PENDING_RETRY_2, worker.retryableNextStatus(1));
    assertEquals(
        STATUS_PENDING_RETRY_2,
        worker.retryableNextStatus(5),
        "a transient failure keeps retrying, not dead-lettered after a few attempts");
    assertEquals(
        STATUS_FAILED,
        worker.retryableNextStatus(Integer.MAX_VALUE),
        "a persistently retryable record eventually dead-letters instead of looping forever");
  }

  @Test
  void isRetryable_transientAndUnknownRetry_fourXxDoesNot() {
    assertTrue(worker.isRetryable(new IOException("connection reset")), "network errors retry");
    assertTrue(
        worker.isRetryable(new RuntimeException("no status code")),
        "unknown errors default to retryable (conservative)");

    ElasticsearchException badRequest = mock(ElasticsearchException.class);
    when(badRequest.status()).thenReturn(400);
    assertFalse(worker.isRetryable(badRequest), "4xx is a permanent document error");

    ElasticsearchException serverError = mock(ElasticsearchException.class);
    when(serverError.status()).thenReturn(503);
    assertTrue(worker.isRetryable(serverError), "5xx is a transient cluster error");
  }
}
