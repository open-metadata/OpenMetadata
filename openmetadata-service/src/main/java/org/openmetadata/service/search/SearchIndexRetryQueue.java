package org.openmetadata.service.search;

import io.micrometer.core.instrument.Metrics;
import java.util.UUID;
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
