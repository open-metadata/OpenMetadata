package org.openmetadata.service.search.opensearch;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import java.io.IOException;
import java.util.Arrays;
import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.openmetadata.search.IndexMapping;
import os.org.opensearch.client.opensearch.OpenSearchClient;
import os.org.opensearch.client.opensearch.indices.CreateIndexRequest;
import os.org.opensearch.client.opensearch.indices.CreateIndexResponse;
import os.org.opensearch.client.opensearch.indices.DeleteIndexRequest;
import os.org.opensearch.client.opensearch.indices.DeleteIndexResponse;
import os.org.opensearch.client.opensearch.indices.ExistsRequest;
import os.org.opensearch.client.opensearch.indices.GetAliasRequest;
import os.org.opensearch.client.opensearch.indices.GetAliasResponse;
import os.org.opensearch.client.opensearch.indices.OpenSearchIndicesClient;
import os.org.opensearch.client.opensearch.indices.PutMappingRequest;
import os.org.opensearch.client.opensearch.indices.PutMappingResponse;
import os.org.opensearch.client.opensearch.indices.UpdateAliasesRequest;
import os.org.opensearch.client.opensearch.indices.UpdateAliasesResponse;
import os.org.opensearch.client.transport.endpoints.BooleanResponse;

@ExtendWith(MockitoExtension.class)
class OpenSearchIndexManagerTest {

  @Mock private OpenSearchClient openSearchClient;

  @Mock private OpenSearchIndicesClient indicesClient;

  @Mock private BooleanResponse booleanResponse;

  @Mock private CreateIndexResponse createIndexResponse;

  @Mock private PutMappingResponse putMappingResponse;

  @Mock private DeleteIndexResponse deleteIndexResponse;

  @Mock private UpdateAliasesResponse updateAliasesResponse;

  @Mock private GetAliasResponse getAliasResponse;

  @Mock private IndexMapping indexMapping;

  private OpenSearchIndexManager indexManager;
  private static final String TEST_INDEX = "test_index";
  private static final String TEST_ALIAS = "test_alias";
  private static final String CLUSTER_ALIAS = "test_cluster";

  @BeforeEach
  void setUp() {
    lenient().when(openSearchClient.indices()).thenReturn(indicesClient);
    indexManager = new OpenSearchIndexManager(openSearchClient, CLUSTER_ALIAS);
  }

  @Test
  void testIndexExists_ReturnsTrueWhenIndexExists() throws IOException {
    when(indicesClient.exists(any(ExistsRequest.class))).thenReturn(booleanResponse);
    when(booleanResponse.value()).thenReturn(true);

    boolean result = indexManager.indexExists(TEST_INDEX);

    assertTrue(result);
    verify(indicesClient).exists(any(ExistsRequest.class));
  }

  @Test
  void testIndexExists_ReturnsFalseWhenIndexDoesNotExist() throws IOException {
    when(indicesClient.exists(any(ExistsRequest.class))).thenReturn(booleanResponse);
    when(booleanResponse.value()).thenReturn(false);

    boolean result = indexManager.indexExists(TEST_INDEX);

    assertFalse(result);
    verify(indicesClient).exists(any(ExistsRequest.class));
  }

  @Test
  void testIndexExists_ReturnsFalseOnException() throws IOException {
    when(indicesClient.exists(any(ExistsRequest.class)))
        .thenThrow(new IOException("Connection error"));

    boolean result = indexManager.indexExists(TEST_INDEX);

    assertFalse(result);
    verify(indicesClient).exists(any(ExistsRequest.class));
  }

