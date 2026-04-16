package org.openmetadata.service.search.elasticsearch;

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

import es.co.elastic.clients.elasticsearch.ElasticsearchClient;
import es.co.elastic.clients.elasticsearch._types.DocStats;
import es.co.elastic.clients.elasticsearch._types.HealthStatus;
import es.co.elastic.clients.elasticsearch._types.StoreStats;
import es.co.elastic.clients.elasticsearch.indices.AliasDefinition;
import es.co.elastic.clients.elasticsearch.indices.CreateIndexRequest;
import es.co.elastic.clients.elasticsearch.indices.CreateIndexResponse;
import es.co.elastic.clients.elasticsearch.indices.DeleteIndexRequest;
import es.co.elastic.clients.elasticsearch.indices.DeleteIndexResponse;
import es.co.elastic.clients.elasticsearch.indices.ElasticsearchIndicesClient;
import es.co.elastic.clients.elasticsearch.indices.ExistsRequest;
import es.co.elastic.clients.elasticsearch.indices.GetAliasRequest;
import es.co.elastic.clients.elasticsearch.indices.GetAliasResponse;
import es.co.elastic.clients.elasticsearch.indices.IndicesStatsResponse;
import es.co.elastic.clients.elasticsearch.indices.PutMappingRequest;
import es.co.elastic.clients.elasticsearch.indices.PutMappingResponse;
import es.co.elastic.clients.elasticsearch.indices.UpdateAliasesRequest;
import es.co.elastic.clients.elasticsearch.indices.UpdateAliasesResponse;
import es.co.elastic.clients.elasticsearch.indices.get_alias.IndexAliases;
import es.co.elastic.clients.elasticsearch.indices.stats.IndexStats;
import es.co.elastic.clients.elasticsearch.indices.stats.IndicesStats;
import es.co.elastic.clients.elasticsearch.indices.stats.ShardRouting;
import es.co.elastic.clients.elasticsearch.indices.stats.ShardStats;
import es.co.elastic.clients.transport.endpoints.BooleanResponse;
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

@ExtendWith(MockitoExtension.class)
class ElasticSearchIndexManagerTest {

  @Mock private ElasticsearchClient elasticsearchClient;

  @Mock private ElasticsearchIndicesClient indicesClient;

  @Mock private BooleanResponse booleanResponse;

  @Mock private CreateIndexResponse createIndexResponse;

  @Mock private PutMappingResponse putMappingResponse;

  @Mock private DeleteIndexResponse deleteIndexResponse;

  @Mock private UpdateAliasesResponse updateAliasesResponse;

  @Mock private GetAliasResponse getAliasResponse;

  @Mock private IndicesStatsResponse indicesStatsResponse;

  @Mock private IndexMapping indexMapping;

  private ElasticSearchIndexManager indexManager;
  private static final String TEST_INDEX = "test_index";
  private static final String TEST_ALIAS = "test_alias";
  private static final String CLUSTER_ALIAS = "test_cluster";

  @BeforeEach
  void setUp() {
    lenient().when(elasticsearchClient.indices()).thenReturn(indicesClient);
    indexManager = new ElasticSearchIndexManager(elasticsearchClient, CLUSTER_ALIAS);
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
    ElasticSearchIndexManager managerWithNullClient =
        new ElasticSearchIndexManager(null, CLUSTER_ALIAS);

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
    ElasticSearchIndexManager managerWithNullClient =
        new ElasticSearchIndexManager(null, CLUSTER_ALIAS);

    assertNotNull(managerWithNullClient);
    assertFalse(managerWithNullClient.indexExists(TEST_INDEX));
  }

  @Test
  void testConstructor_HandlesNullClusterAlias() {
    ElasticSearchIndexManager managerWithNullAlias =
        new ElasticSearchIndexManager(elasticsearchClient, null);

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
    ElasticSearchIndexManager managerWithNullClient =
        new ElasticSearchIndexManager(null, CLUSTER_ALIAS);
    lenient().when(indexMapping.getIndexName(CLUSTER_ALIAS)).thenReturn(TEST_INDEX);

    assertDoesNotThrow(() -> managerWithNullClient.createIndex(indexMapping, "{}"));
    verifyNoInteractions(indicesClient);
  }

