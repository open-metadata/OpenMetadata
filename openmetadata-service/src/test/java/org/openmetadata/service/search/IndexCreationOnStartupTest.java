package org.openmetadata.service.search;

import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.junit.jupiter.api.Test;
import org.openmetadata.search.IndexMapping;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplicationTest;

@Slf4j
public class IndexCreationOnStartupTest extends OpenMetadataApplicationTest {

  @Test
  void testIndexesCreatedOnServerStart() {
    SearchRepository searchRepository = Entity.getSearchRepository();
    assertNotNull(searchRepository, "SearchRepository should not be null");

    Map<String, IndexMapping> entityIndexMap = searchRepository.getEntityIndexMap();
    assertNotNull(entityIndexMap, "Entity index map should not be null");
    assertTrue(!entityIndexMap.isEmpty(), "Entity index map should not be empty");

    LOG.info("Found {} entity indexes to validate", entityIndexMap.size());

    for (Map.Entry<String, IndexMapping> entry : entityIndexMap.entrySet()) {
      String entityType = entry.getKey();
      IndexMapping indexMapping = entry.getValue();

      LOG.info("Checking if index exists for entity type: {}", entityType);

      boolean indexExists = searchRepository.indexExists(indexMapping);
      assertTrue(
          indexExists,
          String.format("Index for entity type '%s' should exist after server start", entityType));

      LOG.info("Index for entity type '{}' exists: {}", entityType, indexExists);
    }

    LOG.info("Successfully validated all {} indexes exist", entityIndexMap.size());
  }
}
