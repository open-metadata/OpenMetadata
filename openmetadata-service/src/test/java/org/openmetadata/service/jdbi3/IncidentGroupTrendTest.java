package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

import java.time.Duration;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.tests.type.IncidentTrendDirection;

class IncidentGroupTrendTest {
  @Test
  void samplesIncludeBothEndsOfTheLastSevenDays() {
    long end = Duration.ofDays(20).toMillis();
    IncidentGroupTrend window = IncidentGroupTrend.endingAt(end);
    assertEquals(end - Duration.ofDays(7).toMillis(), window.start());
    assertEquals(window.start(), window.bindings().get("trendSample0"));
    assertEquals(end, window.bindings().get("trendSample8"));
  }

  @Test
  void directionsCompareOpenCountsRatherThanSummingHalves() {
    assertEquals(IncidentTrendDirection.Rising, IncidentGroupTrend.direction(List.of(3, 3, 4, 4)));
    assertEquals(IncidentTrendDirection.Steady, IncidentGroupTrend.direction(List.of(4, 4, 4, 4)));
    assertEquals(IncidentTrendDirection.Falling, IncidentGroupTrend.direction(List.of(4, 4, 2, 2)));
    assertEquals(IncidentTrendDirection.Steady, IncidentGroupTrend.direction(List.of(4, 8, 2, 4)));
  }

  @Test
  void missingSamplesAreZeroIncludingFullyResolvedPeriods() {
    assertEquals(
        List.of(3, 0, 0, 0, 0, 0, 0, 0, 1),
        IncidentGroupTrend.counts(
            List.of(
                new TimeSeriesDAOs.IncidentGroupTrendCount("table", 0, 3),
                new TimeSeriesDAOs.IncidentGroupTrendCount("table", 8, 1))));
  }

  @Test
  void rowFiltersDoNotEraseTheHistoricalBaselineOrResolutions() {
    ListFilter filter = new ListFilter(null);
    filter.addQueryParam("testCaseResolutionStatusType", "Assigned");
    filter.addQueryParam("incidentStartTs", "100");
    filter.addQueryParam("incidentEndTs", "200");
    filter.addQueryParam("incidentDateField", "createdAt");
    filter.addQueryParam("incidentGroupKey", "table");
    filter.addQueryParam("incidentAssignee", "alice");
    filter.addQueryParam("incidentSeverity", "Severity1");
    ListFilter history =
        TimeSeriesDAOs.TestCaseResolutionStatusTimeSeriesDAO.incidentTrendFilter(filter);
    assertNull(history.getQueryParam("testCaseResolutionStatusType"));
    assertNull(history.getQueryParam("incidentStartTs"));
    assertNull(history.getQueryParam("incidentEndTs"));
    assertNull(history.getQueryParam("incidentDateField"));
    assertNull(history.getQueryParam("incidentGroupKey"));
    assertEquals("alice", history.getQueryParam("incidentAssignee"));
    assertEquals("Severity1", history.getQueryParam("incidentSeverity"));
    assertEquals("Assigned", filter.getQueryParam("testCaseResolutionStatusType"));
  }
}
