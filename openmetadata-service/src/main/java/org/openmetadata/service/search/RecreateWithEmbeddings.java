package org.openmetadata.service.search;

import java.util.Set;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.service.Entity;

@Slf4j
public class RecreateWithEmbeddings extends DefaultRecreateHandler {

  @Override
  public ReindexContext reCreateIndexes(Set<String> entities) {
    SearchRepository searchRepository = Entity.getSearchRepository();
    searchRepository.initializeVectorSearchService();
    return super.reCreateIndexes(entities);
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
