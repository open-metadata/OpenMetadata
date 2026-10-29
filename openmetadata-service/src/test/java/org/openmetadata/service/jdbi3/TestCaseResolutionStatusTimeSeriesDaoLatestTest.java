package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.CALLS_REAL_METHODS;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.jdbi3.TimeSeriesDAOs.TestCaseResolutionStatusTimeSeriesDAO;

/**
 * An incident listing without a time range still goes through the origin test_case join and the
 * outer record-status filter — the base partitioned queries cannot rank the incidents' own status
 * fields, and the originEntityFQN predicate reads the testCaseEntityFQN alias the join introduces,
 * so a listing shaped without the join fails on an unknown alias.
 */
class TestCaseResolutionStatusTimeSeriesDaoLatestTest {

  @Test
  void aLatestListingWithoutATimeRangeKeepsTheOriginJoinAndTheOuterFilter() {
    TestCaseResolutionStatusTimeSeriesDAO dao =
        mock(TestCaseResolutionStatusTimeSeriesDAO.class, CALLS_REAL_METHODS);
    when(dao.getTimeSeriesTableName()).thenReturn("test_case_resolution_status_time_series");
    when(dao.listWithOffset(
            anyString(), anyMap(), anyString(), anyString(), eq(10), eq(0), anyMap(), anyString()))
        .thenReturn(List.of("latest"));

    ListFilter filter =
        new ListFilter(Include.ALL)
            .addQueryParam("originEntityFQN", "svc.db.schema.table")
            .addQueryParam("testCaseResolutionStatusType", "New");
    List<String> jsons = dao.listWithOffset(filter, 10, 0, true);

    ArgumentCaptor<String> condition = ArgumentCaptor.forClass(String.class);
    ArgumentCaptor<String> outerCondition = ArgumentCaptor.forClass(String.class);
    verify(dao)
        .listWithOffset(
            eq("test_case_resolution_status_time_series"),
            anyMap(),
            condition.capture(),
            eq("entityFQNHash"),
            eq(10),
            eq(0),
            anyMap(),
            outerCondition.capture());
    assertTrue(
        condition.getValue().contains("INNER JOIN (SELECT entityFQN AS testCaseEntityFQN"),
        "the originEntityFQN predicate depends on the join's testCaseEntityFQN alias");
    assertTrue(
        condition.getValue().contains("tc.deleted = FALSE"),
        "incidents scope to non-deleted test cases on the join — the include"
            + " parameter is deprecated and has no effect (ADR:2026-10-29-incident-listing-include-deprecated)");
    assertTrue(
        outerCondition.getValue().contains("testCaseResolutionStatusType"),
        "the record's own status ranks on the outer condition");
    assertEquals(List.of("latest"), jsons);
    // The base no-range partitioned query lacks both the join and the outer filter.
    verify(dao, never())
        .listWithOffset(anyString(), anyMap(), anyString(), anyString(), eq(10), eq(0));
  }

  @Test
  void aLatestCountWithoutATimeRangeKeepsTheOriginJoinAndTheOuterFilter() {
    TestCaseResolutionStatusTimeSeriesDAO dao =
        mock(TestCaseResolutionStatusTimeSeriesDAO.class, CALLS_REAL_METHODS);
    when(dao.getTimeSeriesTableName()).thenReturn("test_case_resolution_status_time_series");
    when(dao.listCount(anyString(), anyMap(), anyString(), anyString(), anyMap(), anyString()))
        .thenReturn(3);

    ListFilter filter =
        new ListFilter(Include.ALL)
            .addQueryParam("originEntityFQN", "svc.db.schema.table")
            .addQueryParam("incidentAssignee", "user");
    int count = dao.listCount(filter, true);

    ArgumentCaptor<String> condition = ArgumentCaptor.forClass(String.class);
    ArgumentCaptor<String> outerCondition = ArgumentCaptor.forClass(String.class);
    verify(dao)
        .listCount(
            eq("test_case_resolution_status_time_series"),
            anyMap(),
            condition.capture(),
            eq("entityFQNHash"),
            anyMap(),
            outerCondition.capture());
    assertTrue(
        condition.getValue().contains("INNER JOIN (SELECT entityFQN AS testCaseEntityFQN"),
        "the count filters the same rows the listing reads, join included");
    assertTrue(
        condition.getValue().contains("tc.deleted = FALSE"),
        "the count scopes to non-deleted test cases on the join too");
    assertTrue(outerCondition.getValue().contains("incidentAssignee"));
    assertEquals(3, count);
    verify(dao, never()).listCount(anyString(), anyString(), anyMap(), anyString());
  }

  @Test
  void aListingWithoutATimeRangeWithoutLatestKeepsThePlainJoinedListing() {
    TestCaseResolutionStatusTimeSeriesDAO dao =
        mock(TestCaseResolutionStatusTimeSeriesDAO.class, CALLS_REAL_METHODS);
    when(dao.getTimeSeriesTableName()).thenReturn("test_case_resolution_status_time_series");
    when(dao.listWithOffset(anyString(), anyMap(), anyString(), eq(10), eq(0)))
        .thenReturn(List.of("all"));

    ListFilter filter =
        new ListFilter(Include.ALL).addQueryParam("originEntityFQN", "svc.db.schema.table");
    assertEquals(List.of("all"), dao.listWithOffset(filter, 10, 0, false));

    ArgumentCaptor<String> condition = ArgumentCaptor.forClass(String.class);
    verify(dao)
        .listWithOffset(
            eq("test_case_resolution_status_time_series"),
            anyMap(),
            condition.capture(),
            eq(10),
            eq(0));
    assertTrue(condition.getValue().contains("INNER JOIN (SELECT entityFQN AS testCaseEntityFQN"));
  }
}
