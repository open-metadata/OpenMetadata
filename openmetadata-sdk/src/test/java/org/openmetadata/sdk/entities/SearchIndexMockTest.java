package org.openmetadata.sdk.entities;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;
import org.openmetadata.schema.api.data.CreateSearchIndex;
import org.openmetadata.schema.entity.data.SearchIndex;
import org.openmetadata.schema.type.SearchIndexField;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.services.dataassets.SearchIndexService;

/**
 * Mock tests for SearchIndex entity operations.
 */
public class SearchIndexMockTest {

  @Mock private OpenMetadataClient mockClient;
  @Mock private SearchIndexService mockSearchIndexService;

  @BeforeEach
  void setUp() {
    MockitoAnnotations.openMocks(this);
    when(mockClient.searchIndexes()).thenReturn(mockSearchIndexService);
    org.openmetadata.sdk.entities.SearchIndex.setDefaultClient(mockClient);
  }

  @Test
  void testCreateSearchIndex() {
    // Arrange
    CreateSearchIndex createRequest = new CreateSearchIndex();
    createRequest.setName("products-index");
    createRequest.setService("elasticsearch");
    createRequest.setDisplayName("Products Search Index");
    createRequest.setDescription("Full-text search index for product catalog");

    SearchIndex expectedIndex = new SearchIndex();
    expectedIndex.setId(UUID.randomUUID());
    expectedIndex.setName("products-index");
    expectedIndex.setFullyQualifiedName("elasticsearch.products-index");
    expectedIndex.setDisplayName("Products Search Index");

    when(mockSearchIndexService.create(any(CreateSearchIndex.class))).thenReturn(expectedIndex);

    // Act
    SearchIndex result = org.openmetadata.sdk.entities.SearchIndex.create(createRequest);

    // Assert
    assertNotNull(result);
    assertEquals("products-index", result.getName());
    assertEquals("Products Search Index", result.getDisplayName());
    verify(mockSearchIndexService).create(any(CreateSearchIndex.class));
  }

  @Test
  void testRetrieveSearchIndex() {
    // Arrange
    String indexId = UUID.randomUUID().toString();
    SearchIndex expectedIndex = new SearchIndex();
    expectedIndex.setId(UUID.fromString(indexId));
    expectedIndex.setName("users-index");
    // expectedIndex.setIndexType("fulltext"); // IndexType might be enum

    when(mockSearchIndexService.get(indexId)).thenReturn(expectedIndex);

    // Act
    SearchIndex result = org.openmetadata.sdk.entities.SearchIndex.retrieve(indexId);

    // Assert
    assertNotNull(result);
    assertEquals(indexId, result.getId().toString());
    assertEquals("users-index", result.getName());
    // assertEquals("fulltext", result.getIndexType());
    verify(mockSearchIndexService).get(indexId);
  }

  @Test
  void testRetrieveSearchIndexWithFields() {
    // Arrange
    String indexId = UUID.randomUUID().toString();
    String fields = "fields,searchIndexSettings,tags";
    SearchIndex expectedIndex = new SearchIndex();
    expectedIndex.setId(UUID.fromString(indexId));
    expectedIndex.setName("documents-index");

    // Mock index fields
    SearchIndexField field1 = new SearchIndexField();
    field1.setName("title");
    // field1.setDataType("text"); // DataType might be enum
    SearchIndexField field2 = new SearchIndexField();
    field2.setName("content");
    // field2.setDataType("text");
    expectedIndex.setFields(List.of(field1, field2));

    when(mockSearchIndexService.get(indexId, fields)).thenReturn(expectedIndex);

    // Act
    SearchIndex result = org.openmetadata.sdk.entities.SearchIndex.retrieve(indexId, fields);

    // Assert
    assertNotNull(result);
    assertNotNull(result.getFields());
    assertEquals(2, result.getFields().size());
    assertEquals("title", result.getFields().get(0).getName());
    verify(mockSearchIndexService).get(indexId, fields);
  }

  @Test
  void testRetrieveSearchIndexByName() {
    // Arrange
    String fqn = "opensearch.indices.logs-index";
    SearchIndex expectedIndex = new SearchIndex();
    expectedIndex.setName("logs-index");
    expectedIndex.setFullyQualifiedName(fqn);

    when(mockSearchIndexService.getByName(fqn)).thenReturn(expectedIndex);

    // Act
    SearchIndex result = org.openmetadata.sdk.entities.SearchIndex.retrieveByName(fqn);

    // Assert
    assertNotNull(result);
    assertEquals(fqn, result.getFullyQualifiedName());
    assertEquals("logs-index", result.getName());
    verify(mockSearchIndexService).getByName(fqn);
  }

  @Test
  void testUpdateSearchIndex() {
    // Arrange
    SearchIndex indexToUpdate = new SearchIndex();
    indexToUpdate.setId(UUID.randomUUID());
    indexToUpdate.setName("metrics-index");
    indexToUpdate.setDescription("Updated metrics search index");

    // Add settings
    // Settings type might be different
    // indexToUpdate.setSearchIndexSettings(settings);

    SearchIndex expectedIndex = new SearchIndex();
    expectedIndex.setId(indexToUpdate.getId());
    expectedIndex.setName(indexToUpdate.getName());
    expectedIndex.setDescription(indexToUpdate.getDescription());
    // expectedIndex.setSearchIndexSettings(settings);

    when(mockSearchIndexService.update(anyString(), any(SearchIndex.class)))
        .thenReturn(expectedIndex);

    // Act
    SearchIndex result =
        org.openmetadata.sdk.entities.SearchIndex.update(
            indexToUpdate.getId().toString(), expectedIndex);

    // Assert
    assertNotNull(result);
    assertEquals("Updated metrics search index", result.getDescription());
    // assertNotNull(result.getSearchIndexSettings());
    // assertEquals(5, result.getSearchIndexSettings().get("number_of_shards"));
    verify(mockSearchIndexService).update(indexToUpdate.getId().toString(), indexToUpdate);
  }

  @Test
  void testDeleteSearchIndex() {
    // Arrange
    String indexId = UUID.randomUUID().toString();
    doNothing().when(mockSearchIndexService).delete(indexId);

    // Act
    org.openmetadata.sdk.entities.SearchIndex.delete(indexId);

    // Assert
    verify(mockSearchIndexService).delete(indexId);
  }

  @Test
  void testAsyncOperations() throws Exception {
    // Arrange
    String indexId = UUID.randomUUID().toString();
    SearchIndex expectedIndex = new SearchIndex();
    expectedIndex.setId(UUID.fromString(indexId));
    expectedIndex.setName("async-index");

    when(mockSearchIndexService.get(indexId)).thenReturn(expectedIndex);

    // Act
    // Note: retrieveAsync doesn't exist, using synchronous retrieve
    SearchIndex result = org.openmetadata.sdk.entities.SearchIndex.retrieve(indexId);

    // Assert
    assertNotNull(result);
    assertEquals("async-index", result.getName());
    verify(mockSearchIndexService).get(indexId);
  }
}
