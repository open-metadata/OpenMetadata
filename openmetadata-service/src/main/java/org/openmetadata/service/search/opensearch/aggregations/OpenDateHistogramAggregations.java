package org.openmetadata.service.search.opensearch.aggregations;

import java.util.HashMap;
import java.util.Map;
import lombok.Getter;
import lombok.Setter;
import org.openmetadata.service.search.SearchAggregationNode;
import os.org.opensearch.client.opensearch._types.aggregations.Aggregation;
import os.org.opensearch.client.opensearch._types.aggregations.CalendarInterval;
import os.org.opensearch.client.opensearch._types.aggregations.DateHistogramAggregation;

@Setter
@Getter
public class OpenDateHistogramAggregations implements OpenAggregations {
  static final String aggregationType = "date_histogram";
  private String aggregationName;
  private Aggregation aggregation;
  private Map<String, Aggregation> subAggregations = new HashMap<>();
  private String field;
  private CalendarInterval calendarInterval;

  @Override
  public void createAggregation(SearchAggregationNode node) {
    Map<String, String> params = node.getValue();
    this.aggregationName = node.getName();

    this.field = params.get("field");
    this.calendarInterval = mapCalendarInterval(params.get("calendar_interval"));

    this.aggregation =
        Aggregation.of(
            a ->
                a.dateHistogram(
                    DateHistogramAggregation.of(
                        dh -> dh.field(field).calendarInterval(calendarInterval))));
  }

  private CalendarInterval mapCalendarInterval(String interval) {
    return switch (interval) {
      case "1m", "minute" -> CalendarInterval.Minute;
      case "1h", "hour" -> CalendarInterval.Hour;
      case "1d", "day" -> CalendarInterval.Day;
      case "1w", "week" -> CalendarInterval.Week;
      case "1M", "month" -> CalendarInterval.Month;
      case "1q", "quarter" -> CalendarInterval.Quarter;
      case "1Y", "year" -> CalendarInterval.Year;
      default -> throw new IllegalArgumentException("Unsupported calendar interval: " + interval);
    };
  }

  @Override
  public void setSubAggregations(Map<String, Aggregation> subAggregations) {
    this.subAggregations = subAggregations;
    this.aggregation =
        Aggregation.of(
            a ->
                a.dateHistogram(
                        DateHistogramAggregation.of(
                            dh -> dh.field(field).calendarInterval(calendarInterval)))
                    .aggregations(subAggregations));
  }

  @Override
  public Boolean supportsSubAggregationsNatively() {
    return true;
  }
}
