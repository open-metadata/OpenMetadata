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
    UUID changeEventId = uuidFromDbOrNull(rs.getString("change_event_id"), "change_event_id");
    UUID entityId = uuidFromDbOrNull(rs.getString("entity_id"), "entity_id");

    return AuditLogRecord.builder()
        .id(rs.getLong("id"))
        .changeEventId(changeEventId)
        .eventTs(rs.getLong("event_ts"))
        .eventType(rs.getString("event_type"))
        .userName(rs.getString("user_name"))
        .actorType(getActorTypeOrDefault(rs.getString("actor_type")))
        .impersonatedBy(rs.getString("impersonated_by"))
        .serviceName(rs.getString("service_name"))
        .entityType(rs.getString("entity_type"))
        .entityId(entityId)
        .entityFQN(rs.getString("entity_fqn"))
        .entityFQNHash(rs.getString("entity_fqn_hash"))
        .eventJson(rs.getString("event_json"))
        .createdAt(rs.getLong("created_at"))
        .build();
  }

  private String getActorTypeOrDefault(String value) {
    if (value == null || value.isBlank()) {
      return AuditLogRecord.ActorType.USER.name();
    }
    return value;
  }

  private static UUID uuidFromDbOrNull(String raw, String columnName) throws SQLException {
    if (raw == null) return null;

    String s = raw.trim();
    if (s.isEmpty()) return null;

    try {
      return UUID.fromString(s);
    } catch (IllegalArgumentException e) {
      throw new SQLException("Invalid UUID in column '" + columnName + "': '" + raw + "'", e);
    }
  }
}
