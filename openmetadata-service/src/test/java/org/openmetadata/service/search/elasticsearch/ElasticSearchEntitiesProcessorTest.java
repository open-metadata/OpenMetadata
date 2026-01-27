package org.openmetadata.service.search.elasticsearch;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

import es.co.elastic.clients.elasticsearch.core.bulk.BulkOperation;
import java.net.URI;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.MockedStatic;
import org.mockito.Mockito;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.system.StepStats;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.search.IndexMapping;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.SearchIndexException;
import org.openmetadata.service.search.SearchRepository;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class ElasticSearchEntitiesProcessorTest {

  @Mock private SearchRepository searchRepository;
  @Mock private IndexMapping indexMapping;

  private ElasticSearchEntitiesProcessor processor;
  private static final int TOTAL = 100;
  private static final String ENTITY_TYPE = "table";
  private static final String INDEX_NAME = "table_search_index";

  @BeforeEach
  void setUp() {
    processor = new ElasticSearchEntitiesProcessor(TOTAL);
  }

  @Test
  void testProcessorCreation() {
    assertNotNull(processor);
    StepStats stats = processor.getStats();
    assertNotNull(stats);
    assertEquals(TOTAL, stats.getTotalRecords());
    assertEquals(0, stats.getSuccessRecords());
    assertEquals(0, stats.getFailedRecords());
  }

  @Test
  void testProcessWithNullEntityType() {
    // Given
    ResultList<MockEntity> input = createMockResultList(5);
    Map<String, Object> contextData = new HashMap<>();

    // When & Then
    assertThrows(IllegalArgumentException.class, () -> processor.process(input, contextData));
  }

  @Test
  void testProcessWithEmptyEntityType() {
    // Given
    ResultList<MockEntity> input = createMockResultList(5);
    Map<String, Object> contextData = new HashMap<>();
    contextData.put("entityType", "");

    // When & Then
    assertThrows(IllegalArgumentException.class, () -> processor.process(input, contextData));
  }

  @Test
  void testProcessWithEmptyResultList() throws SearchIndexException {
    try (MockedStatic<Entity> entityMock = Mockito.mockStatic(Entity.class)) {
      // Given
      ResultList<MockEntity> input = createMockResultList(0);
      Map<String, Object> contextData = new HashMap<>();
      contextData.put("entityType", ENTITY_TYPE);

      entityMock.when(() -> Entity.getSearchRepository()).thenReturn(searchRepository);
      when(searchRepository.getIndexMapping(ENTITY_TYPE)).thenReturn(indexMapping);
      when(searchRepository.getClusterAlias()).thenReturn("default");
      when(indexMapping.getIndexName("default")).thenReturn(INDEX_NAME);

      // When
      List<BulkOperation> result = processor.process(input, contextData);

      // Then
      assertNotNull(result);
      assertEquals(0, result.size());
      assertEquals(0, processor.getStats().getSuccessRecords());
    }
  }

  @Test
  void testUpdateStats() {
    // Given
    assertEquals(0, processor.getStats().getSuccessRecords());
    assertEquals(0, processor.getStats().getFailedRecords());

    // When
    processor.updateStats(15, 3);

    // Then
    assertEquals(15, processor.getStats().getSuccessRecords());
    assertEquals(3, processor.getStats().getFailedRecords());
  }

  @Test
  void testProcessWithException() {
    try (MockedStatic<Entity> entityMock = Mockito.mockStatic(Entity.class)) {
      // Given
      ResultList<MockEntity> input = createMockResultList(5);
      Map<String, Object> contextData = new HashMap<>();
      contextData.put("entityType", ENTITY_TYPE);

      entityMock.when(() -> Entity.getSearchRepository()).thenReturn(searchRepository);
      entityMock
          .when(() -> Entity.buildSearchIndex(eq(ENTITY_TYPE), any()))
          .thenThrow(new RuntimeException("Test exception"));

      // When & Then
      assertThrows(SearchIndexException.class, () -> processor.process(input, contextData));
      assertEquals(0, processor.getStats().getSuccessRecords());
      assertEquals(5, processor.getStats().getFailedRecords());
    }
  }

  private ResultList<MockEntity> createMockResultList(int count) {
    ResultList<MockEntity> resultList = new ResultList<>();
    List<MockEntity> entities = new java.util.ArrayList<>();
    for (int i = 0; i < count; i++) {
      entities.add(new MockEntity());
    }
    resultList.setData(entities);
    return resultList;
  }

  static class MockEntity implements EntityInterface {
    private final UUID id = UUID.randomUUID();
    private final String fqn = "test.entity." + id;

    @Override
    public UUID getId() {
      return id;
    }

    @Override
    public String getDescription() {
      return "test description";
    }

    @Override
    public String getDisplayName() {
      return "Test Entity";
    }

    @Override
    public String getName() {
      return "testEntity";
    }

    @Override
    public Double getVersion() {
      return 1.0;
    }

    @Override
    public String getUpdatedBy() {
      return "testUser";
    }

    @Override
    public Long getUpdatedAt() {
      return System.currentTimeMillis();
    }

    @Override
    public URI getHref() {
      return null;
    }

    @Override
    public ChangeDescription getChangeDescription() {
      return null;
    }

    @Override
    public ChangeDescription getIncrementalChangeDescription() {
      return null;
    }

    @Override
    public String getFullyQualifiedName() {
      return fqn;
    }

    @Override
    public void setId(UUID id) {}

    @Override
    public void setDescription(String description) {}

    @Override
    public void setDisplayName(String displayName) {}

    @Override
    public void setName(String name) {}

    @Override
    public void setVersion(Double newVersion) {}

    @Override
    public void setChangeDescription(ChangeDescription changeDescription) {}

    @Override
    public void setIncrementalChangeDescription(ChangeDescription incrementalChangeDescription) {}

    @Override
    public void setFullyQualifiedName(String fullyQualifiedName) {}

    @Override
    public void setUpdatedBy(String admin) {}

    @Override
    public void setUpdatedAt(Long updatedAt) {}

    @Override
    public void setHref(URI href) {}

    @Override
    public <T extends EntityInterface> T withHref(URI href) {
      return (T) this;
    }
  }
}
