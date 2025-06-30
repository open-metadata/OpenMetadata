package org.openmetadata.service.search;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

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

public class SearchClusterMetricsTest {

  @Mock private SearchRepository searchRepository;
  @Mock private OpenSearchClient openSearchClient;
  @Mock private ElasticSearchClient elasticSearchClient;

  @BeforeEach
  void setUp() {
    MockitoAnnotations.openMocks(this);
  }

  @Test
  void testExtractCpuPercent_NumericValue() throws Exception {
    // Test OpenSearch < 2.19 format with direct numeric value
    Map<String, Object> cpu = new HashMap<>();
    cpu.put("percent", 75.5);

    Double result = invokeExtractCpuPercent(cpu);
    assertEquals(75.5, result);
  }

  @Test
  void testExtractCpuPercent_MapValue() throws Exception {
    // Test OpenSearch 2.19+ format with map containing value
    Map<String, Object> cpu = new HashMap<>();
    Map<String, Object> percentMap = new HashMap<>();
    percentMap.put("value", 65.3);
    cpu.put("percent", percentMap);

    Double result = invokeExtractCpuPercent(cpu);
    assertEquals(65.3, result);
  }

  @Test
  void testExtractCpuPercent_MapWithAlternativeKeys() throws Exception {
    // Test with different key names in the map
    Map<String, Object> cpu = new HashMap<>();
    Map<String, Object> percentMap = new HashMap<>();
    percentMap.put("usage", 45.2);
    cpu.put("percent", percentMap);

    Double result = invokeExtractCpuPercent(cpu);
    assertEquals(45.2, result);
  }

  @Test
  void testExtractCpuPercent_InvalidValue() throws Exception {
    // Test with invalid value type
    Map<String, Object> cpu = new HashMap<>();
    cpu.put("percent", "invalid");

    Double result = invokeExtractCpuPercent(cpu);
    assertEquals(50.0, result); // Should return default value
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
    // Test handling of OpenSearch 2.19 response with LinkedHashMap
    Map<String, Object> clusterStats = createMockClusterStats();
    Map<String, Object> nodesStats = createMockNodesStats();
    Map<String, Object> clusterSettings = createMockClusterSettings();

    when(searchRepository.getSearchType())
        .thenReturn(ElasticSearchConfiguration.SearchType.OPENSEARCH);
    when(searchRepository.getSearchClient()).thenReturn(openSearchClient);
    when(openSearchClient.clusterStats()).thenReturn(clusterStats);
    when(openSearchClient.nodesStats()).thenReturn(nodesStats);
    when(openSearchClient.clusterSettings()).thenReturn(clusterSettings);

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
        SearchClusterMetrics.class.getDeclaredMethod("getConservativeDefaults", long.class);
    method.setAccessible(true);

    SearchClusterMetrics metrics = (SearchClusterMetrics) method.invoke(null, 100000L);

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

  private Map<String, Object> createMockClusterStats() {
    Map<String, Object> stats = new HashMap<>();
    Map<String, Object> nodes = new HashMap<>();
    nodes.put("count", 1);
    stats.put("nodes", nodes);

    Map<String, Object> indices = new HashMap<>();
    Map<String, Object> shards = new HashMap<>();
    shards.put("total", 10);
    indices.put("shards", shards);
    stats.put("indices", indices);

    return stats;
  }

  private Map<String, Object> createMockNodesStats() {
    Map<String, Object> stats = new HashMap<>();
    Map<String, Object> nodes = new HashMap<>();
    Map<String, Object> node1 = new HashMap<>();

    // OS stats
    Map<String, Object> os = new HashMap<>();
    Map<String, Object> cpu = new HashMap<>();
    // Simulate OpenSearch 2.19 format with LinkedHashMap
    Map<String, Object> cpuPercent = new HashMap<>();
    cpuPercent.put("value", 25.0);
    cpu.put("percent", cpuPercent);
    os.put("cpu", cpu);
    node1.put("os", os);

    // JVM stats
    Map<String, Object> jvm = new HashMap<>();
    Map<String, Object> mem = new HashMap<>();
    mem.put("heap_used_in_bytes", 536870912L); // 512MB
    mem.put("heap_max_in_bytes", 1073741824L); // 1GB
    jvm.put("mem", mem);
    node1.put("jvm", jvm);

    nodes.put("node1", node1);
    stats.put("nodes", nodes);

    return stats;
  }

  private Map<String, Object> createMockClusterSettings() {
    Map<String, Object> settings = new HashMap<>();
    Map<String, Object> persistent = new HashMap<>();
    persistent.put("http.max_content_length", "100mb");
    settings.put("persistent", persistent);
    return settings;
  }
}
