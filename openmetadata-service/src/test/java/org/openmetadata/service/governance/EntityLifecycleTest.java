package org.openmetadata.service.governance;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.openmetadata.schema.type.EntityStatus;

class EntityLifecycleTest {

  @ParameterizedTest
  @ValueSource(strings = {"Superseded", "Invalidated"})
  void memoryRetirementStagesAreNotGeneralStages(String value) {
    EntityStatus stage = EntityStatus.fromValue(value);

    assertFalse(EntityLifecycle.GENERAL.includes(stage));
    assertFalse(EntityLifecycle.GENERAL.allows(EntityStatus.APPROVED, stage));
  }

  /** A lifecycle where a draft is reviewed before it is approved, and approval is final. */
  private static final EntityLifecycle REVIEWED =
      new EntityLifecycle(
          Map.of(
              EntityStatus.DRAFT, Set.of(EntityStatus.IN_REVIEW),
              EntityStatus.IN_REVIEW, Set.of(EntityStatus.APPROVED, EntityStatus.DRAFT),
              EntityStatus.APPROVED, Set.of()));

  @Test
  void generalLifecycleMovesBetweenAnyOfTheGeneralStages() {
    assertEquals(EntityLifecycle.GENERAL_STAGES, EntityLifecycle.GENERAL.stages());
    for (EntityStatus from : EntityLifecycle.GENERAL_STAGES) {
      for (EntityStatus to : EntityLifecycle.GENERAL_STAGES) {
        assertEquals(from != to, EntityLifecycle.GENERAL.allows(from, to), from + " to " + to);
      }
    }
  }

  @Test
  void declaredLifecycleAllowsOnlyTheMovesItDeclares() {
    assertTrue(REVIEWED.allows(EntityStatus.DRAFT, EntityStatus.IN_REVIEW));
    assertTrue(REVIEWED.allows(EntityStatus.IN_REVIEW, EntityStatus.DRAFT));
    assertFalse(REVIEWED.allows(EntityStatus.DRAFT, EntityStatus.APPROVED));
    assertFalse(REVIEWED.allows(EntityStatus.APPROVED, EntityStatus.DRAFT));
    assertFalse(REVIEWED.includes(EntityStatus.DEPRECATED));
  }

  @Test
  void entitySavedWithoutAStageCanTakeAnyStageOfItsLifecycle() {
    assertTrue(REVIEWED.allows(null, EntityStatus.APPROVED));
    assertFalse(REVIEWED.allows(null, EntityStatus.DEPRECATED));
  }

  @Test
  void lifecycleThatMovesToAStageItDoesNotListIsRejected() {
    Map<EntityStatus, Set<EntityStatus>> movesOutside =
        Map.of(EntityStatus.DRAFT, Set.of(EntityStatus.APPROVED));

    IllegalArgumentException mistake =
        assertThrows(IllegalArgumentException.class, () -> new EntityLifecycle(movesOutside));
    assertTrue(mistake.getMessage().contains(EntityStatus.APPROVED.value()));
  }
}
