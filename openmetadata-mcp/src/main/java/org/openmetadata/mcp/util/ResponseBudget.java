/*
 *  Copyright 2025 Collate
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
package org.openmetadata.mcp.util;

import java.util.List;

/**
 * Shared size-budgeting for MCP read tools. Every tool that returns a list of items (search
 * results, columns, lineage nodes) must keep its serialized response under the dispatch-level {@link
 * McpResponseTrim#MAX_RESPONSE_CHARS} cap, or the dispatch floor discards the entire payload and
 * returns a data-less stub. The correct way to stay under the cap is to return <em>fewer items</em>,
 * never to mangle the content of the items that are kept.
 *
 * <p>The one rule this enforces: measure each item's <em>actual</em> serialized size and include
 * items until the budget is reached. A single proportional guess (target = count * budget / total)
 * can undershoot when item sizes vary, leaving the response above the cap and re-triggering the
 * empty-stub nuke; this counts exactly instead.
 */
public final class ResponseBudget {

  /**
   * Fraction of {@link McpResponseTrim#MAX_RESPONSE_CHARS} an item list may occupy, leaving headroom
   * for the surrounding metadata (query echo, counts, markers) and the serialization overhead of the
   * enclosing structure so the assembled response lands below the hard cap rather than at it.
   */
  public static final double DEFAULT_BUDGET_FACTOR = 0.8;

  private ResponseBudget() {}

  /** Default item budget: {@link #DEFAULT_BUDGET_FACTOR} of the dispatch-level cap. */
  public static long defaultBudgetChars() {
    return (long) (McpResponseTrim.MAX_RESPONSE_CHARS * DEFAULT_BUDGET_FACTOR);
  }

  /**
   * Returns how many leading items of {@code items} fit within {@code budgetChars} once {@code
   * overheadChars} (the serialized size of everything except the items) is accounted for. Items are
   * measured one by one with {@link McpResponseTrim#serializedLength(Object)} and added while they
   * fit.
   *
   * <p>Guarantees forward progress for paging: when the overhead still leaves room but the very
   * first item alone exceeds the remaining budget, one item is returned rather than zero, so a
   * caller advancing by the returned count never stalls on the same offset. When the overhead itself
   * exceeds the budget, zero items are returned (the caller keeps its metadata and must not claim
   * more is reachable).
   */
  public static int fitCount(List<?> items, long overheadChars, long budgetChars) {
    long available = budgetChars - overheadChars;
    long used = 0;
    int fit = 0;
    for (int i = 0; i < items.size() && used <= available; i++) {
      used += McpResponseTrim.serializedLength(items.get(i)) + 1;
      if (used <= available) {
        fit = i + 1;
      }
    }
    boolean firstItemOverflows = fit == 0 && !items.isEmpty() && available > 0;
    if (firstItemOverflows) {
      fit = 1;
    }
    return fit;
  }

  /** Convenience overload using {@link #defaultBudgetChars()}. */
  public static int fitCount(List<?> items, long overheadChars) {
    return fitCount(items, overheadChars, defaultBudgetChars());
  }
}
