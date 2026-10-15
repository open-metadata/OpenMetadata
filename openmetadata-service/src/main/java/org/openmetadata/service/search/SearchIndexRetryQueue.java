package org.openmetadata.service.search;

import io.micrometer.core.instrument.Metrics;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.CollectionDAO;

@Slf4j
public final class SearchIndexRetryQueue {

  public static final String STATUS_PENDING = "PENDING";
  public static final String STATUS_PENDING_RETRY_1 = "PENDING_RETRY_1";
  public static final String STATUS_PENDING_RETRY_2 = "PENDING_RETRY_2";
  public static final String STATUS_IN_PROGRESS = "IN_PROGRESS";
  public static final String STATUS_COMPLETED = "COMPLETED";
  public static final String STATUS_FAILED = "FAILED";

  private static final int MAX_REASON_LENGTH = 8192;
  private static final Set<Integer> TRANSIENT_CLIENT_ERRORS = Set.of(404, 408, 409, 429);

  // The retry table is already deployed without a payload column. Keep the durable context in its
  // TEXT failureReason while hiding this suffix from the queue API.
  private static final String PROPAGATION_CONTEXT_MARKER =
      "\n" + CollectionDAO.SearchIndexRetryQueueDAO.PROPAGATION_CONTEXT_TOKEN;
  private static final String REPAIR_SCOPE_MARKER = "\n__OPENMETADATA_SEARCH_REPAIR_SCOPE_V1__:";

  private SearchIndexRetryQueue() {}

  public static void enqueue(EntityInterface<?> entity, String operation, Throwable failure) {
    if (entity == null) {
      return;
    }
    String entityType =
        entity.getEntityReference() != null ? entity.getEntityReference().getType() : "";
    enqueue(
        entity.getId() != null ? entity.getId().toString() : null,
        entity.getFullyQualifiedName(),
        entityType,
        failureReason(operation, failure));
  }

  public static void enqueueWithPropagation(
      EntityInterface<?> entity,
      ChangeDescription propagationChangeDescription,
      String failureReason) {
    if (entity == null) {
      return;
    }
    String entityType =
        entity.getEntityReference() != null ? entity.getEntityReference().getType() : "";
    enqueue(
        entity.getId() != null ? entity.getId().toString() : null,
        entity.getFullyQualifiedName(),
        entityType,
        withPropagationContext(failureReason, propagationChangeDescription));
  }

  public static void enqueueWithPropagation(
      EntityInterface<?> entity,
      ChangeDescription propagationChangeDescription,
      String operation,
      Throwable failure) {
    enqueueWithPropagation(entity, propagationChangeDescription, failureReason(operation, failure));
  }

  public static void enqueue(String entityId, String entityFqn, String failureReason) {
    enqueue(entityId, entityFqn, "", failureReason);
  }

  public static void enqueue(
      String entityId, String entityFqn, String entityType, String failureReason) {
    String normalizedEntityId = normalize(entityId);
    String normalizedEntityFqn = normalize(entityFqn);
    String normalizedEntityType = normalize(entityType);

    if (normalizedEntityId.isEmpty() && normalizedEntityFqn.isEmpty()) {
      return;
    }

    CollectionDAO collectionDAO = Entity.getCollectionDAO();
    if (collectionDAO == null) {
      LOG.debug("Skipping search retry queue insert because CollectionDAO is not initialized yet.");
      return;
    }

    try {
      collectionDAO
          .searchIndexRetryQueueDAO()
          .upsert(
              normalizedEntityId,
              normalizedEntityFqn,
              truncate(failureReason),
              SearchIndexRetryQueue.STATUS_PENDING,
              normalizedEntityType);
      Metrics.counter("search.retry.enqueued").increment();
    } catch (Exception e) {
      LOG.warn(
          "Failed to record search retry queue row for entityId={} entityFqn={}: {}",
          normalizedEntityId,
          normalizedEntityFqn,
          e.getMessage());
    }
  }

  public static String failureReason(String operation, Throwable failure) {
    String safeOperation = normalize(operation);
    String message =
        failure != null && failure.getMessage() != null && !failure.getMessage().isEmpty()
            ? failure.getMessage()
            : failure != null ? failure.getClass().getSimpleName() : "Unknown failure";
    if (safeOperation.isEmpty()) {
      return truncate(message);
    }
    return truncate(safeOperation + ": " + message);
  }

