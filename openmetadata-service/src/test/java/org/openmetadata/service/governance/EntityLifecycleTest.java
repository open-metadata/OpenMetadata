package org.openmetadata.service.governance;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.EnumSet;
import java.util.HashMap;
import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.openmetadata.schema.entity.context.ContextMemoryStatus;
import org.openmetadata.schema.type.EntityStatus;

class EntityLifecycleTest {
  private enum ReviewedStatus {
    DRAFT,
    IN_REVIEW,
    APPROVED
  }

  private static final EntityLifecycle<ReviewedStatus> REVIEWED =
      new EntityLifecycle<>(
          ReviewedStatus.class,
          Map.of(
              ReviewedStatus.DRAFT, Set.of(ReviewedStatus.IN_REVIEW),
              ReviewedStatus.IN_REVIEW, Set.of(ReviewedStatus.APPROVED, ReviewedStatus.DRAFT),
              ReviewedStatus.APPROVED, Set.of()));

  @ParameterizedTest
  @ValueSource(strings = {"Superseded", "Invalidated"})
  void memoryRetirementStagesAreNotGeneralStages(String value) {
    assertEquals(value, ContextMemoryStatus.fromValue(value).value());
    assertFalse(EntityLifecycle.GENERAL.includesCode(value));
    assertFalse(EntityLifecycle.GENERAL.allowsCodes(EntityStatus.APPROVED.value(), value));
  }

  @Test
  void generalLifecycleMovesBetweenAnyOfTheGeneralStages() {
    assertEquals(EntityLifecycle.GENERAL_STAGES, EntityLifecycle.GENERAL.stages());
    for (EntityStatus from : EntityLifecycle.GENERAL_STAGES) {
      for (EntityStatus to : EntityLifecycle.GENERAL_STAGES) {
        assertEquals(from != to, EntityLifecycle.GENERAL.allows(from, to), from + " to " + to);
        assertEquals(from != to, EntityLifecycle.GENERAL.allowsCodes(from.value(), to.value()));
      }
    }
  }

  @Test
  void declaredLifecycleAllowsOnlyTheMovesItDeclares() {
    assertTrue(REVIEWED.allows(ReviewedStatus.DRAFT, ReviewedStatus.IN_REVIEW));
    assertTrue(REVIEWED.allows(ReviewedStatus.IN_REVIEW, ReviewedStatus.DRAFT));
    assertFalse(REVIEWED.allows(ReviewedStatus.DRAFT, ReviewedStatus.APPROVED));
    assertFalse(REVIEWED.allows(ReviewedStatus.APPROVED, ReviewedStatus.DRAFT));
    assertFalse(REVIEWED.includesCode(EntityStatus.DEPRECATED.value()));
    assertFalse(
        REVIEWED.allowsCodes(EntityStatus.DEPRECATED.value(), ReviewedStatus.DRAFT.toString()));
  }

  @Test
  void entitySavedWithoutAStageCanTakeAnyStageOfItsLifecycle() {
    assertTrue(REVIEWED.allows(null, ReviewedStatus.APPROVED));
    assertTrue(REVIEWED.allowsCodes(null, ReviewedStatus.APPROVED.toString()));
    assertFalse(REVIEWED.allowsCodes(null, EntityStatus.DEPRECATED.value()));
  }

  @Test
  void lifecycleThatMovesToAStageItDoesNotListIsRejected() {
    var mistake =
        assertThrows(
            IllegalArgumentException.class,
            () ->
                new EntityLifecycle<>(
                    ReviewedStatus.class,
                    Map.of(ReviewedStatus.DRAFT, Set.of(ReviewedStatus.APPROVED))));
    assertTrue(mistake.getMessage().contains(ReviewedStatus.APPROVED.toString()));
  }

  @Test
  void lifecycleMustDeclareEveryStageInItsGeneratedSchemaEnum() {
    var mistake =
        assertThrows(
            IllegalArgumentException.class,
            () ->
                new EntityLifecycle<>(
                    ContextMemoryStatus.class, Map.of(ContextMemoryStatus.DRAFT, Set.of())));
    assertTrue(mistake.getMessage().contains("ContextMemoryStatus schema vocabulary"));
  }

  @Test
  void lifecycleDefensivelyCopiesItsTransitionGraph() {
    Set<ReviewedStatus> draftMoves = EnumSet.of(ReviewedStatus.IN_REVIEW);
    Map<ReviewedStatus, Set<ReviewedStatus>> graph = new HashMap<>(REVIEWED.transitions());
    graph.put(ReviewedStatus.DRAFT, draftMoves);
    EntityLifecycle<ReviewedStatus> policy = new EntityLifecycle<>(ReviewedStatus.class, graph);
    draftMoves.clear();
    graph.clear();
    assertTrue(policy.allows(ReviewedStatus.DRAFT, ReviewedStatus.IN_REVIEW));
    assertThrows(UnsupportedOperationException.class, () -> policy.transitions().clear());
    assertThrows(
        UnsupportedOperationException.class,
        () -> policy.transitions().get(ReviewedStatus.DRAFT).clear());
  }
}
