package org.openmetadata.service.search;

import java.util.Set;

/**
 * Interface for cleaning up resources during reindexing operations.
 * This allows for different implementations to be provided for different deployment tiers.
 */
public interface RecreateIndexHandler {
  ReindexContext reCreateIndexes(Set<String> entities);

  default void finalizeReindex(EntityReindexContext entityReindexContext, boolean reindexSuccess) {}
}
