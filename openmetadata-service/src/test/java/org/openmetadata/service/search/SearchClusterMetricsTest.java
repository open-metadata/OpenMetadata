package org.openmetadata.service.search;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.lang.reflect.Method;
import java.util.HashMap;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;
import org.openmetadata.schema.service.configuration.elasticsearch.ElasticSearchConfiguration;
import org.openmetadata.service.search.elasticsearch.ElasticSearchClient;
import org.openmetadata.service.search.opensearch.OpenSearchClient;
import os.org.opensearch.client.json.JsonData;
import os.org.opensearch.client.opensearch.cluster.ClusterStatsResponse;
import os.org.opensearch.client.opensearch.cluster.GetClusterSettingsResponse;
import os.org.opensearch.client.opensearch.cluster.stats.ClusterIndices;
import os.org.opensearch.client.opensearch.cluster.stats.ClusterIndicesShards;
import os.org.opensearch.client.opensearch.cluster.stats.ClusterNodeCount;
import os.org.opensearch.client.opensearch.cluster.stats.ClusterNodes;
import os.org.opensearch.client.opensearch.nodes.NodesStatsResponse;
import os.org.opensearch.client.opensearch.nodes.stats.Jvm;
import os.org.opensearch.client.opensearch.nodes.stats.JvmMemoryStats;
import os.org.opensearch.client.opensearch.nodes.stats.OperatingSystem;
import os.org.opensearch.client.opensearch.nodes.stats.OperatingSystemCpuStats;
import os.org.opensearch.client.opensearch.nodes.stats.Stats;

public class SearchClusterMetricsTest {

  @Mock private SearchRepository searchRepository;
  @Mock private OpenSearchClient openSearchClient;
  @Mock private ElasticSearchClient elasticSearchClient;

  @BeforeEach
  void setUp() {
    MockitoAnnotations.openMocks(this);
  }

  @Test
  void testExtractLongValue_ValidNumber() throws Exception {
    Map<String, Object> map = new HashMap<>();
    map.put("heap_max_bytes", 1073741824L); // 1GB

    Long result = invokeExtractLongValue(map, "heap_max_bytes", 0L);
    assertEquals(1073741824L, result);
  }

  @Test
  void testExtractLongValue_IntegerNumber() throws Exception {
    Map<String, Object> map = new HashMap<>();
    map.put("count", 42);

    Long result = invokeExtractLongValue(map, "count", 0L);
    assertEquals(42L, result);
  }

  @Test
  void testExtractLongValue_MissingKey() throws Exception {
    Map<String, Object> map = new HashMap<>();

    Long result = invokeExtractLongValue(map, "missing_key", 100L);
    assertEquals(100L, result); // Should return default value
  }

  @Test
  void testExtractIntValue_ValidNumber() throws Exception {
    Map<String, Object> map = new HashMap<>();
    map.put("count", 10);

    Integer result = invokeExtractIntValue(map, "count", 0);
    assertEquals(10, result);
  }

  @Test
  void testExtractIntValue_LongNumber() throws Exception {
    Map<String, Object> map = new HashMap<>();
    map.put("count", 42L);

    Integer result = invokeExtractIntValue(map, "count", 0);
    assertEquals(42, result);
  }

  @Test
  void testExtractIntValue_InvalidType() throws Exception {
    Map<String, Object> map = new HashMap<>();
    map.put("count", "not a number");

    Integer result = invokeExtractIntValue(map, "count", 5);
    assertEquals(5, result); // Should return default value
  }

