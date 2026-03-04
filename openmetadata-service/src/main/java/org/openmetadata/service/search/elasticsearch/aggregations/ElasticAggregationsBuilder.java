package org.openmetadata.service.search.elasticsearch.aggregations;

import es.co.elastic.clients.elasticsearch._types.aggregations.Aggregation;
import es.co.elastic.clients.elasticsearch._types.query_dsl.Query;
import es.co.elastic.clients.json.JsonpMapper;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.Map;
import org.openmetadata.service.search.SearchAggregationNode;

public class ElasticAggregationsBuilder {
  private final JsonpMapper mapper;

  public ElasticAggregationsBuilder(JsonpMapper mapper) {
    this.mapper = mapper;
  }

  public Map<String, Aggregation> buildAggregations(SearchAggregationNode node) {
    Map<String, Aggregation> aggregations = new HashMap<>();
    buildAggregation(node, null, aggregations);
    return aggregations;
  }

  private void buildAggregation(
      SearchAggregationNode node,
      ElasticAggregations parentAggregation,
      Map<String, Aggregation> rootAggregations) {
    String type = node.getType();
    if (type.equals("root")) {
      for (SearchAggregationNode child : node.getChildren()) {
        buildAggregation(child, null, rootAggregations);
      }
      return;
    }

    ElasticAggregations elasticAggregation = getAggregation(type);
    elasticAggregation.createAggregation(node);

    Map<String, Aggregation> subAggregations = new LinkedHashMap<>();
    for (SearchAggregationNode child : node.getChildren()) {
      buildAggregation(child, elasticAggregation, subAggregations);
    }

    if (!subAggregations.isEmpty()) {
      elasticAggregation.setSubAggregations(subAggregations);
    }

    Aggregation finalAggregation = elasticAggregation.getAggregation();
    if (!subAggregations.isEmpty()
        && !elasticAggregation.isPipelineAggregation()
        && !elasticAggregation.supportsSubAggregationsNatively()) {
      Query matchAllQuery = Query.of(q -> q.matchAll(m -> m));
      finalAggregation = Aggregation.of(a -> a.filter(matchAllQuery).aggregations(subAggregations));

      if (elasticAggregation.getAggregationName() != null) {
        String aggName = elasticAggregation.getAggregationName();
        Map<String, Aggregation> wrappedSubAggs = new LinkedHashMap<>(subAggregations);
        wrappedSubAggs.put(aggName + "_inner", elasticAggregation.getAggregation());

        finalAggregation =
            Aggregation.of(a -> a.filter(matchAllQuery).aggregations(wrappedSubAggs));
      }
    }

    rootAggregations.put(elasticAggregation.getAggregationName(), finalAggregation);
  }

  private ElasticAggregations getAggregation(String aggregationType) {
    return switch (aggregationType) {
      case "bucket_selector" -> new ElasticBucketSelectorAggregations();
      case "bucket_sort" -> new ElasticBucketSortAggregations();
      case "date_histogram" -> new ElasticDateHistogramAggregations();
      case "terms" -> new ElasticTermsAggregations();
      case "avg" -> new ElasticAvgAggregations();
      case "min" -> new ElasticMinAggregations();
      case "max" -> new ElasticMaxAggregations();
      case "filter" -> new ElasticFilterAggregations(mapper);
      case "value_count" -> new ElasticValueCountAggregations();
      case "cardinality" -> new ElasticCardinalityAggregations();
      case "stats_bucket" -> new ElasticStatsBucketAggregations();
      case "nested" -> new ElasticNestedAggregations();
      case "top_hits" -> new ElasticTopHitsAggregations();
      default -> throw new IllegalArgumentException("Invalid aggregation type: " + aggregationType);
    };
  }
}
