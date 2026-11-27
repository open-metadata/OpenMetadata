package org.openmetadata.service.search.vector;

import java.util.List;
import java.util.Locale;
import java.util.Objects;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EventType;
import org.openmetadata.search.IndexMapping;
import org.openmetadata.service.Entity;
import org.openmetadata.service.events.lifecycle.EntityLifecycleEventDispatcher;
import org.openmetadata.service.events.lifecycle.EntityLifecycleEventHandler;
import org.openmetadata.service.search.vector.utils.AvailableEntityTypes;
import org.openmetadata.service.security.policyevaluator.SubjectContext;

@Slf4j
public class VectorEmbeddingHandler implements EntityLifecycleEventHandler {
  private static final String DELETE_CHUNKS_OPERATION = "deleteEntityChunks";
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

  /** A hard delete reaches this handler through {@link #prepareHardDelete(List)}. */
  @Override
  public boolean shouldProcess(EventType eventType, ChangeDescription changeDescription) {
    return eventType != EventType.ENTITY_DELETED;
  }

  @Override
  public void onEntityCreated(EntityInterface<?> entity, SubjectContext subjectContext) {
    updateEmbedding(entity);
  }

  @Override
  public void onEntityUpdated(
      EntityInterface<?> entity,
      ChangeDescription changeDescription,
      SubjectContext subjectContext) {
    if (entity == null) {
      LOG.warn("Received null entity in onEntityUpdated");
      return;
    }
    // A recursive soft delete marks each descendant deleted with this update, and sends it no soft
    // delete event, so the update removes its chunks.
    if (Boolean.TRUE.equals(entity.getDeleted())) {
      deleteChunks(entity);
      return;
    }
    if (!Entity.isVectorEmbeddable(entity)) {
      deleteChunks(entity);
      clearEntityEmbedding(entity);
      return;
    }
    updateEmbedding(entity);
  }

  @Override
  public Runnable prepareHardDelete(EntityInterface<?> entity) {
    return prepareHardDelete(List.of(entity));
  }

  /**
   * Every hard delete prepares here, the descendants of a recursive delete included, which get no
   * delete event. Their chunks are deleted after the delete, one task per ordered lane, each after
   * the tasks this server already queued for its entities, so none of those updates writes them
   * back. A task a full lane sheds goes to the search retry queue; a delete the cluster refuses is
   * only logged, as every chunk delete is here.
   */
  @Override
  public Runnable prepareHardDelete(List<? extends EntityInterface<?>> entities) {
    List<EntityReference> embedded =
        entities.stream()
            .filter(entity -> entity != null && entity.getId() != null && isSupported(entity))
            .map(EntityInterface::getEntityReference)
            .toList();
    return embedded.isEmpty()
        ? () -> {}
        : () ->
            EntityLifecycleEventDispatcher.getInstance()
                .submitInEntityOrder(embedded, DELETE_CHUNKS_OPERATION, this::deleteChunksOf);
  }

  private void deleteChunksOf(List<EntityReference> entities) {
    for (EntityReference entity : entities) {
      deleteChunks(entity.getId().toString());
    }
  }

  /** Invalidates stale stored text without making a provider call on the index-writing thread. */
  public void invalidateStaleEmbedding(EntityInterface<?> entity) {
    if (!hasCurrentEmbedding(entity)) {
      deleteChunks(entity);
      clearEntityEmbedding(entity);
    }
  }

  private boolean hasCurrentEmbedding(EntityInterface<?> entity) {
    if (entity == null
        || !isSupported(entity)
        || Boolean.TRUE.equals(entity.getDeleted())
        || !Entity.isVectorEmbeddable(entity)) {
      return false;
    }
    String indexName = resolveEntityIndexName(extractEntityType(entity));
    return indexName != null
        && Objects.equals(
            VectorDocBuilder.computeFingerprintForEntity(entity),
            vectorService.getExistingFingerprint(indexName, entity.getId().toString()));
  }

  @Override
  public void onEntitySoftDeletedOrRestored(
      EntityInterface<?> entity, boolean isDeleted, SubjectContext subjectContext) {
    // Chunk docs carry their own deleted flag, so mirror the transition: drop chunks on soft
    // delete, re-embed on restore. The entity search doc itself is handled by SearchIndexHandler.
    if (isDeleted) {
      deleteChunks(entity);
    } else {
      updateEmbedding(entity);
    }
  }

  /**
   * Entity-doc embedding writes are partial merges, so an entity that stops being embeddable keeps
   * its stale {@code embedding} — and stays kNN-matchable — unless the field is removed explicitly.
   */
  private void clearEntityEmbedding(EntityInterface<?> entity) {
    if (entity != null && entity.getId() != null && isSupported(entity)) {
      try {
        String entityIndexName = resolveEntityIndexName(extractEntityType(entity));
        if (entityIndexName != null) {
          vectorService.clearEntityEmbedding(entityIndexName, entity.getId().toString());
        }
      } catch (Exception e) {
        LOG.error("Failed to clear embedding for entity {}: {}", entity.getId(), e.getMessage(), e);
      }
    }
  }

  private void deleteChunks(EntityInterface<?> entity) {
    if (entity != null && entity.getId() != null && isSupported(entity)) {
      deleteChunks(entity.getId().toString());
    }
  }

  private void deleteChunks(String entityId) {
    try {
      vectorService.deleteEntityChunks(entityId);
    } catch (Exception e) {
      LOG.error("Failed to delete chunks for entity {}: {}", entityId, e.getMessage(), e);
    }
  }

  private boolean isSupported(EntityInterface<?> entity) {
    String entityType = extractEntityType(entity);
    return entityType != null && isSupportedEntityType(entityType);
  }

  public void updateEmbedding(EntityInterface<?> entity) {
    if (entity == null) {
      LOG.warn("Received null entity in updateEmbedding");
      return;
    }
    if (!isSupported(entity)) {
      return;
    }
    if (!Entity.isVectorEmbeddable(entity)) {
      return;
    }
    try {
      String entityIndexName = resolveEntityIndexName(extractEntityType(entity));
      if (entityIndexName == null) {
        LOG.warn("No index mapping found for entity type: {}", extractEntityType(entity));
        return;
      }
      // Dual-target write: the legacy chunk-0 partial update keeps hybrid search (which reads
      // the embedding on the entity doc) working, while the chunk index carries every chunk for
      // the semantic vector path (issue #4789). The combined call embeds each chunk once and
      // reuses chunk 0 for the entity doc.
      vectorService.updateEntityEmbeddings(entity, entityIndexName);
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

  private String extractEntityType(EntityInterface<?> entity) {
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
