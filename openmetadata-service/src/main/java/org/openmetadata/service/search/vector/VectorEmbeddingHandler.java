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
  public boolean isAsync() {
    return true;
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
    // No-op: entity search doc is already deleted by SearchIndexHandler
  }

  @Override
  public void onEntitySoftDeletedOrRestored(
      EntityInterface entity, boolean isDeleted, SubjectContext subjectContext) {
    // No-op: entity search doc handles soft delete/restore via SearchIndexHandler
  }

  private void updateEmbedding(EntityInterface entity) {
    if (entity == null) {
      LOG.warn("Received null entity in updateEmbedding");
      return;
    }
    String entityType = extractEntityType(entity);
    if (entityType == null || !isSupportedEntityType(entityType)) {
      return;
    }
    try {
      String entityIndexName = resolveEntityIndexName(entityType);
      if (entityIndexName == null) {
        LOG.warn("No index mapping found for entity type: {}", entityType);
        return;
      }
      vectorService.updateEntityEmbedding(entity, entityIndexName);
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
