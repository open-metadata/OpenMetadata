package org.openmetadata.service.migration.utils.v1125;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.mockito.Answers.RETURNS_DEEP_STUBS;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.jdbi.v3.core.Handle;
import org.jdbi.v3.core.statement.PreparedBatch;
import org.junit.jupiter.api.Test;
import org.openmetadata.service.jdbi3.locator.ConnectionType;

class MigrationUtilTest {

  private Map<String, Object> validRow(String tagFqn) {
    Map<String, Object> row = new HashMap<>();
    row.put("id", UUID.randomUUID().toString());
    row.put("fqnhash", "hash-" + UUID.randomUUID());
    row.put("tagfqn", tagFqn);
    row.put("expirydate", 1_700_000_000_000L);
    row.put("applieddate", 1_699_000_000_000L);
    return row;
  }

  private Handle handleReturningRows(List<Map<String, Object>> rows) {
    Handle handle = mock(Handle.class, RETURNS_DEEP_STUBS);
    when(handle.createQuery(any(String.class)).mapToMap().list()).thenReturn(rows);
    PreparedBatch batch = mock(PreparedBatch.class, RETURNS_DEEP_STUBS);
    when(handle.prepareBatch(any(String.class))).thenReturn(batch);
    when(handle.createUpdate(any(String.class)).bindList(any(String.class), anyList()).execute())
        .thenReturn(1);
    return handle;
  }

  @Test
  void migrateCertificationToTagUsageDoesNothingWhenAllTablesEmpty() {
    Handle handle = handleReturningRows(List.of());

    assertDoesNotThrow(
        () -> MigrationUtil.migrateCertificationToTagUsage(handle, ConnectionType.MYSQL));
  }

  @Test
  void migrateCertificationToTagUsageLogsMigrationCountWhenRowsMigrated() {
    Map<String, Object> row = validRow("Certification.Gold");
    Handle handle = mock(Handle.class, RETURNS_DEEP_STUBS);
    when(handle.createQuery(any(String.class)).mapToMap().list())
        .thenReturn(List.of(row), List.of());
    PreparedBatch batch = mock(PreparedBatch.class, RETURNS_DEEP_STUBS);
    when(handle.prepareBatch(any(String.class))).thenReturn(batch);
    when(handle.createUpdate(any(String.class)).bindList(any(String.class), anyList()).execute())
        .thenReturn(1);

    assertDoesNotThrow(
        () -> MigrationUtil.migrateCertificationToTagUsage(handle, ConnectionType.MYSQL));

    verify(batch).execute();
  }

  @Test
  void migrateCertificationToTagUsageSkipsTableOnException() {
    Handle handle = mock(Handle.class, RETURNS_DEEP_STUBS);
    when(handle.createQuery(any(String.class)).mapToMap().list())
        .thenThrow(new RuntimeException("DB error"))
        .thenReturn(List.of());

    assertDoesNotThrow(
        () -> MigrationUtil.migrateCertificationToTagUsage(handle, ConnectionType.MYSQL));
  }

  @Test
  void migrateCertificationToTagUsageSkipsRowsWithNullTagFqn() {
    Map<String, Object> nullTagRow = new HashMap<>();
    nullTagRow.put("id", UUID.randomUUID().toString());
    nullTagRow.put("fqnhash", "some-hash");
    nullTagRow.put("tagfqn", null);
    nullTagRow.put("expirydate", null);
    nullTagRow.put("applieddate", null);

    Handle handle = mock(Handle.class, RETURNS_DEEP_STUBS);
    when(handle.createQuery(any(String.class)).mapToMap().list()).thenReturn(List.of(nullTagRow));
    PreparedBatch batch = mock(PreparedBatch.class, RETURNS_DEEP_STUBS);
    when(handle.prepareBatch(any(String.class))).thenReturn(batch);

    assertDoesNotThrow(
        () -> MigrationUtil.migrateCertificationToTagUsage(handle, ConnectionType.MYSQL));

    verify(batch, times(0)).execute();
  }

  @Test
  void migrateCertificationToTagUsageMysqlAndPostgresSqlVariants() {
    Handle mysqlHandle = handleReturningRows(List.of());
    assertDoesNotThrow(
        () -> MigrationUtil.migrateCertificationToTagUsage(mysqlHandle, ConnectionType.MYSQL));

    Handle postgresHandle = handleReturningRows(List.of());
    assertDoesNotThrow(
        () ->
            MigrationUtil.migrateCertificationToTagUsage(postgresHandle, ConnectionType.POSTGRES));
  }

