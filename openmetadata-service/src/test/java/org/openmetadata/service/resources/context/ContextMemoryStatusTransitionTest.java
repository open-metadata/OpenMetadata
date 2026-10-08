package org.openmetadata.service.resources.context;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.Set;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.openmetadata.schema.entity.context.ContextMemoryStatus;
import org.openmetadata.service.governance.EntityLifecycle;
import org.openmetadata.service.jdbi3.ContextMemoryRepository;

class ContextMemoryStatusTransitionTest {

  @ParameterizedTest
  @ValueSource(strings = {"Superseded", "Invalidated"})
  void explicitRetirementStagesResolvePendingAndApprovedMemories(String value) {
    ContextMemoryStatus retired = ContextMemoryStatus.fromValue(value);

    assertTrue(MEMORY.allows(ContextMemoryStatus.UNPROCESSED, retired));
    assertTrue(MEMORY.allows(ContextMemoryStatus.APPROVED, retired));
    assertTrue(MEMORY.allows(retired, ContextMemoryStatus.APPROVED));
    assertTrue(MEMORY.allows(retired, ContextMemoryStatus.UNPROCESSED));
    assertTrue(MEMORY.allows(retired, ContextMemoryStatus.ARCHIVED));
    assertFalse(MEMORY.allows(ContextMemoryStatus.DRAFT, retired));
    assertFalse(MEMORY.allows(retired, ContextMemoryStatus.DRAFT));
    for (ContextMemoryStatus other :
        Set.of(
            ContextMemoryStatus.SUPERSEDED,
            ContextMemoryStatus.INVALIDATED,
            ContextMemoryStatus.DEPRECATED,
            ContextMemoryStatus.REJECTED)) {
      if (other != retired) {
        assertFalse(MEMORY.allows(retired, other));
      }
    }
  }

  @Test
  void unprocessedMemoriesCanBeResolvedAndReviewedMemoriesCanBeExplicitlyRequeued() {
    assertTrue(MEMORY.allows(ContextMemoryStatus.UNPROCESSED, ContextMemoryStatus.APPROVED));
    assertTrue(MEMORY.allows(ContextMemoryStatus.UNPROCESSED, ContextMemoryStatus.REJECTED));
    assertTrue(MEMORY.allows(ContextMemoryStatus.UNPROCESSED, ContextMemoryStatus.DEPRECATED));
    assertTrue(MEMORY.allows(ContextMemoryStatus.APPROVED, ContextMemoryStatus.UNPROCESSED));
    assertTrue(MEMORY.allows(ContextMemoryStatus.REJECTED, ContextMemoryStatus.UNPROCESSED));
  }

  @Test
  void unprocessedConflictsCanAwaitAHumanDecisionAsDraft() {
    assertTrue(MEMORY.allows(ContextMemoryStatus.UNPROCESSED, ContextMemoryStatus.DRAFT));
    assertTrue(MEMORY.allows(ContextMemoryStatus.DRAFT, ContextMemoryStatus.APPROVED));
    assertTrue(MEMORY.allows(ContextMemoryStatus.DRAFT, ContextMemoryStatus.REJECTED));
    assertTrue(MEMORY.allows(ContextMemoryStatus.DRAFT, ContextMemoryStatus.UNPROCESSED));
  }

  private static final EntityLifecycle<ContextMemoryStatus> MEMORY =
      ContextMemoryRepository.LIFECYCLE;

  @Test
  void memoryStagesIncludePendingAndResolvedStates() {
    assertEquals(
        Set.of(
            ContextMemoryStatus.UNPROCESSED,
            ContextMemoryStatus.DRAFT,
            ContextMemoryStatus.APPROVED,
            ContextMemoryStatus.DEPRECATED,
            ContextMemoryStatus.REJECTED,
            ContextMemoryStatus.SUPERSEDED,
            ContextMemoryStatus.INVALIDATED,
            ContextMemoryStatus.ARCHIVED),
        MEMORY.stages());
  }

  @Test
  void memoryMovesForwardAndCanBeRestoredFromTheArchive() {
    assertTrue(MEMORY.allows(ContextMemoryStatus.DRAFT, ContextMemoryStatus.APPROVED));
    assertTrue(MEMORY.allows(ContextMemoryStatus.DRAFT, ContextMemoryStatus.ARCHIVED));
    assertTrue(MEMORY.allows(ContextMemoryStatus.APPROVED, ContextMemoryStatus.ARCHIVED));
    assertTrue(MEMORY.allows(ContextMemoryStatus.APPROVED, ContextMemoryStatus.DEPRECATED));
    assertTrue(MEMORY.allows(ContextMemoryStatus.APPROVED, ContextMemoryStatus.REJECTED));
    assertTrue(MEMORY.allows(ContextMemoryStatus.ARCHIVED, ContextMemoryStatus.APPROVED));
    assertTrue(MEMORY.allows(ContextMemoryStatus.DEPRECATED, ContextMemoryStatus.APPROVED));
    assertTrue(MEMORY.allows(ContextMemoryStatus.REJECTED, ContextMemoryStatus.APPROVED));
  }

  @Test
  void resolvedMemoriesNeverGoBackToDraft() {
    assertFalse(MEMORY.allows(ContextMemoryStatus.APPROVED, ContextMemoryStatus.DRAFT));
    assertFalse(MEMORY.allows(ContextMemoryStatus.ARCHIVED, ContextMemoryStatus.DRAFT));
  }

  @Test
  void memorySavedWithoutAStageMayTakeAnyMemoryStage() {
    assertTrue(MEMORY.allows(null, ContextMemoryStatus.DRAFT));
    assertTrue(MEMORY.allows(null, ContextMemoryStatus.ARCHIVED));
    assertFalse(MEMORY.includesCode("In Review"));
  }

  @Test
  void retiredMemoriesCannotSkipBetweenRetiredStagesOrReturnToDraft() {
    assertFalse(MEMORY.allows(ContextMemoryStatus.DEPRECATED, ContextMemoryStatus.REJECTED));
    assertFalse(MEMORY.allows(ContextMemoryStatus.REJECTED, ContextMemoryStatus.DEPRECATED));
    assertFalse(MEMORY.allows(ContextMemoryStatus.DEPRECATED, ContextMemoryStatus.DRAFT));
    assertFalse(MEMORY.allows(ContextMemoryStatus.REJECTED, ContextMemoryStatus.DRAFT));
  }
}
