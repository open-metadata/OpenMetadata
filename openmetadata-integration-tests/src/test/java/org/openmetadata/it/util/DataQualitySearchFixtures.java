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
package org.openmetadata.it.util;

import java.time.Duration;
import java.util.List;

/** Shared fixtures for the data quality search integration tests. */
public final class DataQualitySearchFixtures {

  /**
   * Search converges synchronously post-commit, but a transient write failure falls back to the
   * async retry queue — allow generous headroom so heavy parallel runs don't trip the happy path.
   */
  public static final Duration SEARCH_CONVERGENCE_TIMEOUT = Duration.ofSeconds(120);

  /**
   * Search terms a user can realistically paste into a search box that Lucene's {@code query_string}
   * parser rejects: every one of these returned a 500 query_shard_exception from the data quality
   * search endpoints.
   *
   * <p>The last four are the cases escaping could never have covered, which is why the fix is a
   * different parser rather than a character denylist. Elasticsearch documents {@code <} and {@code
   * >} as impossible to escape, and reserved <em>words</em> are not characters at all.
   */
  public static final List<String> RESERVED_CHARACTER_QUERIES =
      List.of(
          "https://localhost:8585/table/orders",
          "orders (v2)",
          "orders [archived]",
          "dimension:value",
          "orders && customers",
          "\"unterminated phrase",
          "boosted^2",
          "fuzzy~",
          "a||b",
          "trailing backslash\\",
          "count < 10",
          "count > 10",
          "NOT",
          "orders AND");

  private DataQualitySearchFixtures() {}
}
