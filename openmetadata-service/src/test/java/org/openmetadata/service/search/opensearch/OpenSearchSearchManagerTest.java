package org.openmetadata.service.search.opensearch;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;

import org.junit.jupiter.api.Test;
import org.openmetadata.sdk.exception.SearchException;
import os.org.opensearch.client.opensearch.core.SearchResponse;

class OpenSearchSearchManagerTest {

  private static final String INDEX = "table";

  @Test
  void allowsSearchResponseWithNoFailedShards() {
    SearchResponse<Object> response =
        SearchResponse.of(
            r -> r.took(1).timedOut(false).shards(s -> s.total(1).successful(1).failed(0)));

    assertDoesNotThrow(() -> OpenSearchSearchManager.validateShardFailures(response, INDEX));
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
        SearchException.class,
        () -> OpenSearchSearchManager.validateShardFailures(response, INDEX));
  }
}
