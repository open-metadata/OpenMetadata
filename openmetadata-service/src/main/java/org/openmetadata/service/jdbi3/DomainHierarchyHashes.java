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
package org.openmetadata.service.jdbi3;

import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;
import org.openmetadata.service.Entity;

/**
 * Pure fqnHash hierarchy math used to count nested descendant domains in bulk.
 *
 * <p>An {@code fqnHash} is a list of per-segment hashes joined by {@link Entity#SEPARATOR} (e.g.
 * {@code "hA.hB.hC"}), so ancestry is simply a segment-list prefix relationship: {@code hA.hB} is an
 * ancestor of {@code hA.hB.hC}. Working on segment lists (rather than raw character offsets) keeps
 * the logic obvious and avoids the partial-segment pitfalls of substring matching. This class has no
 * DB or entity dependencies and is exercised directly by {@code DomainHierarchyHashesTest}.
 */
final class DomainHierarchyHashes {
  private static final Pattern SEGMENT_DELIMITER = Pattern.compile(Pattern.quote(Entity.SEPARATOR));

  private DomainHierarchyHashes() {}

  /**
   * Longest ancestor fqnHash shared by every hash in {@code fqnHashes}, or an empty string when they
   * share no leading segment (i.e. they live under different top-level domains). A single hash is its
   * own longest common ancestor.
   */
  static String longestCommonAncestor(Collection<String> fqnHashes) {
    List<String> commonSegments = null;
    for (String fqnHash : fqnHashes) {
      List<String> segments = segmentsOf(fqnHash);
      commonSegments =
          (commonSegments == null) ? segments : longestCommonPrefix(commonSegments, segments);
      if (commonSegments.isEmpty()) {
        break;
      }
    }
    return commonSegments == null ? "" : String.join(Entity.SEPARATOR, commonSegments);
  }

  /**
   * Counts, for each ancestor hash in {@code ancestorHashes}, how many of {@code candidateHashes} are
   * its strict descendants. A candidate is attributed to every ancestor on its path, so a depth-3
   * domain increments both its parent and its grandparent when both are present. Runs in
   * O(candidates × depth).
   */
  static Map<String, Integer> countDescendantsByAncestor(
      Collection<String> candidateHashes, Collection<String> ancestorHashes) {
    Set<String> ancestors = Set.copyOf(ancestorHashes);
    Map<String, Integer> descendantCountByHash = new HashMap<>();
    for (String candidateHash : candidateHashes) {
      for (String ancestorHash : strictAncestorHashes(candidateHash)) {
        if (ancestors.contains(ancestorHash)) {
          descendantCountByHash.merge(ancestorHash, 1, Integer::sum);
        }
      }
    }
    return descendantCountByHash;
  }

  /**
   * Every strict-ancestor fqnHash of {@code fqnHash} (all proper prefixes), shallowest first. A root
   * hash (single segment) has none.
   */
  static List<String> strictAncestorHashes(String fqnHash) {
    List<String> segments = segmentsOf(fqnHash);
    List<String> ancestors = new ArrayList<>(Math.max(0, segments.size() - 1));
    StringBuilder ancestor = new StringBuilder();
    for (int depth = 0; depth < segments.size() - 1; depth++) {
      ancestor.append(depth == 0 ? "" : Entity.SEPARATOR).append(segments.get(depth));
      ancestors.add(ancestor.toString());
    }
    return ancestors;
  }

  private static List<String> longestCommonPrefix(List<String> left, List<String> right) {
    int sharedDepth = 0;
    int comparableDepth = Math.min(left.size(), right.size());
    while (sharedDepth < comparableDepth && left.get(sharedDepth).equals(right.get(sharedDepth))) {
      sharedDepth++;
    }
    return left.subList(0, sharedDepth);
  }

  private static List<String> segmentsOf(String fqnHash) {
    return List.of(SEGMENT_DELIMITER.split(fqnHash));
  }
}
