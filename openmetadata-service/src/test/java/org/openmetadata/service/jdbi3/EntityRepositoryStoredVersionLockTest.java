package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.service.exception.PreconditionFailedException;

/**
 * A version-checked store that first applies side effects outside the database (an external
 * secrets-manager write) must reject a stale expected version before those side effects are
 * applied, or a losing pair of overlapping If-Match PATCHes still mutates the credential the
 * winner keeps.
 */
class EntityRepositoryStoredVersionLockTest {
  private static final UUID ENTITY_ID = UUID.randomUUID();

  @Test
  void aSavedVersionDifferentFromTheExpectedOneIsRejectedWithoutLockRelease() {
    EntityDAO<?> dao = entityDaoReturningStoredJson("{\"version\":1.1}");
    assertThrows(
        PreconditionFailedException.class,
        () -> EntityRepository.assertLockedStoredVersion(dao, ENTITY_ID, 1.0));
  }

  @Test
  void theExpectedVersionPassesTheAssert() {
    EntityDAO<?> dao = entityDaoReturningStoredJson("{\"version\":1.0}");
    assertDoesNotThrow(() -> EntityRepository.assertLockedStoredVersion(dao, ENTITY_ID, 1.0));
  }

  @Test
  void aRowThatIsGoneIsLeftToTheStoreThatFollows() {
    EntityDAO<?> dao = entityDaoReturningStoredJson(null);
    assertDoesNotThrow(() -> EntityRepository.assertLockedStoredVersion(dao, ENTITY_ID, 1.0));
  }

  private EntityDAO<?> entityDaoReturningStoredJson(String savedJson) {
    @SuppressWarnings("unchecked")
    EntityDAO<User> dao = mock(EntityDAO.class);
    when(dao.getTableName()).thenReturn("user_entity");
    when(dao.findByIdForUpdate("user_entity", ENTITY_ID, "")).thenReturn(savedJson);
    return dao;
  }
}
