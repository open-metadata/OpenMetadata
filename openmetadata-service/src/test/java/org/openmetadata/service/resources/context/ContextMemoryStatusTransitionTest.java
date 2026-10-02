package org.openmetadata.service.resources.context;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import jakarta.ws.rs.BadRequestException;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.service.jdbi3.ContextMemoryRepository;

class ContextMemoryStatusTransitionTest {

  @Test
  void testValidStatusTransitionsAreAccepted() {
    ContextMemoryRepository.validateStatusTransition(EntityStatus.DRAFT, EntityStatus.APPROVED);
    ContextMemoryRepository.validateStatusTransition(EntityStatus.DRAFT, EntityStatus.ARCHIVED);
    ContextMemoryRepository.validateStatusTransition(EntityStatus.APPROVED, EntityStatus.ARCHIVED);
    ContextMemoryRepository.validateStatusTransition(EntityStatus.ARCHIVED, EntityStatus.APPROVED);
  }

  @Test
  void testNoOpStatusTransitionIsAccepted() {
    ContextMemoryRepository.validateStatusTransition(EntityStatus.APPROVED, EntityStatus.APPROVED);
    ContextMemoryRepository.validateStatusTransition(EntityStatus.DRAFT, EntityStatus.DRAFT);
  }

  @Test
  void testApprovedToDraftIsRejected() {
    BadRequestException exception =
        assertThrows(
            BadRequestException.class,
            () ->
                ContextMemoryRepository.validateStatusTransition(
                    EntityStatus.APPROVED, EntityStatus.DRAFT));
    assertTrue(exception.getMessage().contains("Invalid memory status transition"));
  }

  @Test
  void testArchivedToDraftIsRejected() {
    assertThrows(
        BadRequestException.class,
        () ->
            ContextMemoryRepository.validateStatusTransition(
                EntityStatus.ARCHIVED, EntityStatus.DRAFT));
  }

  @Test
  void testMemorySavedWithoutAStageMayTakeAnyMemoryStage() {
    ContextMemoryRepository.validateStatusTransition(null, EntityStatus.DRAFT);
    ContextMemoryRepository.validateStatusTransition(null, EntityStatus.ARCHIVED);
  }

  @Test
  void testMemoryIsCreatedOnlyInItsOwnStages() {
    ContextMemoryRepository.validateMemoryStage(null);
    ContextMemoryRepository.validateMemoryStage(EntityStatus.DRAFT);
    ContextMemoryRepository.validateMemoryStage(EntityStatus.APPROVED);
    ContextMemoryRepository.validateMemoryStage(EntityStatus.ARCHIVED);

    BadRequestException inReview =
        assertThrows(
            BadRequestException.class,
            () -> ContextMemoryRepository.validateMemoryStage(EntityStatus.IN_REVIEW));
    assertTrue(inReview.getMessage().contains("Invalid memory status"));
  }

  @Test
  void testSharedStagesOutsideTheMemoryLifecycleAreRejected() {
    BadRequestException toDeprecated =
        assertThrows(
            BadRequestException.class,
            () ->
                ContextMemoryRepository.validateStatusTransition(
                    EntityStatus.APPROVED, EntityStatus.DEPRECATED));
    assertTrue(toDeprecated.getMessage().contains("Invalid memory status transition"));

    BadRequestException fromInReview =
        assertThrows(
            BadRequestException.class,
            () ->
                ContextMemoryRepository.validateStatusTransition(
                    EntityStatus.IN_REVIEW, EntityStatus.APPROVED));
    assertTrue(fromInReview.getMessage().contains("No transitions defined"));
  }
}
