package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
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

    // The endpoint's documented include default is non-deleted: the scoping is a tc-qualified
    // predicate riding the join the originEntityFQN predicate needs anyway.
    ListFilter filter =
        new ListFilter(Include.NON_DELETED)
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
        "the non-deleted scope travels qualified on the join, never unqualified"
            + " (ADR:2026-10-29-incident-listing-test-case-deletion-scoping-is-qualified)");
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
        new ListFilter(Include.NON_DELETED)
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
  void withoutOriginEntityFqnTheIncludeScopeRidesAnExistsInsteadOfTheJoin() {
    TestCaseResolutionStatusTimeSeriesDAO dao =
        mock(TestCaseResolutionStatusTimeSeriesDAO.class, CALLS_REAL_METHODS);
    when(dao.getTimeSeriesTableName()).thenReturn("test_case_resolution_status_time_series");
    when(dao.listWithOffset(
            anyString(),
            anyMap(),
            anyString(),
            eq("entityFQNHash"),
            eq(10),
            eq(0),
            anyMap(),
            anyString()))
        .thenReturn(List.of("latest"));

    // No join is needed without originEntityFQN, so the scoping pays an indexed EXISTS instead;
    // include=all adds neither join nor scope.
    dao.listWithOffset(
        new ListFilter(Include.NON_DELETED).addQueryParam("testCaseFQN", "svc.db.schema.tc1"),
        10,
        0,
        true);
    dao.listWithOffset(
        new ListFilter(Include.DELETED).addQueryParam("testCaseFQN", "svc.db.schema.tc1"),
        10,
        0,
        true);
    dao.listWithOffset(new ListFilter(Include.ALL), 10, 0, true);

    ArgumentCaptor<String> conditions = ArgumentCaptor.forClass(String.class);
    verify(dao, org.mockito.Mockito.times(3))
        .listWithOffset(
            eq("test_case_resolution_status_time_series"),
            anyMap(),
            conditions.capture(),
            eq("entityFQNHash"),
            eq(10),
            eq(0),
            anyMap(),
            anyString());
    String nonDeletedCond = conditions.getAllValues().get(0);
    String deletedCond = conditions.getAllValues().get(1);
    String allCond = conditions.getAllValues().get(2);
    assertFalse(
        nonDeletedCond.contains("INNER JOIN"),
        "no originEntityFQN: the query pays no join no predicate needs");
    assertTrue(
        nonDeletedCond.contains("EXISTS (SELECT 1 FROM test_case")
            && nonDeletedCond.contains("tcScope.deleted = FALSE"),
        "the non-deleted scope rides an indexed EXISTS instead of the join");
    assertTrue(
        deletedCond.contains("tcScope.deleted = TRUE"),
        "include=deleted keeps working without the join");
    assertFalse(
        allCond.contains("EXISTS (SELECT 1 FROM test_case"), "include=all adds no deletion scope");
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
