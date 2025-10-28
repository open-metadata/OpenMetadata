package org.openmetadata.service.search.elasticsearch.dataInsightAggregators;

import es.co.elastic.clients.elasticsearch._types.FieldValue;
import es.co.elastic.clients.elasticsearch._types.SortOrder;
import es.co.elastic.clients.elasticsearch._types.aggregations.Aggregation;
import es.co.elastic.clients.elasticsearch._types.aggregations.StringTermsBucket;
import es.co.elastic.clients.elasticsearch._types.query_dsl.BoolQuery;
import es.co.elastic.clients.elasticsearch._types.query_dsl.Query;
import es.co.elastic.clients.elasticsearch.core.SearchRequest;
import es.co.elastic.clients.elasticsearch.core.SearchResponse;
import es.co.elastic.clients.elasticsearch.core.search.Hit;
import es.co.elastic.clients.json.JsonData;
import es.co.elastic.clients.util.NamedValue;
import jakarta.json.JsonObject;
import jakarta.json.JsonValue;
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

  private static Map<String, Object> jsonObjectToMap(JsonObject jsonObject) {
    Map<String, Object> map = new HashMap<>();
    for (String key : jsonObject.keySet()) {
      JsonValue value = jsonObject.get(key);
      if (value.getValueType() == JsonValue.ValueType.OBJECT) {
        map.put(key, jsonObjectToMap(value.asJsonObject()));
      } else if (value.getValueType() == JsonValue.ValueType.ARRAY) {
        map.put(key, value.asJsonArray());
      } else if (value.getValueType() == JsonValue.ValueType.STRING) {
        map.put(key, jsonObject.getString(key));
      } else if (value.getValueType() == JsonValue.ValueType.NUMBER) {
        map.put(key, jsonObject.getJsonNumber(key).numberValue());
      } else if (value.getValueType() == JsonValue.ValueType.TRUE) {
        map.put(key, Boolean.TRUE);
      } else if (value.getValueType() == JsonValue.ValueType.FALSE) {
        map.put(key, Boolean.FALSE);
      } else if (value.getValueType() == JsonValue.ValueType.NULL) {
        map.put(key, null);
      }
    }
    return map;
  }

  public static SearchRequest getQueryCostRecords(String serviceName) {
    Map<String, Aggregation> aggregations = new HashMap<>();

    // Sub-aggregations for each query group
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
                                            i.lang("painless")
                                                .source(
                                                    "params.total_duration / params.total_count"))))));

    // Top hits for query details
    queryGroupsSubAggs.put(
        "query_details",
        Aggregation.of(
            a ->
                a.topHits(th -> th.size(1).source(src -> src.filter(f -> f.includes("query.*"))))));

    // Terms aggregation for query_groups
    aggregations.put(
        "query_groups",
        Aggregation.of(
            a ->
                a.terms(
                        t ->
                            t.field("query.checksum.keyword")
                                .size(10)
                                .order(NamedValue.of("total_cost", SortOrder.Desc)))
                    .aggregations(queryGroupsSubAggs)));

    // Aggregation for overall stats
    aggregations.put("overall_totals", Aggregation.of(a -> a.stats(s -> s.field("cost"))));

    // Aggregation for total execution count
    aggregations.put("total_execution_count", Aggregation.of(a -> a.sum(s -> s.field("count"))));

    // Build the search request
    SearchRequest.Builder searchRequestBuilder =
        new SearchRequest.Builder()
            .index(
                Entity.getSearchRepository().getIndexOrAliasName("query_cost_record_search_index"))
            .size(0)
            .aggregations(aggregations);

    // Optional service name filter
    if (serviceName != null && !serviceName.isEmpty()) {
      searchRequestBuilder.query(
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

    return searchRequestBuilder.build();
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
                .map(b -> b.key().stringValue())
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
        totalCount = (long) totalCountAgg.sum().value();
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
            Map<String, Object> detailsMap = jsonObjectToMap(hit.source().toJson().asJsonObject());

            if (detailsMap.containsKey("query")) {
              QueryHolder query = new QueryHolder();
              @SuppressWarnings("unchecked")
              Map<String, Object> queryMap = (Map<String, Object>) detailsMap.get("query");

              for (Map.Entry<String, Object> entry : queryMap.entrySet()) {
                query.withAdditionalProperty(entry.getKey(), entry.getValue());
                if (entry.getKey().equals("query")) {
                  queryText = entry.getValue().toString();
                }
              }

              queryDetails.withQuery(query);
            }

            for (Map.Entry<String, Object> entry : detailsMap.entrySet()) {
              if (!entry.getKey().equals("query")) {
                queryDetails.withAdditionalProperty(entry.getKey(), entry.getValue());
              }
            }
          }
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

    double totalCostSum = 0;
    double minCost = 0;
    double maxCost = 0;
    double avgCost = 0;
    int totalExecutionCountValue = 0;

    var overallTotalsAgg = response.aggregations().get("overall_totals");
    if (overallTotalsAgg != null && overallTotalsAgg.isStats()) {
      totalCostSum = overallTotalsAgg.stats().sum();
      minCost = overallTotalsAgg.stats().min();
      maxCost = overallTotalsAgg.stats().max();
      avgCost = overallTotalsAgg.stats().avg();
    }

    var totalExecutionCountAgg = response.aggregations().get("total_execution_count");
    if (totalExecutionCountAgg != null && totalExecutionCountAgg.isSum()) {
      totalExecutionCountValue = (int) totalExecutionCountAgg.sum().value();
    }

    OverallStats overallStats =
        new OverallStats()
            .withTotalCost(totalCostSum)
            .withMinCost(minCost)
            .withMaxCost(maxCost)
            .withAvgCost(avgCost)
            .withTotalExecutionCount(totalExecutionCountValue);

    return new QueryCostSearchResult().withQueryGroups(queryGroups).withOverallStats(overallStats);
  }
}
