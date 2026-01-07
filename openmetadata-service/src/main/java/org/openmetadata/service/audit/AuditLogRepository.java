package org.openmetadata.service.audit;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import java.util.List;
import java.util.Set;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EventType;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.util.FullyQualifiedName;
import org.openmetadata.service.util.RestUtil;

/** Repository for reading and writing audit log entries. */
@Slf4j
public class AuditLogRepository {
  private static final int MAX_PAGE_SIZE = 200;

  private static final Set<EventType> SUPPORTED_EVENT_TYPES =
      Set.of(
          EventType.ENTITY_CREATED,
          EventType.ENTITY_UPDATED,
          EventType.ENTITY_FIELDS_CHANGED,
          EventType.ENTITY_SOFT_DELETED,
          EventType.ENTITY_DELETED,
          EventType.ENTITY_RESTORED);

  private static final Set<String> AGENT_INDICATORS =
      Set.of("agent", "documentation", "classification", "automator");

  private final CollectionDAO.AuditLogDAO auditLogDAO;

  public AuditLogRepository(CollectionDAO daoCollection) {
    this.auditLogDAO = daoCollection.auditLogDAO();
  }

  public void write(ChangeEvent changeEvent) {
    write(changeEvent, false);
  }

  public void write(ChangeEvent changeEvent, boolean isBot) {
    if (!SUPPORTED_EVENT_TYPES.contains(changeEvent.getEventType())) {
      LOG.debug(
          "Skipping unsupported event type {} for change event {}",
          changeEvent.getEventType(),
          changeEvent.getId());
      return;
    }
    UUID changeEventId = changeEvent.getId();
    if (changeEventId == null) {
      LOG.warn(
          "Skipping change event with null ID: type={}, entityType={}",
          changeEvent.getEventType(),
          changeEvent.getEntityType());
      return;
    }

    LOG.debug(
        "Writing audit log for change event {} type {} entity {}",
        changeEventId,
        changeEvent.getEventType(),
        changeEvent.getEntityType());
    try {
      String entityFqn = changeEvent.getEntityFullyQualifiedName();
      String entityFqnHash =
          nullOrEmpty(entityFqn) ? null : FullyQualifiedName.buildHash(entityFqn);

      AuditLogRecord.ActorType actorType = determineActorType(changeEvent.getUserName(), isBot);
      String serviceName = extractServiceName(entityFqn);

      AuditLogRecord record =
          AuditLogRecord.builder()
              .changeEventId(changeEventId)
              .eventTs(
                  changeEvent.getTimestamp() != null
                      ? changeEvent.getTimestamp()
                      : System.currentTimeMillis())
              .eventType(changeEvent.getEventType().value())
              .userName(changeEvent.getUserName())
              .actorType(actorType.name())
              .impersonatedBy(changeEvent.getImpersonatedBy())
              .serviceName(serviceName)
              .entityType(changeEvent.getEntityType())
              .entityId(changeEvent.getEntityId())
              .entityFQN(entityFqn)
              .entityFQNHash(entityFqnHash)
              .eventJson(JsonUtils.pojoToJson(changeEvent))
              .createdAt(System.currentTimeMillis())
              .build();
      LOG.debug(
          "Inserting audit log record: changeEventId={}, actorType={}, entityType={}, entityId={}",
          record.getChangeEventId(),
          record.getActorType(),
          record.getEntityType(),
          record.getEntityId());
      auditLogDAO.insert(record);
      LOG.debug("Successfully inserted audit log for change event {}", changeEvent.getId());
    } catch (Exception ex) {
      LOG.warn("Failed to persist audit log for change event {}", changeEvent.getId(), ex);
    }
  }

  /** Auth event type constants for login/logout - not part of ChangeEvent types */
  public static final String AUTH_EVENT_LOGIN = "userLogin";

  public static final String AUTH_EVENT_LOGOUT = "userLogout";

  /**
   * Write an authentication event (login/logout) directly to the audit log. This method runs
   * asynchronously using a virtual thread (Java 21) to ensure login/logout operations are never
   * blocked or impacted by audit log writes. Virtual threads are ideal for I/O-bound operations
   * like DB writes. Any write failures are logged but do not affect the caller.
   */
  public void writeAuthEvent(String eventType, String userName, UUID userId) {
    // Use virtual thread for async I/O-bound DB write - lightweight and doesn't block platform
    // threads
    Thread.startVirtualThread(
        () -> {
          try {
            long now = System.currentTimeMillis();
            AuditLogRecord record =
                AuditLogRecord.builder()
                    .changeEventId(UUID.randomUUID())
                    .eventTs(now)
                    .eventType(eventType)
                    .userName(userName)
                    .actorType(AuditLogRecord.ActorType.USER.name())
                    .entityType(Entity.USER)
                    .entityId(userId)
                    .createdAt(now)
                    .build();
            auditLogDAO.insert(record);
            LOG.debug("Recorded auth event {} for user {}", eventType, userName);
          } catch (Exception ex) {
            LOG.warn("Failed to persist auth audit log for user {}", userName, ex);
          }
        });
  }

