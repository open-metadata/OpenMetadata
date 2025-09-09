package org.openmetadata.service.search.opensearch.aggregations;

import java.util.Map;
import lombok.Getter;
import lombok.Setter;
import org.openmetadata.service.search.SearchAggregationNode;
import org.openmetadata.service.search.opensearch.OsUtils;
import os.org.opensearch.common.xcontent.LoggingDeprecationHandler;
import os.org.opensearch.common.xcontent.XContentType;
import os.org.opensearch.index.query.QueryBuilder;
import os.org.opensearch.search.aggregations.AggregationBuilder;
import os.org.opensearch.search.aggregations.AggregationBuilders;
import os.org.opensearch.search.aggregations.PipelineAggregationBuilder;

@Setter
@Getter
public class OpenFilterAggregations implements OpenAggregations {
  static final String aggregationType = "filter";
  AggregationBuilder OpenAggregationBuilder;

  @Override
  public void createAggregation(SearchAggregationNode node) {
    Map<String, String> params = node.getValue();
    String queryJson = params.get("query");

    try {
      var queryParser =
          XContentType.JSON
              .xContent()
              .createParser(
                  OsUtils.osXContentRegistry, LoggingDeprecationHandler.INSTANCE, queryJson);
      QueryBuilder filterQuery =
          os.org.opensearch.index.query.AbstractQueryBuilder.parseInnerQueryBuilder(queryParser);

      AggregationBuilder aggregationBuilders =
          AggregationBuilders.filter(node.getName(), filterQuery);
      setOpenAggregationBuilder(aggregationBuilders);
    } catch (Exception e) {
      throw new IllegalArgumentException("Invalid filter query JSON: " + queryJson, e);
    }
  }

  @Override
  public void setSubAggregation(PipelineAggregationBuilder aggregation) {
    if (OpenAggregationBuilder != null) {
      OpenAggregationBuilder.subAggregation(aggregation);
    }
  }

  @Override
  public void setSubAggregation(AggregationBuilder aggregation) {
    if (OpenAggregationBuilder != null) {
      OpenAggregationBuilder.subAggregation(aggregation);
    }
  }
}
