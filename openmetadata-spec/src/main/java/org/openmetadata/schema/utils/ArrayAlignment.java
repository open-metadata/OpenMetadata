package org.openmetadata.schema.utils;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.function.Function;

/**
 * Pairs the elements of two array spans that hold the same element, so a diff can tell an element
 * that moved from one that changed. An element's identity is its text, for strings, or the first
 * of {@code id}, {@code fullyQualifiedName}, {@code tagFQN} and {@code name} that every element of
 * both spans carries as text, with no value repeated on either side. Because identities are
 * unique, a longest common subsequence of them is a longest run of increasing target indexes,
 * which patience sorting finds in O(n log n) for any input, with no cut-off to fall back from.
 */
final class ArrayAlignment {
  private static final List<Function<JsonNode, JsonNode>> IDENTITIES =
      List.of(
          element -> element,
          element -> element.get("id"),
          element -> element.get("fullyQualifiedName"),
          element -> element.get("tagFQN"),
          element -> element.get("name"));

  /** Indexes of the source and target arrays that hold the same element. */
  record Match(int source, int target) {}

  /** Source elements from {@code sourceFrom} up to {@code sourceTo}, excluded; same for target. */
  record Span(int sourceFrom, int sourceTo, int targetFrom, int targetTo) {}

  private ArrayAlignment() {}

  /**
   * Returns the matched elements in increasing order, or none when the elements have no unique
   * identity or their identities already line up position by position.
   */
  static List<Match> match(final JsonNode source, final JsonNode target, final Span span) {
    return canShift(span)
        ? IDENTITIES.stream()
            .map(identity -> alignBy(identity, source, target, span))
            .flatMap(Optional::stream)
            .findFirst()
            .orElse(List.of())
        : List.of();
  }

  /** With one side empty, or a single element on each, pairing by position is already optimal. */
  private static boolean canShift(final Span span) {
    final int sourceLength = span.sourceTo() - span.sourceFrom();
    final int targetLength = span.targetTo() - span.targetFrom();
    return Math.min(sourceLength, targetLength) > 0 && Math.max(sourceLength, targetLength) > 1;
  }

  /** Returns nothing when {@code identity} does not tell the elements apart. */
  private static Optional<List<Match>> alignBy(
      final Function<JsonNode, JsonNode> identity,
      final JsonNode source,
      final JsonNode target,
      final Span span) {
    final String[] sourceKeys = keys(source, span.sourceFrom(), span.sourceTo(), identity);
    final String[] targetKeys = keys(target, span.targetFrom(), span.targetTo(), identity);
    final boolean identified = sourceKeys != null && targetKeys != null;
    Optional<List<Match>> alignment = Optional.empty();
    if (identified && Arrays.equals(sourceKeys, targetKeys)) {
      alignment = Optional.of(List.of());
    } else if (identified && isUnique(sourceKeys) && isUnique(targetKeys)) {
      alignment = Optional.of(commonRun(sourceKeys, targetKeys, span));
    }
    return alignment;
  }

  /** Returns the identity of each element in {@code [from, to)}, or null when one has none. */
  private static String[] keys(
      final JsonNode array,
      final int from,
      final int to,
      final Function<JsonNode, JsonNode> identity) {
    final String[] keys = new String[to - from];
    for (int index = from; index < to; index++) {
      final JsonNode key = identity.apply(array.get(index));
      if (key == null || !key.isTextual()) {
        return null;
      }
      keys[index - from] = key.textValue();
    }
    return keys;
  }

  private static boolean isUnique(final String[] keys) {
    return new HashSet<>(Arrays.asList(keys)).size() == keys.length;
  }

  private static List<Match> commonRun(
      final String[] sourceKeys, final String[] targetKeys, final Span span) {
    final Map<String, Integer> targetIndexes = new HashMap<>();
    for (int index = 0; index < targetKeys.length; index++) {
      targetIndexes.put(targetKeys[index], span.targetFrom() + index);
    }
    final List<Match> shared = new ArrayList<>();
    for (int index = 0; index < sourceKeys.length; index++) {
      final Integer targetIndex = targetIndexes.get(sourceKeys[index]);
      if (targetIndex != null) {
        shared.add(new Match(span.sourceFrom() + index, targetIndex));
      }
    }
    return longestIncreasingRun(shared);
  }

  /** Patience sorting over the target indexes of matches listed in source order. */
  private static List<Match> longestIncreasingRun(final List<Match> shared) {
    final int[] runEnds = new int[shared.size()];
    final int[] previous = new int[shared.size()];
    int longest = 0;
    for (int position = 0; position < shared.size(); position++) {
      final int length = longestRunBelow(shared, runEnds, longest, shared.get(position).target());
      previous[position] = length == 0 ? -1 : runEnds[length - 1];
      runEnds[length] = position;
      longest = Math.max(longest, length + 1);
    }
    return collectRun(shared, previous, longest == 0 ? -1 : runEnds[longest - 1]);
  }

  /** Binary search for the longest run so far whose last target index is below {@code target}. */
  private static int longestRunBelow(
      final List<Match> shared, final int[] runEnds, final int longest, final int target) {
    int low = 0;
    int high = longest;
    while (low < high) {
      final int middle = (low + high) >>> 1;
      if (shared.get(runEnds[middle]).target() < target) {
        low = middle + 1;
      } else {
        high = middle;
      }
    }
    return low;
  }

  private static List<Match> collectRun(
      final List<Match> shared, final int[] previous, final int last) {
    final List<Match> run = new ArrayList<>();
    for (int position = last; position >= 0; position = previous[position]) {
      run.add(shared.get(position));
    }
    return run.reversed();
  }
}