  @Test
  void testFetchOpenSearchMetrics_WithLinkedHashMapResponse() throws Exception {
    ClusterStatsResponse clusterStats = createMockClusterStats();
    NodesStatsResponse nodesStats = createMockNodesStats();
    GetClusterSettingsResponse clusterSettings = createMockClusterSettings();

    when(searchRepository.getSearchType())
        .thenReturn(ElasticSearchConfiguration.SearchType.OPENSEARCH);
    when(searchRepository.getSearchClient()).thenReturn(openSearchClient);
    when(openSearchClient.clusterStats()).thenReturn(clusterStats);
    when(openSearchClient.nodesStats()).thenReturn(nodesStats);
    when(openSearchClient.clusterSettings()).thenReturn(clusterSettings);

    Map<String, Object> jvmStats = new HashMap<>();
    jvmStats.put("heapMaxBytes", 1073741824L);
    jvmStats.put("memoryUsagePercent", 50.0);

    when(openSearchClient.averageCpuPercentFromNodesStats(nodesStats)).thenReturn(25.0);
    when(openSearchClient.extractJvmMemoryStats(nodesStats)).thenReturn(jvmStats);
    when(openSearchClient.extractMaxContentLengthStr(clusterSettings)).thenReturn("100mb");

    SearchClusterMetrics metrics =
        SearchClusterMetrics.fetchClusterMetrics(searchRepository, 1000, 50);

    assertNotNull(metrics);
    assertTrue(metrics.getHeapSizeBytes() > 0);
    assertTrue(metrics.getTotalNodes() > 0);
  }

  @Test
  void testFetchOpenSearchMetrics_FallsBackToConservativeDefaultsOnError() throws Exception {
    when(searchRepository.getSearchType())
        .thenReturn(ElasticSearchConfiguration.SearchType.OPENSEARCH);
    when(searchRepository.getSearchClient()).thenReturn(openSearchClient);
    when(openSearchClient.clusterStats()).thenThrow(new RuntimeException("cluster stats down"));
    when(openSearchClient.extractMaxContentLengthStr(null)).thenReturn("32mb");

    SearchClusterMetrics metrics =
        SearchClusterMetrics.fetchClusterMetrics(searchRepository, 200000L, 40);

    assertEquals(1, metrics.getTotalNodes());
    assertEquals(0, metrics.getTotalShards());
    assertEquals(32L * 1024 * 1024, metrics.getMaxContentLength());
    assertEquals((32L * 1024 * 1024 * 9) / 10, metrics.getMaxPayloadSizeBytes());
  }

  @Test
  void testFetchElasticSearchMetrics_WithClusterData() throws Exception {
    es.co.elastic.clients.elasticsearch.cluster.ClusterStatsResponse clusterStats =
        createMockElasticClusterStats(3, 12);
    es.co.elastic.clients.elasticsearch.nodes.NodesStatsResponse nodesStats =
        mock(es.co.elastic.clients.elasticsearch.nodes.NodesStatsResponse.class);
    es.co.elastic.clients.elasticsearch.cluster.GetClusterSettingsResponse clusterSettings =
        mock(es.co.elastic.clients.elasticsearch.cluster.GetClusterSettingsResponse.class);

    when(searchRepository.getSearchType())
        .thenReturn(ElasticSearchConfiguration.SearchType.ELASTICSEARCH);
    when(searchRepository.getSearchClient()).thenReturn(elasticSearchClient);
    when(elasticSearchClient.clusterStats()).thenReturn(clusterStats);
    when(elasticSearchClient.nodesStats()).thenReturn(nodesStats);
    when(elasticSearchClient.clusterSettings()).thenReturn(clusterSettings);
    when(elasticSearchClient.averageCpuPercentFromNodesStats(nodesStats)).thenReturn(20.0);
    when(elasticSearchClient.extractJvmMemoryStats(nodesStats))
        .thenReturn(Map.of("heapMaxBytes", 2L * 1024 * 1024 * 1024, "memoryUsagePercent", 35.0));
    when(elasticSearchClient.extractMaxContentLengthStr(clusterSettings)).thenReturn("64mb");

    SearchClusterMetrics metrics =
        SearchClusterMetrics.fetchClusterMetrics(searchRepository, 10000L, 60);

    assertEquals(3, metrics.getTotalNodes());
    assertEquals(12, metrics.getTotalShards());
    assertEquals(20.0, metrics.getCpuUsagePercent());
    assertEquals(35.0, metrics.getMemoryUsagePercent());
    assertEquals(64L * 1024 * 1024, metrics.getMaxContentLength());
    assertTrue(metrics.getRecommendedBatchSize() >= 50);
    assertTrue(metrics.getRecommendedConcurrentRequests() >= 10);
  }

