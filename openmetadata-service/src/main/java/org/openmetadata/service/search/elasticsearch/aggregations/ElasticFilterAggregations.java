package org.openmetadata.service.search.elasticsearch.aggregations;

import es.org.elasticsearch.common.xcontent.LoggingDeprecationHandler;
import es.org.elasticsearch.index.query.QueryBuilder;
import es.org.elasticsearch.search.aggregations.AggregationBuilder;
import es.org.elasticsearch.search.aggregations.AggregationBuilders;
import es.org.elasticsearch.search.aggregations.PipelineAggregationBuilder;
import es.org.elasticsearch.xcontent.XContentType;
import java.util.Map;
import lombok.Getter;
import lombok.Setter;
import org.openmetadata.service.search.SearchAggregationNode;
import org.openmetadata.service.search.elasticsearch.EsUtils;

@Setter
@Getter
public class ElasticFilterAggregations implements ElasticAggregations {
  static final String aggregationType = "filter";
  AggregationBuilder elasticAggregationBuilder;

  @Override
  public void createAggregation(SearchAggregationNode node) {
    Map<String, String> params = node.getValue();
    String queryJson = params.get("query");

    try {
      var queryParser =
          XContentType.JSON
              .xContent()
              .createParser(
                  EsUtils.esXContentRegistry, LoggingDeprecationHandler.INSTANCE, queryJson);
      QueryBuilder filterQuery =
          es.org.elasticsearch.index.query.AbstractQueryBuilder.parseInnerQueryBuilder(queryParser);

      AggregationBuilder aggregationBuilders =
          AggregationBuilders.filter(node.getName(), filterQuery);
      setElasticAggregationBuilder(aggregationBuilders);
    } catch (Exception e) {
      throw new IllegalArgumentException("Invalid filter query JSON: " + queryJson, e);
    }
  }

  @Override
  public void setSubAggregation(PipelineAggregationBuilder aggregation) {
    if (elasticAggregationBuilder != null) {
      elasticAggregationBuilder.subAggregation(aggregation);
    }
  }

  @Override
  public void setSubAggregation(AggregationBuilder aggregation) {
    if (elasticAggregationBuilder != null) {
      elasticAggregationBuilder.subAggregation(aggregation);
    }
  }
}
