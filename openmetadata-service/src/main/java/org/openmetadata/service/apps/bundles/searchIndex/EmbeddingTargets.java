package org.openmetadata.service.apps.bundles.searchIndex;

import org.openmetadata.service.search.ReindexContext;

/**
 * Where a reindex writes one entity's embedding: the index its entity document goes to, and the
 * chunk generation the run staged. A null {@code stagedChunkTarget} sends the chunk documents to
 * the live chunk index, because only a full recreate stages a generation.
 */
record EmbeddingTargets(String entityIndex, String stagedChunkTarget) {

  static EmbeddingTargets of(String entityIndex, ReindexContext reindexContext) {
    String stagedChunkTarget =
        reindexContext == null ? null : reindexContext.getStagedChunkIndex().orElse(null);
    return new EmbeddingTargets(entityIndex, stagedChunkTarget);
  }
}
