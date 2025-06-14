/*
 *  Copyright 2021 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.service.search;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.when;

import java.util.HashMap;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.openmetadata.schema.service.configuration.elasticsearch.ElasticSearchConfiguration;
import org.openmetadata.service.search.elasticsearch.ElasticSearchClient;
import org.openmetadata.service.search.opensearch.OpenSearchClient;

@ExtendWith(MockitoExtension.class)
class SearchClusterMetricsTest {

  @Mock private SearchRepository searchRepository;
  @Mock private ElasticSearchClient elasticSearchClient;
  @Mock private OpenSearchClient openSearchClient;

  private static final long TOTAL_ENTITIES = 1000000L;

  @BeforeEach
  void setUp() {
    lenient().when(searchRepository.getSearchClient()).thenReturn(elasticSearchClient);
    lenient()
        .when(searchRepository.getSearchType())
        .thenReturn(ElasticSearchConfiguration.SearchType.ELASTICSEARCH);
  }

  @Test
  void testFetchClusterMetrics_WithDatabaseConnectionLimit_ElasticSearch() {
    Integer maxDbConnections = 100;
    when(searchRepository.getDatabaseMaxPoolSize()).thenReturn(maxDbConnections);
    setupElasticSearchMocks();
    SearchClusterMetrics metrics =
        SearchClusterMetrics.fetchClusterMetrics(searchRepository, TOTAL_ENTITIES);
    int expectedReservedConnections = (int) (maxDbConnections * 0.6); // 60% reserved = 60
    int expectedMaxProducerThreads = maxDbConnections - expectedReservedConnections; // 40

    assertTrue(
        metrics.getRecommendedProducerThreads() <= expectedMaxProducerThreads,
        String.format(
            "Producer threads (%d) should not exceed max allowed (%d) based on DB connections",
            metrics.getRecommendedProducerThreads(), expectedMaxProducerThreads));

    assertTrue(
        metrics.getRecommendedProducerThreads() >= 5,
        "Producer threads should be at least 5 for functionality");
  }

  @Test
  void testFetchClusterMetrics_WithDatabaseConnectionLimit_OpenSearch() {
    Integer maxDbConnections = 50;
    when(searchRepository.getDatabaseMaxPoolSize()).thenReturn(maxDbConnections);
    when(searchRepository.getSearchType())
        .thenReturn(ElasticSearchConfiguration.SearchType.OPENSEARCH);
    when(searchRepository.getSearchClient()).thenReturn(openSearchClient);

    setupOpenSearchMocks();

    SearchClusterMetrics metrics =
        SearchClusterMetrics.fetchClusterMetrics(searchRepository, TOTAL_ENTITIES);
    int expectedReservedConnections = (int) (maxDbConnections * 0.6); // 60% reserved = 30
    int expectedMaxProducerThreads = maxDbConnections - expectedReservedConnections; // 20

    assertTrue(
        metrics.getRecommendedProducerThreads() <= expectedMaxProducerThreads,
        String.format(
            "Producer threads (%d) should not exceed max allowed (%d) based on DB connections",
            metrics.getRecommendedProducerThreads(), expectedMaxProducerThreads));

    assertTrue(
        metrics.getRecommendedProducerThreads() >= 5,
        "Producer threads should be at least 5 for functionality");
  }

  @Test
  void testFetchClusterMetrics_WithNullDatabaseConnection_UsesDefaultFallback() {
    when(searchRepository.getDatabaseMaxPoolSize()).thenReturn(null);
    setupElasticSearchMocks();
    SearchClusterMetrics metrics =
        SearchClusterMetrics.fetchClusterMetrics(searchRepository, TOTAL_ENTITIES);
    int defaultMaxDbConnections = 50;
    int expectedReservedConnections = (int) (defaultMaxDbConnections * 0.6); // 30
    int expectedMaxProducerThreads = defaultMaxDbConnections - expectedReservedConnections; // 20
    assertTrue(
        metrics.getRecommendedProducerThreads() <= expectedMaxProducerThreads,
        String.format(
            "Producer threads (%d) should not exceed max allowed (%d) using default fallback",
            metrics.getRecommendedProducerThreads(), expectedMaxProducerThreads));
  }

  @Test
  void testFetchClusterMetrics_WithSmallDatabasePool_EnsuresMinimumThreads() {
    Integer maxDbConnections = 10;
    when(searchRepository.getDatabaseMaxPoolSize()).thenReturn(maxDbConnections);
    setupElasticSearchMocks();
    SearchClusterMetrics metrics =
        SearchClusterMetrics.fetchClusterMetrics(searchRepository, TOTAL_ENTITIES);
    assertEquals(
        5,
        metrics.getRecommendedProducerThreads(),
        "Should enforce minimum of 5 producer threads even with small DB pool");
  }

  @Test
  void testConservativeDefaults_WithDatabaseConnectionLimit() {
    Integer maxDbConnections = 80;
    when(searchRepository.getDatabaseMaxPoolSize()).thenReturn(maxDbConnections);

    try {
      when(elasticSearchClient.clusterStats())
          .thenThrow(new RuntimeException("Cluster unavailable"));
    } catch (Exception e) {
      // This shouldn't happen in the test setup
    }
    SearchClusterMetrics metrics =
        SearchClusterMetrics.fetchClusterMetrics(searchRepository, TOTAL_ENTITIES);
    int expectedReservedConnections = (int) (maxDbConnections * 0.6); // 48
    int expectedMaxProducerThreads = maxDbConnections - expectedReservedConnections; // 32

    assertTrue(
        metrics.getRecommendedProducerThreads() <= expectedMaxProducerThreads,
        String.format(
            "Conservative defaults producer threads (%d) should not exceed max allowed (%d)",
            metrics.getRecommendedProducerThreads(), expectedMaxProducerThreads));

    assertTrue(
        metrics.getRecommendedProducerThreads() >= 5,
        "Conservative defaults should maintain minimum functionality");
  }

  @Test
  void testConservativeDefaults_WithNullDatabaseConnection() {
    // Given: No database connection info and cluster metrics fail
    when(searchRepository.getDatabaseMaxPoolSize()).thenReturn(null);
    try {
      when(elasticSearchClient.clusterStats())
          .thenThrow(new RuntimeException("Cluster unavailable"));
    } catch (Exception e) {
      // This shouldn't happen in the test setup
    }

    // When: Fetch cluster metrics (should fallback to conservative defaults)
    SearchClusterMetrics metrics =
        SearchClusterMetrics.fetchClusterMetrics(searchRepository, TOTAL_ENTITIES);

    // Then: Should use default fallback of 50 connections for conservative defaults
    int defaultMaxDbConnections = 50;
    int expectedReservedConnections = (int) (defaultMaxDbConnections * 0.6); // 30
    int expectedMaxProducerThreads = defaultMaxDbConnections - expectedReservedConnections; // 20

    assertTrue(
        metrics.getRecommendedProducerThreads() <= expectedMaxProducerThreads,
        "Conservative defaults with null DB config should use fallback limits");

    assertTrue(
        metrics.getRecommendedProducerThreads() >= 5,
        "Conservative defaults should maintain minimum functionality");
  }

  @Test
  void testReservationLogic_SixtyPercentReservation() {
    Integer maxDbConnections = 100;
    when(searchRepository.getDatabaseMaxPoolSize()).thenReturn(maxDbConnections);
    setupElasticSearchMocks();
    SearchClusterMetrics metrics =
        SearchClusterMetrics.fetchClusterMetrics(searchRepository, TOTAL_ENTITIES);
    assertTrue(
        metrics.getRecommendedProducerThreads() <= 40,
        "Should reserve 60% of connections for user traffic");
  }

  private void setupElasticSearchMocks() {
    try {
      Map<String, Object> clusterStats = new HashMap<>();
      Map<String, Object> nodesStats = new HashMap<>();
      Map<String, Object> clusterSettings = new HashMap<>();

      // Mock cluster stats
      Map<String, Object> nodes = new HashMap<>();
      nodes.put("count", 3);
      clusterStats.put("nodes", nodes);

      Map<String, Object> indices = new HashMap<>();
      indices.put("shards", 15);
      clusterStats.put("indices", indices);

      // Mock node stats
      Map<String, Object> nodeMap = new HashMap<>();
      Map<String, Object> nodeDetails = new HashMap<>();

      Map<String, Object> os = new HashMap<>();
      Map<String, Object> cpu = new HashMap<>();
      cpu.put("percent", 50.0);
      os.put("cpu", cpu);
      nodeDetails.put("os", os);

      Map<String, Object> jvm = new HashMap<>();
      Map<String, Object> mem = new HashMap<>();
      mem.put("heap_used_in_bytes", 2L * 1024 * 1024 * 1024); // 2GB
      mem.put("heap_max_in_bytes", 8L * 1024 * 1024 * 1024); // 8GB
      jvm.put("mem", mem);
      nodeDetails.put("jvm", jvm);

      nodeMap.put("node1", nodeDetails);
      nodesStats.put("nodes", nodeMap);

      // Mock cluster settings (empty for simplicity)
      clusterSettings.put("persistent", new HashMap<>());
      clusterSettings.put("transient", new HashMap<>());

      lenient().when(elasticSearchClient.clusterStats()).thenReturn(clusterStats);
      lenient().when(elasticSearchClient.nodesStats()).thenReturn(nodesStats);
      lenient().when(elasticSearchClient.clusterSettings()).thenReturn(clusterSettings);

    } catch (Exception e) {
      throw new RuntimeException("Failed to setup ElasticSearch mocks", e);
    }
  }

  private void setupOpenSearchMocks() {
    try {
      Map<String, Object> clusterStats = new HashMap<>();
      Map<String, Object> nodesStats = new HashMap<>();
      Map<String, Object> clusterSettings = new HashMap<>();

      // Mock cluster stats
      Map<String, Object> nodes = new HashMap<>();
      nodes.put("count", 2);
      clusterStats.put("nodes", nodes);

      Map<String, Object> indices = new HashMap<>();
      Map<String, Object> shards = new HashMap<>();
      shards.put("total", 10);
      indices.put("shards", shards);
      clusterStats.put("indices", indices);

      // Mock node stats
      Map<String, Object> nodeMap = new HashMap<>();
      Map<String, Object> nodeDetails = new HashMap<>();

      Map<String, Object> os = new HashMap<>();
      Map<String, Object> cpu = new HashMap<>();
      cpu.put("percent", 30.0);
      os.put("cpu", cpu);
      nodeDetails.put("os", os);

      Map<String, Object> jvm = new HashMap<>();
      Map<String, Object> mem = new HashMap<>();
      mem.put("heap_used_in_bytes", 1L * 1024 * 1024 * 1024); // 1GB
      mem.put("heap_max_in_bytes", 4L * 1024 * 1024 * 1024); // 4GB
      jvm.put("mem", mem);
      nodeDetails.put("jvm", jvm);

      nodeMap.put("node1", nodeDetails);
      nodesStats.put("nodes", nodeMap);

      // Mock cluster settings
      clusterSettings.put("persistent", new HashMap<>());
      clusterSettings.put("transient", new HashMap<>());

      lenient().when(openSearchClient.clusterStats()).thenReturn(clusterStats);
      lenient().when(openSearchClient.nodesStats()).thenReturn(nodesStats);
      lenient().when(openSearchClient.clusterSettings()).thenReturn(clusterSettings);

    } catch (Exception e) {
      throw new RuntimeException("Failed to setup OpenSearch mocks", e);
    }
  }
}
