/*
 *  Copyright 2026 Collate
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

package org.openmetadata.service.rdf;

import java.nio.charset.StandardCharsets;
import org.apache.jena.query.Query;

/** Resource bounds shared by every user-authored SPARQL query surface. */
public final class SparqlQueryLimits {
  public static final int DEFAULT_RESULT_LIMIT = 1_000;
  public static final int MAX_RESULT_LIMIT = 10_000;
  public static final int MAX_QUERY_CHARACTERS = 100_000;
  public static final int MAX_OUTPUT_BYTES = 10 * 1024 * 1024;
  public static final int TIMEOUT_MILLIS = 30_000;

  private SparqlQueryLimits() {}

  public static void requireBoundedText(final String sparql) {
    if (sparql != null && sparql.length() > MAX_QUERY_CHARACTERS) {
      throw new IllegalArgumentException(
          "SPARQL query exceeds the maximum length of %,d characters"
              .formatted(MAX_QUERY_CHARACTERS));
    }
  }

  public static Query applyResultLimit(final Query query) {
    if (query.isAskType()) {
      return query;
    }
    if (!query.hasLimit()) {
      query.setLimit(DEFAULT_RESULT_LIMIT);
    } else if (query.getLimit() > MAX_RESULT_LIMIT) {
      throw new IllegalArgumentException(
          "SPARQL result limit must be at most %,d".formatted(MAX_RESULT_LIMIT));
    }
    return query;
  }

  public static String requireBoundedOutput(final String output) {
    if (output != null && output.getBytes(StandardCharsets.UTF_8).length > MAX_OUTPUT_BYTES) {
      throw new IllegalStateException(
          "SPARQL result exceeds the maximum response size of %,d bytes"
              .formatted(MAX_OUTPUT_BYTES));
    }
    return output;
  }
}
