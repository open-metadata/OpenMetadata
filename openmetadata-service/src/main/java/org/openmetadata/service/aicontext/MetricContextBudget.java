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
  static final int ENVELOPE_CHARS =
      "{\"dimensions\":[],\"measures\":[],\"filters\":[],\"relatedMetrics\":[],\"semanticFieldsTruncated\":true}"
          .length();

  private final BudgetTracker budget;
  private final int maxItems;
  private boolean truncated;

  MetricContextBudget(final int budgetChars, final int maxItems) {
    budget = new BudgetTracker(Math.max(0, budgetChars) - ENVELOPE_CHARS);
    this.maxItems = maxItems;
  }

  <T> List<T> take(final List<T> values, final Function<T, String> serialize) {
    final List<T> retained = new ArrayList<>();
    for (final T value : values) {
      if (retained.size() == maxItems || !budget.tryConsume("," + serialize.apply(value))) {
        break;
      }
      retained.add(value);
    }
    truncated |= retained.size() < values.size();
    return retained.isEmpty() ? null : List.copyOf(retained);
  }

  <T> List<T> takeAll(final List<T> values, final Function<T, String> serialize) {
    if (values.size() > maxItems) {
      truncated = true;
      return null;
    }
    final StringBuilder serialized = new StringBuilder();
    for (final T value : values) {
      final String item = serialize.apply(value);
      if ((long) serialized.length() + item.length() + 1 > budget.remaining()) {
        truncated = true;
        return null;
      }
      serialized.append(',').append(item);
    }
    budget.tryConsume(serialized.toString());
    return values.isEmpty() ? null : List.copyOf(values);
  }

  boolean truncated() {
    return truncated;
  }
}
