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
    List<SearchAggregationNode> termsChildren = buildByTermsChildren(GROUP_BY, 15, 0);

    boolean hasBucketSort = termsChildren.stream().anyMatch(n -> "bucket_sort".equals(n.getType()));
    assertTrue(hasBucketSort, "Should include bucket_sort when limit > 0");
  }

  @Test
  void testBuildAggregationExcludesBucketSortWhenLimitNull() {
    List<SearchAggregationNode> termsChildren = buildByTermsChildren(GROUP_BY, null, null);

    boolean hasBucketSort = termsChildren.stream().anyMatch(n -> "bucket_sort".equals(n.getType()));
    assertFalse(hasBucketSort, "Should exclude bucket_sort when limit is null");
  }

  @Test
  void testTermsSizeIsMaxAggregateSizeWhenPaginating() {
    List<SearchAggregationNode> rootNodes = buildRootNodes(GROUP_BY, 15, 0);

    SearchAggregationNode byTerms =
        rootNodes.stream()
            .filter(n -> "terms".equals(n.getType()) && "byTerms".equals(n.getName()))
            .findFirst()
            .orElseThrow(() -> new AssertionError("byTerms aggregation not found"));
    assertEquals(
        String.valueOf(MAX_AGGREGATE_SIZE),
        byTerms.getValue().get("size"),
        "Terms size should be MAX_AGGREGATE_SIZE when paginating");
  }

  @Test
  void testTermsSizeIsDefaultWhenNotPaginating() {
    List<SearchAggregationNode> rootNodes = buildRootNodes(GROUP_BY, null, null);

    SearchAggregationNode byTerms =
        rootNodes.stream()
            .filter(n -> "terms".equals(n.getType()) && "byTerms".equals(n.getName()))
            .findFirst()
            .orElseThrow(() -> new AssertionError("byTerms aggregation not found"));
    assertEquals(
        "100", byTerms.getValue().get("size"), "Terms size should be 100 when not paginating");
  }

  @Test
  void testByTermsCountPresentWhenPaginating() {
    List<SearchAggregationNode> rootNodes = buildRootNodes(GROUP_BY, 15, 0);

    SearchAggregationNode byTermsCount =
        rootNodes.stream()
            .filter(n -> "terms".equals(n.getType()) && "byTermsCount".equals(n.getName()))
            .findFirst()
            .orElseThrow(() -> new AssertionError("byTermsCount aggregation not found"));

    boolean hasMaxTimestamp =
        byTermsCount.getChildren().stream()
            .anyMatch(n -> "max".equals(n.getType()) && "max_timestamp".equals(n.getName()));
    assertTrue(hasMaxTimestamp, "byTermsCount should have max_timestamp child");
  }

  @Test
  void testByTermsCountHasNoBucketSort() {
    List<SearchAggregationNode> rootNodes = buildRootNodes(GROUP_BY, 15, 0);

    SearchAggregationNode byTermsCount =
        rootNodes.stream()
            .filter(n -> "terms".equals(n.getType()) && "byTermsCount".equals(n.getName()))
            .findFirst()
            .orElseThrow(() -> new AssertionError("byTermsCount aggregation not found"));

    boolean hasBucketSort =
        byTermsCount.getChildren().stream().anyMatch(n -> "bucket_sort".equals(n.getType()));
    assertFalse(hasBucketSort, "byTermsCount must not have bucket_sort");
  }

  @Test
  void testByTermsCountAbsentWhenNotPaginating() {
    List<SearchAggregationNode> rootNodes = buildRootNodes(GROUP_BY, null, null);

    boolean hasByTermsCount =
        rootNodes.stream()
            .anyMatch(n -> "terms".equals(n.getType()) && "byTermsCount".equals(n.getName()));
    assertFalse(hasByTermsCount, "byTermsCount should not be present when not paginating");
  }

  @Test
  void testStatsBucketPresentWhenPaginating() {
    List<SearchAggregationNode> rootNodes = buildRootNodes(GROUP_BY, 15, 0);

    SearchAggregationNode statsBucket =
        rootNodes.stream()
            .filter(
                n -> "stats_bucket".equals(n.getType()) && "total_bucket_count".equals(n.getName()))
            .findFirst()
            .orElseThrow(
                () -> new AssertionError("stats_bucket#total_bucket_count not found in root"));

    assertEquals(
        "byTermsCount>max_timestamp",
        statsBucket.getValue().get("buckets_path"),
        "stats_bucket buckets_path should point to byTermsCount>max_timestamp");
  }

  @Test
  void testStatsBucketAbsentWhenNotPaginating() {
    List<SearchAggregationNode> rootNodes = buildRootNodes(GROUP_BY, null, null);

    boolean hasStatsBucket = rootNodes.stream().anyMatch(n -> "stats_bucket".equals(n.getType()));
    assertFalse(hasStatsBucket, "stats_bucket should not be present when not paginating");
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

  private List<SearchAggregationNode> buildRootNodes(
      String groupBy, Integer limit, Integer offset) {
    int termsSize = (limit != null && limit > 0) ? MAX_AGGREGATE_SIZE : 100;
    SearchAggregationNode byTerms = SearchAggregation.terms("byTerms", groupBy, termsSize);

    List<SearchAggregationNode> rootNodes = new ArrayList<>();
    rootNodes.add(byTerms);

    if (limit != null && limit > 0) {
      Integer effectiveLimit = calculateEffectiveLimit(limit, offset);
      Integer effectiveOffset = calculateEffectiveOffset(offset);
      byTerms.addChild(SearchAggregation.bucketSort("pagination", effectiveLimit, effectiveOffset));

      SearchAggregationNode byTermsCount =
          SearchAggregation.terms("byTermsCount", groupBy, MAX_AGGREGATE_SIZE);
      byTermsCount.addChild(SearchAggregation.max("max_timestamp", "timestamp"));

      SearchAggregationNode filterAgg =
          SearchAggregation.filter("with_content_filters", "{\"match_all\": {}}");
      filterAgg.addChild(SearchAggregation.max("max_matching_timestamp", "timestamp"));
      filterAgg.addChild(SearchAggregation.valueCount("count", "timestamp"));
      byTermsCount.addChild(filterAgg);

      byTermsCount.addChild(
          SearchAggregation.bucketSelector(
              "filter_groups",
              "if (params.matching_count == 0) return false; return params.latest_timestamp == params.matching_timestamp;",
              "latest_timestamp,matching_count,matching_timestamp",
              "max_timestamp,with_content_filters>count,with_content_filters>max_matching_timestamp"));

      rootNodes.add(byTermsCount);
      rootNodes.add(
          SearchAggregation.statsBucket("total_bucket_count", "byTermsCount>max_timestamp"));
    }

    return rootNodes;
  }

  private List<SearchAggregationNode> buildByTermsChildren(
      String groupBy, Integer limit, Integer offset) {
    return buildRootNodes(groupBy, limit, offset).stream()
        .filter(n -> "terms".equals(n.getType()) && "byTerms".equals(n.getName()))
        .findFirst()
        .orElseThrow(() -> new AssertionError("byTerms not found"))
        .getChildren();
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
