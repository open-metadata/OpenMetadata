package org.openmetadata.it.util;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.IntStream;
import org.junit.jupiter.api.Test;

class TestNamespaceTest {

  private static final int IDENTIFIER_COUNT = 65_537;

  @Test
  void uniqueShortIdsRemainDistinctPastTheLegacyRandomSuffixSpace() {
    final TestNamespace namespace = new TestNamespace("TestNamespaceTest");
    namespace.setMethodId("uniqueShortIdsRemainDistinctPastTheLegacyRandomSuffixSpace");
    final Set<String> identifiers = ConcurrentHashMap.newKeySet(IDENTIFIER_COUNT);

    IntStream.range(0, IDENTIFIER_COUNT)
        .parallel()
        .forEach(ignored -> identifiers.add(namespace.uniqueShortId()));

    assertEquals(IDENTIFIER_COUNT, identifiers.size());
    assertTrue(identifiers.stream().allMatch(identifier -> identifier.length() == 16));
  }
}
