/*
 *  Copyright 2024 Collate.
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
package org.openmetadata.it.search.shape;

import java.util.Locale;

public final class ShapeClassifier {
  private static final String TOTAL_FIELDS = "limit of total fields";
  private static final String NESTED = "nested";
  private static final String DEPTH = "depth";
  private static final String EXCEEDED = "exceeded";
  private static final String SIZE_ENTITY_TOO_LARGE = "request entity too large";
  private static final String SIZE_CONTENT_TOO_LONG = "content too long";
  private static final String SIZE_TERM_BYTES = "max_bytes_length_exceeded";
  private static final String SIZE_413 = "413";
  private static final String PARSE_MAPPER = "mapper_parsing_exception";
  private static final String PARSE_DOC = "document_parsing_exception";
  private static final String PARSE_FAILED = "failed to parse";

  private ShapeClassifier() {}

  public static Outcome classifyError(final String rawMessage) {
    final String message = rawMessage == null ? "" : rawMessage.toLowerCase(Locale.ROOT);
    final Outcome outcome;
    if (isSize(message)) {
      outcome = Outcome.REJECT_SIZE;
    } else if (message.contains(TOTAL_FIELDS)) {
      outcome = Outcome.REJECT_FIELDS;
    } else if (message.contains(NESTED) && message.contains(EXCEEDED)) {
      outcome = Outcome.REJECT_NESTED;
    } else if (message.contains(DEPTH) && message.contains(EXCEEDED)) {
      outcome = Outcome.REJECT_DEPTH;
    } else if (isParse(message)) {
      outcome = Outcome.REJECT_PARSE;
    } else {
      outcome = Outcome.ERROR_OTHER;
    }
    return outcome;
  }

  private static boolean isSize(final String message) {
    return message.contains(SIZE_ENTITY_TOO_LARGE)
        || message.contains(SIZE_CONTENT_TOO_LONG)
        || message.contains(SIZE_TERM_BYTES)
        || message.contains(SIZE_413);
  }

  private static boolean isParse(final String message) {
    return message.contains(PARSE_MAPPER)
        || message.contains(PARSE_DOC)
        || message.contains(PARSE_FAILED);
  }
}
