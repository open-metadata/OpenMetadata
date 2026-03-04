package org.openmetadata.service.search;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.doCallRealMethod;
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.net.URI;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.service.configuration.elasticsearch.ElasticSearchConfiguration;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.apps.bundles.searchIndex.BulkSink;
import org.openmetadata.service.apps.bundles.searchIndex.ElasticSearchBulkSink;
import org.openmetadata.service.apps.bundles.searchIndex.OpenSearchBulkSink;
import org.openmetadata.service.workflows.searchIndex.ReindexingUtil;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class SearchRepositoryTest {

  @Mock private SearchRepository searchRepository;

  @Mock
  private org.openmetadata.service.search.elasticsearch.ElasticSearchClient elasticSearchClient;

  @Mock private org.openmetadata.service.search.opensearch.OpenSearchClient openSearchClient;

  @BeforeEach
  void setUp() {
    // Create a real instance for testing the new methods
    searchRepository = mock(SearchRepository.class);

    // Mock the new Java API clients
    es.co.elastic.clients.elasticsearch.ElasticsearchClient mockEsNewClient =
        mock(es.co.elastic.clients.elasticsearch.ElasticsearchClient.class);
    es.co.elastic.clients.transport.ElasticsearchTransport mockEsTransport =
        mock(es.co.elastic.clients.transport.ElasticsearchTransport.class);
    lenient().when(mockEsNewClient._transport()).thenReturn(mockEsTransport);
    lenient().when(elasticSearchClient.getNewClient()).thenReturn(mockEsNewClient);

    os.org.opensearch.client.opensearch.OpenSearchClient mockOsNewClient =
        mock(os.org.opensearch.client.opensearch.OpenSearchClient.class);
    os.org.opensearch.client.transport.OpenSearchTransport mockOsTransport =
        mock(os.org.opensearch.client.transport.OpenSearchTransport.class);
    lenient().when(mockOsNewClient._transport()).thenReturn(mockOsTransport);
    lenient().when(openSearchClient.getNewClient()).thenReturn(mockOsNewClient);

    // Enable calling real methods for the methods we want to test
    lenient().when(searchRepository.createBulkSink(10, 2, 1000000L)).thenCallRealMethod();
    lenient().when(searchRepository.createBulkSink(1, 1, 1L)).thenCallRealMethod();
    lenient().when(searchRepository.createBulkSink(1000, 100, 100000000L)).thenCallRealMethod();
    lenient().when(searchRepository.createBulkSink(50, 5, 5000000L)).thenCallRealMethod();
    lenient().when(searchRepository.createBulkSink(100, 10, 10000000L)).thenCallRealMethod();
    lenient().when(searchRepository.isVectorEmbeddingEnabled()).thenCallRealMethod();
  }

  @Test
  void testCreateBulkSinkForElasticSearch() {
    // Mock SearchRepository to return ElasticSearch type
    lenient()
        .when(searchRepository.getSearchType())
        .thenReturn(ElasticSearchConfiguration.SearchType.ELASTICSEARCH);
    lenient().when(searchRepository.getSearchClient()).thenReturn(elasticSearchClient);

    BulkSink bulkSink = searchRepository.createBulkSink(10, 2, 1000000L);

    assertNotNull(bulkSink);
    assertInstanceOf(ElasticSearchBulkSink.class, bulkSink);
  }

  @Test
  void testCreateBulkSinkForOpenSearch() {
    // Mock SearchRepository to return OpenSearch type
    lenient()
        .when(searchRepository.getSearchType())
        .thenReturn(ElasticSearchConfiguration.SearchType.OPENSEARCH);
    lenient().when(searchRepository.getSearchClient()).thenReturn(openSearchClient);

    BulkSink bulkSink = searchRepository.createBulkSink(10, 2, 1000000L);

    assertNotNull(bulkSink);
    assertInstanceOf(OpenSearchBulkSink.class, bulkSink);
  }

  @Test
  void testCreateBulkSinkWithDifferentParameters() {
    // Test with different parameter values
    lenient()
        .when(searchRepository.getSearchType())
        .thenReturn(ElasticSearchConfiguration.SearchType.ELASTICSEARCH);
    lenient().when(searchRepository.getSearchClient()).thenReturn(elasticSearchClient);

    BulkSink bulkSink1 = searchRepository.createBulkSink(50, 5, 5000000L);
    assertNotNull(bulkSink1);
    assertInstanceOf(ElasticSearchBulkSink.class, bulkSink1);

    BulkSink bulkSink2 = searchRepository.createBulkSink(100, 10, 10000000L);
    assertNotNull(bulkSink2);
    assertInstanceOf(ElasticSearchBulkSink.class, bulkSink2);
  }

  @Test
  void testIsVectorEmbeddingEnabled() {
    // Test default implementation returns false
    boolean result = searchRepository.isVectorEmbeddingEnabled();
    assertFalse(result);
  }

  @Test
  void testCreateBulkSinkParameterValidation() {
    lenient()
        .when(searchRepository.getSearchType())
        .thenReturn(ElasticSearchConfiguration.SearchType.ELASTICSEARCH);
    lenient().when(searchRepository.getSearchClient()).thenReturn(elasticSearchClient);

    // Test with minimum values
    BulkSink bulkSink1 = searchRepository.createBulkSink(1, 1, 1L);
    assertNotNull(bulkSink1);

    // Test with large values
    BulkSink bulkSink2 = searchRepository.createBulkSink(1000, 100, 100000000L);
    assertNotNull(bulkSink2);
  }

  @Test
  @SuppressWarnings("unchecked")
  void testUpdateEntitiesBulkWithMixedTypes() throws Exception {
    // This test verifies that updateEntitiesBulk correctly groups entities by type
    // and calls BulkSink.write with the correct entityType for each group

    // Create a real SearchRepository instance with mocked dependencies
    SearchRepository realSearchRepository = mock(SearchRepository.class);
    BulkSink mockBulkSink = mock(BulkSink.class);

    // Setup the mock to call the real method for updateEntitiesBulk
    when(realSearchRepository.createBulkSink(anyInt(), anyInt(), anyLong()))
        .thenReturn(mockBulkSink);
    doNothing().when(mockBulkSink).write(any(), any());
    when(mockBulkSink.flushAndAwait(anyInt())).thenReturn(true);
    doNothing().when(mockBulkSink).close();

    // Use doCallRealMethod for void method
    doCallRealMethod().when(realSearchRepository).updateEntitiesBulk(any());

    // Create mixed entity types
    List<EntityInterface> mixedEntities = new ArrayList<>();
    mixedEntities.add(new MockEntityWithType("table", "table1"));
    mixedEntities.add(new MockEntityWithType("table", "table2"));
    mixedEntities.add(new MockEntityWithType("databaseSchema", "schema1"));
    mixedEntities.add(new MockEntityWithType("databaseSchema", "schema2"));
    mixedEntities.add(new MockEntityWithType("database", "db1"));

    // Call the method
    realSearchRepository.updateEntitiesBulk(mixedEntities);

    // Capture the arguments passed to BulkSink.write
    ArgumentCaptor<List<EntityInterface>> entitiesCaptor = ArgumentCaptor.forClass(List.class);
    ArgumentCaptor<Map<String, Object>> contextCaptor = ArgumentCaptor.forClass(Map.class);

    // Verify write was called 3 times (once for each entity type)
    verify(mockBulkSink, times(3)).write(entitiesCaptor.capture(), contextCaptor.capture());

    // Get all captured values
    List<List<EntityInterface>> capturedEntities = entitiesCaptor.getAllValues();
    List<Map<String, Object>> capturedContexts = contextCaptor.getAllValues();

    // Verify each call had the correct entityType and entity count
    int tableCount = 0;
    int schemaCount = 0;
    int dbCount = 0;

    for (int i = 0; i < capturedContexts.size(); i++) {
      String entityType = (String) capturedContexts.get(i).get(ReindexingUtil.ENTITY_TYPE_KEY);
      int entityCount = capturedEntities.get(i).size();

      // Verify the entityType in context matches the actual entities
      for (Object entity : capturedEntities.get(i)) {
        EntityInterface e = (EntityInterface) entity;
        assertEquals(
            entityType,
            e.getEntityReference().getType(),
            "Entity type in context should match actual entity type");
      }

      switch (entityType) {
        case "table":
          tableCount = entityCount;
          break;
        case "databaseSchema":
          schemaCount = entityCount;
          break;
        case "database":
          dbCount = entityCount;
          break;
        default:
          break;
      }
    }

    assertEquals(2, tableCount, "Should have 2 table entities");
    assertEquals(2, schemaCount, "Should have 2 databaseSchema entities");
    assertEquals(1, dbCount, "Should have 1 database entity");
  }

  @Test
  @SuppressWarnings("unchecked")
  void testUpdateEntitiesBulkWithSingleType() throws Exception {
    // Test when all entities are of the same type - should only call write once

    SearchRepository realSearchRepository = mock(SearchRepository.class);
    BulkSink mockBulkSink = mock(BulkSink.class);

    when(realSearchRepository.createBulkSink(anyInt(), anyInt(), anyLong()))
        .thenReturn(mockBulkSink);
    doNothing().when(mockBulkSink).write(any(), any());
    when(mockBulkSink.flushAndAwait(anyInt())).thenReturn(true);
    doNothing().when(mockBulkSink).close();
    doCallRealMethod().when(realSearchRepository).updateEntitiesBulk(any());

    // Create entities of single type
    List<EntityInterface> entities = new ArrayList<>();
    entities.add(new MockEntityWithType("table", "table1"));
    entities.add(new MockEntityWithType("table", "table2"));
    entities.add(new MockEntityWithType("table", "table3"));

    realSearchRepository.updateEntitiesBulk(entities);

    // Capture the arguments
    ArgumentCaptor<List<EntityInterface>> entitiesCaptor = ArgumentCaptor.forClass(List.class);
    ArgumentCaptor<Map<String, Object>> contextCaptor = ArgumentCaptor.forClass(Map.class);

    // Verify write was called only once
    verify(mockBulkSink, times(1)).write(entitiesCaptor.capture(), contextCaptor.capture());

    // Verify correct entityType
    String entityType = (String) contextCaptor.getValue().get(ReindexingUtil.ENTITY_TYPE_KEY);
    assertEquals("table", entityType);
    assertEquals(3, entitiesCaptor.getValue().size());
  }

  @Test
  void testUpdateEntitiesBulkWithEmptyList() {
    // Test with empty list - should not call createBulkSink at all

    SearchRepository realSearchRepository = mock(SearchRepository.class);
    BulkSink mockBulkSink = mock(BulkSink.class);

    when(realSearchRepository.createBulkSink(anyInt(), anyInt(), anyLong()))
        .thenReturn(mockBulkSink);
    doCallRealMethod().when(realSearchRepository).updateEntitiesBulk(any());

    // Call with empty list
    realSearchRepository.updateEntitiesBulk(new ArrayList<>());

    // Verify createBulkSink was never called
    verify(realSearchRepository, times(0)).createBulkSink(anyInt(), anyInt(), anyLong());
  }

  @Test
  void testUpdateEntitiesBulkWithNull() {
    // Test with null - should handle gracefully

    SearchRepository realSearchRepository = mock(SearchRepository.class);
    BulkSink mockBulkSink = mock(BulkSink.class);

    when(realSearchRepository.createBulkSink(anyInt(), anyInt(), anyLong()))
        .thenReturn(mockBulkSink);
    doCallRealMethod().when(realSearchRepository).updateEntitiesBulk(any());

    // Call with null
    realSearchRepository.updateEntitiesBulk(null);

    // Verify createBulkSink was never called
    verify(realSearchRepository, times(0)).createBulkSink(anyInt(), anyInt(), anyLong());
  }

  /** Mock entity that allows setting a specific entity type for testing */
  static class MockEntityWithType implements EntityInterface {
    private final UUID id = UUID.randomUUID();
    private final String entityType;
    private final String name;
    private final String fqn;

    MockEntityWithType(String entityType, String name) {
      this.entityType = entityType;
      this.name = name;
      this.fqn = "test." + entityType + "." + name;
    }

    @Override
    public EntityReference getEntityReference() {
      return new EntityReference().withId(id).withType(entityType).withName(name);
    }

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
      return name;
    }

    @Override
    public String getName() {
      return name;
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
    @SuppressWarnings("unchecked")
    public <T extends EntityInterface> T withHref(URI href) {
      return (T) this;
    }
  }
}
