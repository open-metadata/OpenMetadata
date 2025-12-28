package org.openmetadata.service.audit;

import java.util.UUID;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** Represents the persisted audit log entry as stored in the database. */
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AuditLogRecord {
  private Long id;
  private UUID changeEventId;
  private Long eventTs;
  private String eventType;
  private String userName;
  private ActorType actorType;
  private String impersonatedBy;
  private String serviceName;
  private String entityType;
  private UUID entityId;
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
