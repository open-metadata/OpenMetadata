package org.openmetadata.service.audit;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Represents the persisted audit log entry as stored in the database. UUIDs are stored as Strings
 * to ensure proper JDBI binding with @BindBean (JDBI's @BindUUID is not used with @BindBean).
 */
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AuditLogRecord {
  private Long id;
  private String changeEventId;
  private Long eventTs;
  private String eventType;
  private String userName;
  private String actorType;
  private String impersonatedBy;
  private String serviceName;
  private String entityType;
  private String entityId;
  private String entityFQN;
  private String entityFQNHash;
  private String eventJson;
  private Long createdAt;

  public enum ActorType {
    USER,
    BOT,
    AGENT
  }
}
