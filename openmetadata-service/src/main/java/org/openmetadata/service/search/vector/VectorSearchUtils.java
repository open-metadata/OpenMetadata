package org.openmetadata.service.search.vector;

import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.search.IndexMapping;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.vector.utils.AvailableEntityTypes;

@Slf4j
public final class VectorSearchUtils {
  private VectorSearchUtils() {}

  public static void updateVectorEmbeddingsForOpenSearch(EntityInterface entity) {
    String entityType = entity.getEntityReference().getType();
    updateVectorEmbeddingsForOpenSearch(entity, entityType);
  }

  public static void updateVectorEmbeddingsForOpenSearch(
      EntityInterface entity, String entityType) {
    if (!Entity.getSearchRepository().isVectorEmbeddingEnabled()) {
      return;
    }
    if (!AvailableEntityTypes.isVectorIndexable(entityType)) {
      return;
    }
    OpenSearchVectorService vectorService = OpenSearchVectorService.getInstance();
    if (vectorService == null) {
      return;
    }
    try {
      IndexMapping mapping = Entity.getSearchRepository().getIndexMapping(entityType);
      if (mapping == null) {
        LOG.warn("No index mapping found for entity type: {}", entityType);
        return;
      }
      String entityIndexName = mapping.getIndexName(Entity.getSearchRepository().getClusterAlias());
      vectorService.updateEntityEmbedding(entity, entityIndexName);
    } catch (Exception e) {
      LOG.error(
          "Failed to update vector embeddings for entity {}: {}",
          entity.getId(),
          e.getMessage(),
          e);
    }
  }
}
