package org.openmetadata.service.resources.context;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.Set;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.service.governance.EntityLifecycle;
import org.openmetadata.service.jdbi3.ContextMemoryRepository;

class ContextMemoryStatusTransitionTest {
  private static final EntityLifecycle MEMORY = ContextMemoryRepository.LIFECYCLE;

  @Test
  void memoryIsDraftApprovedOrArchived() {
    assertEquals(
        Set.of(
            EntityStatus.DRAFT,
            EntityStatus.APPROVED,
            EntityStatus.DEPRECATED,
            EntityStatus.REJECTED,
            EntityStatus.ARCHIVED),
        MEMORY.stages());
  }

  @Test
  void memoryMovesForwardAndCanBeRestoredFromTheArchive() {
    assertTrue(MEMORY.allows(EntityStatus.DRAFT, EntityStatus.APPROVED));
    assertTrue(MEMORY.allows(EntityStatus.DRAFT, EntityStatus.ARCHIVED));
    assertTrue(MEMORY.allows(EntityStatus.APPROVED, EntityStatus.ARCHIVED));
    assertTrue(MEMORY.allows(EntityStatus.APPROVED, EntityStatus.DEPRECATED));
    assertTrue(MEMORY.allows(EntityStatus.APPROVED, EntityStatus.REJECTED));
    assertTrue(MEMORY.allows(EntityStatus.ARCHIVED, EntityStatus.APPROVED));
    assertTrue(MEMORY.allows(EntityStatus.DEPRECATED, EntityStatus.APPROVED));
    assertTrue(MEMORY.allows(EntityStatus.REJECTED, EntityStatus.APPROVED));
  }

  @Test
  void memoryNeverGoesBackToDraft() {
    assertFalse(MEMORY.allows(EntityStatus.APPROVED, EntityStatus.DRAFT));
    assertFalse(MEMORY.allows(EntityStatus.ARCHIVED, EntityStatus.DRAFT));
  }

  @Test
  void memorySavedWithoutAStageMayTakeAnyMemoryStage() {
    assertTrue(MEMORY.allows(null, EntityStatus.DRAFT));
    assertTrue(MEMORY.allows(null, EntityStatus.ARCHIVED));
    assertFalse(MEMORY.allows(null, EntityStatus.IN_REVIEW));
  }

  @Test
  void retiredMemoriesCannotSkipBetweenRetiredStagesOrReturnToDraft() {
    assertFalse(MEMORY.allows(EntityStatus.DEPRECATED, EntityStatus.REJECTED));
    assertFalse(MEMORY.allows(EntityStatus.REJECTED, EntityStatus.DEPRECATED));
    assertFalse(MEMORY.allows(EntityStatus.DEPRECATED, EntityStatus.DRAFT));
    assertFalse(MEMORY.allows(EntityStatus.REJECTED, EntityStatus.DRAFT));
  }
}
