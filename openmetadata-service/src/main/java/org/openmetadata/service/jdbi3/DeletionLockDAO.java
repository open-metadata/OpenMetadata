package org.openmetadata.service.jdbi3;

import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.jdbi.v3.sqlobject.config.RegisterRowMapper;
import org.jdbi.v3.sqlobject.customizer.Bind;
import org.jdbi.v3.sqlobject.customizer.BindBean;
import org.jdbi.v3.sqlobject.statement.SqlQuery;
import org.jdbi.v3.sqlobject.statement.SqlUpdate;
import org.openmetadata.service.util.jdbi.BindUUID;

/**
 * DAO for managing entity deletion locks to prevent concurrent modifications
 * during cascade deletion operations.
 */
@RegisterRowMapper(DeletionLockMapper.class)
public interface DeletionLockDAO {

  @SqlUpdate(
      "INSERT INTO entity_deletion_lock (id, entityId, entityType, entityFqn, lockType, "
          + "lockedBy, lockedAt, expectedCompletion, deletionScope, metadata) "
          + "VALUES (:id, :entityId, :entityType, :entityFqn, :lockType, "
          + ":lockedBy, :lockedAt, :expectedCompletion, :deletionScope, :metadata)")
  void insert(@BindBean DeletionLock lock);

  @SqlQuery(
      "SELECT * FROM entity_deletion_lock WHERE entityId = :entityId AND entityType = :entityType")
  DeletionLock findByEntity(
      @BindUUID("entityId") UUID entityId, @Bind("entityType") String entityType);

  @SqlQuery("SELECT * FROM entity_deletion_lock WHERE entityFqn LIKE :fqnPrefix || '%'")
  List<DeletionLock> findByFqnPrefix(@Bind("fqnPrefix") String fqnPrefix);

  @SqlQuery(
      "SELECT * FROM entity_deletion_lock WHERE "
          + "entityFqn = :fqn OR "
          + ":fqn LIKE entityFqn || '.%'")
  List<DeletionLock> findParentLocks(@Bind("fqn") String fqn);

  @SqlQuery("SELECT * FROM entity_deletion_lock WHERE lockedAt < :staleTime")
  List<DeletionLock> findStaleLocks(@Bind("staleTime") Instant staleTime);

  @SqlUpdate("DELETE FROM entity_deletion_lock WHERE id = :id")
  void delete(@BindUUID("id") UUID id);

  @SqlUpdate(
      "DELETE FROM entity_deletion_lock WHERE entityId = :entityId AND entityType = :entityType")
  void deleteByEntity(@BindUUID("entityId") UUID entityId, @Bind("entityType") String entityType);

  @SqlUpdate("DELETE FROM entity_deletion_lock WHERE lockedAt < :staleTime")
  int deleteStaleLocks(@Bind("staleTime") Instant staleTime);

  @SqlQuery("SELECT COUNT(*) FROM entity_deletion_lock")
  int countActiveLocks();

  @SqlQuery("SELECT COUNT(*) FROM entity_deletion_lock WHERE entityType = :entityType")
  int countActiveLocksByType(@Bind("entityType") String entityType);
}