  static String withPropagationContext(
      String failureReason, ChangeDescription propagationChangeDescription) {
    if (propagationChangeDescription == null) {
      return truncate(failureReason);
    }
    return withContext(
        failureReason,
        PROPAGATION_CONTEXT_MARKER,
        JsonUtils.pojoToJson(propagationChangeDescription));
  }

  static ChangeDescription getPropagationContext(String failureReason) {
    return readContext(
        failureReason,
        PROPAGATION_CONTEXT_MARKER,
        json -> JsonUtils.readValue(json, ChangeDescription.class));
  }

  /**
   * Records documents that a write to many documents at once may have left wrong. The retry worker
   * rebuilds them from the database.
   */
  public static void enqueueRepair(SearchRepairScope scope, String failureReason) {
    enqueue(
        scope.retryKey(),
        scope.label(),
        SearchRepairScope.ENTITY_TYPE,
        withRepairScope(failureReason, scope));
  }

  static String withRepairScope(String failureReason, SearchRepairScope scope) {
    return withContext(failureReason, REPAIR_SCOPE_MARKER, scope.toJson());
  }

  /** The documents a repair row covers, or null for a row that names one entity. */
  public static SearchRepairScope getRepairScope(String failureReason) {
    return readContext(failureReason, REPAIR_SCOPE_MARKER, SearchRepairScope::fromJson);
  }

  private static String withContext(String failureReason, String marker, String contextJson) {
    String encodedContext =
        Base64.getUrlEncoder()
            .withoutPadding()
            .encodeToString(contextJson.getBytes(StandardCharsets.UTF_8));
    String visibleReason = truncate(failureReason);
    return (visibleReason == null ? "" : visibleReason) + marker + encodedContext;
  }

  private static <T> T readContext(
      String failureReason, String marker, Function<String, T> parseContext) {
    int markerIndex = failureReason == null ? -1 : failureReason.lastIndexOf(marker);
    T context = null;
    if (markerIndex >= 0) {
      String encodedContext = failureReason.substring(markerIndex + marker.length());
      try {
        context =
            parseContext.apply(
                new String(Base64.getUrlDecoder().decode(encodedContext), StandardCharsets.UTF_8));
      } catch (RuntimeException e) {
        throw new IllegalArgumentException("Invalid search retry context", e);
      }
    }
    return context;
  }

  public static String visibleFailureReason(String failureReason) {
    if (failureReason == null) {
      return null;
    }
    int contextIndex = contextStart(failureReason);
    return contextIndex < 0 ? failureReason : failureReason.substring(0, contextIndex);
  }

  /** {@code newReason}, keeping the propagation or repair context {@code existingReason} carries. */
  static String preserveRetryContext(String existingReason, String newReason) {
    int contextIndex = existingReason == null ? -1 : contextStart(existingReason);
    if (contextIndex < 0) {
      return truncate(newReason);
    }
    String visibleReason = truncate(newReason);
    return (visibleReason == null ? "" : visibleReason) + existingReason.substring(contextIndex);
  }

  private static int contextStart(String reason) {
    int propagation = reason.lastIndexOf(PROPAGATION_CONTEXT_MARKER);
    int repair = reason.lastIndexOf(REPAIR_SCOPE_MARKER);
    return propagation < 0 ? repair : repair < 0 ? propagation : Math.min(propagation, repair);
  }

  public static String normalize(String value) {
    if (value == null) {
      return "";
    }
    return value.trim();
  }

  public static boolean isUuid(String value) {
    try {
      UUID.fromString(value);
      return true;
    } catch (Exception e) {
      return false;
    }
  }

  /**
   * A missing index (404) can be recreated, and a timeout (408), a conflicting write (409) or an
   * overloaded cluster (429, 5xx) passes; other 4xx errors reject the document itself.
   */
  public static boolean isRetryableStatusCode(int status) {
    return status < 400 || status >= 500 || TRANSIENT_CLIENT_ERRORS.contains(status);
  }

  private static String truncate(String value) {
    if (value == null) {
      return null;
    }
    int contextIndex = contextStart(value);
    if (contextIndex >= 0) {
      return truncate(value.substring(0, contextIndex)) + value.substring(contextIndex);
    }
    if (value.length() <= MAX_REASON_LENGTH) {
      return value;
    }
    return value.substring(0, MAX_REASON_LENGTH);
  }
}