  @Test
  void migrateCertificationToTagUsageContinuesBatchingWhenBatchFull() {
    Map<String, Object> row = validRow("Certification.Silver");
    List<Map<String, Object>> fullBatch = Collections.nCopies(500, row);

    Handle handle = mock(Handle.class, RETURNS_DEEP_STUBS);
    when(handle.createQuery(any(String.class)).mapToMap().list()).thenReturn(fullBatch, List.of());
    PreparedBatch batch = mock(PreparedBatch.class, RETURNS_DEEP_STUBS);
    when(handle.prepareBatch(any(String.class))).thenReturn(batch);
    when(handle.createUpdate(any(String.class)).bindList(any(String.class), anyList()).execute())
        .thenReturn(1);

    assertDoesNotThrow(
        () -> MigrationUtil.migrateCertificationToTagUsage(handle, ConnectionType.MYSQL));

    verify(batch, times(1)).execute();
  }

  @Test
  void migrateCertificationToTagUsageHandlesNullExpiryAndAppliedDate() {
    Map<String, Object> row = new HashMap<>();
    row.put("id", UUID.randomUUID().toString());
    row.put("fqnhash", "hash-null-dates");
    row.put("tagfqn", "Certification.Bronze");
    row.put("expirydate", null);
    row.put("applieddate", null);

    Handle handle = mock(Handle.class, RETURNS_DEEP_STUBS);
    when(handle.createQuery(any(String.class)).mapToMap().list())
        .thenReturn(List.of(row), List.of());
    PreparedBatch batch = mock(PreparedBatch.class, RETURNS_DEEP_STUBS);
    when(handle.prepareBatch(any(String.class))).thenReturn(batch);
    when(handle.createUpdate(any(String.class)).bindList(any(String.class), anyList()).execute())
        .thenReturn(1);

    assertDoesNotThrow(
        () -> MigrationUtil.migrateCertificationToTagUsage(handle, ConnectionType.MYSQL));

    verify(batch).execute();
  }

  @Test
  void migrateCertificationToTagUsageHandlesStringExpiryDate() {
    Map<String, Object> row = new HashMap<>();
    row.put("id", UUID.randomUUID().toString());
    row.put("fqnhash", "hash-string-expiry");
    row.put("tagfqn", "Certification.Gold");
    row.put("expirydate", "1700000000000");
    row.put("applieddate", "1699000000000");

    Handle handle = mock(Handle.class, RETURNS_DEEP_STUBS);
    when(handle.createQuery(any(String.class)).mapToMap().list())
        .thenReturn(List.of(row), List.of());
    PreparedBatch batch = mock(PreparedBatch.class, RETURNS_DEEP_STUBS);
    when(handle.prepareBatch(any(String.class))).thenReturn(batch);
    when(handle.createUpdate(any(String.class)).bindList(any(String.class), anyList()).execute())
        .thenReturn(1);

    assertDoesNotThrow(
        () -> MigrationUtil.migrateCertificationToTagUsage(handle, ConnectionType.MYSQL));

    verify(batch).execute();
  }

  @Test
  void migrateCertificationToTagUsageHandlesInvalidStringExpiryDate() {
    Map<String, Object> row = new HashMap<>();
    row.put("id", UUID.randomUUID().toString());
    row.put("fqnhash", "hash-invalid-expiry");
    row.put("tagfqn", "Certification.Gold");
    row.put("expirydate", "not-a-number");
    row.put("applieddate", "also-not-a-number");

    Handle handle = mock(Handle.class, RETURNS_DEEP_STUBS);
    when(handle.createQuery(any(String.class)).mapToMap().list())
        .thenReturn(List.of(row), List.of());
    PreparedBatch batch = mock(PreparedBatch.class, RETURNS_DEEP_STUBS);
    when(handle.prepareBatch(any(String.class))).thenReturn(batch);
    when(handle.createUpdate(any(String.class)).bindList(any(String.class), anyList()).execute())
        .thenReturn(1);

    assertDoesNotThrow(
        () -> MigrationUtil.migrateCertificationToTagUsage(handle, ConnectionType.MYSQL));

    verify(batch).execute();
  }

  @Test
  void migrateCertificationToTagUsageHandlesNumberExpiryDate() {
    Map<String, Object> row = new HashMap<>();
    row.put("id", UUID.randomUUID().toString());
    row.put("fqnhash", "hash-int-expiry");
    row.put("tagfqn", "Certification.Silver");
    row.put("expirydate", 1_700_000_000);
    row.put("applieddate", 1_699_000_000);

    Handle handle = mock(Handle.class, RETURNS_DEEP_STUBS);
    when(handle.createQuery(any(String.class)).mapToMap().list())
        .thenReturn(List.of(row), List.of());
    PreparedBatch batch = mock(PreparedBatch.class, RETURNS_DEEP_STUBS);
    when(handle.prepareBatch(any(String.class))).thenReturn(batch);
    when(handle.createUpdate(any(String.class)).bindList(any(String.class), anyList()).execute())
        .thenReturn(1);

    assertDoesNotThrow(
        () -> MigrationUtil.migrateCertificationToTagUsage(handle, ConnectionType.MYSQL));

    verify(batch).execute();
  }
}
