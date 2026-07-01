package org.openmetadata.service.search.vector;

import java.util.Locale;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.search.IndexMapping;
import org.openmetadata.service.Entity;
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
  public void onEntityCreated(EntityInterface entity, SubjectContext subjectContext) {
    updateEmbedding(entity);
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
    updateEmbedding(entity);
  }

  @Override
  public void onEntityDeleted(EntityInterface entity, SubjectContext subjectContext) {
    // Entity search doc is deleted by SearchIndexHandler; chunk docs live in the dedicated
    // chunk index and must be cleaned here or the deleted entity keeps matching KNN queries.
    deleteChunks(entity);
  }

  @Override
  public void onEntitySoftDeletedOrRestored(
      EntityInterface entity, boolean isDeleted, SubjectContext subjectContext) {
    // Chunk docs carry their own deleted flag, so mirror the transition: drop chunks on soft
    // delete, re-embed on restore. The entity search doc itself is handled by SearchIndexHandler.
    if (isDeleted) {
      deleteChunks(entity);
    } else {
      updateEmbedding(entity);
    }
  }

  private void deleteChunks(EntityInterface entity) {
    if (entity != null && entity.getId() != null && isSupported(entity)) {
      try {
        vectorService.deleteEntityChunks(entity.getId().toString());
      } catch (Exception e) {
        LOG.error("Failed to delete chunks for entity {}: {}", entity.getId(), e.getMessage(), e);
      }
    }
  }

  private boolean isSupported(EntityInterface entity) {
    String entityType = extractEntityType(entity);
    return entityType != null && isSupportedEntityType(entityType);
  }

  private void updateEmbedding(EntityInterface entity) {
    if (entity == null) {
      LOG.warn("Received null entity in updateEmbedding");
      return;
    }
    if (!isSupported(entity)) {
      return;
    }
    try {
      String entityIndexName = resolveEntityIndexName(extractEntityType(entity));
      if (entityIndexName == null) {
        LOG.warn("No index mapping found for entity type: {}", extractEntityType(entity));
        return;
      }
      // Dual write: the legacy chunk-0 partial update keeps hybrid search (which reads the
      // embedding on the entity doc) working, while the chunk index carries every chunk for
      // the semantic vector path (issue #4789).
      vectorService.updateEntityEmbedding(entity, entityIndexName);
      vectorService.updateEntityEmbeddingChunks(entity);
    } catch (Exception e) {
      LOG.error("Failed to update embedding for entity {}: {}", entity.getId(), e.getMessage(), e);
    }
  }

  private String resolveEntityIndexName(String entityType) {
    try {
      IndexMapping mapping = Entity.getSearchRepository().getIndexMapping(entityType);
      if (mapping == null) {
        return null;
      }
      return mapping.getIndexName(Entity.getSearchRepository().getClusterAlias());
    } catch (Exception e) {
      LOG.warn("Failed to resolve index name for entity type {}: {}", entityType, e.getMessage());
      return null;
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
