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
package org.openmetadata.service.util;

import java.util.List;
import java.util.function.IntToLongFunction;
import org.openmetadata.schema.utils.JsonUtils;

/**
 * Shared size-budgeting for responses that return a list of items (MCP read tools' search results,
 * columns and lineage, and the compact lineage REST endpoint). Each must keep its serialized
 * response under {@link #DEFAULT_MAX_RESPONSE_CHARS}, or the MCP dispatch floor discards the entire
 * payload and returns a data-less stub. The correct way to stay under the cap is to return <em>fewer items</em>,
 * never to mangle the content of the items that are kept.
 *
 * <p>The one rule this enforces: measure each item's <em>actual</em> serialized size and include
 * items until the budget is reached. A single proportional guess (target = count * budget / total)
 * can undershoot when item sizes vary, leaving the response above the cap and re-triggering the
 * empty-stub nuke; this counts exactly instead.
 */
public final class ResponseBudget {

  /** The response size cap MCP dispatch enforces, and the default for other paged responses. */
  public static final int DEFAULT_MAX_RESPONSE_CHARS = 100_000;

  /**
   * Fraction of {@link #DEFAULT_MAX_RESPONSE_CHARS} an item list may occupy, leaving headroom
   * for the surrounding metadata (query echo, counts, markers) and the serialization overhead of the
   * enclosing structure so the assembled response lands below the hard cap rather than at it.
   */
  public static final double DEFAULT_BUDGET_FACTOR = 0.8;

  private ResponseBudget() {}

  /** How many leading items fit and how many chars they consumed. */
  public record Fit(int count, long usedChars) {}

  /**
   * Fits leading items of {@code items} within {@code budgetChars}, measuring each item's real
   * serialized size, and returns both the count and the chars consumed. Guarantees forward progress:
   * when the first item alone exceeds a positive budget, one item is still returned. Callers with two
   * lists sharing one budget (e.g. upstream/downstream edges) use the returned {@code usedChars} to
   * hand the remainder to the second list.
   *
   * <p>Residual: a single item whose serialized size exceeds {@link #DEFAULT_MAX_RESPONSE_CHARS} is
   * inherently un-pageable without truncating its content
   * (which this design refuses to do). Forward progress still returns that one item, so the assembled
   * response can exceed the cap; the dispatch floor ({@code
   * DefaultToolContext.serializeWithinBudget}) then replaces it with an actionable {@code truncated}
   * envelope (tool name, size, cap, advice) rather than a silent empty stub. See {@code
   * ResponseBudgetTest#singleItemOverMaxResponseCharsStillReturnsOne}.
   */
  public static Fit fitWithin(List<?> items, long budgetChars) {
    return fit(items.size(), i -> serializedLength(items.get(i)) + 1, budgetChars);
  }

  /**
   * {@link #fitWithin} over sizes already measured, separator included, for a caller that needs each
   * item's size for more than this one fit.
   */
  public static Fit fitWithin(long[] sizes, long budgetChars) {
    return fit(sizes.length, i -> sizes[i], budgetChars);
  }

  private static Fit fit(int count, IntToLongFunction sizeOf, long budgetChars) {
    long used = 0;
    int fit = 0;
    while (fit < count) {
      long size = sizeOf.applyAsLong(fit);
      if (used + size > budgetChars) {
        break;
      }
      used += size;
      fit++;
    }
    boolean firstItemOverflows = fit == 0 && count > 0 && budgetChars > 0;
    if (firstItemOverflows) {
      fit = 1;
      used = sizeOf.applyAsLong(0);
    }
    return new Fit(fit, used);
  }

  /** Default item budget: {@link #DEFAULT_BUDGET_FACTOR} of the dispatch-level cap. */
  public static long defaultBudgetChars() {
    return budgetChars(DEFAULT_MAX_RESPONSE_CHARS);
  }

  /** Item budget for a response capped at {@code maxResponseChars}. */
  public static long budgetChars(int maxResponseChars) {
    return (long) (maxResponseChars * DEFAULT_BUDGET_FACTOR);
  }

  public static int serializedLength(Object value) {
    return JsonUtils.pojoToJson(value).length();
  }

  /**
   * Returns how many leading items of {@code items} fit within {@code budgetChars} once {@code
   * overheadChars} (the serialized size of everything except the items) is accounted for. Items are
   * measured one by one with {@link #serializedLength(Object)} and added while they
   * fit.
   *
   * <p>Guarantees forward progress for paging: when the overhead still leaves room but the very
   * first item alone exceeds the remaining budget, one item is returned rather than zero, so a
   * caller advancing by the returned count never stalls on the same offset. When the overhead itself
   * exceeds the budget, zero items are returned (the caller keeps its metadata and must not claim
   * more is reachable).
   */
  public static int fitCount(List<?> items, long overheadChars, long budgetChars) {
    return fitWithin(items, budgetChars - overheadChars).count();
  }

  /** Convenience overload using {@link #defaultBudgetChars()}. */
  public static int fitCount(List<?> items, long overheadChars) {
    return fitCount(items, overheadChars, defaultBudgetChars());
  }
}
