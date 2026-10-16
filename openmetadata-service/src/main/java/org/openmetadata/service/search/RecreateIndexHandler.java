package org.openmetadata.service.search;

import java.util.Set;

/**
 * Interface for cleaning up resources during reindexing operations.
 * This allows for different implementations to be provided for different deployment tiers.
 */
public interface RecreateIndexHandler {
  ReindexContext reCreateIndexes(Set<String> entities);

  /**
   * Promote the staged index for an entity to serve live traffic.
   *
   * @return {@code true} when the entity reached a correct terminal serving state (staged index
   *     promoted, or an empty staged index intentionally discarded); {@code false} when promotion
   *     failed (e.g. the alias swap failed or threw) and the entity must be retried. Callers use
   *     this to keep the entity eligible for the finalization retry rather than silently leaving it
   *     on a stale index.
   */
  default boolean finalizeReindex(
      EntityReindexContext entityReindexContext, boolean reindexSuccess) {
    return true;
  }
}
