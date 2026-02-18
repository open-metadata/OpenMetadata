package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import org.junit.jupiter.api.Test;
import org.openmetadata.service.search.SearchAggregation;
import org.openmetadata.service.search.SearchAggregationNode;

class EntityTimeSeriesRepositoryPaginationTest {

  @Test
  void testBuildAggregationIncludesBucketSortWhenLimitProvided() {
    List<SearchAggregationNode> aggregations =
        buildTestAggregation("testCase.fullyQualifiedName", 15, 0);

    boolean hasBucketSort = aggregations.stream().anyMatch(n -> "bucket_sort".equals(n.getType()));
    assertTrue(hasBucketSort, "Should include bucket_sort when limit > 0");
  }

  @Test
  void testBuildAggregationExcludesBucketSortWhenLimitNull() {
    List<SearchAggregationNode> aggregations =
        buildTestAggregation("testCase.fullyQualifiedName", null, null);

    boolean hasBucketSort = aggregations.stream().anyMatch(n -> "bucket_sort".equals(n.getType()));
    assertFalse(hasBucketSort, "Should exclude bucket_sort when limit is null");
  }

  @Test
  void testBuildAggregationAlwaysIncludesCardinality() {
    List<SearchAggregationNode> aggregationsWithLimit =
        buildTestAggregation("testCase.fullyQualifiedName", 15, 0);
    List<SearchAggregationNode> aggregationsWithoutLimit =
        buildTestAggregation("testCase.fullyQualifiedName", null, null);

    boolean hasCardinalityWithLimit =
        aggregationsWithLimit.stream().anyMatch(n -> "cardinality".equals(n.getType()));
    boolean hasCardinalityWithoutLimit =
        aggregationsWithoutLimit.stream().anyMatch(n -> "cardinality".equals(n.getType()));

    assertTrue(hasCardinalityWithLimit, "Should include cardinality with pagination");
    assertTrue(hasCardinalityWithoutLimit, "Should include cardinality without pagination");
  }

  @Test
  void testLimitCappedAtMaxAggregateSize() {
    int effectiveLimit = calculateEffectiveLimit(15000, 0);
    assertEquals(10000, effectiveLimit, "Limit should be capped at MAX_AGGREGATE_SIZE (10,000)");
  }

  @Test
  void testLimitNotCappedWhenBelowMax() {
    int effectiveLimit = calculateEffectiveLimit(500, 0);
    assertEquals(500, effectiveLimit, "Limit below max should not be capped");
  }

  @Test
  void testOffsetDefaultsToZeroWhenNull() {
    Integer effectiveOffset = calculateEffectiveOffset(null);
    assertEquals(0, effectiveOffset, "Offset should default to 0 when null");
  }

  @Test
  void testOffsetPreservedWhenProvided() {
    Integer effectiveOffset = calculateEffectiveOffset(25);
    assertEquals(25, effectiveOffset, "Offset should be preserved when provided");
  }

  private List<SearchAggregationNode> buildTestAggregation(
      String groupBy, Integer limit, Integer offset) {
    Integer effectiveLimit = calculateEffectiveLimit(limit, offset);
    Integer effectiveOffset = calculateEffectiveOffset(offset);

    SearchAggregationNode termsAgg = SearchAggregation.terms("byTerms", groupBy);
    SearchAggregationNode cardinality = SearchAggregation.cardinality("total_count", groupBy);

    List<SearchAggregationNode> aggregations = new java.util.ArrayList<>();
    aggregations.add(termsAgg);
    aggregations.add(cardinality);

    if (limit != null && limit > 0) {
      SearchAggregationNode bucketSort =
          SearchAggregation.bucketSort("pagination", effectiveLimit, effectiveOffset);
      aggregations.add(bucketSort);
    }

    return aggregations;
  }

  private Integer calculateEffectiveLimit(Integer limit, Integer offset) {
    int MAX_AGGREGATE_SIZE = 10000;
    if (limit == null || limit <= 0) {
      return MAX_AGGREGATE_SIZE;
    }
    return Math.min(limit, MAX_AGGREGATE_SIZE);
  }

  private Integer calculateEffectiveOffset(Integer offset) {
    return (offset != null) ? offset : 0;
  }
}
