package org.openmetadata.service.jdbi3;

import com.fasterxml.jackson.databind.JsonNode;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.util.UUID;
import org.jdbi.v3.core.mapper.RowMapper;
import org.jdbi.v3.core.statement.StatementContext;
import org.openmetadata.schema.utils.JsonUtils;

/**
 * JDBI Row mapper for DeletionLock entity
 */
public class DeletionLockMapper implements RowMapper<DeletionLock> {

  @Override
  public DeletionLock map(ResultSet rs, StatementContext ctx) throws SQLException {
    DeletionLock lock = new DeletionLock();

    lock.setId(UUID.fromString(rs.getString("id")));
    lock.setEntityId(UUID.fromString(rs.getString("entityId")));
    lock.setEntityType(rs.getString("entityType"));
    lock.setEntityFqn(rs.getString("entityFqn"));
    lock.setLockType(rs.getString("lockType"));
    lock.setLockedBy(rs.getString("lockedBy"));

    // Convert Timestamp to Instant
    Timestamp lockedAtTs = rs.getTimestamp("lockedAt");
    if (lockedAtTs != null) {
      lock.setLockedAt(lockedAtTs.toInstant());
    }

    Timestamp expectedCompletionTs = rs.getTimestamp("expectedCompletion");
    if (expectedCompletionTs != null) {
      lock.setExpectedCompletion(expectedCompletionTs.toInstant());
    }

    lock.setDeletionScope(rs.getString("deletionScope"));

    // Parse JSON metadata
    String metadataJson = rs.getString("metadata");
    if (metadataJson != null) {
      try {
        JsonNode metadata = JsonUtils.readTree(metadataJson);
        lock.setMetadata(metadata);
      } catch (Exception e) {
        // Log error but don't fail
      }
    }

    return lock;
  }
}