  /** Determine actor type from username pattern - agents, bots, or regular users. */
  private AuditLogRecord.ActorType determineActorType(String userName, boolean isBot) {
    if (nullOrEmpty(userName)) {
      return isBot ? AuditLogRecord.ActorType.BOT : AuditLogRecord.ActorType.USER;
    }
    String lowerName = userName.toLowerCase();
    // Check for AI agent patterns first (documentation-agent, auto-classification, etc.)
    for (String indicator : AGENT_INDICATORS) {
      if (lowerName.contains(indicator)) {
        return AuditLogRecord.ActorType.AGENT;
      }
    }
    // Check for bot patterns (ingestion-bot, metadata-bot, etc.)
    if (lowerName.endsWith("-bot") || lowerName.endsWith("_bot") || lowerName.equals("bot")) {
      return AuditLogRecord.ActorType.BOT;
    }
    // Explicit isBot flag from caller (e.g., auth context)
    if (isBot) {
      return AuditLogRecord.ActorType.BOT;
    }
    return AuditLogRecord.ActorType.USER;
  }

  private String extractServiceName(String entityFqn) {
    if (nullOrEmpty(entityFqn)) {
      return null;
    }
    String[] parts = FullyQualifiedName.split(entityFqn);
    return parts.length > 0 ? parts[0] : null;
  }

  private UUID parseUuid(String value) {
    if (nullOrEmpty(value)) {
      return null;
    }
    try {
      return UUID.fromString(value);
    } catch (IllegalArgumentException ex) {
      LOG.warn("Invalid UUID value: {}", value);
      return null;
    }
  }

  public ResultList<AuditLogEntry> list(
      String userName,
      String actorType,
      String serviceName,
      String entityType,
      String entityFqn,
      String eventType,
      Long startTs,
      Long endTs,
      int limitParam,
      String before,
      String after) {
    RestUtil.validateCursors(before, after);

    int limit = sanitizeLimit(limitParam);

    AuditLogCursor beforeCursor = AuditLogCursor.fromEncoded(before);
    AuditLogCursor afterCursor = AuditLogCursor.fromEncoded(after);

    String baseCondition = buildBaseCondition();
    String entityFqnHash = nullOrEmpty(entityFqn) ? null : FullyQualifiedName.buildHash(entityFqn);

    List<AuditLogRecord> records;
    boolean isBackward = beforeCursor != null;

    if (isBackward) {
      // Backward pagination: get records before the cursor (newer records)
      String cursorCondition = buildBeforeCondition();
      String condition = baseCondition + cursorCondition;

      records =
          auditLogDAO.list(
              condition,
              ORDER_ASC,
              userName,
              actorType,
              serviceName,
              entityType,
              entityFqn,
              entityFqnHash,
              eventType,
              startTs,
              endTs,
              beforeCursor.eventTs(),
              beforeCursor.id(),
              limit + 1);

      // Reverse to maintain consistent DESC ordering in response
      records = new java.util.ArrayList<>(records);
      java.util.Collections.reverse(records);
    } else {
      // Forward pagination: get records after the cursor (older records)
      String cursorCondition = buildAfterCondition();
      String condition = baseCondition + cursorCondition;

      records =
          auditLogDAO.list(
              condition,
              ORDER_DESC,
              userName,
              actorType,
              serviceName,
              entityType,
              entityFqn,
              entityFqnHash,
              eventType,
              startTs,
              endTs,
              afterCursor != null ? afterCursor.eventTs() : null,
              afterCursor != null ? afterCursor.id() : null,
              limit + 1);
    }

    boolean hasMore = records.size() > limit;
    if (hasMore) {
      if (isBackward) {
        // For backward pagination, remove from the beginning (oldest of the fetched newer records)
        records.remove(0);
      } else {
        // For forward pagination, remove from the end (oldest record)
        records.remove(limit);
      }
    }

    int total =
        auditLogDAO.count(
            baseCondition,
            userName,
            actorType,
            serviceName,
            entityType,
            entityFqn,
            entityFqnHash,
            eventType,
            startTs,
            endTs);

    List<AuditLogEntry> resultEntries = records.stream().map(this::toAuditLogEntry).toList();

    // Compute cursors for navigation
    String beforeCursorOut = null;
    String afterCursorOut = null;

    if (!resultEntries.isEmpty()) {
      AuditLogEntry first = resultEntries.get(0);
      AuditLogEntry last = resultEntries.get(resultEntries.size() - 1);

      // Before cursor points to the first (newest) record for backward navigation
      if (afterCursor != null || isBackward) {
        beforeCursorOut = AuditLogCursor.encode(first.getEventTs(), first.getId());
      }

      // After cursor points to the last (oldest) record for forward navigation
      if (hasMore || isBackward) {
        afterCursorOut = AuditLogCursor.encode(last.getEventTs(), last.getId());
      }
    }

    return new ResultList<>(resultEntries, beforeCursorOut, afterCursorOut, total);
  }

