package org.openmetadata.service.search.vector;

import java.util.Locale;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.service.events.lifecycle.EntityLifecycleEventHandler;
import org.openmetadata.service.search.vector.utils.AvailableEntityTypes;
import org.openmetadata.service.security.policyevaluator.SubjectContext;

@Slf4j
public class VectorEmbeddingHandler implements EntityLifecycleEventHandler {
  private final VectorIndexService vectorService;

  public VectorEmbeddingHandler(VectorIndexService vectorService) {
    this.vectorService = vectorService;
  }

  @Override
  public String getHandlerName() {
    return "VectorEmbeddingHandler";
  }

  @Override
  public int getPriority() {
    return 200;
  }

  @Override
  public boolean isAsync() {
    return true;
  }

  @Override
  public void onEntityCreated(EntityInterface entity, SubjectContext subjectContext) {
    reindexEntity(entity);
  }

  @Override
  public void onEntityUpdated(
      EntityInterface entity, ChangeDescription changeDescription, SubjectContext subjectContext) {
    if (entity == null) {
      LOG.warn("Received null entity in onEntityUpdated");
      return;
    }
    if (entity.getDeleted() != null && entity.getDeleted()) {
      return;
    }
    reindexEntity(entity);
  }

  @Override
  public void onEntityDeleted(EntityInterface entity, SubjectContext subjectContext) {
    hardDeleteEntity(entity);
  }

  @Override
  public void onEntitySoftDeletedOrRestored(
      EntityInterface entity, boolean isDeleted, SubjectContext subjectContext) {
    if (entity == null) {
      LOG.warn("Received null entity in onEntitySoftDeletedOrRestored");
      return;
    }
    String entityType = extractEntityType(entity);
    if (entityType == null || !isSupportedEntityType(entityType)) {
      return;
    }
    try {
      if (isDeleted) {
        vectorService.softDeleteEmbeddings(entity);
      } else {
        vectorService.restoreEmbeddings(entity);
      }
    } catch (Exception e) {
      LOG.error(
          "Failed to {} embeddings for entity {}: {}",
          isDeleted ? "soft delete" : "restore",
          entity.getId(),
          e.getMessage(),
          e);
    }
  }

  private void reindexEntity(EntityInterface entity) {
    if (entity == null) {
      LOG.warn("Received null entity in reindexEntity");
      return;
    }
    String entityType = extractEntityType(entity);
    if (entityType == null || !isSupportedEntityType(entityType)) {
      return;
    }
    try {
      String indexName = vectorService.getIndexName();
      vectorService.updateVectorEmbeddings(entity, indexName);
    } catch (Exception e) {
      LOG.error(
          "Failed to reindex vector embeddings for entity {}: {}",
          entity.getId(),
          e.getMessage(),
          e);
    }
  }

  private void hardDeleteEntity(EntityInterface entity) {
    if (entity == null) {
      LOG.warn("Received null entity in hardDeleteEntity");
      return;
    }
    String entityType = extractEntityType(entity);
    if (entityType == null || !isSupportedEntityType(entityType)) {
      return;
    }
    try {
      vectorService.hardDeleteEmbeddings(entity);
    } catch (Exception e) {
      LOG.error(
          "Failed to hard delete embeddings for entity {}: {}", entity.getId(), e.getMessage(), e);
    }
  }

  private String extractEntityType(EntityInterface entity) {
    try {
      return entity.getEntityReference().getType();
    } catch (Exception e) {
      LOG.warn("Failed to extract entity type: {}", e.getMessage());
      return null;
    }
  }

  private boolean isSupportedEntityType(String entityType) {
    return AvailableEntityTypes.SET.contains(entityType.toLowerCase(Locale.ROOT));
  }
}
