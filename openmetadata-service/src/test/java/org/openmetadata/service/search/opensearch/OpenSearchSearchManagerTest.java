package org.openmetadata.service.search.opensearch;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;

import org.junit.jupiter.api.Test;
import os.org.opensearch.client.opensearch.core.SearchResponse;

class OpenSearchSearchManagerTest {

  @Test
  void allowsSearchResponseWithNoFailedShards() {
    SearchResponse<Object> response = SearchResponse.of(r -> r.took(1).timedOut(false));

    assertDoesNotThrow(() -> OpenSearchSearchManager.validateShardFailures(response, "table"));
  }

  @Test
  void rejectsSearchResponseWithFailedShards() {
    SearchResponse<Object> response =
        SearchResponse.of(
            r ->
                r.took(1)
                    .timedOut(false)
                    .shards(s -> s.total(3).successful(2).skipped(0).failed(1)));

    assertThrows(
        org.openmetadata.sdk.exception.SearchException.class,
        () -> OpenSearchSearchManager.validateShardFailures(response, "table"));
  }
}