  @Test
  void testCreateIndex_SuccessfulCreation() throws IOException {
    String indexMappingContent =
        "{\"settings\":{\"number_of_shards\":1}, \"mappings\":{\"properties\":{}}}";
    when(indexMapping.getIndexName(CLUSTER_ALIAS)).thenReturn(TEST_INDEX);
    when(indexMapping.getAlias(CLUSTER_ALIAS)).thenReturn(TEST_ALIAS);
    when(indexMapping.getParentAliases(CLUSTER_ALIAS)).thenReturn(List.of());

    when(indicesClient.create(any(CreateIndexRequest.class))).thenReturn(createIndexResponse);
    when(indicesClient.updateAliases(any(UpdateAliasesRequest.class)))
        .thenReturn(updateAliasesResponse);

    indexManager.createIndex(indexMapping, indexMappingContent);

    verify(indicesClient).create(any(CreateIndexRequest.class));
    verify(indicesClient).updateAliases(any(UpdateAliasesRequest.class));
  }

  @Test
  void testCreateIndex_WithNullMappingContent() throws IOException {
    when(indexMapping.getIndexName(CLUSTER_ALIAS)).thenReturn(TEST_INDEX);
    when(indexMapping.getAlias(CLUSTER_ALIAS)).thenReturn(TEST_ALIAS);
    when(indexMapping.getParentAliases(CLUSTER_ALIAS)).thenReturn(List.of());

    when(indicesClient.create(any(CreateIndexRequest.class))).thenReturn(createIndexResponse);
    when(indicesClient.updateAliases(any(UpdateAliasesRequest.class)))
        .thenReturn(updateAliasesResponse);

    indexManager.createIndex(indexMapping, null);

    verify(indicesClient).create(any(CreateIndexRequest.class));
  }

  @Test
  void testCreateIndex_HandlesException() throws IOException {
    String indexMappingContent = "{\"settings\":{}, \"mappings\":{\"properties\":{}}}";
    when(indexMapping.getIndexName(CLUSTER_ALIAS)).thenReturn(TEST_INDEX);

    when(indicesClient.create(any(CreateIndexRequest.class)))
        .thenThrow(new IOException("Creation failed"));

    assertDoesNotThrow(() -> indexManager.createIndex(indexMapping, indexMappingContent));
    verify(indicesClient).create(any(CreateIndexRequest.class));
  }

  @Test
  void testUpdateIndex_SuccessfulUpdate() throws IOException {
    String indexMappingContent = "{\"properties\":{\"field1\":{\"type\":\"text\"}}}";
    when(indexMapping.getIndexName(CLUSTER_ALIAS)).thenReturn(TEST_INDEX);

    when(indicesClient.putMapping(any(PutMappingRequest.class))).thenReturn(putMappingResponse);

    indexManager.updateIndex(indexMapping, indexMappingContent);

    verify(indicesClient).putMapping(any(PutMappingRequest.class));
  }

  @Test
  void testUpdateIndex_WithNullMappingContent() throws IOException {
    when(indexMapping.getIndexName(CLUSTER_ALIAS)).thenReturn(TEST_INDEX);

    when(indicesClient.putMapping(any(PutMappingRequest.class))).thenReturn(putMappingResponse);

    indexManager.updateIndex(indexMapping, null);

    verify(indicesClient).putMapping(any(PutMappingRequest.class));
  }

  @Test
  void testUpdateIndex_HandlesException() throws IOException {
    String indexMappingContent = "{\"properties\":{}}";
    when(indexMapping.getIndexName(CLUSTER_ALIAS)).thenReturn(TEST_INDEX);

    when(indicesClient.putMapping(any(PutMappingRequest.class)))
        .thenThrow(new IOException("Update failed"));

    assertDoesNotThrow(() -> indexManager.updateIndex(indexMapping, indexMappingContent));
    verify(indicesClient).putMapping(any(PutMappingRequest.class));
  }

  @Test
  void testDeleteIndex_SuccessfulDeletion() throws IOException {
    when(indexMapping.getIndexName(CLUSTER_ALIAS)).thenReturn(TEST_INDEX);
    when(indicesClient.delete(any(DeleteIndexRequest.class))).thenReturn(deleteIndexResponse);

    indexManager.deleteIndex(indexMapping);

    verify(indicesClient).delete(any(DeleteIndexRequest.class));
  }

