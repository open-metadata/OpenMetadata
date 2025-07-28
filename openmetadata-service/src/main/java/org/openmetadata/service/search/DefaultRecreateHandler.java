package org.openmetadata.service.search;

import java.util.Set;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.search.IndexMapping;
import org.openmetadata.service.Entity;

/**
 * Default implementation of RecreateHandler that provides basic logging.
 * This can be overridden to provide more sophisticated cleanup operations.
 */
@Slf4j
public class DefaultRecreateHandler implements RecreateIndexHandler {
  @Override
  public void reCreateIndexes(Set<String> entities) {
    SearchRepository searchRepository = Entity.getSearchRepository();
    for (String entityType : entities) {
      IndexMapping indexType = searchRepository.getIndexMapping(entityType);
      if (indexType == null) {
        LOG.warn(
            "No index mapping found for entityType '{}'. Skipping index recreation.", entityType);
        continue;
      }
      searchRepository.deleteIndex(indexType);
      searchRepository.createIndex(indexType);
      LOG.debug("Recreated index for entityType '{}'.", entityType);
    }
  }
}
