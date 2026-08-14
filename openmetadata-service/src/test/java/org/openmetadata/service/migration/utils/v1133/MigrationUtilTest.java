package org.openmetadata.service.migration.utils.v1133;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Answers.RETURNS_DEEP_STUBS;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.jdbi.v3.core.Handle;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.openmetadata.service.jdbi3.locator.ConnectionType;

class MigrationUtilTest {

  private Handle mockHandle() {
    return mock(Handle.class, RETURNS_DEEP_STUBS);
  }

  private Map<String, Object> contractRow(String contractId, String testSuiteId) {
    Map<String, Object> row = new LinkedHashMap<>();
    row.put("id", contractId);
    if (testSuiteId == null) {
      row.put("json", "{\"id\":\"" + contractId + "\",\"name\":\"c\",\"entity\":{\"id\":\"x\"}}");
    } else {
      row.put(
          "json",
          "{\"id\":\""
              + contractId
              + "\",\"name\":\"c\",\"testSuite\":{\"id\":\""
              + testSuiteId
              + "\",\"type\":\"testSuite\"}}");
    }
    return row;
  }

  @SuppressWarnings("unchecked")
  private void stubBatches(Handle handle, List<Map<String, Object>>... batches) {
    List<Map<String, Object>>[] rest = java.util.Arrays.copyOfRange(batches, 1, batches.length);
    when(handle
            .createQuery(anyString())
            .bind(eq("limit"), anyInt())
            .bind(eq("offset"), anyInt())
            .mapToMap()
            .list())
        .thenReturn(batches[0], (List[]) rest);
  }

  private void stubInsertRowCount(Handle handle, int rowCount) {
    when(handle
            .createUpdate(anyString())
            .bind(eq("fromId"), anyString())
            .bind(eq("toId"), anyString())
            .execute())
        .thenReturn(rowCount);
  }

  @Test
  void emptyResult_noInsertsIssued_mysql() {
    Handle handle = mockHandle();
    stubBatches(handle, Collections.emptyList());

    assertDoesNotThrow(
        () ->
            MigrationUtil.backfillDataContractTestSuiteRelationships(handle, ConnectionType.MYSQL));

    verify(handle, never()).createUpdate(anyString());
  }

  @Test
  void emptyResult_noInsertsIssued_postgres() {
    Handle handle = mockHandle();
    stubBatches(handle, Collections.emptyList());

    assertDoesNotThrow(
        () ->
            MigrationUtil.backfillDataContractTestSuiteRelationships(
                handle, ConnectionType.POSTGRES));

    verify(handle, never()).createUpdate(anyString());
  }

  @Test
  void contractWithoutTestSuite_skipped() {
    Handle handle = mockHandle();
    String contractId = UUID.randomUUID().toString();
    stubBatches(handle, List.of(contractRow(contractId, null)));

    assertDoesNotThrow(
        () ->
            MigrationUtil.backfillDataContractTestSuiteRelationships(handle, ConnectionType.MYSQL));

    verify(handle, never()).createUpdate(anyString());
  }

  @Test
  void singleContractWithTestSuite_insertsOneRow_mysql() {
    Handle handle = mockHandle();
    stubInsertRowCount(handle, 1);
    String contractId = UUID.randomUUID().toString();
    String testSuiteId = UUID.randomUUID().toString();
    stubBatches(handle, List.of(contractRow(contractId, testSuiteId)));

    assertDoesNotThrow(
        () ->
            MigrationUtil.backfillDataContractTestSuiteRelationships(handle, ConnectionType.MYSQL));

    ArgumentCaptor<String> sqlCaptor = ArgumentCaptor.forClass(String.class);
    verify(handle, atLeastOnce()).createUpdate(sqlCaptor.capture());
    String insertSql =
        sqlCaptor.getAllValues().stream()
            .filter(s -> s.toUpperCase().contains("INSERT"))
            .findFirst()
            .orElseThrow();
    assertEquals(true, insertSql.contains("INSERT IGNORE"));
    assertEquals(true, insertSql.contains("entity_relationship"));
    assertEquals(true, insertSql.contains("'testSuite'"));
    assertEquals(true, insertSql.contains("'dataContract'"));
  }

  @Test
  void singleContractWithTestSuite_usesOnConflictOnPostgres() {
    Handle handle = mockHandle();
    stubInsertRowCount(handle, 1);
    String contractId = UUID.randomUUID().toString();
    String testSuiteId = UUID.randomUUID().toString();
    stubBatches(handle, List.of(contractRow(contractId, testSuiteId)));

    assertDoesNotThrow(
        () ->
            MigrationUtil.backfillDataContractTestSuiteRelationships(
                handle, ConnectionType.POSTGRES));

    ArgumentCaptor<String> sqlCaptor = ArgumentCaptor.forClass(String.class);
    verify(handle, atLeastOnce()).createUpdate(sqlCaptor.capture());
    String insertSql =
        sqlCaptor.getAllValues().stream()
            .filter(s -> s.toUpperCase().contains("INSERT"))
            .findFirst()
            .orElseThrow();
    assertEquals(true, insertSql.contains("ON CONFLICT DO NOTHING"));
    assertEquals(true, insertSql.contains("'testSuite'"));
    assertEquals(true, insertSql.contains("'dataContract'"));
  }

  @Test
  void mixedBatch_onlyContractsWithTestSuiteAreInserted() {
    Handle handle = mockHandle();
    stubInsertRowCount(handle, 1);
    String c1 = UUID.randomUUID().toString();
    String c2 = UUID.randomUUID().toString();
    String c3 = UUID.randomUUID().toString();
    String ts1 = UUID.randomUUID().toString();
    String ts3 = UUID.randomUUID().toString();

    stubBatches(handle, List.of(contractRow(c1, ts1), contractRow(c2, null), contractRow(c3, ts3)));

    assertDoesNotThrow(
        () ->
            MigrationUtil.backfillDataContractTestSuiteRelationships(handle, ConnectionType.MYSQL));

    // Exactly 2 inserts issued (c1, c3). c2 skipped (no testSuite in JSON).
    verify(handle, times(2)).createUpdate(contains("INSERT"));
  }

  @Test
  void idempotency_insertReturningZeroDoesNotThrow() {
    Handle handle = mockHandle();
    stubInsertRowCount(handle, 0); // simulate INSERT IGNORE dedup path
    String contractId = UUID.randomUUID().toString();
    String testSuiteId = UUID.randomUUID().toString();
    stubBatches(handle, List.of(contractRow(contractId, testSuiteId)));

    assertDoesNotThrow(
        () ->
            MigrationUtil.backfillDataContractTestSuiteRelationships(handle, ConnectionType.MYSQL));

    verify(handle, atLeastOnce()).createUpdate(anyString());
  }

  @Test
  void selectQueryHitsDataContractEntityTable() {
    Handle handle = mockHandle();
    stubBatches(handle, Collections.emptyList());

    assertDoesNotThrow(
        () ->
            MigrationUtil.backfillDataContractTestSuiteRelationships(handle, ConnectionType.MYSQL));

    ArgumentCaptor<String> queryCaptor = ArgumentCaptor.forClass(String.class);
    verify(handle, atLeastOnce()).createQuery(queryCaptor.capture());
    String select = queryCaptor.getValue();
    assertEquals(true, select.contains("data_contract_entity"));
    assertEquals(true, select.contains("LIMIT"));
    assertEquals(true, select.contains("OFFSET"));
  }
}
