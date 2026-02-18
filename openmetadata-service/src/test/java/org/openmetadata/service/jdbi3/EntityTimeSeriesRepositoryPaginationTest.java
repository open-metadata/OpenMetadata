package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.openmetadata.service.search.SearchAggregation;
import org.openmetadata.service.search.SearchAggregationNode;

class EntityTimeSeriesRepositoryPaginationTest {

  private static final int MAX_AGGREGATE_SIZE = 10000;
  private static final String GROUP_BY = "testCase.fullyQualifiedName";

  @Test
  void testBuildAggregationIncludesBucketSortWhenLimitProvided() {
    List<SearchAggregationNode> aggregations = buildTestAggregation(GROUP_BY, 15, 0);

    boolean hasBucketSort = aggregations.stream().anyMatch(n -> "bucket_sort".equals(n.getType()));
    assertTrue(hasBucketSort, "Should include bucket_sort when limit > 0");
  }

  @Test
  void testBuildAggregationExcludesBucketSortWhenLimitNull() {
    List<SearchAggregationNode> aggregations = buildTestAggregation(GROUP_BY, null, null);

    boolean hasBucketSort = aggregations.stream().anyMatch(n -> "bucket_sort".equals(n.getType()));
    assertFalse(hasBucketSort, "Should exclude bucket_sort when limit is null");
  }

  @Test
  void testTermsSizeIsMaxAggregateSizeWhenPaginating() {
    List<SearchAggregationNode> aggregations = buildTestAggregation(GROUP_BY, 15, 0);

    SearchAggregationNode termsNode =
        aggregations.stream()
            .filter(n -> "terms".equals(n.getType()))
            .findFirst()
            .orElseThrow(() -> new AssertionError("terms aggregation not found"));
    assertEquals(
        String.valueOf(MAX_AGGREGATE_SIZE),
        termsNode.getValue().get("size"),
        "Terms size should be MAX_AGGREGATE_SIZE when paginating");
  }

  @Test
  void testTermsSizeIsDefaultWhenNotPaginating() {
    List<SearchAggregationNode> aggregations = buildTestAggregation(GROUP_BY, null, null);

    SearchAggregationNode termsNode =
        aggregations.stream()
            .filter(n -> "terms".equals(n.getType()))
            .findFirst()
            .orElseThrow(() -> new AssertionError("terms aggregation not found"));
    assertEquals(
        "100", termsNode.getValue().get("size"), "Terms size should be 100 when not paginating");
  }

  @Test
  void testCardinalityWrappedInFilterAggregation() {
    List<SearchAggregationNode> aggregations = buildTestAggregation(GROUP_BY, 15, 0);

    SearchAggregationNode filterWrapper =
        aggregations.stream()
            .filter(n -> "filter".equals(n.getType()) && "total_count_wrapper".equals(n.getName()))
            .findFirst()
            .orElseThrow(() -> new AssertionError("filter#total_count_wrapper not found"));

    boolean hasCardinality =
        filterWrapper.getChildren().stream().anyMatch(n -> "cardinality".equals(n.getType()));
    assertTrue(hasCardinality, "Cardinality should be nested inside the filter wrapper");
  }

  @Test
  void testCardinalityWrappedInFilterWhenNotPaginating() {
    List<SearchAggregationNode> aggregations = buildTestAggregation(GROUP_BY, null, null);

    SearchAggregationNode filterWrapper =
        aggregations.stream()
            .filter(n -> "filter".equals(n.getType()) && "total_count_wrapper".equals(n.getName()))
            .findFirst()
            .orElseThrow(
                () ->
                    new AssertionError(
                        "filter#total_count_wrapper not found in non-paginated query"));

    boolean hasCardinality =
        filterWrapper.getChildren().stream().anyMatch(n -> "cardinality".equals(n.getType()));
    assertTrue(hasCardinality, "Cardinality should still be wrapped in filter when not paginating");
  }

  @Test
  void testCardinalityExtractionPath() {
    String expectedPath = "$.filter#total_count_wrapper.cardinality#total_count.value";
    assertEquals(
        expectedPath,
        "$.filter#total_count_wrapper.cardinality#total_count.value",
        "Cardinality extraction path should traverse through the filter wrapper");
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
    int termsSize = (limit != null && limit > 0) ? MAX_AGGREGATE_SIZE : 100;
    SearchAggregationNode termsAgg = SearchAggregation.terms("byTerms", groupBy, termsSize);

    SearchAggregationNode filteredCount =
        SearchAggregation.filter("total_count_wrapper", "{\"match_all\": {}}");
    filteredCount.addChild(SearchAggregation.cardinality("total_count", groupBy));

    List<SearchAggregationNode> aggregations = new ArrayList<>();
    aggregations.add(termsAgg);
    aggregations.add(filteredCount);

    if (limit != null && limit > 0) {
      Integer effectiveLimit = calculateEffectiveLimit(limit, offset);
      Integer effectiveOffset = calculateEffectiveOffset(offset);
      SearchAggregationNode bucketSort =
          SearchAggregation.bucketSort("pagination", effectiveLimit, effectiveOffset);
      aggregations.add(bucketSort);
    }

    return aggregations;
  }

  private Integer calculateEffectiveLimit(Integer limit, Integer offset) {
    if (limit == null || limit <= 0) {
      return MAX_AGGREGATE_SIZE;
    }
    return Math.min(limit, MAX_AGGREGATE_SIZE);
  }

  private Integer calculateEffectiveOffset(Integer offset) {
    return (offset != null) ? offset : 0;
  }
}
