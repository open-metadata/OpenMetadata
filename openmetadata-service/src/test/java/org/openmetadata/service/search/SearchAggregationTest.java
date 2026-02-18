package org.openmetadata.service.search;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;

import java.util.Map;
import org.junit.jupiter.api.Test;

class SearchAggregationTest {

  @Test
  void testBucketSortCreatesCorrectNode() {
    SearchAggregationNode node = SearchAggregation.bucketSort("test_sort", 10, 20);

    assertNotNull(node);
    assertEquals("bucket_sort", node.getType());
    assertEquals("test_sort", node.getName());

    Map<String, String> value = node.getValue();
    assertEquals("10", value.get("size"));
    assertEquals("20", value.get("from"));
  }

  @Test
  void testBucketSortWithSorting() {
    SearchAggregationNode node =
        SearchAggregation.bucketSort("test_sort", 15, 0, "max_timestamp", "desc");

    assertNotNull(node);
    assertEquals("bucket_sort", node.getType());
    assertEquals("test_sort", node.getName());

    Map<String, String> value = node.getValue();
    assertEquals("15", value.get("size"));
    assertEquals("0", value.get("from"));
    assertEquals("max_timestamp", value.get("sort_field"));
    assertEquals("desc", value.get("sort_order"));
  }

  @Test
  void testBucketSortWithNullValues() {
    SearchAggregationNode node = SearchAggregation.bucketSort("test_sort", null, null);

    assertNotNull(node);
    assertEquals("bucket_sort", node.getType());
    assertEquals("test_sort", node.getName());

    Map<String, String> value = node.getValue();
    assertEquals(0, value.size());
  }

  @Test
  void testCardinalityCreatesCorrectNode() {
    SearchAggregationNode node = SearchAggregation.cardinality("total_count", "testCase.id");

    assertNotNull(node);
    assertEquals("cardinality", node.getType());
    assertEquals("total_count", node.getName());

    Map<String, String> value = node.getValue();
    assertEquals("testCase.id", value.get("field"));
    assertEquals("3000", value.get("precision_threshold"));
  }
}
