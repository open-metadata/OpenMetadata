package org.openmetadata.service.search.opensearch.dataInsightAggregator;

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
import org.openmetadata.service.search.opensearch.OsUtils;
import os.org.opensearch.client.json.JsonData;
import os.org.opensearch.client.opensearch._types.FieldValue;
import os.org.opensearch.client.opensearch._types.SortOrder;
import os.org.opensearch.client.opensearch._types.aggregations.Aggregation;
import os.org.opensearch.client.opensearch._types.aggregations.StringTermsBucket;
import os.org.opensearch.client.opensearch._types.query_dsl.BoolQuery;
import os.org.opensearch.client.opensearch._types.query_dsl.Query;
import os.org.opensearch.client.opensearch.core.SearchRequest;
import os.org.opensearch.client.opensearch.core.SearchResponse;
import os.org.opensearch.client.opensearch.core.search.Hit;

public class QueryCostRecordsAggregator {

  public static SearchRequest getQueryCostRecords(String serviceName) {
    Map<String, Aggregation> aggregations = new HashMap<>();

    Map<String, Aggregation> queryGroupsSubAggs = new HashMap<>();

    queryGroupsSubAggs.put(
        "users", Aggregation.of(a -> a.terms(t -> t.field("query.usedBy.keyword").size(10))));
    queryGroupsSubAggs.put("total_cost", Aggregation.of(a -> a.sum(s -> s.field("cost"))));
    queryGroupsSubAggs.put("total_count", Aggregation.of(a -> a.sum(s -> s.field("count"))));
    queryGroupsSubAggs.put(
        "total_duration", Aggregation.of(a -> a.sum(s -> s.field("totalDuration"))));

    queryGroupsSubAggs.put(
        "avg_duration",
        Aggregation.of(
            a ->
                a.bucketScript(
                    bs ->
                        bs.bucketsPath(
                                bp ->
                                    bp.dict(
                                        Map.of(
                                            "total_duration", "total_duration",
                                            "total_count", "total_count")))
                            .script(
                                s ->
                                    s.inline(
                                        i ->
                                            i.lang(
                                                    l ->
                                                        l.builtin(
                                                            os.org.opensearch.client.opensearch
                                                                ._types.BuiltinScriptLanguage
                                                                .Painless))
                                                .source(
                                                    "params.total_duration / params.total_count"))))));

    queryGroupsSubAggs.put(
        "query_details",
        Aggregation.of(
            a ->
                a.topHits(th -> th.size(1).source(src -> src.filter(f -> f.includes("query.*"))))));

    aggregations.put(
        "query_groups",
        Aggregation.of(
            a ->
                a.terms(
                        t ->
                            t.field("query.checksum.keyword")
                                .size(10)
                                .order(Map.of("total_cost", SortOrder.Desc)))
                    .aggregations(queryGroupsSubAggs)));

    aggregations.put("overall_totals", Aggregation.of(a -> a.stats(s -> s.field("cost"))));
    aggregations.put("total_execution_count", Aggregation.of(a -> a.sum(s -> s.field("count"))));

    SearchRequest.Builder builder =
        new SearchRequest.Builder()
            .index(
                Entity.getSearchRepository().getIndexOrAliasName("query_cost_record_search_index"))
            .size(0)
            .aggregations(aggregations);

    if (serviceName != null && !serviceName.isEmpty()) {
      builder.query(
          Query.of(
              q ->
                  q.bool(
                      BoolQuery.of(
                          b ->
                              b.must(
                                  m ->
                                      m.term(
                                          t ->
                                              t.field("service.name.keyword")
                                                  .value(FieldValue.of(serviceName))))))));
    }

    return builder.build();
  }