  @Test
  void testFetchElasticSearchMetrics_FallsBackToConservativeDefaultsOnError() throws Exception {
    es.co.elastic.clients.elasticsearch.cluster.GetClusterSettingsResponse clusterSettings =
        mock(es.co.elastic.clients.elasticsearch.cluster.GetClusterSettingsResponse.class);

    when(searchRepository.getSearchType())
        .thenReturn(ElasticSearchConfiguration.SearchType.ELASTICSEARCH);
    when(searchRepository.getSearchClient()).thenReturn(elasticSearchClient);
    when(elasticSearchClient.clusterStats()).thenThrow(new RuntimeException("cluster stats down"));
    when(elasticSearchClient.clusterSettings()).thenReturn(clusterSettings);
    when(elasticSearchClient.extractMaxContentLengthStr(clusterSettings)).thenReturn("20mb");

    SearchClusterMetrics metrics =
        SearchClusterMetrics.fetchClusterMetrics(searchRepository, 200000L, 40);

    assertEquals(1, metrics.getTotalNodes());
    assertEquals(0, metrics.getTotalShards());
    assertEquals(20L * 1024 * 1024, metrics.getMaxContentLength());
    assertEquals((20L * 1024 * 1024 * 9) / 10, metrics.getMaxPayloadSizeBytes());
  }

  @Test
  void testFetchClusterMetrics_UsesConservativeDefaultsWhenSearchTypeMissing() {
    when(searchRepository.getSearchType()).thenReturn(null);

    SearchClusterMetrics metrics =
        SearchClusterMetrics.fetchClusterMetrics(searchRepository, 25000L, 20);

    assertEquals(1, metrics.getTotalNodes());
    assertEquals(0, metrics.getTotalShards());
    assertEquals(100, metrics.getRecommendedBatchSize());
  }

  @Test
  void testGetConservativeDefaults() throws Exception {
    SearchClusterMetrics metrics = invokeGetConservativeDefaults(searchRepository, 100000L, 50);

    assertNotNull(metrics);
    assertTrue(metrics.getHeapSizeBytes() > 0);
    assertEquals(1, metrics.getTotalNodes());
    assertEquals(0, metrics.getTotalShards());
    assertEquals(50.0, metrics.getCpuUsagePercent());
    assertTrue(metrics.getMemoryUsagePercent() >= 0);
  }

  @Test
  void testGetConservativeDefaults_UsesOpenSearchClusterLimitWhenAvailable() throws Exception {
    GetClusterSettingsResponse clusterSettings = createMockClusterSettings();
    when(searchRepository.getSearchClient()).thenReturn(openSearchClient);
    when(openSearchClient.clusterSettings()).thenReturn(clusterSettings);
    when(openSearchClient.extractMaxContentLengthStr(clusterSettings)).thenReturn("50mb");

    SearchClusterMetrics metrics = invokeGetConservativeDefaults(searchRepository, 750000L, 40);

    assertEquals(225, metrics.getRecommendedBatchSize());
    assertEquals(50L * 1024 * 1024, metrics.getMaxContentLength());
    assertEquals((50L * 1024 * 1024 * 9) / 10, metrics.getMaxPayloadSizeBytes());
  }

  @Test
  void testIsCompressionEnabled_UsesTransientPersistentAndDefaultsInOrder() {
    Map<String, Object> transientFirst =
        Map.of(
            "transient", Map.of("http.compression", false),
            "persistent", Map.of("http.compression", true),
            "defaults", Map.of("http.compression", true));
    Map<String, Object> persistentFallback = Map.of("persistent", Map.of("http.compression", true));
    Map<String, Object> defaultFallback = Map.of("defaults", Map.of("http.compression", true));

    assertFalse(SearchClusterMetrics.isCompressionEnabled(transientFirst));
    assertTrue(SearchClusterMetrics.isCompressionEnabled(persistentFallback));
    assertTrue(SearchClusterMetrics.isCompressionEnabled(defaultFallback));
  }

  @Test
  void testIsCompressionEnabled_ReturnsFalseForMalformedSettings() {
    assertFalse(SearchClusterMetrics.isCompressionEnabled(Map.of("persistent", "invalid")));
  }

