package org.openmetadata.search.aggregation.elasticsearch;

import es.co.elastic.clients.elasticsearch._types.aggregations.Aggregation;
import es.co.elastic.clients.elasticsearch._types.aggregations.CalendarInterval;
import es.co.elastic.clients.elasticsearch._types.aggregations.DateHistogramAggregation;
import java.util.Map;
import org.openmetadata.search.SearchAggregationNode;

public class ElasticDateHistogramAggregation extends ElasticBaseAggregation {

  public ElasticDateHistogramAggregation() {
    super("date_histogram");
  }

  @Override
  public void createAggregation(SearchAggregationNode node) {
    this.name = node.getName();
    buildSpecificAggregation(node);
  }

  @Override
  protected void buildSpecificAggregation(SearchAggregationNode node) {
    Map<String, String> params = node.getValue();
    String field = params.get("field");
    String calendarInterval = params.get("calendar_interval");

    DateHistogramAggregation.Builder histogramBuilder =
        new DateHistogramAggregation.Builder().field(field);

    if (calendarInterval != null) {
      histogramBuilder.calendarInterval(CalendarInterval.of(calendarInterval));
    }

    this.aggregationBuilder = new Aggregation.Builder().dateHistogram(histogramBuilder);
  }
}
