package org.openmetadata.service.audit;

import java.util.UUID;
import lombok.Builder;
import lombok.Getter;
import lombok.Setter;
import org.openmetadata.schema.type.ChangeEvent;

/** API response model for audit log entries enriched with the original {@link ChangeEvent}. */
@Getter
@Setter
@Builder
public class AuditLogEntry {
  private Long id;
  private UUID changeEventId;
  private Long eventTs;
  private String eventType;
  private String userName;
  private String actorType;
  private String impersonatedBy;
  private String serviceName;
  private String entityType;
  private UUID entityId;
  private String entityFQN;
  private Long createdAt;
  private ChangeEvent changeEvent;

  /** Human-readable summary of the change event (computed at query time, not stored). */
  private String summary;

  /**
   * Raw JSON of the change event as stored in the database. This is provided as a fallback when
   * {@link #changeEvent} deserialization fails or when the frontend needs the raw payload.
   */
  private String rawEventJson;
}
