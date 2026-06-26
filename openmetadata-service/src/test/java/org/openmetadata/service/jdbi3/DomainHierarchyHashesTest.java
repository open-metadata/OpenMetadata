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

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

/**
 * Direct unit tests for the pure fqnHash hierarchy math. fqnHashes are dot-joined segment lists, so
 * readable synthetic paths (e.g. {@code "a.b.c"}) exercise the same logic as real hex hashes.
 */
class DomainHierarchyHashesTest {

  @Test
  void longestCommonAncestor_emptyInput_isEmpty() {
    assertEquals("", DomainHierarchyHashes.longestCommonAncestor(List.of()));
  }

  @Test
  void longestCommonAncestor_singleHash_isThatHash() {
    assertEquals("a.b.c", DomainHierarchyHashes.longestCommonAncestor(List.of("a.b.c")));
  }

  @Test
  void longestCommonAncestor_siblings_isTheirParent() {
    assertEquals(
        "a.b", DomainHierarchyHashes.longestCommonAncestor(List.of("a.b.c", "a.b.d", "a.b.e")));
  }

  @Test
  void longestCommonAncestor_differentParentsSharedRoot_isThatRoot() {
    assertEquals("a", DomainHierarchyHashes.longestCommonAncestor(List.of("a.p1.c1", "a.p2.c2")));
  }

  @Test
  void longestCommonAncestor_unrelatedTopLevels_isEmpty() {
    assertEquals("", DomainHierarchyHashes.longestCommonAncestor(List.of("alpha.x", "beta.y")));
  }

  @Test
  void longestCommonAncestor_ancestorAndDescendant_isTheAncestor() {
    assertEquals("a.b", DomainHierarchyHashes.longestCommonAncestor(List.of("a.b", "a.b.c.d")));
  }

  @Test
  void longestCommonAncestor_sharedCharPrefixButDifferentSegment_isEmpty() {
    // "ab" and "ad" share the leading character 'a' but are different whole segments — a substring
    // approach would wrongly return "a"; segment-wise they share nothing.
    assertEquals("", DomainHierarchyHashes.longestCommonAncestor(List.of("ab.c", "ad.e")));
  }

  @Test
  void strictAncestorHashes_rootHash_hasNone() {
    assertTrue(DomainHierarchyHashes.strictAncestorHashes("root").isEmpty());
  }

  @Test
  void strictAncestorHashes_depthThree_returnsProperPrefixesShallowestFirst() {
    assertEquals(List.of("a", "a.b"), DomainHierarchyHashes.strictAncestorHashes("a.b.c"));
  }

  @Test
  void countDescendantsByAncestor_countsNestedDomainsAtEveryDepth() {
    List<String> candidates = List.of("a.b", "a.c", "a.b.x", "a.b.y");
    Map<String, Integer> counts =
        DomainHierarchyHashes.countDescendantsByAncestor(candidates, List.of("a", "a.b"));

    assertEquals(4, counts.get("a")); // a.b, a.c, a.b.x, a.b.y
    assertEquals(2, counts.get("a.b")); // a.b.x, a.b.y
  }

  @Test
  void countDescendantsByAncestor_doesNotCountAncestorItself() {
    Map<String, Integer> counts =
        DomainHierarchyHashes.countDescendantsByAncestor(List.of("a.b"), List.of("a.b"));

    assertEquals(0, counts.getOrDefault("a.b", 0));
  }

  @Test
  void countDescendantsByAncestor_ignoresCandidatesOutsideTheAncestorSet() {
    Map<String, Integer> counts =
        DomainHierarchyHashes.countDescendantsByAncestor(
            List.of("other.x", "a.b.x"), List.of("a.b"));

    assertEquals(1, counts.get("a.b"));
  }

  @Test
  void countDescendantsByAncestor_emptyCandidates_isEmpty() {
    assertTrue(
        DomainHierarchyHashes.countDescendantsByAncestor(List.of(), List.of("a.b")).isEmpty());
  }

  @Test
  void countDescendantsByAncestor_emptyAncestors_isEmpty() {
    assertTrue(
        DomainHierarchyHashes.countDescendantsByAncestor(List.of("a.b.c"), List.of()).isEmpty());
  }
}
