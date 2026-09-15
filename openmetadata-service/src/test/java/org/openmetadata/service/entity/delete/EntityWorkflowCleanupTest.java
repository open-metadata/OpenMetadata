package org.openmetadata.service.entity.delete;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.service.util.PostCommitActionQueue;

class EntityWorkflowCleanupTest {
  private final List<UUID> cancelled = new ArrayList<>();

  @AfterEach
  void clear() {
    PostCommitActionQueue.clear();
  }

  @Test
  void cancellationWaitsForCommitAndUsesAnIndependentIdSnapshot() {
    final UUID id = UUID.randomUUID();
    final List<UUID> ids = new ArrayList<>(List.of(id));
    PostCommitActionQueue.begin();
    service(true).cancel(ids);
    ids.clear();
    assertTrue(cancelled.isEmpty());
    PostCommitActionQueue.run(PostCommitActionQueue.drain());
    assertEquals(List.of(id), cancelled);
  }

  @Test
  void rollbackDiscardsCancellationAndReleasesTheRequestScope() {
    PostCommitActionQueue.begin();
    service(true).cancel(List.of(UUID.randomUUID()));
    PostCommitActionQueue.clear();
    assertTrue(cancelled.isEmpty());
    final UUID committed = UUID.randomUUID();
    service(true).cancel(List.of(committed));
    assertEquals(List.of(committed), cancelled);
  }

  @Test
  void disabledWorkflowEngineAndEmptyInputsDoNotRunCancellation() {
    service(false).cancel(List.of(UUID.randomUUID()));
    service(true).cancel(List.of());
    service(true).cancel(null);
    assertTrue(cancelled.isEmpty());
  }

  @Test
  void workflowEngineFailureDoesNotFailTheCommittedEntityDeletion() {
    final var service =
        new EntityWorkflowCleanup(
            () -> true,
            ids -> {
              throw new IllegalStateException("Workflow engine unavailable");
            },
            PostCommitActionQueue::runOrDefer);
    assertDoesNotThrow(() -> service.cancel(List.of(UUID.randomUUID())));
  }

  private EntityWorkflowCleanup service(boolean initialized) {
    return new EntityWorkflowCleanup(
        () -> initialized, cancelled::addAll, PostCommitActionQueue::runOrDefer);
  }
}
