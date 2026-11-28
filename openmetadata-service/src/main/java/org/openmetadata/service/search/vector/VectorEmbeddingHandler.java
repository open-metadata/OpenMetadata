package org.openmetadata.service.search.vector;

import java.util.List;
import java.util.Objects;
import java.util.Set;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.search.IndexMapping;
import org.openmetadata.service.Entity;
import org.openmetadata.service.events.lifecycle.EntityLifecycleEventHandler;
import org.openmetadata.service.search.OntologyTermSearch;
import org.openmetadata.service.search.SearchIndexRetryQueue;
import org.openmetadata.service.search.vector.utils.EmbeddedEntityTypes;
import org.openmetadata.service.security.policyevaluator.SubjectContext;

@Slf4j
public class VectorEmbeddingHandler implements EntityLifecycleEventHandler {
  private static final Set<String> LIFECYCLE_TYPES = Set.copyOf(EmbeddedEntityTypes.DATA_ASSETS);
  private static final String DELETE_CHUNKS_OPERATION = "deleteEntityChunks";
  private final VectorIndexService vectorService;

  @Override
  public Set<String> getSupportedEntityTypes() {
    return LIFECYCLE_TYPES;
  }

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
    if (entity.getDeleted() != null && entity.getDeleted()) {
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
  public void onEntityDeleted(EntityInterface<?> entity, SubjectContext subjectContext) {
    // Entity search doc is deleted by SearchIndexHandler; chunk docs live in the dedicated
    // chunk index and must be cleaned here or the deleted entity keeps matching KNN queries.
    deleteChunks(entity);
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

  /**
   * A delete the cluster still refuses after the request retries goes to the search retry queue,
   * whose worker removes the chunks of an entity that is gone, soft-deleted or no longer
   * embeddable. Otherwise the deleted entity's chunks would stay searchable.
   */
  private void deleteChunks(EntityInterface<?> entity) {
    if (entity != null && entity.getId() != null && isSupported(entity)) {
      try {
        vectorService.deleteEntityChunks(entity.getId().toString());
      } catch (RuntimeException e) {
        LOG.warn(
            "Could not delete the chunks of {}; queued for the search retry worker: {}",
            entity.getId(),
            e.getMessage());
        SearchIndexRetryQueue.enqueue(entity, DELETE_CHUNKS_OPERATION, e);
      }
    }
  }

  private boolean isSupported(EntityInterface<?> entity) {
    String entityType = extractEntityType(entity);
    return EmbeddedEntityTypes.isEmbedded(entityType);
  }

  public void refreshOntologyEmbedding(EntityReference reference) {
    final var index = resolveEntityIndexName(reference.getType());
    if (index != null) {
      refreshOntologyEmbedding(
          reference, Entity.getSearchRepository().getWriteFanoutTargets(index));
    }
  }

  public void refreshOntologyEmbedding(EntityReference reference, List<String> targets) {
    final var active = OntologyTermSearch.activeIndex(reference);
    if (active != null) {
      final var body = active.embeddingBody();
      targets.forEach(target -> vectorService.updateEntityEmbeddings(active.term(), target, body));
    }
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
}
