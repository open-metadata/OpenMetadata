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
package org.openmetadata.service.aicontext;

import java.util.ArrayList;
import java.util.List;
import java.util.function.Function;

/** Keeps complete semantic values inside the existing shared knowledge budget. */
final class MetricContextBudget {
  private static final String MARKER = "\"semanticFieldsTruncated\":true";

  private final int budgetChars;
  private final int maxItems;
  private final boolean markerFits;
  private int used;
  private boolean hasField;
  private boolean truncated;

  MetricContextBudget(final int budgetChars, final int maxItems, final boolean includeMarker) {
    this.budgetChars = budgetChars;
    this.maxItems = maxItems;
    markerFits = includeMarker && MARKER.length() + 2 <= budgetChars;
    hasField = markerFits;
    used = 2 + (markerFits ? MARKER.length() : 0);
  }

  <T> List<T> take(final String name, final List<T> values, final Function<T, String> serialize) {
    final List<T> retained = new ArrayList<>();
    long chars = fieldOverhead(name);
    for (final T value : values) {
      if (retained.size() == maxItems) {
        break;
      }
      final int itemChars = serialize.apply(value).length();
      final long nextChars = chars + itemChars + (retained.isEmpty() ? 0 : 1);
      if (used + nextChars > budgetChars) {
        break;
      }
      retained.add(value);
      chars = nextChars;
    }
    truncated |= retained.size() < values.size();
    if (retained.isEmpty()) {
      return null;
    }
    used += (int) chars;
    hasField = true;
    return List.copyOf(retained);
  }

  <T> List<T> takeAll(
      final String name, final List<T> values, final Function<T, String> serialize) {
    if (values.isEmpty()) {
      return null;
    }
    if (values.size() > maxItems) {
      truncated = true;
      return null;
    }
    long chars = fieldOverhead(name);
    boolean first = true;
    for (final T value : values) {
      chars += serialize.apply(value).length() + (first ? 0 : 1);
      if (used + chars > budgetChars) {
        truncated = true;
        return null;
      }
      first = false;
    }
    used += (int) chars;
    hasField = true;
    return List.copyOf(values);
  }

  private int fieldOverhead(final String name) {
    // Two quotes, a colon, two array brackets, and a separator after the first field.
    return name.length() + 5 + (hasField ? 1 : 0);
  }

  boolean truncated() {
    return truncated;
  }

  boolean markerFits() {
    return markerFits;
  }
}
