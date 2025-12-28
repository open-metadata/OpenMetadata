package org.openmetadata.service.audit;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;
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
      return;
    }
    try {
      String entityFqn = changeEvent.getEntityFullyQualifiedName();
      String entityFqnHash =
          nullOrEmpty(entityFqn) ? null : FullyQualifiedName.buildHash(entityFqn);

      AuditLogRecord.ActorType actorType = determineActorType(changeEvent.getUserName(), isBot);
      String serviceName = extractServiceName(entityFqn);

      AuditLogRecord record =
          AuditLogRecord.builder()
              .changeEventId(changeEvent.getId())
              .eventTs(
                  changeEvent.getTimestamp() != null
                      ? changeEvent.getTimestamp()
                      : System.currentTimeMillis())
              .eventType(changeEvent.getEventType().value())
              .userName(changeEvent.getUserName())
              .actorType(actorType)
              .impersonatedBy(changeEvent.getImpersonatedBy())
              .serviceName(serviceName)
              .entityType(changeEvent.getEntityType())
              .entityId(changeEvent.getEntityId())
              .entityFQN(entityFqn)
              .entityFQNHash(entityFqnHash)
              .eventJson(JsonUtils.pojoToJson(changeEvent))
              .createdAt(System.currentTimeMillis())
              .build();
      auditLogDAO.insert(record);
    } catch (Exception ex) {
      LOG.warn("Failed to persist audit log for change event {}", changeEvent.getId(), ex);
    }
  }

  private AuditLogRecord.ActorType determineActorType(String userName, boolean isBot) {
    if (!isBot) {
      return AuditLogRecord.ActorType.USER;
    }
    if (nullOrEmpty(userName)) {
      return AuditLogRecord.ActorType.BOT;
    }
    String lowerName = userName.toLowerCase();
    for (String indicator : AGENT_INDICATORS) {
      if (lowerName.contains(indicator)) {
        return AuditLogRecord.ActorType.AGENT;
      }
    }
    return AuditLogRecord.ActorType.BOT;
  }

  private String extractServiceName(String entityFqn) {
    if (nullOrEmpty(entityFqn)) {
      return null;
    }
    String[] parts = FullyQualifiedName.split(entityFqn);
    return parts.length > 0 ? parts[0] : null;
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
      String after) {
    if (!nullOrEmpty(after)) {
      RestUtil.validateCursors(null, after);
    }

    int limit = sanitizeLimit(limitParam);

    AuditLogCursor afterCursor = AuditLogCursor.fromEncoded(after);

    String baseCondition = buildBaseCondition();
    String cursorCondition = buildAfterCondition();
    String condition = baseCondition + cursorCondition;

    String entityFqnHash = nullOrEmpty(entityFqn) ? null : FullyQualifiedName.buildHash(entityFqn);

    List<AuditLogRecord> records =
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
            afterCursor != null ? afterCursor.eventTs : null,
            afterCursor != null ? afterCursor.id : null,
            limit + 1);

    boolean hasMore = records.size() > limit;
    if (hasMore) {
      records.remove(limit);
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

    List<AuditLogEntry> resultEntries = new ArrayList<>(records.size());
    for (AuditLogRecord record : records) {
      ChangeEvent changeEvent = null;
      try {
        changeEvent = JsonUtils.readValue(record.getEventJson(), ChangeEvent.class);
      } catch (Exception ex) {
        LOG.warn(
            "Failed to deserialize change event {} stored in audit log",
            record.getChangeEventId(),
            ex);
      }

      EntityReference resolvedReference = null;
      if (record.getEntityType() != null) {
        try {
          if (record.getEntityFQN() != null) {
            resolvedReference =
                Entity.getEntityReferenceByName(
                    record.getEntityType(), record.getEntityFQN(), Include.NON_DELETED);
          } else if (record.getEntityId() != null) {
            resolvedReference =
                Entity.getEntityReferenceById(
                    record.getEntityType(), record.getEntityId(), Include.NON_DELETED);
          }
        } catch (Exception lookupEx) {
          LOG.debug(
              "Failed to resolve entity reference for audit log record {} of type {}",
              record.getId(),
              record.getEntityType(),
              lookupEx);
        }
      }

      if (resolvedReference != null) {
        if (record.getEntityFQN() == null) {
          record.setEntityFQN(resolvedReference.getFullyQualifiedName());
        }
        if (changeEvent != null) {
          if (changeEvent.getEntityFullyQualifiedName() == null) {
            changeEvent.setEntityFullyQualifiedName(resolvedReference.getFullyQualifiedName());
          }
          if (changeEvent.getEntity() == null) {
            changeEvent.setEntity(resolvedReference);
          }
        }
      }

      resultEntries.add(
          AuditLogEntry.builder()
              .id(record.getId())
              .changeEventId(record.getChangeEventId())
              .eventTs(record.getEventTs())
              .eventType(record.getEventType())
              .userName(record.getUserName())
              .actorType(record.getActorType() != null ? record.getActorType().name() : "USER")
              .impersonatedBy(record.getImpersonatedBy())
              .serviceName(record.getServiceName())
              .entityType(record.getEntityType())
              .entityId(record.getEntityId())
              .entityFQN(record.getEntityFQN())
              .createdAt(record.getCreatedAt())
              .changeEvent(changeEvent)
              .build());
    }

    String afterCursorOut = null;
    if (!resultEntries.isEmpty() && hasMore) {
      AuditLogEntry last = resultEntries.get(resultEntries.size() - 1);
      afterCursorOut = AuditLogCursor.encode(last.getEventTs(), last.getId());
    }

    return new ResultList<>(resultEntries, null, afterCursorOut, total);
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

  private static final String ORDER_DESC = "ORDER BY event_ts DESC, id DESC";

  private int sanitizeLimit(int requested) {
    int limit = requested <= 0 ? 25 : requested;
    return Math.min(limit, MAX_PAGE_SIZE);
  }

  private static class AuditLogCursor {
    private final long eventTs;
    private final long id;

    private AuditLogCursor(long eventTs, long id) {
      this.eventTs = eventTs;
      this.id = id;
    }

    private static AuditLogCursor fromEncoded(String encoded) {
      if (nullOrEmpty(encoded)) {
        return null;
      }
      try {
        String decoded = RestUtil.decodeCursor(encoded);
        CursorPayload payload = JsonUtils.readValue(decoded, CursorPayload.class);
        return new AuditLogCursor(payload.getEventTs(), payload.getId());
      } catch (Exception ex) {
        LOG.warn("Failed to parse audit log cursor {}", encoded, ex);
        return null;
      }
    }

    private static String encode(Long eventTs, Long id) {
      if (eventTs == null || id == null) {
        return null;
      }
      CursorPayload payload = new CursorPayload(eventTs, id);
      try {
        return RestUtil.encodeCursor(JsonUtils.pojoToJson(payload));
      } catch (Exception ex) {
        LOG.warn("Failed to encode audit log cursor for ts {} id {}", eventTs, id, ex);
        return null;
      }
    }
  }

  private static class CursorPayload {
    private Long eventTs;
    private Long id;

    public CursorPayload() {}

    CursorPayload(Long eventTs, Long id) {
      this.eventTs = eventTs;
      this.id = id;
    }

    public Long getEventTs() {
      return eventTs;
    }

    public Long getId() {
      return id;
    }
  }
}