  private AuditLogEntry toAuditLogEntry(AuditLogRecord record) {
    ChangeEvent changeEvent = deserializeChangeEvent(record);
    EntityReference resolvedRef = resolveEntityReference(record);

    enrichWithResolvedReference(record, changeEvent, resolvedRef);

    return AuditLogEntry.builder()
        .id(record.getId())
        .changeEventId(record.getChangeEventId())
        .eventTs(record.getEventTs())
        .eventType(record.getEventType())
        .userName(record.getUserName())
        .actorType(record.getActorType() != null ? record.getActorType() : "USER")
        .impersonatedBy(record.getImpersonatedBy())
        .serviceName(record.getServiceName())
        .entityType(record.getEntityType())
        .entityId(record.getEntityId())
        .entityFQN(record.getEntityFQN())
        .createdAt(record.getCreatedAt())
        .changeEvent(changeEvent)
        .build();
  }

  private ChangeEvent deserializeChangeEvent(AuditLogRecord record) {
    if (nullOrEmpty(record.getEventJson())) {
      return null;
    }
    try {
      return JsonUtils.readValue(record.getEventJson(), ChangeEvent.class);
    } catch (Exception ex) {
      LOG.warn(
          "Failed to deserialize change event {} stored in audit log",
          record.getChangeEventId(),
          ex);
      return null;
    }
  }

  private EntityReference resolveEntityReference(AuditLogRecord record) {
    if (record.getEntityType() == null) {
      return null;
    }
    try {
      if (record.getEntityFQN() != null) {
        return Entity.getEntityReferenceByName(
            record.getEntityType(), record.getEntityFQN(), Include.NON_DELETED);
      } else if (record.getEntityId() != null) {
        return Entity.getEntityReferenceById(
            record.getEntityType(), record.getEntityId(), Include.NON_DELETED);
      }
    } catch (Exception ex) {
      LOG.debug(
          "Failed to resolve entity reference for audit log record {} of type {}",
          record.getId(),
          record.getEntityType(),
          ex);
    }
    return null;
  }

  private void enrichWithResolvedReference(
      AuditLogRecord record, ChangeEvent changeEvent, EntityReference resolvedRef) {
    if (resolvedRef == null) {
      return;
    }
    if (record.getEntityFQN() == null) {
      record.setEntityFQN(resolvedRef.getFullyQualifiedName());
    }
    if (changeEvent != null) {
      if (changeEvent.getEntityFullyQualifiedName() == null) {
        changeEvent.setEntityFullyQualifiedName(resolvedRef.getFullyQualifiedName());
      }
      if (changeEvent.getEntity() == null) {
        changeEvent.setEntity(resolvedRef);
      }
    }
  }

  private String buildBaseCondition() {
    return "WHERE (:userName IS NULL OR user_name = :userName) "
        + "AND (:actorType IS NULL OR actor_type = :actorType) "
        + "AND (:serviceName IS NULL OR service_name = :serviceName) "
        + "AND (:entityType IS NULL OR entity_type = :entityType) "
        + "AND (:entityFQN IS NULL OR entity_fqn = :entityFQN) "
        + "AND (:entityFQNHASH IS NULL OR entity_fqn_hash = :entityFQNHASH) "
        + "AND (:eventType IS NULL OR event_type = :eventType) "
        + "AND (:startTs IS NULL OR event_ts >= :startTs) "
        + "AND (:endTs IS NULL OR event_ts <= :endTs)";
  }

  private String buildAfterCondition() {
    return " AND (:afterEventTs IS NULL OR event_ts < :afterEventTs "
        + "OR (event_ts = :afterEventTs AND id < :afterId))";
  }

  private String buildBeforeCondition() {
    return " AND (event_ts > :afterEventTs OR (event_ts = :afterEventTs AND id > :afterId))";
  }

  private static final String ORDER_DESC = "ORDER BY event_ts DESC, id DESC";
  private static final String ORDER_ASC = "ORDER BY event_ts ASC, id ASC";

  private int sanitizeLimit(int requested) {
    int limit = requested <= 0 ? 25 : requested;
    return Math.min(limit, MAX_PAGE_SIZE);
  }

  /** Cursor for keyset pagination - uses Java 21 record for immutability and conciseness. */
  private record AuditLogCursor(long eventTs, long id) {
    static AuditLogCursor fromEncoded(String encoded) {
      if (nullOrEmpty(encoded)) {
        return null;
      }
      try {
        String decoded = RestUtil.decodeCursor(encoded);
        CursorPayload payload = JsonUtils.readValue(decoded, CursorPayload.class);
        return new AuditLogCursor(payload.eventTs(), payload.id());
      } catch (Exception ex) {
        LOG.warn("Failed to parse audit log cursor {}", encoded, ex);
        return null;
      }
    }

    static String encode(Long eventTs, Long id) {
      if (eventTs == null || id == null) {
        return null;
      }
      try {
        return RestUtil.encodeCursor(JsonUtils.pojoToJson(new CursorPayload(eventTs, id)));
      } catch (Exception ex) {
        LOG.warn("Failed to encode audit log cursor for ts {} id {}", eventTs, id, ex);
        return null;
      }
    }
  }

  /** JSON payload for cursor serialization - uses Java 21 record. */
  private record CursorPayload(Long eventTs, Long id) {}
}
