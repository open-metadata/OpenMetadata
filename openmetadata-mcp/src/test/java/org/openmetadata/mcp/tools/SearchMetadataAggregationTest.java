package org.openmetadata.mcp.tools;

import static org.junit.jupiter.api.Assertions.*;

import java.util.*;
import org.junit.jupiter.api.Test;

/**
 * Unit tests for SearchMetadataTool aggregation truncation functionality. Tests the fix for issue
 * #25091: MCP server can return excessive data in aggregations, overwhelming LLM context.
 */
class SearchMetadataAggregationTest {

  @Test
  void testAggregationsExcludedByDefault() {
    // Simulate search response with aggregations
    Map<String, Object> searchResponse = createSearchResponseWithAggregations(20);

    // Call with includeAggregations=false (default behavior)
    Map<String, Object> result =
        SearchMetadataTool.buildEnhancedSearchResponse(
            searchResponse, "test query", 10, Collections.emptyList(), false, 10);

    // Aggregations should NOT be present
    assertFalse(result.containsKey("aggregations"));
    assertFalse(result.containsKey("aggregationsTruncated"));
  }

  @Test
  void testAggregationsIncludedWhenRequested() {
    Map<String, Object> searchResponse = createSearchResponseWithAggregations(5);

    // Call with includeAggregations=true
    Map<String, Object> result =
        SearchMetadataTool.buildEnhancedSearchResponse(
            searchResponse, "test query", 10, Collections.emptyList(), true, 10);

    // Aggregations should be present
    assertTrue(result.containsKey("aggregations"));
    assertNotNull(result.get("aggregations"));
  }

  @Test
  void testAggregationsTruncatedWhenExceedingLimit() {
    // Create response with 20 buckets
    Map<String, Object> searchResponse = createSearchResponseWithAggregations(20);

    // Call with maxAggregationBuckets=5
    Map<String, Object> result =
        SearchMetadataTool.buildEnhancedSearchResponse(
            searchResponse, "test query", 10, Collections.emptyList(), true, 5);

    // Verify aggregations are present
    assertTrue(result.containsKey("aggregations"));
    @SuppressWarnings("unchecked")
    Map<String, Object> aggregations = (Map<String, Object>) result.get("aggregations");

    // Verify serviceType aggregation is truncated
    @SuppressWarnings("unchecked")
    Map<String, Object> serviceTypeAgg = (Map<String, Object>) aggregations.get("serviceType");
    assertNotNull(serviceTypeAgg);

    @SuppressWarnings("unchecked")
    List<Object> buckets = (List<Object>) serviceTypeAgg.get("buckets");
    assertEquals(5, buckets.size(), "Buckets should be truncated to maxAggregationBuckets");

    // Verify truncation metadata
    assertEquals(20, serviceTypeAgg.get("_originalBucketCount"));
    assertEquals(true, serviceTypeAgg.get("_truncated"));

    // Verify global truncation flag
    assertEquals(true, result.get("aggregationsTruncated"));
    assertTrue(result.containsKey("aggregationsMessage"));
  }

  @Test
  void testAggregationsNotTruncatedWhenUnderLimit() {
    // Create response with 5 buckets
    Map<String, Object> searchResponse = createSearchResponseWithAggregations(5);

    // Call with maxAggregationBuckets=10 (more than bucket count)
    Map<String, Object> result =
        SearchMetadataTool.buildEnhancedSearchResponse(
            searchResponse, "test query", 10, Collections.emptyList(), true, 10);

    // Verify aggregations are present
    assertTrue(result.containsKey("aggregations"));
    @SuppressWarnings("unchecked")
    Map<String, Object> aggregations = (Map<String, Object>) result.get("aggregations");

    @SuppressWarnings("unchecked")
    Map<String, Object> serviceTypeAgg = (Map<String, Object>) aggregations.get("serviceType");

    @SuppressWarnings("unchecked")
    List<Object> buckets = (List<Object>) serviceTypeAgg.get("buckets");
    assertEquals(5, buckets.size(), "All buckets should be preserved");

    // No truncation metadata should be present
    assertFalse(serviceTypeAgg.containsKey("_truncated"));
    assertFalse(result.containsKey("aggregationsTruncated"));
  }

  @Test
  void testNonBucketAggregationsPreserved() {
    // Create response with value_count aggregation (no buckets)
    Map<String, Object> searchResponse = createSearchResponseWithValueCountAgg();

    Map<String, Object> result =
        SearchMetadataTool.buildEnhancedSearchResponse(
            searchResponse, "test query", 10, Collections.emptyList(), true, 5);

    assertTrue(result.containsKey("aggregations"));
    @SuppressWarnings("unchecked")
    Map<String, Object> aggregations = (Map<String, Object>) result.get("aggregations");

    // Value count aggregation should be preserved as-is
    @SuppressWarnings("unchecked")
    Map<String, Object> totalCount = (Map<String, Object>) aggregations.get("total_count");
    assertNotNull(totalCount);
    assertEquals(100, totalCount.get("value"));
  }

