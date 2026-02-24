package org.openmetadata.service.search;

import static org.junit.jupiter.api.Assertions.assertEquals;
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
  void testGetConservativeDefaults() throws Exception {
    // Test conservative defaults use JVM heap values
    Method method =
        SearchClusterMetrics.class.getDeclaredMethod(
            "getConservativeDefaults", SearchRepository.class, long.class, int.class);
    method.setAccessible(true);

    SearchClusterMetrics metrics =
        (SearchClusterMetrics) method.invoke(null, searchRepository, 100000L, 50);

    assertNotNull(metrics);
    assertTrue(metrics.getHeapSizeBytes() > 0); // Should use JVM heap
    assertEquals(1, metrics.getTotalNodes());
    assertEquals(0, metrics.getTotalShards());
    assertEquals(50.0, metrics.getCpuUsagePercent());
    assertTrue(metrics.getMemoryUsagePercent() >= 0);
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
