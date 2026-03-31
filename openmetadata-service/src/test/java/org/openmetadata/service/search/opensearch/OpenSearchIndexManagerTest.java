package org.openmetadata.service.search.opensearch;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.spy;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import java.io.IOException;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.openmetadata.search.IndexMapping;
import os.org.opensearch.client.opensearch.OpenSearchClient;
import os.org.opensearch.client.opensearch._types.DocStats;
import os.org.opensearch.client.opensearch._types.StoreStats;
import os.org.opensearch.client.opensearch.indices.AliasDefinition;
import os.org.opensearch.client.opensearch.indices.CreateIndexRequest;
import os.org.opensearch.client.opensearch.indices.CreateIndexResponse;
import os.org.opensearch.client.opensearch.indices.DeleteIndexRequest;
import os.org.opensearch.client.opensearch.indices.DeleteIndexResponse;
import os.org.opensearch.client.opensearch.indices.ExistsRequest;
import os.org.opensearch.client.opensearch.indices.GetAliasRequest;
import os.org.opensearch.client.opensearch.indices.GetAliasResponse;
import os.org.opensearch.client.opensearch.indices.IndicesStatsResponse;
import os.org.opensearch.client.opensearch.indices.OpenSearchIndicesClient;
import os.org.opensearch.client.opensearch.indices.PutMappingRequest;
import os.org.opensearch.client.opensearch.indices.PutMappingResponse;
import os.org.opensearch.client.opensearch.indices.UpdateAliasesRequest;
import os.org.opensearch.client.opensearch.indices.UpdateAliasesResponse;
import os.org.opensearch.client.opensearch.indices.get_alias.IndexAliases;
import os.org.opensearch.client.opensearch.indices.stats.IndexShardStats;
import os.org.opensearch.client.opensearch.indices.stats.IndexStats;
import os.org.opensearch.client.opensearch.indices.stats.IndicesStats;
import os.org.opensearch.client.opensearch.indices.stats.ShardRouting;
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

  @Mock private IndicesStatsResponse indicesStatsResponse;

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
  void testUpdateIndex_ClientNotAvailable() {
    OpenSearchIndexManager managerWithNullClient = new OpenSearchIndexManager(null, CLUSTER_ALIAS);

    assertDoesNotThrow(() -> managerWithNullClient.updateIndex(indexMapping, "{}"));
    verifyNoInteractions(indicesClient);
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
  void testCreateIndex_HandlesInvalidJson() {
    String invalidJson = "invalid json";
    when(indexMapping.getIndexName(CLUSTER_ALIAS)).thenReturn(TEST_INDEX);

    assertDoesNotThrow(() -> indexManager.createIndex(indexMapping, invalidJson));
    verifyNoInteractions(indicesClient);
  }

  @Test
  void testUpdateIndex_HandlesInvalidJson() {
    String invalidJson = "invalid json";
    when(indexMapping.getIndexName(CLUSTER_ALIAS)).thenReturn(TEST_INDEX);

    assertDoesNotThrow(() -> indexManager.updateIndex(indexMapping, invalidJson));
    verifyNoInteractions(indicesClient);
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
    when(indicesClient.getAlias(any(GetAliasRequest.class))).thenReturn(getAliasResponse);
    when(getAliasResponse.result())
        .thenReturn(
            Map.of(
                TEST_INDEX + "_v1", mock(IndexAliases.class),
                TEST_INDEX + "_v2", mock(IndexAliases.class)));
    when(indicesClient.updateAliases(any(UpdateAliasesRequest.class)))
        .thenReturn(updateAliasesResponse);
    when(updateAliasesResponse.acknowledged()).thenReturn(true);

    indexManager.addAliases(TEST_INDEX, aliases);

    verify(indicesClient).getAlias(any(GetAliasRequest.class));
    verify(indicesClient).updateAliases(any(UpdateAliasesRequest.class));
  }

  @Test
  void testAddAliases_HandlesException() throws IOException {
    Set<String> aliases = Set.of("alias1", "alias2");
    when(indicesClient.getAlias(any(GetAliasRequest.class))).thenReturn(getAliasResponse);
    when(getAliasResponse.result())
        .thenReturn(Map.of(TEST_INDEX + "_v1", mock(IndexAliases.class)));
    when(indicesClient.updateAliases(any(UpdateAliasesRequest.class)))
        .thenThrow(new IOException("Add aliases failed"));

    assertDoesNotThrow(() -> indexManager.addAliases(TEST_INDEX, aliases));
    verify(indicesClient).updateAliases(any(UpdateAliasesRequest.class));
  }

  @Test
  void testAddAliases_IgnoresEmptyAliasSet() {
    assertDoesNotThrow(() -> indexManager.addAliases(TEST_INDEX, Set.of()));

    verifyNoInteractions(indicesClient);
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
    when(updateAliasesResponse.acknowledged()).thenReturn(true);

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
  void testRemoveAliases_IgnoresEmptyAliasSet() {
    assertDoesNotThrow(() -> indexManager.removeAliases(TEST_INDEX, Set.of()));

    verifyNoInteractions(indicesClient);
  }

  @Test
  void testGetAliases_SuccessfulRetrieval() throws IOException {
    when(indicesClient.getAlias(any(GetAliasRequest.class))).thenReturn(getAliasResponse);
    IndexAliases aliasMetadata = mock(IndexAliases.class);
    when(getAliasResponse.result()).thenReturn(Map.of(TEST_INDEX, aliasMetadata));
    when(aliasMetadata.aliases())
        .thenReturn(
            Map.of("table", mock(AliasDefinition.class), "entity", mock(AliasDefinition.class)));

    Set<String> result = indexManager.getAliases(TEST_INDEX);

    verify(indicesClient).getAlias(any(GetAliasRequest.class));
    assertEquals(Set.of("table", "entity"), result);
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
    when(getAliasResponse.result())
        .thenReturn(Map.of("table_search_index_v1", mock(IndexAliases.class)));

    Set<String> result = indexManager.getIndicesByAlias(TEST_ALIAS);

    verify(indicesClient).existsAlias(any(java.util.function.Function.class));
    verify(indicesClient).getAlias(any(GetAliasRequest.class));
    assertEquals(Set.of("table_search_index_v1"), result);
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
  void testGetIndicesByAlias_ReturnsEmptyWhenAliasDoesNotExist() throws IOException {
    when(indicesClient.existsAlias(any(java.util.function.Function.class)))
        .thenReturn(booleanResponse);
    when(booleanResponse.value()).thenReturn(false);

    Set<String> result = indexManager.getIndicesByAlias(TEST_ALIAS);

    assertTrue(result.isEmpty());
    verify(indicesClient).existsAlias(any(java.util.function.Function.class));
    verify(indicesClient, never()).getAlias(any(GetAliasRequest.class));
  }

  @Test
  void testGetIndicesByAlias_ReturnsEmptyOnNotFoundException() throws IOException {
    os.org.opensearch.client.opensearch._types.OpenSearchException aliasMissingException =
        new os.org.opensearch.client.opensearch._types.OpenSearchException(
            buildErrorResponse(404, "alias_missing_exception"));
    when(indicesClient.existsAlias(any(java.util.function.Function.class)))
        .thenReturn(booleanResponse);
    when(booleanResponse.value()).thenReturn(true);
    when(indicesClient.getAlias(any(GetAliasRequest.class))).thenThrow(aliasMissingException);

    Set<String> result = indexManager.getIndicesByAlias(TEST_ALIAS);

    assertTrue(result.isEmpty());
    verify(indicesClient).getAlias(any(GetAliasRequest.class));
  }

  @Test
  void testGetIndicesByAlias_HandlesUnexpectedOpenSearchException() throws IOException {
    os.org.opensearch.client.opensearch._types.OpenSearchException unexpectedException =
        new os.org.opensearch.client.opensearch._types.OpenSearchException(
            buildErrorResponse(500, "internal_server_error"));
    when(indicesClient.existsAlias(any(java.util.function.Function.class)))
        .thenReturn(booleanResponse);
    when(booleanResponse.value()).thenReturn(true);
    when(indicesClient.getAlias(any(GetAliasRequest.class))).thenThrow(unexpectedException);

    Set<String> result = indexManager.getIndicesByAlias(TEST_ALIAS);

    assertTrue(result.isEmpty());
    verify(indicesClient).getAlias(any(GetAliasRequest.class));
  }

  @Test
  void testListIndicesByPrefix_ReturnsMatchingIndices() throws IOException {
    when(indicesClient.getAlias(any(GetAliasRequest.class))).thenReturn(getAliasResponse);
    when(getAliasResponse.result())
        .thenReturn(
            Map.of(
                "table_search_index_v1", mock(IndexAliases.class),
                "table_search_index_v2", mock(IndexAliases.class)));

    Set<String> result = indexManager.listIndicesByPrefix("table_search_index");

    assertEquals(Set.of("table_search_index_v1", "table_search_index_v2"), result);
    verify(indicesClient).getAlias(any(GetAliasRequest.class));
  }

  @Test
  void testListIndicesByPrefix_HandlesException() throws IOException {
    when(indicesClient.getAlias(any(GetAliasRequest.class)))
        .thenThrow(new IOException("prefix lookup failed"));

    Set<String> result = indexManager.listIndicesByPrefix(TEST_INDEX);

    assertTrue(result.isEmpty());
    verify(indicesClient).getAlias(any(GetAliasRequest.class));
  }

  @Test
  void testListIndicesByPrefix_ClientNotAvailable() {
    OpenSearchIndexManager managerWithNullClient = new OpenSearchIndexManager(null, CLUSTER_ALIAS);

    Set<String> result = managerWithNullClient.listIndicesByPrefix(TEST_INDEX);

    assertTrue(result.isEmpty());
    verifyNoInteractions(indicesClient);
  }

  @Test
  void testSwapAliases_ReturnsTrueWhenAliasesAreEmpty() {
    assertTrue(indexManager.swapAliases(Set.of("old_index"), "new_index", Set.of()));
    verifyNoInteractions(indicesClient);
  }

  @Test
  void testSwapAliases_ReturnsTrueWhenAcknowledged() throws IOException {
    when(indicesClient.updateAliases(any(UpdateAliasesRequest.class)))
        .thenReturn(updateAliasesResponse);
    when(updateAliasesResponse.acknowledged()).thenReturn(true);

    boolean result =
        indexManager.swapAliases(null, "table_search_index_v2", Set.of("table", "table_search"));

    assertTrue(result);
    verify(indicesClient).updateAliases(any(UpdateAliasesRequest.class));
  }

  @Test
  void testSwapAliases_ReturnsFalseWhenNotAcknowledged() throws IOException {
    when(indicesClient.updateAliases(any(UpdateAliasesRequest.class)))
        .thenReturn(updateAliasesResponse);
    when(updateAliasesResponse.acknowledged()).thenReturn(false);

    boolean result =
        indexManager.swapAliases(
            Set.of("table_search_index_v1"), "table_search_index_v2", Set.of("table"));

    assertFalse(result);
    verify(indicesClient).updateAliases(any(UpdateAliasesRequest.class));
  }

  @Test
  void testSwapAliases_ReturnsFalseOnException() throws IOException {
    when(indicesClient.updateAliases(any(UpdateAliasesRequest.class)))
        .thenThrow(new IOException("swap failed"));

    boolean result =
        indexManager.swapAliases(
            Set.of("table_search_index_v1"), "table_search_index_v2", Set.of("table"));

    assertFalse(result);
    verify(indicesClient).updateAliases(any(UpdateAliasesRequest.class));
  }

  @Test
  void testSwapAliases_ClientNotAvailable() {
    OpenSearchIndexManager managerWithNullClient = new OpenSearchIndexManager(null, CLUSTER_ALIAS);

    assertFalse(
        managerWithNullClient.swapAliases(Set.of(TEST_INDEX), "new_index", Set.of("table")));
    verifyNoInteractions(indicesClient);
  }

  @Test
  void testGetIndicesByAlias_ClientNotAvailable() {
    OpenSearchIndexManager managerWithNullClient = new OpenSearchIndexManager(null, CLUSTER_ALIAS);

    Set<String> result = managerWithNullClient.getIndicesByAlias(TEST_ALIAS);

    assertTrue(result.isEmpty());
    verifyNoInteractions(indicesClient);
  }

  @Test
  void testDeleteIndexWithBackoff_SuccessfulOnFirstAttempt() throws IOException {
    when(indicesClient.delete(any(DeleteIndexRequest.class))).thenReturn(deleteIndexResponse);
    when(deleteIndexResponse.acknowledged()).thenReturn(true);

    assertDoesNotThrow(() -> indexManager.deleteIndexWithBackoff(TEST_INDEX));
    verify(indicesClient).delete(any(DeleteIndexRequest.class));
  }

  @Test
  void testDeleteIndexWithBackoff_SuccessfulAfterRetry() throws IOException {
    os.org.opensearch.client.opensearch._types.OpenSearchException snapshotException =
        new os.org.opensearch.client.opensearch._types.OpenSearchException(
            buildErrorResponse(503, "snapshot_in_progress_exception"));

    when(indicesClient.delete(any(DeleteIndexRequest.class)))
        .thenThrow(snapshotException)
        .thenReturn(deleteIndexResponse);
    when(deleteIndexResponse.acknowledged()).thenReturn(true);

    assertDoesNotThrow(() -> indexManager.deleteIndexWithBackoff(TEST_INDEX));
    verify(indicesClient, org.mockito.Mockito.times(2)).delete(any(DeleteIndexRequest.class));
  }

  @Test
  void testDeleteIndexWithBackoff_FailsAfterMaxRetries() throws IOException {
    os.org.opensearch.client.opensearch._types.OpenSearchException snapshotException =
        new os.org.opensearch.client.opensearch._types.OpenSearchException(
            buildErrorResponse(400, "snapshot_in_progress_exception"));

    when(indicesClient.delete(any(DeleteIndexRequest.class))).thenThrow(snapshotException);

    assertDoesNotThrow(() -> indexManager.deleteIndexWithBackoff(TEST_INDEX));
    verify(indicesClient, org.mockito.Mockito.times(6)).delete(any(DeleteIndexRequest.class));
  }

  @Test
  void testDeleteIndexWithBackoff_NonRetryableError() throws IOException {
    os.org.opensearch.client.opensearch._types.OpenSearchException nonRetryableException =
        new os.org.opensearch.client.opensearch._types.OpenSearchException(
            buildErrorResponse(404, "index_not_found_exception"));

    when(indicesClient.delete(any(DeleteIndexRequest.class))).thenThrow(nonRetryableException);

    assertDoesNotThrow(() -> indexManager.deleteIndexWithBackoff(TEST_INDEX));
    verify(indicesClient, org.mockito.Mockito.times(1)).delete(any(DeleteIndexRequest.class));
  }

  @Test
  void testDeleteIndexWithBackoff_ClientNotAvailable() {
    OpenSearchIndexManager managerWithNullClient = new OpenSearchIndexManager(null, CLUSTER_ALIAS);

    assertDoesNotThrow(() -> managerWithNullClient.deleteIndexWithBackoff(TEST_INDEX));
    verifyNoInteractions(indicesClient);
  }

  @Test
  void testCreateIndexByName_SuccessfulCreation() throws IOException {
    when(indicesClient.create(any(CreateIndexRequest.class))).thenReturn(createIndexResponse);

    indexManager.createIndex(TEST_INDEX, null);

    verify(indicesClient).create(any(CreateIndexRequest.class));
  }

  @Test
  void testCreateIndexByName_HandlesException() throws IOException {
    when(indicesClient.create(any(CreateIndexRequest.class)))
        .thenThrow(new IOException("create failed"));

    assertDoesNotThrow(() -> indexManager.createIndex(TEST_INDEX, null));
    verify(indicesClient).create(any(CreateIndexRequest.class));
  }

  @Test
  void testCreateIndexByName_ClientNotAvailable() {
    OpenSearchIndexManager managerWithNullClient = new OpenSearchIndexManager(null, CLUSTER_ALIAS);

    assertDoesNotThrow(() -> managerWithNullClient.createIndex(TEST_INDEX, null));
    verifyNoInteractions(indicesClient);
  }

  @Test
  void testDeleteIndexByName_SuccessfulDeletion() throws IOException {
    when(indicesClient.delete(any(DeleteIndexRequest.class))).thenReturn(deleteIndexResponse);
    when(deleteIndexResponse.acknowledged()).thenReturn(true);

    indexManager.deleteIndex(TEST_INDEX);

    verify(indicesClient).delete(any(DeleteIndexRequest.class));
  }

  @Test
  void testDeleteIndexByName_ClientNotAvailable() {
    OpenSearchIndexManager managerWithNullClient = new OpenSearchIndexManager(null, CLUSTER_ALIAS);

    assertDoesNotThrow(() -> managerWithNullClient.deleteIndex(TEST_INDEX));
    verifyNoInteractions(indicesClient);
  }

  @Test
  void testGetAllIndexStats_AggregatesVisibleIndicesOnly() throws IOException {
    OpenSearchIndexManager spyManager =
        spy(new OpenSearchIndexManager(openSearchClient, CLUSTER_ALIAS));
    IndicesStats visibleStats = mock(IndicesStats.class);
    IndexStats primaryStats = mock(IndexStats.class);
    DocStats docStats = mock(DocStats.class);
    StoreStats storeStats = mock(StoreStats.class);
    IndexShardStats primaryShard = mock(IndexShardStats.class);
    IndexShardStats replicaShard = mock(IndexShardStats.class);
    ShardRouting primaryRouting = mock(ShardRouting.class);
    ShardRouting replicaRouting = mock(ShardRouting.class);

    when(indicesClient.stats(any(java.util.function.Function.class)))
        .thenReturn(indicesStatsResponse);
    when(indicesStatsResponse.indices())
        .thenReturn(Map.of(".kibana", mock(IndicesStats.class), TEST_INDEX, visibleStats));
    when(visibleStats.primaries()).thenReturn(primaryStats);
    when(primaryStats.docs()).thenReturn(docStats);
    when(docStats.count()).thenReturn(42L);
    when(primaryStats.store()).thenReturn(storeStats);
    when(storeStats.sizeInBytes()).thenReturn(128L);
    when(visibleStats.shards()).thenReturn(Map.of("0", List.of(primaryShard, replicaShard)));
    when(primaryShard.routing()).thenReturn(primaryRouting);
    when(primaryRouting.primary()).thenReturn(true);
    when(replicaShard.routing()).thenReturn(replicaRouting);
    when(replicaRouting.primary()).thenReturn(false);
    doReturn(Set.of("table", "entity")).when(spyManager).getAliases(TEST_INDEX);

    var result = spyManager.getAllIndexStats();

    assertEquals(1, result.size());
    assertEquals(TEST_INDEX, result.get(0).name());
    assertEquals(42L, result.get(0).documents());
    assertEquals(1, result.get(0).primaryShards());
    assertEquals(1, result.get(0).replicaShards());
    assertEquals(128L, result.get(0).sizeInBytes());
    assertEquals("GREEN", result.get(0).health());
    assertEquals(Set.of("table", "entity"), result.get(0).aliases());
    verify(spyManager).getAliases(TEST_INDEX);
    verify(spyManager, never()).getAliases(".kibana");
  }

  private os.org.opensearch.client.opensearch._types.ErrorResponse buildErrorResponse(
      int status, String type) {
    return new os.org.opensearch.client.opensearch._types.ErrorResponse.Builder()
        .status(status)
        .error(error -> error.type(type).reason(type))
        .build();
  }
}