  @Test
  void testEmptyAggregationsHandled() {
    Map<String, Object> searchResponse = new HashMap<>();
    searchResponse.put("hits", createEmptyHits());
    searchResponse.put("aggregations", new HashMap<>());

    Map<String, Object> result =
        SearchMetadataTool.buildEnhancedSearchResponse(
            searchResponse, "test query", 10, Collections.emptyList(), true, 10);

    // Should not throw and should not add aggregations key for empty map
    assertFalse(result.containsKey("aggregations"));
  }

  @Test
  void testMultipleAggregationsTruncatedIndependently() {
    // Create response with multiple aggregations of different sizes
    Map<String, Object> searchResponse = createSearchResponseWithMultipleAggregations();

    Map<String, Object> result =
        SearchMetadataTool.buildEnhancedSearchResponse(
            searchResponse, "test query", 10, Collections.emptyList(), true, 5);

    @SuppressWarnings("unchecked")
    Map<String, Object> aggregations = (Map<String, Object>) result.get("aggregations");

    // serviceType has 20 buckets - should be truncated
    @SuppressWarnings("unchecked")
    Map<String, Object> serviceTypeAgg = (Map<String, Object>) aggregations.get("serviceType");
    @SuppressWarnings("unchecked")
    List<Object> serviceTypeBuckets = (List<Object>) serviceTypeAgg.get("buckets");
    assertEquals(5, serviceTypeBuckets.size());
    assertEquals(true, serviceTypeAgg.get("_truncated"));

    // owners has 3 buckets - should NOT be truncated
    @SuppressWarnings("unchecked")
    Map<String, Object> ownersAgg = (Map<String, Object>) aggregations.get("owners");
    @SuppressWarnings("unchecked")
    List<Object> ownersBuckets = (List<Object>) ownersAgg.get("buckets");
    assertEquals(3, ownersBuckets.size());
    assertFalse(ownersAgg.containsKey("_truncated"));
  }

  // Helper methods to create test data

  private Map<String, Object> createSearchResponseWithAggregations(int bucketCount) {
    Map<String, Object> response = new HashMap<>();
    response.put("hits", createEmptyHits());

    Map<String, Object> aggregations = new HashMap<>();
    Map<String, Object> serviceTypeAgg = new HashMap<>();
    List<Map<String, Object>> buckets = new ArrayList<>();

    for (int i = 0; i < bucketCount; i++) {
      Map<String, Object> bucket = new HashMap<>();
      bucket.put("key", "Service" + i);
      bucket.put("doc_count", 100 - i);
      buckets.add(bucket);
    }

    serviceTypeAgg.put("buckets", buckets);
    aggregations.put("serviceType", serviceTypeAgg);
    response.put("aggregations", aggregations);

    return response;
  }

  private Map<String, Object> createSearchResponseWithValueCountAgg() {
    Map<String, Object> response = new HashMap<>();
    response.put("hits", createEmptyHits());

    Map<String, Object> aggregations = new HashMap<>();
    Map<String, Object> totalCount = new HashMap<>();
    totalCount.put("value", 100);
    aggregations.put("total_count", totalCount);
    response.put("aggregations", aggregations);

    return response;
  }

  private Map<String, Object> createSearchResponseWithMultipleAggregations() {
    Map<String, Object> response = new HashMap<>();
    response.put("hits", createEmptyHits());

    Map<String, Object> aggregations = new HashMap<>();

    // Large aggregation (20 buckets)
    Map<String, Object> serviceTypeAgg = new HashMap<>();
    List<Map<String, Object>> serviceTypeBuckets = new ArrayList<>();
    for (int i = 0; i < 20; i++) {
      Map<String, Object> bucket = new HashMap<>();
      bucket.put("key", "Service" + i);
      bucket.put("doc_count", 100 - i);
      serviceTypeBuckets.add(bucket);
    }
    serviceTypeAgg.put("buckets", serviceTypeBuckets);
    aggregations.put("serviceType", serviceTypeAgg);

    // Small aggregation (3 buckets)
    Map<String, Object> ownersAgg = new HashMap<>();
    List<Map<String, Object>> ownersBuckets = new ArrayList<>();
    for (int i = 0; i < 3; i++) {
      Map<String, Object> bucket = new HashMap<>();
      bucket.put("key", "Owner" + i);
      bucket.put("doc_count", 50 - i);
      ownersBuckets.add(bucket);
    }
    ownersAgg.put("buckets", ownersBuckets);
    aggregations.put("owners", ownersAgg);

    response.put("aggregations", aggregations);
    return response;
  }

  private Map<String, Object> createEmptyHits() {
    Map<String, Object> hits = new HashMap<>();
    hits.put("hits", Collections.emptyList());
    Map<String, Object> total = new HashMap<>();
    total.put("value", 0);
    hits.put("total", total);
    return hits;
  }
}
