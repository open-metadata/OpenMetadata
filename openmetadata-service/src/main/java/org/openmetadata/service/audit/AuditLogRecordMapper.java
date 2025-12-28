package org.openmetadata.service.audit;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.core.mapper.RowMapper;
import org.jdbi.v3.core.statement.StatementContext;

/** Row mapper for {@link AuditLogRecord}. */
@Slf4j
public class AuditLogRecordMapper implements RowMapper<AuditLogRecord> {

  @Override
  public AuditLogRecord map(ResultSet rs, StatementContext ctx) throws SQLException {
    return AuditLogRecord.builder()
        .id(rs.getLong("id"))
        .changeEventId(getUuid(rs, "change_event_id"))
        .eventTs(rs.getLong("event_ts"))
        .eventType(rs.getString("event_type"))
        .userName(rs.getString("user_name"))
        .actorType(getActorType(rs, "actor_type"))
        .impersonatedBy(rs.getString("impersonated_by"))
        .serviceName(rs.getString("service_name"))
        .entityType(rs.getString("entity_type"))
        .entityId(getUuid(rs, "entity_id"))
        .entityFQN(rs.getString("entity_fqn"))
        .entityFQNHash(rs.getString("entity_fqn_hash"))
        .eventJson(rs.getString("event_json"))
        .createdAt(rs.getLong("created_at"))
        .build();
  }

  private UUID getUuid(ResultSet rs, String column) throws SQLException {
    String value = rs.getString(column);
    if (value == null || value.isBlank()) {
      return null;
    }
    try {
      return UUID.fromString(value);
    } catch (IllegalArgumentException ex) {
      LOG.warn("Invalid UUID value '{}' for column '{}'", value, column, ex);
      return null;
    }
  }

  private AuditLogRecord.ActorType getActorType(ResultSet rs, String column) throws SQLException {
    String value = rs.getString(column);
    if (value == null || value.isBlank()) {
      return AuditLogRecord.ActorType.USER;
    }
    try {
      return AuditLogRecord.ActorType.valueOf(value);
    } catch (IllegalArgumentException ex) {
      LOG.warn("Invalid ActorType value '{}' for column '{}'", value, column);
      return AuditLogRecord.ActorType.USER;
    }
  }
}
