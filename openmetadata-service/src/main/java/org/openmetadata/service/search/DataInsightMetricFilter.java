package org.openmetadata.service.search;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Reads a Data Insight chart metric's {@code filter}.
 *
 * <p>Both engines used to parse that string inline, twice each, and both fell back to an unfiltered
 * aggregation on any failure. Routing every read through here keeps a filter that cannot be parsed
 * failing the same way everywhere: the caller gets {@code null} and leaves the aggregation
 * unfiltered, exactly as before.
 */
public final class DataInsightMetricFilter {
  private static final Logger LOG = LoggerFactory.getLogger(DataInsightMetricFilter.class);
  private static final ObjectMapper MAPPER = new ObjectMapper();
  private static final String QUERY_KEY = "query";
  private static final String EMPTY_FILTER = "{}";

  /**
   * Prefix both engines name a filtered metric's wrapper aggregation with, and the whole order path
   * a terms axis needs to rank by it. Naming the aggregation itself sorts on its document count;
   * there is no metric key, so nothing built from this may contain a dot — an order path splits on
   * {@code .} into a metric sub-field and the search is rejected outright when it does.
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
}