  @Test
  void testDeleteIndex_HandlesException() throws IOException {
    when(indexMapping.getIndexName(CLUSTER_ALIAS)).thenReturn(TEST_INDEX);
    when(indicesClient.delete(any(DeleteIndexRequest.class)))
        .thenThrow(new IOException("Deletion failed"));

    assertDoesNotThrow(() -> indexManager.deleteIndex(indexMapping));
    verify(indicesClient).delete(any(DeleteIndexRequest.class));
  }

  @Test
  void testCreateAliases_SuccessfulCreation() throws IOException {
    when(indexMapping.getAlias(CLUSTER_ALIAS)).thenReturn(TEST_ALIAS);
    when(indexMapping.getIndexName(CLUSTER_ALIAS)).thenReturn(TEST_INDEX);
    when(indexMapping.getParentAliases(CLUSTER_ALIAS))
        .thenReturn(Arrays.asList("parent1", "parent2"));

    when(indicesClient.updateAliases(any(UpdateAliasesRequest.class)))
        .thenReturn(updateAliasesResponse);

    indexManager.createAliases(indexMapping);

    verify(indicesClient).updateAliases(any(UpdateAliasesRequest.class));
  }

  @Test
  void testCreateAliases_WithEmptyParentAliases() throws IOException {
    when(indexMapping.getAlias(CLUSTER_ALIAS)).thenReturn(TEST_ALIAS);
    when(indexMapping.getIndexName(CLUSTER_ALIAS)).thenReturn(TEST_INDEX);
    when(indexMapping.getParentAliases(CLUSTER_ALIAS)).thenReturn(List.of());

    when(indicesClient.updateAliases(any(UpdateAliasesRequest.class)))
        .thenReturn(updateAliasesResponse);

    indexManager.createAliases(indexMapping);

    verify(indicesClient).updateAliases(any(UpdateAliasesRequest.class));
  }

  @Test
  void testCreateAliases_HandlesException() throws IOException {
    when(indexMapping.getAlias(CLUSTER_ALIAS)).thenReturn(TEST_ALIAS);
    when(indexMapping.getIndexName(CLUSTER_ALIAS)).thenReturn(TEST_INDEX);
    when(indexMapping.getParentAliases(CLUSTER_ALIAS)).thenReturn(List.of());

    when(indicesClient.updateAliases(any(UpdateAliasesRequest.class)))
        .thenThrow(new IOException("Alias creation failed"));

    assertDoesNotThrow(() -> indexManager.createAliases(indexMapping));
    verify(indicesClient).updateAliases(any(UpdateAliasesRequest.class));
  }

  @Test
  void testAddIndexAlias_SuccessfulAddition() throws IOException {
    when(indexMapping.getIndexName(CLUSTER_ALIAS)).thenReturn(TEST_INDEX);
    when(indicesClient.updateAliases(any(UpdateAliasesRequest.class)))
        .thenReturn(updateAliasesResponse);

    indexManager.addIndexAlias(indexMapping, TEST_ALIAS);

    verify(indicesClient).updateAliases(any(UpdateAliasesRequest.class));
  }

  @Test
  void testAddIndexAlias_HandlesException() throws IOException {
    when(indexMapping.getIndexName(CLUSTER_ALIAS)).thenReturn(TEST_INDEX);
    when(indicesClient.updateAliases(any(UpdateAliasesRequest.class)))
        .thenThrow(new IOException("Alias addition failed"));

    assertDoesNotThrow(() -> indexManager.addIndexAlias(indexMapping, TEST_ALIAS));
    verify(indicesClient).updateAliases(any(UpdateAliasesRequest.class));
  }

  @Test
  void testConstructor_HandlesNullClient() {
    OpenSearchIndexManager managerWithNullClient = new OpenSearchIndexManager(null, CLUSTER_ALIAS);

    assertNotNull(managerWithNullClient);
    assertFalse(managerWithNullClient.indexExists(TEST_INDEX));
  }

