package org.openmetadata.service.search.opensearch.aggregations;

import javax.json.JsonObject;
import lombok.Getter;
import lombok.Setter;
import os.org.opensearch.search.aggregations.AggregationBuilder;
import os.org.opensearch.search.aggregations.AggregationBuilders;
import os.org.opensearch.search.aggregations.PipelineAggregationBuilder;
import os.org.opensearch.search.aggregations.bucket.histogram.DateHistogramInterval;

@Setter
@Getter
public class OpenDateHistogramAggregations implements OpenAggregations {
  static final String aggregationType = "date_histogram";
  AggregationBuilder elasticAggregationBuilder;

  @Override
  public void createAggregation(JsonObject jsonAggregation, String key) {
    JsonObject dateHistogramAggregation = jsonAggregation.getJsonObject(aggregationType);
    String calendarInterval = dateHistogramAggregation.getString("calendar_interval");
    AggregationBuilder aggregationBuilder =
        AggregationBuilders.dateHistogram(key)
            .field(dateHistogramAggregation.getString("field"))
            .calendarInterval(new DateHistogramInterval(calendarInterval));
    setElasticAggregationBuilder(aggregationBuilder);
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
