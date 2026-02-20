package org.openmetadata.service.search.opensearch.aggregations;

import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.Map;
import org.openmetadata.service.search.SearchAggregationNode;
import os.org.opensearch.client.json.JsonpMapper;
import os.org.opensearch.client.opensearch._types.aggregations.Aggregation;
import os.org.opensearch.client.opensearch._types.query_dsl.Query;

public class OpenAggregationsBuilder {
  private final JsonpMapper mapper;

  public OpenAggregationsBuilder(JsonpMapper mapper) {
    this.mapper = mapper;
  }

  public Map<String, Aggregation> buildAggregations(SearchAggregationNode node) {
    Map<String, Aggregation> aggregations = new HashMap<>();
    buildAggregation(node, null, aggregations);
    return aggregations;
  }

  private void buildAggregation(
      SearchAggregationNode node,
      OpenAggregations parentAggregation,
      Map<String, Aggregation> rootAggregations) {
    String type = node.getType();
    if (type.equals("root")) {
      for (SearchAggregationNode child : node.getChildren()) {
        buildAggregation(child, null, rootAggregations);
      }
      return;
    }

    OpenAggregations openAggregation = getAggregation(type);
    openAggregation.createAggregation(node);

    Map<String, Aggregation> subAggregations = new LinkedHashMap<>();
    for (SearchAggregationNode child : node.getChildren()) {
      buildAggregation(child, openAggregation, subAggregations);
    }

    if (!subAggregations.isEmpty()) {
      openAggregation.setSubAggregations(subAggregations);
    }

    Aggregation finalAggregation = openAggregation.getAggregation();
    if (!subAggregations.isEmpty()
        && !openAggregation.isPipelineAggregation()
        && !openAggregation.supportsSubAggregationsNatively()) {
      Query matchAllQuery = Query.of(q -> q.matchAll(m -> m));
      finalAggregation = Aggregation.of(a -> a.filter(matchAllQuery).aggregations(subAggregations));

      if (openAggregation.getAggregationName() != null) {
        String aggName = openAggregation.getAggregationName();
        Map<String, Aggregation> wrappedSubAggs = new LinkedHashMap<>(subAggregations);
        wrappedSubAggs.put(aggName + "_inner", openAggregation.getAggregation());

        finalAggregation =
            Aggregation.of(a -> a.filter(matchAllQuery).aggregations(wrappedSubAggs));
      }
    }

    rootAggregations.put(openAggregation.getAggregationName(), finalAggregation);
  }

  private OpenAggregations getAggregation(String aggregationType) {
    return switch (aggregationType) {
      case "bucket_selector" -> new OpenBucketSelectorAggregations();
      case "bucket_sort" -> new OpenBucketSortAggregations();
      case "date_histogram" -> new OpenDateHistogramAggregations();
      case "terms" -> new OpenTermsAggregations();
      case "avg" -> new OpenAvgAggregations();
      case "min" -> new OpenMinAggregations();
      case "max" -> new OpenMaxAggregations();
      case "filter" -> new OpenFilterAggregations(mapper);
      case "value_count" -> new OpenValueCountAggregations();
      case "cardinality" -> new OpenCardinalityAggregations();
      case "stats_bucket" -> new OpenStatsBucketAggregations();
      case "nested" -> new OpenNestedAggregations();
      case "top_hits" -> new OpenTopHitsAggregations();
      default -> throw new IllegalArgumentException("Invalid aggregation type: " + aggregationType);
    };
  }
}