  @Test
  void testConstructor_HandlesNullClusterAlias() {
    OpenSearchIndexManager managerWithNullAlias =
        new OpenSearchIndexManager(openSearchClient, null);

    assertNotNull(managerWithNullAlias);
    verifyNoInteractions(indicesClient);
  }

  @Test
  void testCreateIndex_HandlesInvalidJson() throws IOException {
    String invalidJson = "invalid json";
    when(indexMapping.getIndexName(CLUSTER_ALIAS)).thenReturn(TEST_INDEX);

    assertDoesNotThrow(() -> indexManager.createIndex(indexMapping, invalidJson));
    verifyNoInteractions(indicesClient);
  }

  @Test
  void testUpdateIndex_HandlesInvalidJson() throws IOException {
    String invalidJson = "invalid json";
    when(indexMapping.getIndexName(CLUSTER_ALIAS)).thenReturn(TEST_INDEX);
    when(indicesClient.putMapping(any(PutMappingRequest.class))).thenReturn(putMappingResponse);

    assertDoesNotThrow(() -> indexManager.updateIndex(indexMapping, invalidJson));
    verify(indicesClient).putMapping(any(PutMappingRequest.class));
  }

  @Test
  void testCreateIndex_ClientNotAvailable() {
    OpenSearchIndexManager managerWithNullClient = new OpenSearchIndexManager(null, CLUSTER_ALIAS);
    lenient().when(indexMapping.getIndexName(CLUSTER_ALIAS)).thenReturn(TEST_INDEX);

    assertDoesNotThrow(() -> managerWithNullClient.createIndex(indexMapping, "{}"));
    verifyNoInteractions(indicesClient);
  }

  @Test
  void testCreateAliases_WithNullAlias() throws IOException {
    when(indexMapping.getAlias(CLUSTER_ALIAS)).thenReturn(null);
    when(indexMapping.getIndexName(CLUSTER_ALIAS)).thenReturn(TEST_INDEX);
    when(indexMapping.getParentAliases(CLUSTER_ALIAS)).thenReturn(List.of("parent1"));

    // Should still create parent aliases
    when(indicesClient.updateAliases(any(UpdateAliasesRequest.class)))
        .thenReturn(updateAliasesResponse);

    indexManager.createAliases(indexMapping);

    verify(indicesClient).updateAliases(any(UpdateAliasesRequest.class));
  }

  @Test
  void testAddAliases_SuccessfulAddition() throws IOException {
    Set<String> aliases = Set.of("alias1", "alias2");
    when(indicesClient.updateAliases(any(UpdateAliasesRequest.class)))
        .thenReturn(updateAliasesResponse);

    indexManager.addAliases(TEST_INDEX, aliases);

    verify(indicesClient).updateAliases(any(UpdateAliasesRequest.class));
  }

  @Test
  void testAddAliases_HandlesException() throws IOException {
    Set<String> aliases = Set.of("alias1", "alias2");
    when(indicesClient.updateAliases(any(UpdateAliasesRequest.class)))
        .thenThrow(new IOException("Add aliases failed"));

    assertDoesNotThrow(() -> indexManager.addAliases(TEST_INDEX, aliases));
    verify(indicesClient).updateAliases(any(UpdateAliasesRequest.class));
  }

  @Test
  void testAddAliases_ClientNotAvailable() {
    OpenSearchIndexManager managerWithNullClient = new OpenSearchIndexManager(null, CLUSTER_ALIAS);
    Set<String> aliases = Set.of("alias1", "alias2");

    assertDoesNotThrow(() -> managerWithNullClient.addAliases(TEST_INDEX, aliases));
    verifyNoInteractions(indicesClient);
  }

  @Test
  void testRemoveAliases_SuccessfulRemoval() throws IOException {
    Set<String> aliases = Set.of("alias1", "alias2");
    when(indicesClient.updateAliases(any(UpdateAliasesRequest.class)))
        .thenReturn(updateAliasesResponse);

    indexManager.removeAliases(TEST_INDEX, aliases);

    verify(indicesClient).updateAliases(any(UpdateAliasesRequest.class));
  }

