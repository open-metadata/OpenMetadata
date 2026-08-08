/*
 *  Copyright 2025 Collate.
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

import io.micrometer.core.instrument.Metrics;
import java.util.concurrent.CompletionException;
import java.util.concurrent.ExecutionException;

/**
 * Counts every request the server sends to the search cluster, so that cluster-side failures are
 * alertable from Prometheus instead of only being discoverable in application logs after a user
 * reports broken search.
 *
 * <p>Exposed as {@code search_client_requests_total{engine,method,outcome,status}}.
 */
public final class SearchRequestMetrics {
  private static final String REQUESTS_METRIC = "search.client.requests";
  private static final String ENGINE_TAG = "engine";
  private static final String METHOD_TAG = "method";
  private static final String OUTCOME_TAG = "outcome";
  private static final String STATUS_TAG = "status";
  private static final String SUCCESS_OUTCOME = "success";
  private static final String FAILURE_OUTCOME = "failure";
  private static final String NO_STATUS = "none";

  private SearchRequestMetrics() {}

  public static void recordSuccess(String engine, String method) {
    count(engine, method, SUCCESS_OUTCOME, NO_STATUS);
  }

  /**
   * @param httpStatus status reported by the search cluster, or 0 when the request never got a
   *     response (connect timeout, read timeout, unresolvable host, ...) — the exception type is
   *     then used as the status tag so connectivity loss stays distinguishable from a 5xx.
   */
  public static void recordFailure(String engine, String method, int httpStatus, Throwable error) {
    String status =
        httpStatus > 0 ? String.valueOf(httpStatus) : unwrap(error).getClass().getSimpleName();
    count(engine, method, FAILURE_OUTCOME, status);
  }

  /** Strips the {@link CompletionException} wrappers added by the async transport paths. */
  public static Throwable unwrap(Throwable error) {
    Throwable cause = error;
    while ((cause instanceof CompletionException || cause instanceof ExecutionException)
        && cause.getCause() != null) {
      cause = cause.getCause();
    }
    return cause;
  }

  private static void count(String engine, String method, String outcome, String status) {
    Metrics.counter(
            REQUESTS_METRIC,
            ENGINE_TAG,
            engine,
            METHOD_TAG,
            method,
            OUTCOME_TAG,
            outcome,
            STATUS_TAG,
            status)
        .increment();
  }
}
