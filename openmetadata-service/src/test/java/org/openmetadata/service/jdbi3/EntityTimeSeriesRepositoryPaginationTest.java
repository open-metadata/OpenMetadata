package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import jakarta.json.JsonObject;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.search.SearchAggregationNode;
import org.openmetadata.service.search.SearchListFilter;

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
  void testTermsSizeIsMaxAggSizeWhenNotPaginating() {
    List<SearchAggregationNode> nodes =
        EntityTimeSeriesRepository.buildAggregationNodes(
            GROUP_BY, CONTENT_FILTERS, null, null, null, null, MAX_AGG_SIZE);

    assertEquals(
        String.valueOf(MAX_AGG_SIZE),
        byTerms(nodes).getValue().get("size"),
        "content filters apply inside each bucket, so a smaller size silently drops groups");
  }

  @Test
  void testLatestHitReturnsOnlyTheRequestedSourceFields() {
    List<SearchAggregationNode> nodes =
        EntityTimeSeriesRepository.buildAggregationNodes(
            GROUP_BY, CONTENT_FILTERS, null, null, null, null, MAX_AGG_SIZE, List.of("a", "b"));

    SearchAggregationNode latest =
        byTerms(nodes).getChildren().stream()
            .filter(n -> "top_hits".equals(n.getType()))
            .findFirst()
            .orElseThrow();
    assertEquals("a,b", latest.getValue().get("source_fields"));
  }

  @Test
  void testScopeFilterKeepsOnlyGroupInvariantParams() {
    SearchListFilter content = new SearchListFilter();
    content.addQueryParam("entityFQN", "svc.db.schema.table");
    content.addQueryParam("testCaseStatus", "Failed");
    content.addQueryParam("testSuiteId", "suite");
    content.addQueryParam("testCaseFQN", (String) null);

    SearchListFilter scope =
        EntityTimeSeriesRepository.groupScopeFilter(content, Set.of("entityFQN", "testCaseFQN"));

    assertEquals("svc.db.schema.table", scope.getQueryParam("entityFQN"));
    assertNull(scope.getQueryParam("testCaseStatus"), "status belongs to the latest record");
    assertNull(scope.getQueryParam("testSuiteId"), "suite membership can change between results");
    assertFalse(scope.getQueryParams().containsKey("testCaseFQN"), "null params are skipped");
  }

  @Test
  void testScopeFilterIsEmptyWithoutInvariantParams() {
    SearchListFilter content = new SearchListFilter();
    content.addQueryParam("entityFQN", "svc.db.schema.table");

    assertTrue(
        EntityTimeSeriesRepository.groupScopeFilter(content, Set.of()).getQueryParams().isEmpty());
  }

  @Test
  void testTruncationIsReadFromEitherTermsAggregation() {
    assertFalse(EntityTimeSeriesRepository.isTruncated(aggregations(0, null)));
    assertTrue(EntityTimeSeriesRepository.isTruncated(aggregations(5, null)));
    assertTrue(EntityTimeSeriesRepository.isTruncated(aggregations(0, 7)));
    assertFalse(EntityTimeSeriesRepository.isTruncated(JsonUtils.readJson("{}").asJsonObject()));
  }

  @Test
  void testInvariantParamsDependOnTheGroupingField() {
    TestCaseResultRepository results =
        Mockito.mock(TestCaseResultRepository.class, Mockito.CALLS_REAL_METHODS);
    TestCaseResolutionStatusRepository incidents =
        Mockito.mock(TestCaseResolutionStatusRepository.class, Mockito.CALLS_REAL_METHODS);

    assertEquals(
        Set.of("entityFQN", "testCaseFQN", "testCaseType"),
        results.getGroupInvariantParams(TestCaseResultRepository.LATEST_PER_TEST_CASE));
    assertEquals(
        Set.of("testCaseFqn", "originEntityFQN"),
        incidents.getGroupInvariantParams(TestCaseResolutionStatusRepository.LATEST_PER_TEST_CASE));
    assertEquals(Set.of(), results.getGroupInvariantParams("someOtherField.keyword"));
  }

  private static JsonObject aggregations(long byTermsOther, Integer byTermsCountOther) {
    Map<String, Object> aggregations = new HashMap<>();
    aggregations.put("sterms#byTerms", Map.of("sum_other_doc_count", byTermsOther));
    if (byTermsCountOther != null) {
      aggregations.put("sterms#byTermsCount", Map.of("sum_other_doc_count", byTermsCountOther));
    }
    return JsonUtils.readJson(JsonUtils.pojoToJson(aggregations)).asJsonObject();
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