  @Test
  void testRemoveAliases_HandlesException() throws IOException {
    Set<String> aliases = Set.of("alias1", "alias2");
    when(indicesClient.updateAliases(any(UpdateAliasesRequest.class)))
        .thenThrow(new IOException("Remove aliases failed"));

    assertDoesNotThrow(() -> indexManager.removeAliases(TEST_INDEX, aliases));
    verify(indicesClient).updateAliases(any(UpdateAliasesRequest.class));
  }

  @Test
  void testRemoveAliases_ClientNotAvailable() {
    OpenSearchIndexManager managerWithNullClient = new OpenSearchIndexManager(null, CLUSTER_ALIAS);
    Set<String> aliases = Set.of("alias1", "alias2");

    assertDoesNotThrow(() -> managerWithNullClient.removeAliases(TEST_INDEX, aliases));
    verifyNoInteractions(indicesClient);
  }

  @Test
  void testGetAliases_SuccessfulRetrieval() throws IOException {
    when(indicesClient.getAlias(any(GetAliasRequest.class))).thenReturn(getAliasResponse);

    Set<String> result = indexManager.getAliases(TEST_INDEX);

    verify(indicesClient).getAlias(any(GetAliasRequest.class));
    assertNotNull(result);
  }

  @Test
  void testGetAliases_HandlesException() throws IOException {
    when(indicesClient.getAlias(any(GetAliasRequest.class)))
        .thenThrow(new IOException("Get aliases failed"));

    Set<String> result = indexManager.getAliases(TEST_INDEX);

    assertTrue(result.isEmpty());
    verify(indicesClient).getAlias(any(GetAliasRequest.class));
  }

  @Test
  void testGetAliases_ClientNotAvailable() {
    OpenSearchIndexManager managerWithNullClient = new OpenSearchIndexManager(null, CLUSTER_ALIAS);

    Set<String> result = managerWithNullClient.getAliases(TEST_INDEX);

    assertTrue(result.isEmpty());
    verifyNoInteractions(indicesClient);
  }

  @Test
  void testGetIndicesByAlias_SuccessfulRetrieval() throws IOException {
    when(indicesClient.existsAlias(any(java.util.function.Function.class)))
        .thenReturn(booleanResponse);
    when(booleanResponse.value()).thenReturn(true);
    when(indicesClient.getAlias(any(GetAliasRequest.class))).thenReturn(getAliasResponse);

    Set<String> result = indexManager.getIndicesByAlias(TEST_ALIAS);

    verify(indicesClient).existsAlias(any(java.util.function.Function.class));
    verify(indicesClient).getAlias(any(GetAliasRequest.class));
    assertNotNull(result);
  }

  @Test
  void testGetIndicesByAlias_HandlesException() throws IOException {
    when(indicesClient.existsAlias(any(java.util.function.Function.class)))
        .thenReturn(booleanResponse);
    when(booleanResponse.value()).thenReturn(true);
    when(indicesClient.getAlias(any(GetAliasRequest.class)))
        .thenThrow(new IOException("Get indices by alias failed"));

    Set<String> result = indexManager.getIndicesByAlias(TEST_ALIAS);

    assertTrue(result.isEmpty());
    verify(indicesClient).existsAlias(any(java.util.function.Function.class));
    verify(indicesClient).getAlias(any(GetAliasRequest.class));
  }

  @Test
  void testGetIndicesByAlias_ClientNotAvailable() {
    OpenSearchIndexManager managerWithNullClient = new OpenSearchIndexManager(null, CLUSTER_ALIAS);

    Set<String> result = managerWithNullClient.getIndicesByAlias(TEST_ALIAS);

    assertTrue(result.isEmpty());
    verifyNoInteractions(indicesClient);
  }
}
