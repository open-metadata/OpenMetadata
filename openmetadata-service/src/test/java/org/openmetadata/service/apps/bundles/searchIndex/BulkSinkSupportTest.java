/*
 *  Copyright 2026 Collate.
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
package org.openmetadata.service.apps.bundles.searchIndex;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.node.JsonNodeFactory;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

/**
 * Covers the logic both bulk sinks now share. It had no test of its own while it existed twice, which
 * is the other half of why two copies is a problem: neither copy was pinned, so they could drift
 * without anything going red.
 */
class BulkSinkSupportTest {

  private static final int MAX_RETRIES = 3;

  @ParameterizedTest
  @ValueSource(
      strings = {
        "rejected_execution_exception",
        "EsRejectedExecutionException",
        "RemoteTransportException on node",
        "java.net.ConnectException: refused",
        "read TIMEOUT after 30s",
        "Request Entity Too Large",
        "content too long",
        "failed with 413",
        "circuit_breaking_exception: [parent]",
        "too_many_requests"
      })
  @DisplayName("transient cluster failures retry, matched case-insensitively")
  void transientFailuresRetry(final String message) {
    assertThat(BulkSinkSupport.shouldRetry(0, new RuntimeException(message), MAX_RETRIES)).isTrue();
  }

  @Test
  @DisplayName("a failure the cluster would just repeat is not retried")
  void permanentFailureDoesNotRetry() {
    assertThat(
            BulkSinkSupport.shouldRetry(
                0, new RuntimeException("mapper_parsing_exception: bad field"), MAX_RETRIES))
        .isFalse();
  }

  @Test
  @DisplayName("the attempt ceiling wins over a retryable message")
  void attemptCeilingStops() {
    RuntimeException retryable = new RuntimeException("timeout");
    assertThat(BulkSinkSupport.shouldRetry(MAX_RETRIES - 1, retryable, MAX_RETRIES)).isTrue();
    assertThat(BulkSinkSupport.shouldRetry(MAX_RETRIES, retryable, MAX_RETRIES)).isFalse();
  }

  @Test
  @DisplayName("a message-less error retries, but stays bounded")
  void nullMessageRetriesWithinCeiling() {
    // More likely a transport failure than something the cluster would repeat, and the ceiling
    // still
    // applies — so this cannot become an unbounded loop.
    assertThat(BulkSinkSupport.shouldRetry(0, new RuntimeException(), MAX_RETRIES)).isTrue();
    assertThat(BulkSinkSupport.shouldRetry(0, null, MAX_RETRIES)).isTrue();
    assertThat(BulkSinkSupport.shouldRetry(MAX_RETRIES, null, MAX_RETRIES)).isFalse();
  }

  @Test
  @DisplayName("backoff doubles per attempt")
  void backoffIsExponential() {
    assertThat(BulkSinkSupport.calculateBackoff(0, 100)).isEqualTo(100);
    assertThat(BulkSinkSupport.calculateBackoff(1, 100)).isEqualTo(200);
    assertThat(BulkSinkSupport.calculateBackoff(3, 100)).isEqualTo(800);
  }

  @Test
  @DisplayName("entity type survives the rebuild suffix a staged index carries")
  void entityTypeFromIndexName() {
    assertThat(BulkSinkSupport.extractEntityTypeFromIndex("table_search_index")).isEqualTo("table");
    assertThat(BulkSinkSupport.extractEntityTypeFromIndex("mlmodel_search_index_rebuild_123456"))
        .isEqualTo("mlmodel");
    assertThat(BulkSinkSupport.extractEntityTypeFromIndex("no_suffix_here"))
        .isEqualTo("no_suffix_here");
    assertThat(BulkSinkSupport.extractEntityTypeFromIndex(null)).isEqualTo("unknown");
    assertThat(BulkSinkSupport.extractEntityTypeFromIndex("")).isEqualTo("unknown");
  }

  @Test
  @DisplayName("a cached embedding is reusable only when complete and the right size")
  void cachedEmbeddingReuse() {
    assertThat(BulkSinkSupport.canReuseCachedEmbedding(cached(3, "fp"), 3)).isTrue();
    assertThat(BulkSinkSupport.canReuseCachedEmbedding(cached(3, "fp"), 0)).isTrue();

    // A vector of the wrong width came from a different model — reusing it would poison the index.
    assertThat(BulkSinkSupport.canReuseCachedEmbedding(cached(2, "fp"), 3)).isFalse();
    assertThat(BulkSinkSupport.canReuseCachedEmbedding(cached(0, "fp"), 3)).isFalse();
    assertThat(BulkSinkSupport.canReuseCachedEmbedding(cached(3, " "), 3)).isFalse();
    assertThat(BulkSinkSupport.canReuseCachedEmbedding(null, 3)).isFalse();
    assertThat(BulkSinkSupport.canReuseCachedEmbedding(JsonNodeFactory.instance.textNode("x"), 3))
        .isFalse();
  }

  private static ObjectNode cached(int dimension, String fingerprint) {
    ObjectNode node = JsonNodeFactory.instance.objectNode();
    var embedding = node.putArray("embedding");
    for (int i = 0; i < dimension; i++) {
      embedding.add(0.1);
    }
    node.put("fingerprint", fingerprint);
    return node;
  }
}
