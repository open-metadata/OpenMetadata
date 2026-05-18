package org.openmetadata.service.resources.context;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import jakarta.ws.rs.BadRequestException;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.context.ContextMemoryStatus;
import org.openmetadata.service.jdbi3.ContextMemoryRepository;

class ContextMemoryStatusTransitionTest {

  @Test
  void testValidStatusTransitionsAreAccepted() {
    ContextMemoryRepository.validateStatusTransition(
        ContextMemoryStatus.DRAFT, ContextMemoryStatus.ACTIVE);
    ContextMemoryRepository.validateStatusTransition(
        ContextMemoryStatus.DRAFT, ContextMemoryStatus.ARCHIVED);
    ContextMemoryRepository.validateStatusTransition(
        ContextMemoryStatus.ACTIVE, ContextMemoryStatus.ARCHIVED);
    ContextMemoryRepository.validateStatusTransition(
        ContextMemoryStatus.ARCHIVED, ContextMemoryStatus.ACTIVE);
  }

  @Test
  void testNoOpStatusTransitionIsAccepted() {
    ContextMemoryRepository.validateStatusTransition(
        ContextMemoryStatus.ACTIVE, ContextMemoryStatus.ACTIVE);
    ContextMemoryRepository.validateStatusTransition(
        ContextMemoryStatus.DRAFT, ContextMemoryStatus.DRAFT);
  }

  @Test
  void testActiveToDraftIsRejected() {
    BadRequestException exception =
        assertThrows(
            BadRequestException.class,
            () ->
                ContextMemoryRepository.validateStatusTransition(
                    ContextMemoryStatus.ACTIVE, ContextMemoryStatus.DRAFT));
    assertTrue(exception.getMessage().contains("Invalid memory status transition"));
  }

  @Test
  void testArchivedToDraftIsRejected() {
    assertThrows(
        BadRequestException.class,
        () ->
            ContextMemoryRepository.validateStatusTransition(
                ContextMemoryStatus.ARCHIVED, ContextMemoryStatus.DRAFT));
  }
}
