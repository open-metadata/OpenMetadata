package org.openmetadata.service.search;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;
import org.openmetadata.schema.dataInsight.custom.LineChart;
import org.openmetadata.schema.dataInsight.custom.LineChartMetric;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Reads a Data Insight chart metric's {@code filter}, and decides how a categorical axis picks its
 * categories.
 *
 * <p>Both engines used to parse that string inline, twice each, and both fell back to an unfiltered
 * aggregation on any failure. Routing every read through here keeps a filter that cannot be parsed
 * failing the same way everywhere: the caller gets {@code null} and leaves the aggregation
 * unfiltered, exactly as before.
 *
 * <p>The selection decision lives here too, because both engines must reach the same answer. A
 * terms axis picks its top N by document count, which is neither the population the metric filters
 * to nor the number the chart plots. {@link #ranksByFilterBucket} covers the metrics that can be
 * ranked in place; {@link #hoistableQueryJson} narrows the request for the rest.
 */
public final class DataInsightMetricFilter {
  private static final Logger LOG = LoggerFactory.getLogger(DataInsightMetricFilter.class);
  private static final ObjectMapper MAPPER = new ObjectMapper();
  private static final String QUERY_KEY = "query";
  private static final String EMPTY_FILTER = "{}";
  private static final String TIMESTAMP_FIELD = "@timestamp";

  /**
   * Aggregation both engines wrap a filtered function metric in, and the whole order path a terms
   * axis needs to rank by it. Naming the aggregation itself sorts on its document count; there is
   * no metric key, so nothing here can contain a dot — an order path splits on {@code .} into a
   * metric sub-field and the search is rejected outright when it does.
   */
  public static final String FILTER_AGG_KEY = "filter";

  private DataInsightMetricFilter() {}

  /**
   * JSON text of the filter's {@code query} node, or null when the filter is absent, empty or
   * unparseable. The {@code "{}"} comparison is an exact string match, which is what the inline
   * parses did.
   */
  public static String queryJson(String filter) {
    if (filter == null || filter.equals(EMPTY_FILTER)) {
      return null;
    }
    try {
      JsonNode queryNode = MAPPER.readTree(filter).get(QUERY_KEY);
      return queryNode == null ? null : queryNode.toString();
    } catch (Exception e) {
      // Warn without the throwable: these endpoints are polled, and the fallback is well defined.
      LOG.warn("Ignoring a Data Insight metric filter that will not parse: {}", e.getMessage());
      return null;
    }
  }

  /**
   * The query text to constrain a chart's request with, or null to leave the request as it was.
   *
   * <p>Terms buckets are picked from the documents the request matches and then counted with the
   * metric filter applied, so a chart whose metrics agree on one filter has to constrain the request
   * with it too or it selects from a population it does not count.
   *
   * <p>Charts without a terms x-axis are excluded: they have no top-N to align, and narrowing their
   * query would shorten the window a date histogram plots, moving the first/last delta the UI
   * renders. Both engines share this decision, so it lives here rather than twice in the
   * aggregators.
   */
  public static String hoistableQueryJson(LineChart lineChart) {
    if (lineChart == null || !hasTermsXAxis(lineChart) || ranksByFilterBucket(lineChart)) {
      return null;
    }
    return sharedQueryJson(lineChart.getMetrics());
  }

  /**
   * Whether a terms axis can rank itself instead of the request being narrowed.
   *
   * <p>Narrowing fixes which categories are picked, but a terms aggregation carries {@code
   * min_doc_count: 1}, so a category the filter emptied loses its bucket and the chart can no
   * longer say a service holds none. Ordering the axis by {@link #FILTER_AGG_KEY} ranks categories
   * by how many documents matched, which keeps the wide population and puts the empty ones last,
   * where they cannot displace a category that has data.
   *
   * <p>Ranking on the wrapper's document count rather than the metric's value is what makes this
   * safe for every function: an empty {@code min} reads as larger than any real minimum and an
   * empty {@code sum} is zero, so sorting on either would float the empty categories to the top.
   * A document count is never negative and is zero exactly when the category matched nothing.
   *
   * <p>Formula metrics are excluded: they compile to one wrapper per term, named with an index, so
   * there is no single aggregation to name. Those still narrow the request.
   */
  public static boolean ranksByFilterBucket(LineChart lineChart) {
    return lineChart != null
        && hasTermsXAxis(lineChart)
        && sharedQueryJson(lineChart.getMetrics()) != null
        && lineChart.getMetrics().stream()
            .allMatch(metric -> metric.getFormula() == null && metric.getFunction() != null);
  }

  private static boolean hasTermsXAxis(LineChart lineChart) {
    return lineChart.getxAxisField() != null && !lineChart.getxAxisField().equals(TIMESTAMP_FIELD);
  }

  /**
   * The query text every metric of a chart shares, or null when they differ or any metric has none.
   *
   * <p>A terms aggregation picks its buckets from the documents the request matches, then counts
   * inside them with the metric filter applied. Those are two different populations unless the
   * filter also constrains the request, so a chart whose metrics agree on one filter can have it
   * applied in both places. Metrics that disagree have no single population to select from, and are
   * left alone.
   */
  public static String sharedQueryJson(List<LineChartMetric> metrics) {
    if (metrics == null || metrics.isEmpty()) {
      return null;
    }
    String shared = null;
    for (LineChartMetric metric : metrics) {
      String queryJson = queryJson(metric.getFilter());
      if (queryJson == null || (shared != null && !shared.equals(queryJson))) {
        return null;
      }
      shared = queryJson;
    }
    return shared;
  }
}
