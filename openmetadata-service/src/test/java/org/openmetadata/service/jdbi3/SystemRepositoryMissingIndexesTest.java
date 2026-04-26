package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.search.IndexMapping;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.CollectionDAO.SystemDAO;
import org.openmetadata.service.migration.MigrationValidationClient;
import org.openmetadata.service.search.SearchRepository;

class SystemRepositoryMissingIndexesTest {

  private MockedStatic<Entity> entityMock;
  private MockedStatic<MigrationValidationClient> migrationMock;
  private SearchRepository searchRepository;
  private SystemRepository systemRepository;

  @BeforeEach
  void setup() {
    entityMock = mockStatic(Entity.class);
    migrationMock = mockStatic(MigrationValidationClient.class);

    CollectionDAO collectionDAO = mock(CollectionDAO.class);
    SystemDAO systemDAO = mock(SystemDAO.class);
    when(collectionDAO.systemDAO()).thenReturn(systemDAO);
    entityMock.when(Entity::getCollectionDAO).thenReturn(collectionDAO);

    MigrationValidationClient migrationClient = mock(MigrationValidationClient.class);
    migrationMock.when(MigrationValidationClient::getInstance).thenReturn(migrationClient);

    searchRepository = mock(SearchRepository.class);
    entityMock.when(Entity::getSearchRepository).thenReturn(searchRepository);

    systemRepository = new SystemRepository();
  }

  @AfterEach
  void tearDown() {
    entityMock.close();
    migrationMock.close();
  }

  @Test
  void testVectorEmbeddingIndexSkippedWhenSemanticSearchDisabled() {
    IndexMapping tableMapping = mock(IndexMapping.class);
    IndexMapping vectorMapping = mock(IndexMapping.class);
    Map<String, IndexMapping> indexMap =
        Map.of("table", tableMapping, "vectorEmbedding", vectorMapping);

    when(searchRepository.isVectorEmbeddingEnabled()).thenReturn(false);
    when(searchRepository.getEntityIndexMap()).thenReturn(indexMap);
    when(searchRepository.indexExists(tableMapping)).thenReturn(true);
    when(searchRepository.indexExists(vectorMapping)).thenReturn(false);

    List<String> missing = systemRepository.findMissingIndexes(searchRepository);

    assertTrue(missing.isEmpty(), "vectorEmbedding should be ignored when semantic search is off");
  }

  @Test
  void testVectorEmbeddingIndexReportedMissingWhenSemanticSearchEnabled() {
    IndexMapping tableMapping = mock(IndexMapping.class);
    IndexMapping vectorMapping = mock(IndexMapping.class);
    Map<String, IndexMapping> indexMap =
        Map.of("table", tableMapping, "vectorEmbedding", vectorMapping);

    when(searchRepository.isVectorEmbeddingEnabled()).thenReturn(true);
    when(searchRepository.getEntityIndexMap()).thenReturn(indexMap);
    when(searchRepository.indexExists(tableMapping)).thenReturn(true);
    when(searchRepository.indexExists(vectorMapping)).thenReturn(false);

    List<String> missing = systemRepository.findMissingIndexes(searchRepository);

    assertEquals(1, missing.size());
    assertEquals("vectorEmbedding", missing.get(0));
  }

  @Test
  void testNonVectorMissingIndexesAlwaysReported() {
    IndexMapping tableMapping = mock(IndexMapping.class);
    IndexMapping glossaryMapping = mock(IndexMapping.class);
    IndexMapping vectorMapping = mock(IndexMapping.class);
    Map<String, IndexMapping> indexMap =
        Map.of(
            "table", tableMapping, "glossary", glossaryMapping, "vectorEmbedding", vectorMapping);

    when(searchRepository.isVectorEmbeddingEnabled()).thenReturn(false);
    when(searchRepository.getEntityIndexMap()).thenReturn(indexMap);
    when(searchRepository.indexExists(tableMapping)).thenReturn(true);
    when(searchRepository.indexExists(glossaryMapping)).thenReturn(false);
    when(searchRepository.indexExists(vectorMapping)).thenReturn(false);

    List<String> missing = systemRepository.findMissingIndexes(searchRepository);

    assertEquals(1, missing.size());
    assertEquals("glossary", missing.get(0));
    assertFalse(missing.contains("vectorEmbedding"));
  }

  @Test
  void testAllIndexesPresentReturnsEmpty() {
    IndexMapping tableMapping = mock(IndexMapping.class);
    IndexMapping vectorMapping = mock(IndexMapping.class);
    Map<String, IndexMapping> indexMap =
        Map.of("table", tableMapping, "vectorEmbedding", vectorMapping);

    when(searchRepository.isVectorEmbeddingEnabled()).thenReturn(true);
    when(searchRepository.getEntityIndexMap()).thenReturn(indexMap);
    when(searchRepository.indexExists(tableMapping)).thenReturn(true);
    when(searchRepository.indexExists(vectorMapping)).thenReturn(true);

    List<String> missing = systemRepository.findMissingIndexes(searchRepository);

    assertTrue(missing.isEmpty());
  }
}