  @Test
  void testCreateAliases_WithNullAlias() throws IOException {
    when(indexMapping.getAlias(CLUSTER_ALIAS)).thenReturn(null);
    when(indexMapping.getIndexName(CLUSTER_ALIAS)).thenReturn(TEST_INDEX);
    when(indexMapping.getParentAliases(CLUSTER_ALIAS)).thenReturn(List.of("parent1"));
    when(indicesClient.updateAliases(any(UpdateAliasesRequest.class)))
        .thenReturn(updateAliasesResponse);

    indexManager.createAliases(indexMapping);

    verify(indicesClient).updateAliases(any(UpdateAliasesRequest.class));
  }

  @Test
  void testAddAliases_SuccessfulAddition() throws IOException {
    Set<String> aliases = Set.of("alias1", "alias2");
    when(indicesClient.getAlias(any(GetAliasRequest.class))).thenReturn(getAliasResponse);
    when(getAliasResponse.aliases())
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
    when(getAliasResponse.aliases())
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
    ElasticSearchIndexManager managerWithNullClient =
        new ElasticSearchIndexManager(null, CLUSTER_ALIAS);
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
    ElasticSearchIndexManager managerWithNullClient =
        new ElasticSearchIndexManager(null, CLUSTER_ALIAS);
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
    when(getAliasResponse.aliases()).thenReturn(Map.of(TEST_INDEX, aliasMetadata));
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
    ElasticSearchIndexManager managerWithNullClient =
        new ElasticSearchIndexManager(null, CLUSTER_ALIAS);

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
    when(getAliasResponse.aliases())
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
    es.co.elastic.clients.elasticsearch._types.ElasticsearchException aliasMissingException =
        new es.co.elastic.clients.elasticsearch._types.ElasticsearchException(
            "Alias missing", buildErrorResponse(404, "alias_missing_exception"));
    when(indicesClient.existsAlias(any(java.util.function.Function.class)))
        .thenReturn(booleanResponse);
    when(booleanResponse.value()).thenReturn(true);
    when(indicesClient.getAlias(any(GetAliasRequest.class))).thenThrow(aliasMissingException);

    Set<String> result = indexManager.getIndicesByAlias(TEST_ALIAS);

    assertTrue(result.isEmpty());
    verify(indicesClient).getAlias(any(GetAliasRequest.class));
  }

  @Test
  void testGetIndicesByAlias_HandlesUnexpectedElasticsearchException() throws IOException {
    es.co.elastic.clients.elasticsearch._types.ElasticsearchException unexpectedException =
        new es.co.elastic.clients.elasticsearch._types.ElasticsearchException(
            "Internal error", buildErrorResponse(500, "internal_server_error"));
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
    when(getAliasResponse.aliases())
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
    ElasticSearchIndexManager managerWithNullClient =
        new ElasticSearchIndexManager(null, CLUSTER_ALIAS);

    assertFalse(
        managerWithNullClient.swapAliases(Set.of(TEST_INDEX), "new_index", Set.of("table")));
    verifyNoInteractions(indicesClient);
  }

  @Test
  void testGetIndicesByAlias_ClientNotAvailable() {
    ElasticSearchIndexManager managerWithNullClient =
        new ElasticSearchIndexManager(null, CLUSTER_ALIAS);

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
    es.co.elastic.clients.elasticsearch._types.ElasticsearchException snapshotException =
        new es.co.elastic.clients.elasticsearch._types.ElasticsearchException(
            "Snapshot in progress", buildErrorResponse(503, "snapshot_in_progress_exception"));

    when(indicesClient.delete(any(DeleteIndexRequest.class)))
        .thenThrow(snapshotException)
        .thenReturn(deleteIndexResponse);
    when(deleteIndexResponse.acknowledged()).thenReturn(true);

    assertDoesNotThrow(() -> indexManager.deleteIndexWithBackoff(TEST_INDEX));
    verify(indicesClient, org.mockito.Mockito.times(2)).delete(any(DeleteIndexRequest.class));
  }

  @Test
  void testDeleteIndexWithBackoff_FailsAfterMaxRetries() throws IOException {
    es.co.elastic.clients.elasticsearch._types.ElasticsearchException snapshotException =
        new es.co.elastic.clients.elasticsearch._types.ElasticsearchException(
            "Snapshot in progress", buildErrorResponse(400, "snapshot_in_progress_exception"));

    when(indicesClient.delete(any(DeleteIndexRequest.class))).thenThrow(snapshotException);

    assertDoesNotThrow(() -> indexManager.deleteIndexWithBackoff(TEST_INDEX));
    verify(indicesClient, org.mockito.Mockito.times(6)).delete(any(DeleteIndexRequest.class));
  }

