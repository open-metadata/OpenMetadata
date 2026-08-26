package org.openmetadata.it.util;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.IntStream;
import org.junit.jupiter.api.Test;

class TestNamespaceTest {

  private static final int IDENTIFIER_COUNT = 65_537;
  private static final int IDENTIFIER_LENGTH = 16;
  private static final int RUN_PREFIX_LENGTH = 8;

  @Test
  void uniqueShortIdsRemainDistinctPastTheLegacyRandomSuffixSpace() {
    final TestNamespace namespace = new TestNamespace("TestNamespaceTest");
    namespace.setMethodId("uniqueShortIdsRemainDistinctPastTheLegacyRandomSuffixSpace");
    final Set<String> identifiers = ConcurrentHashMap.newKeySet(IDENTIFIER_COUNT);

    IntStream.range(0, IDENTIFIER_COUNT)
        .parallel()
        .forEach(ignored -> identifiers.add(namespace.uniqueShortId()));

    assertEquals(IDENTIFIER_COUNT, identifiers.size());
    assertTrue(
        identifiers.stream().allMatch(identifier -> identifier.length() == IDENTIFIER_LENGTH));
  }

  @Test
  void uniqueShortIdsDisperseTheCounterAcrossEverySuffixPosition() {
    final TestNamespace namespace = new TestNamespace("TestNamespaceTest");
    final List<String> identifiers =
        IntStream.range(0, 256).mapToObj(ignored -> namespace.uniqueShortId()).toList();

    IntStream.range(RUN_PREFIX_LENGTH, IDENTIFIER_LENGTH)
        .forEach(
            position ->
                assertTrue(
                    identifiers.stream()
                            .mapToInt(identifier -> identifier.charAt(position))
                            .distinct()
                            .count()
                        > 1,
                    "Expected suffix position %d to vary".formatted(position)));
  }
}