  @Test
  void testExtractMaxContentLength_HandlesMissingAndInvalidValues() {
    assertEquals(
        SearchClusterMetrics.DEFAULT_MAX_CONTENT_LENGTH,
        SearchClusterMetrics.extractMaxContentLength(null));
    assertEquals(
        SearchClusterMetrics.DEFAULT_MAX_CONTENT_LENGTH,
        SearchClusterMetrics.extractMaxContentLength("not-a-size"));
  }

  @Test
  void testParseByteSize_SupportsKnownUnitsAndDefaults() throws Exception {
    assertEquals(512L, invokeParseByteSize("512b"));
    assertEquals(2L * 1024, invokeParseByteSize("2kb"));
    assertEquals(3L * 1024 * 1024, invokeParseByteSize("3mb"));
    assertEquals(4L * 1024 * 1024 * 1024, invokeParseByteSize("4gb"));
    assertEquals(128L, invokeParseByteSize("128"));
    assertEquals(SearchClusterMetrics.DEFAULT_MAX_CONTENT_LENGTH, invokeParseByteSize(" "));
    assertEquals(SearchClusterMetrics.DEFAULT_MAX_CONTENT_LENGTH, invokeParseByteSize("bad-input"));
  }

  @Test
  void testLogRecommendations_DoesNotThrow() {
    SearchClusterMetrics metrics =
        SearchClusterMetrics.builder()
            .availableProcessors(4)
            .heapSizeBytes(1024L * 1024 * 1024)
            .availableMemoryBytes(512L * 1024 * 1024)
            .totalShards(12)
            .totalNodes(3)
            .cpuUsagePercent(25.0)
            .memoryUsagePercent(40.0)
            .maxPayloadSizeBytes(16L * 1024 * 1024)
            .maxContentLength(20L * 1024 * 1024)
            .recommendedConcurrentRequests(50)
            .recommendedBatchSize(250)
            .recommendedProducerThreads(6)
            .recommendedConsumerThreads(4)
            .recommendedQueueSize(2000)
            .recommendedFieldFetchThreads(8)
            .recommendedDocBuildThreads(6)
            .recommendedStatsIntervalMs(1500L)
            .build();

    assertDoesNotThrow(metrics::logRecommendations);
  }

  // Helper methods to invoke private static methods using reflection
  private Double invokeExtractCpuPercent(Map<String, Object> cpu) throws Exception {
    Method method = SearchClusterMetrics.class.getDeclaredMethod("extractCpuPercent", Map.class);
    method.setAccessible(true);
    return (Double) method.invoke(null, cpu);
  }

  private Long invokeExtractLongValue(Map<String, Object> map, String key, long defaultValue)
      throws Exception {
    Method method =
        SearchClusterMetrics.class.getDeclaredMethod(
            "extractLongValue", Map.class, String.class, long.class);
    method.setAccessible(true);
    return (Long) method.invoke(null, map, key, defaultValue);
  }

  private Integer invokeExtractIntValue(Map<String, Object> map, String key, int defaultValue)
      throws Exception {
    Method method =
        SearchClusterMetrics.class.getDeclaredMethod(
            "extractIntValue", Map.class, String.class, int.class);
    method.setAccessible(true);
    return (Integer) method.invoke(null, map, key, defaultValue);
  }

  private SearchClusterMetrics invokeGetConservativeDefaults(
      SearchRepository repository, long totalEntities, int maxDbConnections) throws Exception {
    Method method =
        SearchClusterMetrics.class.getDeclaredMethod(
            "getConservativeDefaults", SearchRepository.class, long.class, int.class);
    method.setAccessible(true);
    return (SearchClusterMetrics) method.invoke(null, repository, totalEntities, maxDbConnections);
  }

  private long invokeParseByteSize(String sizeStr) throws Exception {
    Method method = SearchClusterMetrics.class.getDeclaredMethod("parseByteSize", String.class);
    method.setAccessible(true);
    return (Long) method.invoke(null, sizeStr);
  }

