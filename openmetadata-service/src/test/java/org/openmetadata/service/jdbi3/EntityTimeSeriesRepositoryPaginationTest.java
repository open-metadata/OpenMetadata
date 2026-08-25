package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import org.junit.jupiter.api.Test;
import org.openmetadata.service.search.SearchAggregationNode;

class EntityTimeSeriesRepositoryPaginationTest {

  private static final String GROUP_BY = "testCase.fullyQualifiedName.keyword";
  private static final String CONTENT_FILTERS = "{\"match_all\":{}}";
  private static final int MAX_AGG_SIZE = 10000;

  @Test
  void testBucketSortPresentWhenPaginating() {
    List<SearchAggregationNode> nodes =
        EntityTimeSeriesRepository.buildAggregationNodes(
            GROUP_BY, CONTENT_FILTERS, 15, 0, null, null, MAX_AGG_SIZE);

    boolean hasBucketSort =
        byTerms(nodes).getChildren().stream().anyMatch(n -> "bucket_sort".equals(n.getType()));
    assertTrue(hasBucketSort, "Should include bucket_sort when limit > 0");
  }

  @Test
  void testBucketSortAbsentWhenNotPaginating() {
    List<SearchAggregationNode> nodes =
        EntityTimeSeriesRepository.buildAggregationNodes(
            GROUP_BY, CONTENT_FILTERS, null, null, null, null, MAX_AGG_SIZE);

    boolean hasBucketSort =
        byTerms(nodes).getChildren().stream().anyMatch(n -> "bucket_sort".equals(n.getType()));
    assertFalse(hasBucketSort, "Should not include bucket_sort when limit is null");
  }

  @Test
  void testTermsSizeIsMaxAggSizeWhenPaginating() {
    List<SearchAggregationNode> nodes =
        EntityTimeSeriesRepository.buildAggregationNodes(
            GROUP_BY, CONTENT_FILTERS, 15, 0, null, null, MAX_AGG_SIZE);

    assertEquals(
        String.valueOf(MAX_AGG_SIZE),
        byTerms(nodes).getValue().get("size"),
        "byTerms size must be maxAggSize when paginating so bucket_sort has enough buckets to slice");
  }

  @Test
  void testTermsSizeIsDefaultWhenNotPaginating() {
    List<SearchAggregationNode> nodes =
        EntityTimeSeriesRepository.buildAggregationNodes(
            GROUP_BY, CONTENT_FILTERS, null, null, null, null, MAX_AGG_SIZE);

    assertEquals(
        "100",
        byTerms(nodes).getValue().get("size"),
        "byTerms size should be 100 when not paginating");
  }

  @Test
  void testByTermsCountPresentWhenPaginating() {
    List<SearchAggregationNode> nodes =
        EntityTimeSeriesRepository.buildAggregationNodes(
            GROUP_BY, CONTENT_FILTERS, 15, 0, null, null, MAX_AGG_SIZE);

    SearchAggregationNode byTermsCount = byTermsCount(nodes);
    boolean hasMaxTimestamp =
        byTermsCount.getChildren().stream()
            .anyMatch(n -> "max".equals(n.getType()) && "max_timestamp".equals(n.getName()));
    assertTrue(
        hasMaxTimestamp, "byTermsCount must have max_timestamp for stats_bucket to reference");
  }

  @Test
  void testByTermsCountHasNoBucketSort() {
    List<SearchAggregationNode> nodes =
        EntityTimeSeriesRepository.buildAggregationNodes(
            GROUP_BY, CONTENT_FILTERS, 15, 0, null, null, MAX_AGG_SIZE);

    boolean hasBucketSort =
        byTermsCount(nodes).getChildren().stream().anyMatch(n -> "bucket_sort".equals(n.getType()));
    assertFalse(
        hasBucketSort,
        "byTermsCount must not paginate — it needs all post-filter buckets visible to stats_bucket");
  }

  @Test
  void testByTermsCountAbsentWhenNotPaginating() {
    List<SearchAggregationNode> nodes =
        EntityTimeSeriesRepository.buildAggregationNodes(
            GROUP_BY, CONTENT_FILTERS, null, null, null, null, MAX_AGG_SIZE);

    boolean hasByTermsCount =
        nodes.stream()
            .anyMatch(n -> "terms".equals(n.getType()) && "byTermsCount".equals(n.getName()));
    assertFalse(hasByTermsCount, "byTermsCount should not be built when not paginating");
  }

