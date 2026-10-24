package org.openmetadata.service.apps.bundles.searchIndex;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Answers.RETURNS_DEEP_STUBS;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import org.junit.jupiter.api.Test;
import org.openmetadata.schema.service.configuration.elasticsearch.ElasticSearchConfiguration;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.search.elasticsearch.ElasticSearchClient;
import org.openmetadata.service.search.opensearch.OpenSearchClient;

class SearchIndexClusterValidatorTest {

  private final SearchRepository searchRepository = mock(SearchRepository.class);

  @Test
  void clusterCapacityRecordComputesThresholdAndCapacityChecks() {
    SearchIndexClusterValidator.ClusterCapacity capacity =
        new SearchIndexClusterValidator.ClusterCapacity(450, 500, 0.9, 50);

    assertTrue(capacity.isAboveThreshold(0.85));
    assertTrue(capacity.hasCapacityFor(20));
  }

  @Test
  void getClusterCapacityReadsOpenSearchStatsAndPersistentShardLimit() throws Exception {
    SearchIndexClusterValidator validator = new SearchIndexClusterValidator();
    OpenSearchClient client = mock(OpenSearchClient.class, RETURNS_DEEP_STUBS);

    when(searchRepository.getSearchType())
        .thenReturn(ElasticSearchConfiguration.SearchType.OPENSEARCH);
    when(searchRepository.getSearchClient()).thenReturn(client);
    when(client.clusterStats().nodes().count().total()).thenReturn(3);
    when(client.clusterStats().indices().shards().total()).thenReturn(450);
    when(client.clusterSettings().persistent().get("cluster.max_shards_per_node"))
        .thenReturn(os.org.opensearch.client.json.JsonData.of(200));

    SearchIndexClusterValidator.ClusterCapacity capacity =
        validator.getClusterCapacity(searchRepository);

    assertEquals(450, capacity.currentShards());
    assertEquals(600, capacity.maxShards());
    assertEquals(150, capacity.availableShards());
    assertEquals(0.75, capacity.usagePercent(), 0.0001);
  }

  @Test
  void getClusterCapacityReadsElasticDefaultsWhenPersistentSettingsMissing() throws Exception {
    SearchIndexClusterValidator validator = new SearchIndexClusterValidator();
    ElasticSearchClient client = mock(ElasticSearchClient.class, RETURNS_DEEP_STUBS);

    when(searchRepository.getSearchType())
        .thenReturn(ElasticSearchConfiguration.SearchType.ELASTICSEARCH);
    when(searchRepository.getSearchClient()).thenReturn(client);
    when(client.clusterStats().nodes().count().total()).thenReturn(2);
    when(client.clusterStats().indices().shards().total()).thenReturn(120.0);
    when(client.clusterSettings().persistent().get("cluster.max_shards_per_node")).thenReturn(null);
    when(client.clusterSettings().defaults().get("cluster.max_shards_per_node"))
        .thenReturn(es.co.elastic.clients.json.JsonData.of(150));

    SearchIndexClusterValidator.ClusterCapacity capacity =
        validator.getClusterCapacity(searchRepository);

    assertEquals(120, capacity.currentShards());
    assertEquals(300, capacity.maxShards());
    assertEquals(180, capacity.availableShards());
    assertEquals(0.4, capacity.usagePercent(), 0.0001);
  }

  @Test
  void getClusterCapacityFallsBackToConservativeEstimateWhenSearchTypeIsMissing() {
    SearchIndexClusterValidator validator = new SearchIndexClusterValidator();

    when(searchRepository.getSearchType()).thenReturn(null);
    when(searchRepository.getSearchClient()).thenReturn(mock(OpenSearchClient.class));

    SearchIndexClusterValidator.ClusterCapacity capacity =
        validator.getClusterCapacity(searchRepository);

    assertEquals(0, capacity.currentShards());
    assertEquals(1000, capacity.maxShards());
    assertEquals(1000, capacity.availableShards());
  }