  private ClusterStatsResponse createMockClusterStats() {
    ClusterStatsResponse clusterStats = mock(ClusterStatsResponse.class);
    ClusterNodes nodes = mock(ClusterNodes.class);
    ClusterNodeCount nodeCount = mock(ClusterNodeCount.class);
    ClusterIndices indices = mock(ClusterIndices.class);
    ClusterIndicesShards shards = mock(ClusterIndicesShards.class);

    when(nodeCount.total()).thenReturn(1);
    when(nodes.count()).thenReturn(nodeCount);
    when(clusterStats.nodes()).thenReturn(nodes);

    when(shards.total()).thenReturn(Integer.valueOf(10));
    when(indices.shards()).thenReturn(shards);
    when(clusterStats.indices()).thenReturn(indices);
    when(indices.shards()).thenReturn(shards);

    return clusterStats;
  }

  private es.co.elastic.clients.elasticsearch.cluster.ClusterStatsResponse
      createMockElasticClusterStats(int totalNodes, Integer totalShards) {
    es.co.elastic.clients.elasticsearch.cluster.ClusterStatsResponse clusterStats =
        mock(es.co.elastic.clients.elasticsearch.cluster.ClusterStatsResponse.class);
    es.co.elastic.clients.elasticsearch.cluster.stats.ClusterNodes nodes =
        mock(es.co.elastic.clients.elasticsearch.cluster.stats.ClusterNodes.class);
    es.co.elastic.clients.elasticsearch.cluster.stats.ClusterNodeCount nodeCount =
        mock(es.co.elastic.clients.elasticsearch.cluster.stats.ClusterNodeCount.class);
    es.co.elastic.clients.elasticsearch.cluster.stats.ClusterIndices indices =
        mock(es.co.elastic.clients.elasticsearch.cluster.stats.ClusterIndices.class);
    es.co.elastic.clients.elasticsearch.cluster.stats.ClusterIndicesShards shards =
        mock(es.co.elastic.clients.elasticsearch.cluster.stats.ClusterIndicesShards.class);

    when(nodeCount.total()).thenReturn(totalNodes);
    when(nodes.count()).thenReturn(nodeCount);
    when(clusterStats.nodes()).thenReturn(nodes);
    when(shards.total()).thenReturn(totalShards == null ? null : totalShards.doubleValue());
    when(indices.shards()).thenReturn(shards);
    when(clusterStats.indices()).thenReturn(indices);

    return clusterStats;
  }

  private NodesStatsResponse createMockNodesStats() {
    NodesStatsResponse nodesStats = mock(NodesStatsResponse.class);
    Stats nodeStats = mock(Stats.class);
    OperatingSystem os = mock(OperatingSystem.class);
    OperatingSystemCpuStats cpu = mock(OperatingSystemCpuStats.class);
    Jvm jvm = mock(Jvm.class);
    JvmMemoryStats mem = mock(JvmMemoryStats.class);

    when(cpu.percent()).thenReturn(Double.valueOf(25.0));
    when(os.cpu()).thenReturn(cpu);
    when(nodeStats.os()).thenReturn(os);

    when(nodeStats.jvm()).thenReturn(jvm);
    when(jvm.mem()).thenReturn(mem);
    when(mem.heapUsedInBytes()).thenReturn(536870912L); // 512MB
    when(mem.heapMaxInBytes()).thenReturn(1073741824L); // 1GB

    Map<String, Stats> nodesMap = new HashMap<>();
    nodesMap.put("node1", nodeStats);
    when(nodesStats.nodes()).thenReturn(nodesMap);

    return nodesStats;
  }

  private GetClusterSettingsResponse createMockClusterSettings() {
    GetClusterSettingsResponse clusterSettings = mock(GetClusterSettingsResponse.class);
    JsonData maxContentLengthData = mock(JsonData.class);

    when(maxContentLengthData.to(String.class)).thenReturn("100mb");

    Map<String, JsonData> persistentSettings = new HashMap<>();
    persistentSettings.put("http.max_content_length", maxContentLengthData);

    when(clusterSettings.persistent()).thenReturn(persistentSettings);
    when(clusterSettings.transient_()).thenReturn(new HashMap<>());

    return clusterSettings;
  }
}
