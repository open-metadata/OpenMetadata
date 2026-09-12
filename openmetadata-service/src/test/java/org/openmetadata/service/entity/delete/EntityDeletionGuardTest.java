package org.openmetadata.service.entity.delete;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.openmetadata.service.Entity.TABLE;

import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.service.jdbi3.DeletionLock;
import org.openmetadata.service.jdbi3.DeletionLockDAO;
import org.openmetadata.service.lock.HierarchicalLockManager;

class EntityDeletionGuardTest {
  private final Map<UUID, DeletionLock> locks = new HashMap<>();
  private final Table entity =
      new Table().withId(UUID.randomUUID()).withFullyQualifiedName("service.db.schema.table");
  private HierarchicalLockManager manager;
  private boolean failInsert;
  private boolean failDelete;

  @BeforeEach
  void initialize() {
    final var dao = mock(DeletionLockDAO.class);
    when(dao.findByEntity(any(), anyString()))
        .thenAnswer(invocation -> locks.get(invocation.getArgument(0)));
    doAnswer(
            invocation -> {
              if (failInsert) {
                throw new IllegalStateException("Lock storage unavailable");
              }
              final DeletionLock lock = invocation.getArgument(0);
              locks.put(lock.getEntityId(), lock);
              return null;
            })
        .when(dao)
        .insert(any());
    doAnswer(
            invocation -> {
              if (failDelete) {
                throw new IllegalStateException("Lock storage unavailable");
              }
              locks.values().removeIf(lock -> lock.getId().equals(invocation.getArgument(0)));
              return null;
            })
        .when(dao)
        .delete(any());
    manager = new HierarchicalLockManager(dao);
  }

  @Test
  void recursiveScopeHoldsTheOperatorLockUntilClose() {
    try (var ignored = acquire(true)) {
      assertEquals("editor", locks.get(entity.getId()).getLockedBy());
      assertEquals(
          DeletionLock.DeletionScope.CASCADE.getValue(),
          locks.get(entity.getId()).getDeletionScope());
    }
    assertTrue(locks.isEmpty());
  }

  @Test
  void directDeletionDoesNotAcquireALock() {
    acquire(false).close();
    assertTrue(locks.isEmpty());
  }

  @Test
  void absentManagerPreservesUnlockedDeletion() {
    manager = null;
    acquire(true).close();
    assertTrue(locks.isEmpty());
  }

  @Test
  void failedAcquisitionRetainsTheExistingBestEffortContract() {
    failInsert = true;
    assertDoesNotThrow(() -> acquire(true).close());
    assertTrue(locks.isEmpty());
  }

  @Test
  void failedReleaseDoesNotReplaceTheDeletionResult() {
    final var scope = acquire(true);
    failDelete = true;
    assertDoesNotThrow(scope::close);
    assertEquals(1, locks.size());
  }

  @Test
  void managerRemovedDuringDeletionDoesNotFailClose() {
    final var scope = acquire(true);
    manager = null;
    assertDoesNotThrow(scope::close);
  }

  private EntityDeletionService.Scope acquire(boolean recursive) {
    return new EntityDeletionGuard(TABLE, () -> manager)
        .acquire(entity, new EntityDeletionService.Request("editor", recursive, true));
  }
}