  @Test
  void getClusterCapacityUsesConservativeEstimateWhenElasticStatsLookupFails() throws Exception {
    SearchIndexClusterValidator validator = new SearchIndexClusterValidator();
    ElasticSearchClient client = mock(ElasticSearchClient.class, RETURNS_DEEP_STUBS);

    when(searchRepository.getSearchType())
        .thenReturn(ElasticSearchConfiguration.SearchType.ELASTICSEARCH);
    when(searchRepository.getSearchClient()).thenReturn(client);
    when(client.clusterStats()).thenThrow(new java.io.IOException("stats unavailable"));

    SearchIndexClusterValidator.ClusterCapacity capacity =
        validator.getClusterCapacity(searchRepository);

    assertEquals(0, capacity.currentShards());
    assertEquals(1000, capacity.maxShards());
    assertEquals(1000, capacity.availableShards());
  }

  @Test
  void getClusterCapacityUsesConservativeEstimateWhenOpenSearchStatsLookupFails() throws Exception {
    SearchIndexClusterValidator validator = new SearchIndexClusterValidator();
    OpenSearchClient client = mock(OpenSearchClient.class, RETURNS_DEEP_STUBS);

    when(searchRepository.getSearchType())
        .thenReturn(ElasticSearchConfiguration.SearchType.OPENSEARCH);
    when(searchRepository.getSearchClient()).thenReturn(client);
    when(client.clusterStats()).thenThrow(new java.io.IOException("stats unavailable"));

    SearchIndexClusterValidator.ClusterCapacity capacity =
        validator.getClusterCapacity(searchRepository);

    assertEquals(0, capacity.currentShards());
    assertEquals(1000, capacity.maxShards());
    assertEquals(1000, capacity.availableShards());
  }

  @Test
  void getClusterCapacityFallsBackToDefaultShardLimitWhenOpenSearchSettingIsInvalid()
      throws Exception {
    SearchIndexClusterValidator validator = new SearchIndexClusterValidator();
    OpenSearchClient client = mock(OpenSearchClient.class, RETURNS_DEEP_STUBS);

    when(searchRepository.getSearchType())
        .thenReturn(ElasticSearchConfiguration.SearchType.OPENSEARCH);
    when(searchRepository.getSearchClient()).thenReturn(client);
    when(client.clusterStats().nodes().count().total()).thenReturn(2);
    when(client.clusterStats().indices().shards().total()).thenReturn(100);
    when(client.clusterSettings().persistent().get("cluster.max_shards_per_node"))
        .thenReturn(os.org.opensearch.client.json.JsonData.of("invalid"));

    SearchIndexClusterValidator.ClusterCapacity capacity =
        validator.getClusterCapacity(searchRepository);

    assertEquals(100, capacity.currentShards());
    assertEquals(2000, capacity.maxShards());
    assertEquals(1900, capacity.availableShards());
  }

  @Test
  void getClusterCapacityFallsBackToDefaultShardLimitWhenElasticSettingIsInvalid()
      throws Exception {
    SearchIndexClusterValidator validator = new SearchIndexClusterValidator();
    ElasticSearchClient client = mock(ElasticSearchClient.class, RETURNS_DEEP_STUBS);

    when(searchRepository.getSearchType())
        .thenReturn(ElasticSearchConfiguration.SearchType.ELASTICSEARCH);
    when(searchRepository.getSearchClient()).thenReturn(client);
    when(client.clusterStats().nodes().count().total()).thenReturn(2);
    when(client.clusterStats().indices().shards().total()).thenReturn(100.0);
    when(client.clusterSettings().persistent().get("cluster.max_shards_per_node"))
        .thenReturn(es.co.elastic.clients.json.JsonData.of("invalid"));
    when(client.clusterSettings().defaults()).thenReturn(null);

    SearchIndexClusterValidator.ClusterCapacity capacity =
        validator.getClusterCapacity(searchRepository);

    assertEquals(100, capacity.currentShards());
    assertEquals(2000, capacity.maxShards());
    assertEquals(1900, capacity.availableShards());
  }
}
