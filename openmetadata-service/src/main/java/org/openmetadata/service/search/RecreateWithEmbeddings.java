package org.openmetadata.service.search;

import java.util.HashSet;
import java.util.Set;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.search.IndexMapping;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.vector.OpenSearchVectorService;
import org.openmetadata.service.search.vector.VectorIndexService;

@Slf4j
public class RecreateWithEmbeddings extends DefaultRecreateHandler {

  @Override
  public ReindexContext reCreateIndexes(Set<String> entities) {
    SearchRepository searchRepository = Entity.getSearchRepository();
    searchRepository.initializeVectorSearchService();

    Set<String> allEntities = new HashSet<>(entities);
    if (OpenSearchVectorService.getInstance() != null) {
      allEntities.add(VectorIndexService.VECTOR_INDEX_KEY);
    }

    return super.reCreateIndexes(allEntities);
  }

  @Override
  protected void recreateIndexFromMapping(
      ReindexContext context, IndexMapping indexMapping, String entityType) {
    if (VectorIndexService.VECTOR_INDEX_KEY.equals(entityType)
        && OpenSearchVectorService.getInstance() == null) {
      LOG.info("Skipping vector index recreation - vector service not initialized");
      return;
    }
    super.recreateIndexFromMapping(context, indexMapping, entityType);
  }

  @Override
  public void promoteEntityIndex(EntityReindexContext context, boolean reindexSuccess) {
    if (VectorIndexService.VECTOR_INDEX_KEY.equals(context.getEntityType())
        && OpenSearchVectorService.getInstance() == null) {
      return;
    }
    super.promoteEntityIndex(context, reindexSuccess);
  }

  @Override
  public void finalizeReindex(EntityReindexContext context, boolean reindexSuccess) {
    super.finalizeReindex(context, reindexSuccess);

    if (reindexSuccess) {
      SearchRepository searchRepository = Entity.getSearchRepository();
      if (searchRepository.isVectorEmbeddingEnabled()) {
        LOG.info(
            "Reindex finalized for entity type '{}' with vector embeddings enabled",
            context.getEntityType());
      }
    }
  }
}