  public static QueryCostSearchResult parseQueryCostResponse(SearchResponse<JsonData> response) {
    List<QueryGroup> queryGroups = new ArrayList<>();

    if (response.aggregations() == null || !response.aggregations().containsKey("query_groups")) {
      return new QueryCostSearchResult().withQueryGroups(queryGroups);
    }

    var queryGroupsAgg = response.aggregations().get("query_groups");
    if (!queryGroupsAgg.isSterms()) {
      return new QueryCostSearchResult().withQueryGroups(queryGroups);
    }

    List<StringTermsBucket> buckets = queryGroupsAgg.sterms().buckets().array();

    for (StringTermsBucket bucket : buckets) {
      String queryText = null;

      var usersAgg = bucket.aggregations().get("users");
      List<String> users = new ArrayList<>();
      if (usersAgg != null && usersAgg.isSterms()) {
        users =
            usersAgg.sterms().buckets().array().stream()
                .map(StringTermsBucket::key)
                .collect(Collectors.toList());
      }

      double totalCost = 0;
      long totalCount = 0;
      double totalDuration = 0;

      var totalCostAgg = bucket.aggregations().get("total_cost");
      if (totalCostAgg != null && totalCostAgg.isSum()) {
        totalCost = totalCostAgg.sum().value();
      }
      var totalCountAgg = bucket.aggregations().get("total_count");
      if (totalCountAgg != null && totalCountAgg.isSum()) {
        Double countValue = totalCountAgg.sum().value();
        totalCount = countValue != null ? countValue.longValue() : 0L;
      }
      var totalDurationAgg = bucket.aggregations().get("total_duration");
      if (totalDurationAgg != null && totalDurationAgg.isSum()) {
        totalDuration = totalDurationAgg.sum().value();
      }

      double avgDuration;
      var avgDurationAgg = bucket.aggregations().get("avg_duration");
      if (avgDurationAgg != null && avgDurationAgg.isSimpleValue()) {
        avgDuration = avgDurationAgg.simpleValue().value();
      } else {
        avgDuration = totalCount > 0 ? totalDuration / totalCount : 0;
      }

      QueryDetails queryDetails = new QueryDetails();
      var queryDetailsAgg = bucket.aggregations().get("query_details");
      if (queryDetailsAgg != null && queryDetailsAgg.isTopHits()) {
        List<Hit<JsonData>> hits = queryDetailsAgg.topHits().hits().hits();
        if (!hits.isEmpty()) {
          Hit<JsonData> hit = hits.get(0);
          if (hit.source() != null) {
            Map<String, Object> detailsMap = OsUtils.jsonDataToMap(hit.source());
            if (detailsMap.containsKey("query")) {
              QueryHolder queryHolder = new QueryHolder();
              @SuppressWarnings("unchecked")
              Map<String, Object> queryMap = (Map<String, Object>) detailsMap.get("query");
              for (var entry : queryMap.entrySet()) {
                queryHolder.withAdditionalProperty(entry.getKey(), entry.getValue());
                if (entry.getKey().equals("query")) {
                  queryText = entry.getValue().toString();
                }
              }
              queryDetails.withQuery(queryHolder);
            }
            for (var entry : detailsMap.entrySet()) {
              if (!entry.getKey().equals("query")) {
                queryDetails.withAdditionalProperty(entry.getKey(), entry.getValue());
              }
            }
          }
        }
      }

      QueryGroup qg =
          new QueryGroup()
              .withQueryText(queryText)
              .withUsers(users)
              .withTotalCost(totalCost)
              .withTotalCount((int) totalCount)
              .withTotalDuration(totalDuration)
              .withAvgDuration(avgDuration)
              .withQueryDetails(queryDetails);
      queryGroups.add(qg);
    }

    double totalCostSum = 0, minCost = 0, maxCost = 0, avgCost = 0;
    int totalExecCount = 0;

    var overallTotalsAgg = response.aggregations().get("overall_totals");
    if (overallTotalsAgg != null && overallTotalsAgg.isStats()) {
      totalCostSum = overallTotalsAgg.stats().sum();
      minCost = overallTotalsAgg.stats().min();
      maxCost = overallTotalsAgg.stats().max();
      avgCost = overallTotalsAgg.stats().avg();
    }
    var totalExecCountAgg = response.aggregations().get("total_execution_count");
    if (totalExecCountAgg != null && totalExecCountAgg.isSum()) {
      Double countValue = totalExecCountAgg.sum().value();
      totalExecCount = countValue != null ? countValue.intValue() : 0;
    }

    OverallStats overallStats =
        new OverallStats()
            .withTotalCost(totalCostSum)
            .withMinCost(minCost)
            .withMaxCost(maxCost)
            .withAvgCost(avgCost)
            .withTotalExecutionCount(totalExecCount);

    return new QueryCostSearchResult().withQueryGroups(queryGroups).withOverallStats(overallStats);
  }
}
