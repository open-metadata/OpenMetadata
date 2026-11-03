package org.openmetadata.service.context.center;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

class MemoryTextSimilarityTest {

  @Test
  void aReplacedNumberIsAConflict() {
    assertTrue(MemoryTextSimilarity.hasConflictingNumbers("15%", "20%"));
    assertTrue(MemoryTextSimilarity.hasConflictingNumbers("15% (2025)", "20% (2025)"));
  }

  @Test
  void anAddedOrDroppedNumberIsARewording() {
    assertFalse(MemoryTextSimilarity.hasConflictingNumbers("15%", "15% (section 3)"));
    assertFalse(MemoryTextSimilarity.hasConflictingNumbers("As of 2025, 30 days", "30 days"));
    assertFalse(MemoryTextSimilarity.hasConflictingNumbers("30 days", "about a month"));
  }
}
