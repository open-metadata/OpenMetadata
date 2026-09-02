package org.openmetadata.service.search;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

import org.junit.jupiter.api.Test;

/**
 * Both engines fall back to an unfiltered aggregation on a filter they cannot read, so this parser
 * decides when a chart counts what it was asked for. Returning null is the safe answer everywhere:
 * the sub-aggregation stays unfiltered, exactly as it did before the parses were shared.
 */
class DataInsightMetricFilterTest {

  @Test
  void theQueryNodeIsExtractedVerbatim() {
    assertEquals(
        "{\"term\":{\"entityType.keyword\":\"table\"}}",
        DataInsightMetricFilter.queryJson(
            "{\"query\":{\"term\":{\"entityType.keyword\":\"table\"}}}"));
  }

  @Test
  void formattingDoesNotChangeTheExtractedQuery() {
    // Re-serialized from the parsed tree, so indentation cannot split two filters that mean the
    // same thing.
    assertEquals(
        DataInsightMetricFilter.queryJson("{\"query\":{\"term\":{\"a\":\"b\"}}}"),
        DataInsightMetricFilter.queryJson("{ \"query\" : { \"term\" : { \"a\" : \"b\" } } }"));
  }

  @Test
  void absentEmptyOrUnreadableFiltersYieldNothing() {
    assertNull(DataInsightMetricFilter.queryJson(null));
    assertNull(
        DataInsightMetricFilter.queryJson("{}"), "the empty filter is an exact-string check");
    assertNull(DataInsightMetricFilter.queryJson("{\"bool\":{}}"), "valid JSON with no query node");
    assertNull(DataInsightMetricFilter.queryJson("{"), "unparseable");
  }

  @Test
  void theOrderKeyPrefixCannotContainADot() {
    // An order path splits on '.' into an aggregation and a metric sub-field, and the engine
    // rejects the whole search when the sub-field does not exist.
    assertEquals(-1, DataInsightMetricFilter.FILTER_AGG_KEY.indexOf('.'));
  }
}
