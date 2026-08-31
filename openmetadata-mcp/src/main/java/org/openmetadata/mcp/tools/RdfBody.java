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

package org.openmetadata.mcp.tools;

import java.nio.charset.StandardCharsets;
import java.util.Objects;
import org.openmetadata.mcp.util.ResponseBudget;

/**
 * Size-bounding for the opaque RDF payloads (SPARQL bodies, Turtle graphs, SHACL reports) the
 * knowledge-graph tools return.
 *
 * <p>{@link ResponseBudget} fits a <em>list</em> by dropping items; these tools return one blob, so
 * the only lever is where to cut. Left uncapped, a blob over {@code
 * McpResponseTrim#MAX_RESPONSE_CHARS} makes {@code DefaultToolContext.applyBudget} discard the whole
 * response for a data-less stub - the caller pays for the query and receives nothing. The cut lands
 * on a UTF-8 boundary and {@code byteCount} reports the pre-truncation size.
 */
final class RdfBody {

  /**
   * Ceiling for one RDF payload. UTF-8 bytes are never fewer than the characters they encode, so
   * bounding bytes bounds the serialized length too; the headroom {@link
   * ResponseBudget#DEFAULT_BUDGET_FACTOR} reserves covers JSON escaping and the envelope.
   */
  static final int MAX_BYTES = (int) ResponseBudget.defaultBudgetChars();

  static final int MIN_BYTES = 1024;

  private RdfBody() {}

  record Bounded(String value, boolean truncated, int byteCount) {

    Bounded {
      value = Objects.requireNonNullElse(value, "");
    }
  }

  static Bounded bound(String response, int maxBytes) {
    byte[] bytes = Objects.requireNonNullElse(response, "").getBytes(StandardCharsets.UTF_8);
    int end = utf8Boundary(bytes, Math.min(bytes.length, maxBytes));
    return new Bounded(
        new String(bytes, 0, end, StandardCharsets.UTF_8), bytes.length > maxBytes, bytes.length);
  }

  /** Backs off any UTF-8 continuation byte (0b10xxxxxx) so the cut never splits a code point. */
  private static int utf8Boundary(byte[] bytes, int proposedEnd) {
    int end = proposedEnd;
    while (end < bytes.length && end > 0 && (bytes[end] & 0xC0) == 0x80) {
      end--;
    }
    return end;
  }

  static int clamp(int value, int minimum, int maximum) {
    return Math.min(Math.max(value, minimum), maximum);
  }
}