  @Test
  void testStatsBucketPresentWhenPaginating() {
    List<SearchAggregationNode> nodes =
        EntityTimeSeriesRepository.buildAggregationNodes(
            GROUP_BY, CONTENT_FILTERS, 15, 0, null, null, MAX_AGG_SIZE);

    SearchAggregationNode statsBucket =
        nodes.stream()
            .filter(
                n -> "stats_bucket".equals(n.getType()) && "total_bucket_count".equals(n.getName()))
            .findFirst()
            .orElseThrow(() -> new AssertionError("stats_bucket#total_bucket_count not found"));

    assertEquals(
        "byTermsCount>max_timestamp",
        statsBucket.getValue().get("buckets_path"),
        "stats_bucket must point to byTermsCount>max_timestamp to count post-filter groups");
  }

  @Test
  void testStatsBucketAbsentWhenNotPaginating() {
    List<SearchAggregationNode> nodes =
        EntityTimeSeriesRepository.buildAggregationNodes(
            GROUP_BY, CONTENT_FILTERS, null, null, null, null, MAX_AGG_SIZE);

    boolean hasStatsBucket = nodes.stream().anyMatch(n -> "stats_bucket".equals(n.getType()));
    assertFalse(hasStatsBucket, "stats_bucket should not be built when not paginating");
  }

  @Test
  void testLimitCappedAtMaxAggSize() {
    List<SearchAggregationNode> nodes =
        EntityTimeSeriesRepository.buildAggregationNodes(
            GROUP_BY, CONTENT_FILTERS, 15000, 0, null, null, MAX_AGG_SIZE);

    assertEquals(
        String.valueOf(MAX_AGG_SIZE),
        bucketSort(nodes).getValue().get("size"),
        "Limit must be capped at maxAggSize");
  }

  @Test
  void testLimitBelowMaxAggSizeIsPreserved() {
    List<SearchAggregationNode> nodes =
        EntityTimeSeriesRepository.buildAggregationNodes(
            GROUP_BY, CONTENT_FILTERS, 500, 0, null, null, MAX_AGG_SIZE);

    assertEquals(
        "500",
        bucketSort(nodes).getValue().get("size"),
        "Limit below maxAggSize should not be capped");
  }

  @Test
  void testOffsetDefaultsToZeroWhenNull() {
    List<SearchAggregationNode> nodes =
        EntityTimeSeriesRepository.buildAggregationNodes(
            GROUP_BY, CONTENT_FILTERS, 15, null, null, null, MAX_AGG_SIZE);

    assertEquals("0", bucketSort(nodes).getValue().get("from"), "Null offset should default to 0");
  }

  @Test
  void testOffsetPreservedWhenProvided() {
    List<SearchAggregationNode> nodes =
        EntityTimeSeriesRepository.buildAggregationNodes(
            GROUP_BY, CONTENT_FILTERS, 15, 25, null, null, MAX_AGG_SIZE);

    assertEquals(
        "25",
        bucketSort(nodes).getValue().get("from"),
        "Offset should be passed through to bucket_sort");
  }

  private static SearchAggregationNode byTerms(List<SearchAggregationNode> nodes) {
    return nodes.stream()
        .filter(n -> "terms".equals(n.getType()) && "byTerms".equals(n.getName()))
        .findFirst()
        .orElseThrow(() -> new AssertionError("byTerms aggregation not found"));
  }

  private static SearchAggregationNode byTermsCount(List<SearchAggregationNode> nodes) {
    return nodes.stream()
        .filter(n -> "terms".equals(n.getType()) && "byTermsCount".equals(n.getName()))
        .findFirst()
        .orElseThrow(() -> new AssertionError("byTermsCount aggregation not found"));
  }

  private static SearchAggregationNode bucketSort(List<SearchAggregationNode> nodes) {
    return byTerms(nodes).getChildren().stream()
        .filter(n -> "bucket_sort".equals(n.getType()))
        .findFirst()
        .orElseThrow(() -> new AssertionError("bucket_sort not found in byTerms"));
  }
}
