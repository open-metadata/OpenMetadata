package org.openmetadata.service.search.elasticsearch.dataInsightAggregators;

import es.org.elasticsearch.action.search.SearchAction;
import es.org.elasticsearch.action.search.SearchRequest;
import es.org.elasticsearch.action.search.SearchRequestBuilder;
import es.org.elasticsearch.action.search.SearchResponse;
import es.org.elasticsearch.index.query.BoolQueryBuilder;
import es.org.elasticsearch.index.query.QueryBuilders;
import es.org.elasticsearch.script.Script;
import es.org.elasticsearch.search.aggregations.AbstractAggregationBuilder;
import es.org.elasticsearch.search.aggregations.AggregationBuilders;
import es.org.elasticsearch.search.aggregations.BucketOrder;
import es.org.elasticsearch.search.aggregations.PipelineAggregatorBuilders;
import es.org.elasticsearch.search.aggregations.bucket.terms.Terms;
import es.org.elasticsearch.search.aggregations.bucket.terms.TermsAggregationBuilder;
import es.org.elasticsearch.search.aggregations.metrics.NumericMetricsAggregation;
import es.org.elasticsearch.search.aggregations.metrics.Stats;
import es.org.elasticsearch.search.aggregations.metrics.StatsAggregationBuilder;
import es.org.elasticsearch.search.aggregations.metrics.Sum;
import es.org.elasticsearch.search.aggregations.metrics.SumAggregationBuilder;
import es.org.elasticsearch.search.aggregations.metrics.TopHits;
import es.org.elasticsearch.search.aggregations.metrics.TopHitsAggregationBuilder;
import es.org.elasticsearch.search.aggregations.pipeline.BucketScriptPipelineAggregationBuilder;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.openmetadata.schema.entity.data.OverallStats;
import org.openmetadata.schema.entity.data.QueryCostSearchResult;
import org.openmetadata.schema.entity.data.QueryDetails;
import org.openmetadata.schema.entity.data.QueryGroup;
import org.openmetadata.schema.entity.data.QueryHolder;
import org.openmetadata.service.Entity;

public class QueryCostRecordsAggregator {

  public static SearchRequest getQueryCostRecords(String serviceName) {
    SearchRequest searchRequest;
    AbstractAggregationBuilder aggregationBuilder;
    // Create search request builder
    SearchRequestBuilder searchRequestBuilder =
        new SearchRequestBuilder(null, SearchAction.INSTANCE);
    searchRequestBuilder.setSize(0);

    // Create query groups aggregation with size 10 and order by total_cost
    TermsAggregationBuilder queryGroupsAgg =
        AggregationBuilders.terms("query_groups")
            .field("query.checksum.keyword")
            .size(10)
            .order(BucketOrder.aggregation("total_cost", false));

    // Add sub-aggregations to query_groups
    // Users aggregation
    TermsAggregationBuilder usersAgg =
        AggregationBuilders.terms("users").field("query.usedBy.keyword").size(10);
    queryGroupsAgg.subAggregation(usersAgg);

    // Total cost aggregation
    SumAggregationBuilder totalCostAgg = AggregationBuilders.sum("total_cost").field("cost");
    queryGroupsAgg.subAggregation(totalCostAgg);

    // Total count aggregation
    SumAggregationBuilder totalCountAgg = AggregationBuilders.sum("total_count").field("count");
    queryGroupsAgg.subAggregation(totalCountAgg);

    // Total duration aggregation
    SumAggregationBuilder totalDurationAgg =
        AggregationBuilders.sum("total_duration").field("totalDuration");
    queryGroupsAgg.subAggregation(totalDurationAgg);

    // Average duration aggregation (bucket script)
    Map<String, String> bucketsPathMap = new HashMap<>();
    bucketsPathMap.put("total_duration", "total_duration");
    bucketsPathMap.put("total_count", "total_count");
    BucketScriptPipelineAggregationBuilder avgDurationAgg =
        PipelineAggregatorBuilders.bucketScript(
            "avg_duration",
            bucketsPathMap,
            new Script("params.total_duration / params.total_count"));
    queryGroupsAgg.subAggregation(avgDurationAgg);

    // Query details aggregation (top hits)
    TopHitsAggregationBuilder queryDetailsAgg =
        AggregationBuilders.topHits("query_details")
            .size(1)
            .fetchSource(new String[] {"query.*"}, null);
    queryGroupsAgg.subAggregation(queryDetailsAgg);

    // set query size to 10
    queryGroupsAgg.size(10);
    queryGroupsAgg.order(BucketOrder.aggregation("total_cost", false));

    // Overall totals aggregation
    StatsAggregationBuilder overallTotalsAgg =
        AggregationBuilders.stats("overall_totals").field("cost");

    // Total execution count aggregation
    SumAggregationBuilder totalExecutionCountAgg =
        AggregationBuilders.sum("total_execution_count").field("count");

    // Add all top-level aggregations to the search request
    searchRequestBuilder.addAggregation(queryGroupsAgg);
    searchRequestBuilder.addAggregation(overallTotalsAgg);
    searchRequestBuilder.addAggregation(totalExecutionCountAgg);

    // If serviceName is provided, add a filter
    if (serviceName != null && !serviceName.isEmpty()) {
      BoolQueryBuilder boolQuery =
          QueryBuilders.boolQuery()
              .must(QueryBuilders.termQuery("service.name.keyword", serviceName));
      searchRequestBuilder.setQuery(boolQuery);
    }

    // Build the search request
    searchRequest =
        searchRequestBuilder
            .request()
            .indices(
                Entity.getSearchRepository().getIndexOrAliasName("query_cost_record_search_index"));

    return searchRequest;
  }

