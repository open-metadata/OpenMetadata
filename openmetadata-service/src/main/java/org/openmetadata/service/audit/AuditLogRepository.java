package org.openmetadata.service.audit;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.service.formatter.field.DefaultFieldFormatter.getFieldValue;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EventType;
import org.openmetadata.schema.type.FieldChange;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.util.AsyncService;
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
          EventType.ENTITY_RESTORED,
          EventType.USER_LOGIN,
          EventType.USER_LOGOUT);

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
              .changeEventId(changeEventId.toString())
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
              .entityId(
                  changeEvent.getEntityId() != null ? changeEvent.getEntityId().toString() : null)
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

  public static final EventType AUTH_EVENT_LOGIN = EventType.USER_LOGIN;
  public static final EventType AUTH_EVENT_LOGOUT = EventType.USER_LOGOUT;

  /**
   * Write an authentication event (login/logout) to the audit log. Constructs a proper
   * ChangeEvent and delegates to {@link #write(ChangeEvent)} so that event_json is always
   * populated. Runs asynchronously using a virtual thread to avoid blocking the caller.
   */
  public void writeAuthEvent(EventType eventType, String userName, UUID userId) {
    AsyncService.getInstance()
        .execute(
            () -> {
              ChangeEvent changeEvent =
                  new ChangeEvent()
                      .withId(UUID.randomUUID())
                      .withEventType(eventType)
                      .withEntityType(Entity.USER)
                      .withEntityId(userId)
                      .withUserName(userName)
                      .withTimestamp(System.currentTimeMillis());
              write(changeEvent);
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

  private static final int EXPORT_BATCH_SIZE = 1000;
  private static final long EXPORT_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes timeout

  /** Functional interface for export progress callbacks. */
  @FunctionalInterface
  public interface ExportProgressCallback {
    void onProgress(int fetched, int total, String message);
  }

  /**
   * Export audit logs in batches to avoid long-running queries that could cause resource
   * contention with concurrent writes. Uses cursor-based pagination for efficient batching.
   *
   * @param progressCallback Optional callback for progress notifications (can be null)
   */
  public List<AuditLogEntry> exportInBatches(
      String userName,
      String actorType,
      String serviceName,
      String entityType,
      String eventType,
      Long startTs,
      Long endTs,
      String searchTerm,
      int totalLimit,
      ExportProgressCallback progressCallback) {

    long startTime = System.currentTimeMillis();
    List<AuditLogEntry> allResults = new ArrayList<>();
    String afterCursor = null;
    int remaining = totalLimit;

    // Get total count for progress reporting
    String baseCondition = buildBaseCondition(searchTerm);
    String entityFqnHash = null;
    String searchPattern = nullOrEmpty(searchTerm) ? null : "%" + searchTerm.toLowerCase() + "%";
    int estimatedTotal =
        auditLogDAO.count(
            baseCondition,
            userName,
            actorType,
            serviceName,
            entityType,
            null,
            entityFqnHash,
            eventType,
            startTs,
            endTs,
            searchPattern);
    int actualTotal = Math.min(estimatedTotal, totalLimit);

    // Send initial progress
    if (progressCallback != null) {
      progressCallback.onProgress(0, actualTotal, "Starting export...");
    }

    int batchNumber = 0;
    while (remaining > 0) {
      // Check timeout
      if (System.currentTimeMillis() - startTime > EXPORT_TIMEOUT_MS) {
        LOG.warn(
            "Export timed out after {} ms, returning {} records fetched so far",
            EXPORT_TIMEOUT_MS,
            allResults.size());
        break;
      }

      int batchSize = Math.min(EXPORT_BATCH_SIZE, remaining);

      ResultList<AuditLogEntry> batch =
          list(
              userName,
              actorType,
              serviceName,
              entityType,
              null, // entityFqn
              eventType,
              startTs,
              endTs,
              searchTerm,
              batchSize,
              null, // before
              afterCursor);

      if (batch.getData().isEmpty()) {
        break;
      }

      allResults.addAll(batch.getData());
      remaining -= batch.getData().size();
      batchNumber++;

      // Send progress update every batch
      if (progressCallback != null) {
        String message =
            String.format(
                "Fetched %d of %d records (batch %d)", allResults.size(), actualTotal, batchNumber);
        progressCallback.onProgress(allResults.size(), actualTotal, message);
      }

      // Get cursor for next batch
      afterCursor = batch.getPaging().getAfter();
      if (afterCursor == null) {
        break;
      }
    }

    return allResults;
  }

  /**
   * Export audit logs in batches without progress callback (backwards compatibility).
   */
  public List<AuditLogEntry> exportInBatches(
      String userName,
      String actorType,
      String serviceName,
      String entityType,
      String eventType,
      Long startTs,
      Long endTs,
      String searchTerm,
      int totalLimit) {
    return exportInBatches(
        userName,
        actorType,
        serviceName,
        entityType,
        eventType,
        startTs,
        endTs,
        searchTerm,
        totalLimit,
        null);
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
      String searchTerm,
      int limitParam,
      String before,
      String after) {
    RestUtil.validateCursors(before, after);

    int limit = sanitizeLimit(limitParam);

    AuditLogCursor beforeCursor = AuditLogCursor.fromEncoded(before);
    AuditLogCursor afterCursor = AuditLogCursor.fromEncoded(after);

    String baseCondition = buildBaseCondition(searchTerm);
    String entityFqnHash = nullOrEmpty(entityFqn) ? null : FullyQualifiedName.buildHash(entityFqn);
    // Lowercase the search pattern for case-insensitive matching (works with LOWER() in SQL)
    String searchPattern = nullOrEmpty(searchTerm) ? null : "%" + searchTerm.toLowerCase() + "%";

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
              searchPattern,
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
              searchPattern,
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
            endTs,
            searchPattern);

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
        .changeEventId(parseUuid(record.getChangeEventId()))
        .eventTs(record.getEventTs())
        .eventType(record.getEventType())
        .userName(record.getUserName())
        .actorType(record.getActorType() != null ? record.getActorType() : "USER")
        .impersonatedBy(record.getImpersonatedBy())
        .serviceName(record.getServiceName())
        .entityType(record.getEntityType())
        .entityId(parseUuid(record.getEntityId()))
        .entityFQN(record.getEntityFQN())
        .createdAt(record.getCreatedAt())
        .changeEvent(changeEvent)
        .summary(computeSummary(changeEvent, record))
        .rawEventJson(record.getEventJson())
        .build();
  }

  /** Compute a human-readable summary of the change event. */
  private String computeSummary(ChangeEvent changeEvent, AuditLogRecord record) {
    if (changeEvent == null) {
      return formatAuthEventSummary(record);
    }

    EventType eventType = changeEvent.getEventType();
    String entityType = changeEvent.getEntityType();
    String entityFqn = changeEvent.getEntityFullyQualifiedName();

    switch (eventType) {
      case ENTITY_CREATED:
        return String.format("Created %s: %s", entityType, entityFqn);
      case ENTITY_DELETED:
        return String.format("Deleted %s: %s", entityType, entityFqn);
      case ENTITY_SOFT_DELETED:
        return String.format("Soft deleted %s: %s", entityType, entityFqn);
      case ENTITY_RESTORED:
        return String.format("Restored %s: %s", entityType, entityFqn);
      case ENTITY_UPDATED:
      case ENTITY_FIELDS_CHANGED:
        return formatChangeDescription(changeEvent.getChangeDescription());
      case USER_LOGIN:
        return "User logged in";
      case USER_LOGOUT:
        return "User logged out";
      default:
        return eventType.value();
    }
  }

  private String formatAuthEventSummary(AuditLogRecord record) {
    String eventType = record.getEventType();
    if (AUTH_EVENT_LOGIN.value().equals(eventType)) {
      return "User logged in";
    } else if (AUTH_EVENT_LOGOUT.value().equals(eventType)) {
      return "User logged out";
    }
    return eventType;
  }

  private String formatChangeDescription(ChangeDescription desc) {
    if (desc == null) {
      return "Entity updated";
    }

    List<String> changes = new ArrayList<>();

    for (FieldChange field : desc.getFieldsAdded()) {
      changes.add(formatFieldChange("Added", field));
    }
    for (FieldChange field : desc.getFieldsUpdated()) {
      changes.add(formatFieldChange("Updated", field));
    }
    for (FieldChange field : desc.getFieldsDeleted()) {
      changes.add(formatFieldChange("Deleted", field));
    }

    if (changes.isEmpty()) {
      return "Entity updated";
    }
    return String.join(", ", changes);
  }

  private String formatFieldChange(String action, FieldChange field) {
    String fieldName = getReadableFieldName(field.getName());
    String value = extractFieldValue(field);
    if (nullOrEmpty(value)) {
      return String.format("%s %s", action, fieldName);
    }
    return String.format("%s %s: %s", action, fieldName, value);
  }

  private String getReadableFieldName(String fieldName) {
    if (nullOrEmpty(fieldName)) {
      return "field";
    }
    // Handle nested field names like "columns.description" or "tags"
    if (fieldName.contains(".")) {
      String[] parts = fieldName.split("\\.");
      return parts[parts.length - 1];
    }
    return fieldName;
  }

  /**
   * Extract a human-readable value from a field change. Reuses the existing formatting logic from
   * {@link org.openmetadata.service.formatter.field.DefaultFieldFormatter#getFieldValue}.
   */
  private String extractFieldValue(FieldChange field) {
    Object newValue = field.getNewValue();
    Object oldValue = field.getOldValue();

    // For deletes, use oldValue since newValue will be empty
    Object value = newValue != null ? newValue : oldValue;
    if (value == null) {
      return null;
    }

    // Reuse the existing formatter logic that handles tags, entity references, etc.
    String formattedValue = getFieldValue(value);
    if (nullOrEmpty(formattedValue)) {
      return null;
    }

    // Truncate long values for summary display
    if (formattedValue.length() > 80) {
      return formattedValue.substring(0, 77) + "...";
    }
    return formattedValue;
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
        UUID entityId = parseUuid(record.getEntityId());
        if (entityId != null) {
          return Entity.getEntityReferenceById(
              record.getEntityType(), entityId, Include.NON_DELETED);
        }
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

  private String buildBaseCondition(String searchTerm) {
    StringBuilder condition =
        new StringBuilder(
            "WHERE (:userName IS NULL OR user_name = :userName) "
                + "AND (:actorType IS NULL OR actor_type = :actorType) "
                + "AND (:serviceName IS NULL OR service_name = :serviceName) "
                + "AND (:entityType IS NULL OR entity_type = :entityType) "
                + "AND (:entityFQN IS NULL OR entity_fqn = :entityFQN) "
                + "AND (:entityFQNHASH IS NULL OR entity_fqn_hash = :entityFQNHASH) "
                + "AND (:eventType IS NULL OR event_type = :eventType) "
                + "AND (:startTs IS NULL OR event_ts >= :startTs) "
                + "AND (:endTs IS NULL OR event_ts <= :endTs)");

    // Add search condition if searchTerm is provided
    // Uses LOWER() + LIKE for case-insensitive search across multiple columns
    // Works consistently on both MySQL and PostgreSQL
    if (!nullOrEmpty(searchTerm)) {
      condition.append(
          " AND (:searchPattern IS NULL OR "
              + "LOWER(user_name) LIKE :searchPattern OR "
              + "LOWER(entity_fqn) LIKE :searchPattern OR "
              + "LOWER(service_name) LIKE :searchPattern OR "
              + "LOWER(entity_type) LIKE :searchPattern OR "
              + "LOWER(event_json) LIKE :searchPattern)");
    }
    return condition.toString();
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
    /**
     * Decode an encoded cursor string, handling potential double-encoding issues. The method is
     * robust against: - Single base64 encoding (normal case) - Double base64 encoding (can happen
     * in some API chains) - Invalid/corrupted cursors (returns null instead of throwing)
     */
    static AuditLogCursor fromEncoded(String encoded) {
      if (nullOrEmpty(encoded)) {
        return null;
      }
      try {
        String decoded = encoded;

        // Try to decode and parse, handling potential double-encoding
        // Maximum 3 decode attempts to prevent infinite loops with malformed data
        for (int attempt = 0; attempt < 3; attempt++) {
          // First, try to parse as JSON directly
          CursorPayload payload = tryParsePayload(decoded);
          if (payload != null) {
            return new AuditLogCursor(payload.eventTs(), payload.id());
          }

          // If not valid JSON, try to base64 decode
          String nextDecoded = tryBase64Decode(decoded);
          if (nextDecoded == null || nextDecoded.equals(decoded)) {
            // Decoding failed or didn't change the string - stop trying
            break;
          }
          decoded = nextDecoded;
        }

        LOG.warn(
            "Could not parse audit log cursor after decode attempts: original={}, final={}",
            encoded,
            decoded);
        return null;
      } catch (Exception ex) {
        LOG.warn("Failed to parse audit log cursor {}", encoded, ex);
        return null;
      }
    }

    /** Try to parse a string as CursorPayload JSON. Returns null if parsing fails. */
    private static CursorPayload tryParsePayload(String value) {
      if (nullOrEmpty(value) || !value.trim().startsWith("{")) {
        return null;
      }
      try {
        CursorPayload payload = JsonUtils.readValue(value, CursorPayload.class);
        // Validate that we got valid data
        if (payload != null && payload.eventTs() != null && payload.id() != null) {
          return payload;
        }
      } catch (Exception ignored) {
        // Not valid JSON, return null
      }
      return null;
    }

    /** Try to base64 decode a string. Returns null if decoding fails. */
    private static String tryBase64Decode(String value) {
      if (nullOrEmpty(value)) {
        return null;
      }
      try {
        return RestUtil.decodeCursor(value);
      } catch (Exception ignored) {
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
