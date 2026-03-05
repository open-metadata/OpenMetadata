package org.openmetadata.service.apps.bundles.searchIndex;

import java.util.Set;

/**
 * Per-entity-type batch sizing based on typical document size. Large entity types (tables,
 * dashboards, etc.) produce bigger search documents, so we use smaller batches. Small entity types
 * (users, tags, etc.) produce tiny documents, so we can use larger batches.
 */
public final class EntityBatchSizeEstimator {

  private static final Set<String> LARGE_ENTITIES =
      Set.of("table", "topic", "dashboard", "mlmodel", "container", "storedProcedure");

  private static final Set<String> SMALL_ENTITIES =
      Set.of("user", "team", "bot", "role", "policy", "tag", "classification");

  private static final int MIN_BATCH_SIZE = 25;
  private static final int MAX_BATCH_SIZE = 1000;

  private EntityBatchSizeEstimator() {}

  public static int estimateBatchSize(String entityType, int baseBatchSize) {
    if (baseBatchSize <= 0) {
      return baseBatchSize;
    }

    if (LARGE_ENTITIES.contains(entityType)) {
      return Math.max(baseBatchSize / 2, MIN_BATCH_SIZE);
    }

    if (SMALL_ENTITIES.contains(entityType)) {
      return Math.min(baseBatchSize * 2, MAX_BATCH_SIZE);
    }

    return baseBatchSize;
  }
}