  @Test
  void testDeleteIndexWithBackoff_NonRetryableError() throws IOException {
    es.co.elastic.clients.elasticsearch._types.ElasticsearchException nonRetryableException =
        new es.co.elastic.clients.elasticsearch._types.ElasticsearchException(
            "Index not found", buildErrorResponse(404, "index_not_found_exception"));

    when(indicesClient.delete(any(DeleteIndexRequest.class))).thenThrow(nonRetryableException);

    assertDoesNotThrow(() -> indexManager.deleteIndexWithBackoff(TEST_INDEX));
    verify(indicesClient, org.mockito.Mockito.times(1)).delete(any(DeleteIndexRequest.class));
  }

  @Test
  void testDeleteIndexWithBackoff_ClientNotAvailable() {
    ElasticSearchIndexManager managerWithNullClient =
        new ElasticSearchIndexManager(null, CLUSTER_ALIAS);

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
    ElasticSearchIndexManager managerWithNullClient =
        new ElasticSearchIndexManager(null, CLUSTER_ALIAS);

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
    ElasticSearchIndexManager managerWithNullClient =
        new ElasticSearchIndexManager(null, CLUSTER_ALIAS);

    assertDoesNotThrow(() -> managerWithNullClient.deleteIndex(TEST_INDEX));
    verifyNoInteractions(indicesClient);
  }

  @Test
  void testGetAllIndexStats_AggregatesVisibleIndicesAndHealth() throws IOException {
    ElasticSearchIndexManager spyManager =
        spy(new ElasticSearchIndexManager(elasticsearchClient, CLUSTER_ALIAS));
    IndicesStats visibleStats = mock(IndicesStats.class);
    IndicesStats statsWithoutPrimaries = mock(IndicesStats.class);
    IndexStats primaryStats = mock(IndexStats.class);
    DocStats docStats = mock(DocStats.class);
    StoreStats storeStats = mock(StoreStats.class);
    ShardStats primaryShard = mock(ShardStats.class);
    ShardStats replicaShard = mock(ShardStats.class);
    ShardRouting primaryRouting = mock(ShardRouting.class);
    ShardRouting replicaRouting = mock(ShardRouting.class);

    when(indicesClient.stats(any(java.util.function.Function.class)))
        .thenReturn(indicesStatsResponse);
    when(indicesStatsResponse.indices())
        .thenReturn(
            Map.of(
                ".kibana",
                mock(IndicesStats.class),
                TEST_INDEX,
                visibleStats,
                "entity_search_index",
                statsWithoutPrimaries));
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
    when(visibleStats.health()).thenReturn(HealthStatus.Yellow);
    when(statsWithoutPrimaries.health()).thenReturn(null);
    when(statsWithoutPrimaries.primaries()).thenReturn(null);
    when(statsWithoutPrimaries.shards()).thenReturn(null);
    doReturn(Set.of("table")).when(spyManager).getAliases(TEST_INDEX);
    doReturn(Set.of("entity")).when(spyManager).getAliases("entity_search_index");

    var result = spyManager.getAllIndexStats();
    var testIndexStats =
        result.stream().filter(stat -> TEST_INDEX.equals(stat.name())).findFirst().orElseThrow();
    var entityIndexStats =
        result.stream()
            .filter(stat -> "entity_search_index".equals(stat.name()))
            .findFirst()
            .orElseThrow();

    assertEquals(2, result.size());
    assertEquals(42L, testIndexStats.documents());
    assertEquals(1, testIndexStats.primaryShards());
    assertEquals(1, testIndexStats.replicaShards());
    assertEquals(128L, testIndexStats.sizeInBytes());
    assertEquals("YELLOW", testIndexStats.health());
    assertEquals(Set.of("table"), testIndexStats.aliases());
    assertEquals(0L, entityIndexStats.documents());
    assertEquals(0, entityIndexStats.primaryShards());
    assertEquals(0, entityIndexStats.replicaShards());
    assertEquals(0L, entityIndexStats.sizeInBytes());
    assertEquals("UNKNOWN", entityIndexStats.health());
    assertEquals(Set.of("entity"), entityIndexStats.aliases());
    verify(spyManager).getAliases(TEST_INDEX);
    verify(spyManager).getAliases("entity_search_index");
    verify(spyManager, never()).getAliases(".kibana");
  }

  private es.co.elastic.clients.elasticsearch._types.ErrorResponse buildErrorResponse(
      int status, String type) {
    return new es.co.elastic.clients.elasticsearch._types.ErrorResponse.Builder()
        .status(status)
        .error(error -> error.type(type).reason(type))
        .build();
  }
}
