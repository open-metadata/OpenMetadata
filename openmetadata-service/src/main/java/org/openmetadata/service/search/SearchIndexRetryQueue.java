package org.openmetadata.service.search;

import io.micrometer.core.instrument.Metrics;
import java.util.Collections;
import java.util.HashSet;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicReference;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.EntityInterface;
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

  private static final AtomicReference<Set<String>> SUSPENDED_ENTITY_TYPES =
      new AtomicReference<>(Collections.emptySet());
  private static final AtomicBoolean SUSPEND_ALL_STREAMING = new AtomicBoolean(false);

  private SearchIndexRetryQueue() {}

  public static void enqueue(EntityInterface entity, String operation, Throwable failure) {
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

  public static boolean isRetryableStatusCode(int status) {
    if (status == 429 || status >= 500) {
      return true;
    }
    return status < 400;
  }

  public static void updateSuspension(Set<String> entityTypes, boolean suspendAll) {
    Set<String> normalized = new HashSet<>();
    for (String entityType : entityTypes == null ? Collections.<String>emptySet() : entityTypes) {
      String normalizedType = normalize(entityType);
      if (!normalizedType.isEmpty()) {
        normalized.add(normalizedType);
      }
    }

    // Set entity types before the boolean so that isEntityTypeSuspended never
    // sees suspendAll=false with an outdated (empty) entity-types set.
    SUSPENDED_ENTITY_TYPES.set(Collections.unmodifiableSet(normalized));
    SUSPEND_ALL_STREAMING.set(suspendAll);
  }

  public static void clearSuspension() {
    SUSPEND_ALL_STREAMING.set(false);
    SUSPENDED_ENTITY_TYPES.set(Collections.emptySet());
  }

  public static boolean isEntityTypeSuspended(String entityType) {
    if (SUSPEND_ALL_STREAMING.get()) {
      return true;
    }
    String normalized = normalize(entityType);
    return !normalized.isEmpty() && SUSPENDED_ENTITY_TYPES.get().contains(normalized);
  }

  public static boolean isStreamingSuspended() {
    return SUSPEND_ALL_STREAMING.get() || !SUSPENDED_ENTITY_TYPES.get().isEmpty();
  }

  public static boolean isSuspendAllStreaming() {
    return SUSPEND_ALL_STREAMING.get();
  }

  public static Set<String> getSuspendedEntityTypes() {
    return SUSPENDED_ENTITY_TYPES.get();
  }

  private static String truncate(String value) {
    if (value == null) {
      return null;
    }
    if (value.length() <= MAX_REASON_LENGTH) {
      return value;
    }
    return value.substring(0, MAX_REASON_LENGTH);
  }
}