  public static QueryCostSearchResult parseQueryCostResponse(SearchResponse response) {
    List<QueryGroup> queryGroups = new ArrayList<>();

    // Get the query_groups aggregation
    Terms queryGroupsAgg = response.getAggregations().get("query_groups");

    // Process each query group
    for (Terms.Bucket bucket : queryGroupsAgg.getBuckets()) {
      String queryText = null;

      // Get users
      Terms usersAgg = bucket.getAggregations().get("users");
      List<String> users =
          usersAgg.getBuckets().stream()
              .map(Terms.Bucket::getKeyAsString)
              .collect(Collectors.toList());

      // Get metrics
      double totalCost = ((Sum) bucket.getAggregations().get("total_cost")).getValue();
      long totalCount = (long) ((Sum) bucket.getAggregations().get("total_count")).getValue();
      double totalDuration = ((Sum) bucket.getAggregations().get("total_duration")).getValue();

      // Get avg_duration using a more generic approach
      double avgDuration;
      Object avgDurationAgg = bucket.getAggregations().get("avg_duration");
      if (avgDurationAgg instanceof NumericMetricsAggregation.SingleValue) {
        // This should work for most implementations
        avgDuration = ((NumericMetricsAggregation.SingleValue) avgDurationAgg).value();
      } else {
        // Fallback: calculate it ourselves if the aggregation result can't be accessed
        avgDuration = totalCount > 0 ? totalDuration / totalCount : 0;
      }

      // Get query details
      TopHits queryDetailsHits = bucket.getAggregations().get("query_details");
      Map<String, Object> detailsMap = queryDetailsHits.getHits().getHits()[0].getSourceAsMap();

      // Create QueryDetails object
      QueryDetails queryDetails = new QueryDetails();

      // Extract query information if available
      if (detailsMap.containsKey("query")) {
        // Create a QueryHolder object instead of using the Map directly
        QueryHolder query = new QueryHolder();
        @SuppressWarnings("unchecked")
        Map<String, Object> queryMap = (Map<String, Object>) detailsMap.get("query");

        // Add all properties from queryMap to the Query__1 object as additional properties
        for (Map.Entry<String, Object> entry : queryMap.entrySet()) {
          query.withAdditionalProperty(entry.getKey(), entry.getValue());
          if (entry.getKey().equals("query")) {
            queryText = entry.getValue().toString();
          }
        }

        queryDetails.withQuery(query);
      }

      // Add any other fields from detailsMap to queryDetails
      for (Map.Entry<String, Object> entry : detailsMap.entrySet()) {
        if (!entry.getKey().equals("query")) {
          queryDetails.withAdditionalProperty(entry.getKey(), entry.getValue());
        }
      }

      QueryGroup queryGroup =
          new QueryGroup()
              .withQueryText(queryText)
              .withUsers(users)
              .withTotalCost(totalCost)
              .withTotalCount((int) totalCount)
              .withTotalDuration(totalDuration)
              .withAvgDuration(avgDuration)
              .withQueryDetails(queryDetails);

      queryGroups.add(queryGroup);
    }

    // Get overall stats
    Stats overallTotals = response.getAggregations().get("overall_totals");
    Sum totalExecutionCount = response.getAggregations().get("total_execution_count");

    OverallStats overallStats =
        new OverallStats()
            .withTotalCost(overallTotals.getSum())
            .withMinCost(overallTotals.getMin())
            .withMaxCost(overallTotals.getMax())
            .withAvgCost(overallTotals.getAvg())
            .withTotalExecutionCount((int) totalExecutionCount.getValue());

    return new QueryCostSearchResult().withQueryGroups(queryGroups).withOverallStats(overallStats);
  }
}
