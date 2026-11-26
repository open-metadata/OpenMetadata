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

import java.io.IOException;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.Objects;
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
      throw new OutputLimitExceededException();
    }
    return output;
  }

  /** A local query exceeded its isolated execution or transport budget. */
  public static class QueryLimitExceededException extends IllegalArgumentException {
    public QueryLimitExceededException(final String message) {
      super(message);
    }
  }

  /**
   * The ontology itself does not fit the local worker, so no query over it can run there; one the
   * triplestore serves can still answer it.
   */
  public static final class OntologyTooLargeException extends QueryLimitExceededException {
    public OntologyTooLargeException(final String message) {
      super(message);
    }
  }

  static final class BoundedOutputStream extends OutputStream {
    private final OutputStream target;
    private final long maximumBytes;
    private final String message;
    private long written;

    BoundedOutputStream(final OutputStream target, final long maximumBytes, final String message) {
      this.target = Objects.requireNonNull(target);
      this.maximumBytes = maximumBytes;
      this.message = message;
    }

    @Override
    public void write(final int value) throws IOException {
      requireCapacity(1);
      target.write(value);
      written++;
    }

    @Override
    public void write(final byte[] bytes, final int offset, final int length) throws IOException {
      Objects.checkFromIndexSize(offset, length, bytes.length);
      requireCapacity(length);
      target.write(bytes, offset, length);
      written += length;
    }

    private void requireCapacity(final int length) {
      if (length > maximumBytes - written) {
        throw new QueryLimitExceededException(message);
      }
    }

    @Override
    public void flush() throws IOException {
      target.flush();
    }

    @Override
    public void close() throws IOException {
      target.close();
    }
  }

  /** The complete result is larger than {@link #MAX_OUTPUT_BYTES}. */
  public static final class OutputLimitExceededException extends IllegalStateException {
    public OutputLimitExceededException() {
      super(
          "SPARQL result exceeds the maximum response size of %,d bytes"
              .formatted(MAX_OUTPUT_BYTES));
    }
  }
}
