package org.openmetadata.service.search.vector;

import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.EntityInterface;
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
      vectorService.updateVectorEmbeddings(entity, vectorService.getIndexName());
    } catch (Exception e) {
      LOG.error(
          "Failed to update vector embeddings for entity {}: {}",
          entity.getId(),
          e.getMessage(),
          e);
    }
  }

  public static void softDeleteVectorEmbeddingsForOpenSearch(EntityInterface entity) {
    if (!Entity.getSearchRepository().isVectorEmbeddingEnabled()) {
      return;
    }
    String entityType = entity.getEntityReference().getType();
    if (!AvailableEntityTypes.isVectorIndexable(entityType)) {
      return;
    }
    OpenSearchVectorService vectorService = OpenSearchVectorService.getInstance();
    if (vectorService == null) {
      return;
    }
    try {
      vectorService.softDeleteEmbeddings(entity);
    } catch (Exception e) {
      LOG.error(
          "Failed to soft delete embeddings for entity {}: {}", entity.getId(), e.getMessage(), e);
    }
  }

  public static void hardDeleteVectorEmbeddingsForOpenSearch(EntityInterface entity) {
    if (!Entity.getSearchRepository().isVectorEmbeddingEnabled()) {
      return;
    }
    String entityType = entity.getEntityReference().getType();
    if (!AvailableEntityTypes.isVectorIndexable(entityType)) {
      return;
    }
    OpenSearchVectorService vectorService = OpenSearchVectorService.getInstance();
    if (vectorService == null) {
      return;
    }
    try {
      vectorService.hardDeleteEmbeddings(entity);
    } catch (Exception e) {
      LOG.error(
          "Failed to hard delete embeddings for entity {}: {}", entity.getId(), e.getMessage(), e);
    }
  }

  public static void restoreVectorEmbeddingsForOpenSearch(EntityInterface entity) {
    if (!Entity.getSearchRepository().isVectorEmbeddingEnabled()) {
      return;
    }
    String entityType = entity.getEntityReference().getType();
    if (!AvailableEntityTypes.isVectorIndexable(entityType)) {
      return;
    }
    OpenSearchVectorService vectorService = OpenSearchVectorService.getInstance();
    if (vectorService == null) {
      return;
    }
    try {
      vectorService.restoreEmbeddings(entity);
    } catch (Exception e) {
      LOG.error(
          "Failed to restore embeddings for entity {}: {}", entity.getId(), e.getMessage(), e);
    }
  }
}
