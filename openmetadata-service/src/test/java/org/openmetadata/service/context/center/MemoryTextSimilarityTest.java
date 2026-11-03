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

  /** The model writes one amount differently between runs; that is not a second value. */
  @Test
  void aReformattedNumberIsTheSameNumber() {
    assertFalse(MemoryTextSimilarity.hasConflictingNumbers("$1,500 per trip", "$1500 per trip"));
    assertFalse(MemoryTextSimilarity.hasConflictingNumbers("2.50 EUR", "2.5 EUR"));
    assertFalse(MemoryTextSimilarity.hasConflictingNumbers("within 08 hours", "within 8 hours"));
    assertFalse(MemoryTextSimilarity.hasConflictingNumbers("sections 1,2", "sections 1, 2"));
    assertTrue(MemoryTextSimilarity.hasConflictingNumbers("$1,500 per trip", "$2,000 per trip"));
  }
}
