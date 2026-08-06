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

import com.fasterxml.jackson.databind.JsonNode;
import java.util.Set;

/**
 * The engine-neutral half of {@code ElasticSearchBulkSink} and {@code OpenSearchBulkSink}.
 *
 * <p>The two sinks are 1,767 and 1,928 lines and 31 of their 47 methods are byte-identical. Most of
 * that duplication cannot simply move here — it reads {@code BulkOperation}, which is a different type
 * per engine, and untangling it is the orchestrator-plus-adapters split (phase 6 proper). What lives
 * here is the subset that touches no engine type at all, so it can be shared today with no behavioural
 * risk, and this class is the seam that split grows from.
 *
 * <p>The retry classification is the reason this is worth doing now rather than waiting. It is a
 * ten-term substring list deciding which cluster failures are transient; two copies of a list like that
 * is precisely how the engines drift into retrying different things, and nothing would have failed to
 * tell anyone.
 */
public final class BulkSinkSupport {

  /**
   * Cluster failures worth another attempt: back-pressure, transport hiccups, and payloads the node
   * refused for size. Matched case-insensitively against the message because the engines surface them
   * as differently-shaped exception strings.
   */
  private static final Set<String> RETRYABLE_ERROR_MARKERS =
      Set.of(
          "rejected_execution_exception",
          "esrejectedexecutionexception",
          "remotetransportexception",
          "connectexception",
          "timeout",
          "request entity too large",
          "content too long",
          "413",
          "circuit_breaking_exception",
          "too_many_requests");

  private static final String SEARCH_INDEX_SUFFIX = "_search_index";

  private BulkSinkSupport() {}

  /**
   * Whether a failed bulk attempt should be retried.
   *
   * <p>A null message retries: an exception that says nothing is more likely a transport failure than a
   * rejection the cluster would repeat, and the attempt ceiling still bounds it.
   */
  public static boolean shouldRetry(int attemptNumber, Throwable error, int maxRetries) {
    if (attemptNumber >= maxRetries) {
      return false;
    }
    String errorMessage = error == null ? null : error.getMessage();
    if (errorMessage == null) {
      return true;
    }
    String lowerCaseMessage = errorMessage.toLowerCase();
    return RETRYABLE_ERROR_MARKERS.stream().anyMatch(lowerCaseMessage::contains);
  }

  /** Exponential backoff on the attempt number. */
  public static long calculateBackoff(int attemptNumber, long initialBackoffMillis) {
    return initialBackoffMillis * (long) Math.pow(2, attemptNumber);
  }

  /**
   * Entity type from an index name, tolerating the rebuild suffix a staged index carries — names arrive
   * as {@code table_search_index} or {@code mlmodel_search_index_rebuild_123456}.
   */
  public static String extractEntityTypeFromIndex(String indexName) {
    if (indexName == null || indexName.isEmpty()) {
      return "unknown";
    }
    int searchIndexPos = indexName.indexOf(SEARCH_INDEX_SUFFIX);
    if (searchIndexPos > 0) {
      return indexName.substring(0, searchIndexPos);
    }
    return indexName;
  }

  /**
   * Whether a cached vector can be spliced into a rebuilt document instead of regenerated.
   *
   * <p>This is {@code FieldOwnership.CARRIED} in practice: an embedding is not derivable from the
   * entity, so a rebuild either carries the cached one forward or pays for a model call. The dimension
   * check guards against reusing a vector produced by a different model.
   */
  public static boolean canReuseCachedEmbedding(JsonNode cached, int expectedDimension) {
    if (cached == null || !cached.isObject()) {
      return false;
    }
    JsonNode embedding = cached.path("embedding");
    if (!embedding.isArray() || embedding.isEmpty()) {
      return false;
    }
    if (expectedDimension > 0 && embedding.size() != expectedDimension) {
      return false;
    }
    JsonNode fingerprint = cached.path("fingerprint");
    return fingerprint.isTextual() && !fingerprint.asText().isBlank();
  }
}
