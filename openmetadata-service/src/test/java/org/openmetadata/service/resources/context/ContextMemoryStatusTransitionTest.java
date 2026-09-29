package org.openmetadata.service.resources.context;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import jakarta.ws.rs.BadRequestException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
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

  @Test
  void testLifecycleTransitionsFromActiveAreAccepted() {
    ContextMemoryRepository.validateStatusTransition(
        ContextMemoryStatus.ACTIVE, ContextMemoryStatus.SUPERSEDED);
    ContextMemoryRepository.validateStatusTransition(
        ContextMemoryStatus.ACTIVE, ContextMemoryStatus.INVALIDATED);
  }

  @ParameterizedTest
  @CsvSource({
    "Superseded,Active",
    "Superseded,Archived",
    "Invalidated,Active",
    "Invalidated,Archived"
  })
  void testSupersededAndInvalidatedCanBeRestoredOrArchived(String from, String to) {
    ContextMemoryRepository.validateStatusTransition(
        ContextMemoryStatus.fromValue(from), ContextMemoryStatus.fromValue(to));
  }

  @ParameterizedTest
  @CsvSource({
    "Draft,Superseded",
    "Draft,Invalidated",
    "Archived,Superseded",
    "Archived,Invalidated",
    "Superseded,Invalidated",
    "Invalidated,Superseded",
    "Superseded,Draft",
    "Invalidated,Draft"
  })
  void testTransitionsOutsideTheLifecycleTableAreRejected(String from, String to) {
    assertThrows(
        BadRequestException.class,
        () ->
            ContextMemoryRepository.validateStatusTransition(
                ContextMemoryStatus.fromValue(from), ContextMemoryStatus.fromValue(to)));
  }
}
