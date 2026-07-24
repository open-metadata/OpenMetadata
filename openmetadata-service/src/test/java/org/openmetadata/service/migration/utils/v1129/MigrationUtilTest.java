package org.openmetadata.service.migration.utils.v1129;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Answers.RETURNS_DEEP_STUBS;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.sql.ResultSet;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.UUID;
import org.jdbi.v3.core.Handle;
import org.jdbi.v3.core.mapper.RowMapper;
import org.jdbi.v3.core.statement.Update;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.openmetadata.service.jdbi3.locator.ConnectionType;

class MigrationUtilTest {

  private Handle mockHandle() {
    return mock(Handle.class, RETURNS_DEEP_STUBS);
  }

  private void stubTableExists(Handle handle, String tableName) throws Exception {
    ResultSet rs = mock(ResultSet.class);
    when(rs.next()).thenReturn(true, false);
    when(rs.getString("TABLE_NAME")).thenReturn(tableName);
    when(handle.getConnection().getMetaData().getTables(any(), any(), eq(tableName), any()))
        .thenReturn(rs);
  }

  @SuppressWarnings("unchecked")
  private void stubBatch(Handle handle, List<String[]>... batches) {
    when(handle
            .createQuery(anyString())
            .bind(anyString(), anyInt())
            .map(any(RowMapper.class))
            .list())
        .thenReturn(batches[0], (List[]) java.util.Arrays.copyOfRange(batches, 1, batches.length));
  }

  private List<String[]> rows(String... jsons) {
    List<String[]> result = new ArrayList<>();
    for (String json : jsons) {
      result.add(new String[] {UUID.randomUUID().toString(), json});
    }
    return result;
  }

  // ─── thread_entity tests ──────────────────────────────────────────────────

  @Test
  void bothTablesAbsent_noQueriesOrUpdates() {
    Handle handle = mockHandle();

    assertDoesNotThrow(() -> new MigrationUtil(handle, ConnectionType.MYSQL).migrateTaskDomains());

    verify(handle, never()).createQuery(anyString());
    verify(handle, never()).createUpdate(anyString());
  }

  @Test
  void threadEntity_emptyBatch_terminatesWithoutUpdates_mysql() throws Exception {
    Handle handle = mockHandle();
    stubTableExists(handle, "thread_entity");
    stubBatch(handle, Collections.emptyList());

    assertDoesNotThrow(() -> new MigrationUtil(handle, ConnectionType.MYSQL).migrateTaskDomains());

    verify(handle, never()).createUpdate(anyString());
  }

  @Test
  void threadEntity_emptyBatch_terminatesWithoutUpdates_postgres() throws Exception {
    Handle handle = mockHandle();
    stubTableExists(handle, "thread_entity");
    stubBatch(handle, Collections.emptyList());

    assertDoesNotThrow(
        () -> new MigrationUtil(handle, ConnectionType.POSTGRES).migrateTaskDomains());

    verify(handle, never()).createUpdate(anyString());
  }

  @Test
  void threadEntity_mysqlWhereClauseMatchesMissingAndJsonNull() throws Exception {
    Handle handle = mockHandle();
    stubTableExists(handle, "thread_entity");
    stubBatch(handle, Collections.emptyList());

    new MigrationUtil(handle, ConnectionType.MYSQL).migrateTaskDomains();

    ArgumentCaptor<String> sqlCaptor = ArgumentCaptor.forClass(String.class);
    verify(handle, atLeastOnce()).createQuery(sqlCaptor.capture());
    // Both cases must be checked: key missing (SQL NULL) AND JSON null
    // (JSON_TYPE returns 'NULL' for JSON null, not SQL NULL).
    assertTrue(
        sqlCaptor.getAllValues().stream()
            .anyMatch(s -> s != null && s.contains("JSON_EXTRACT(json, '$.domains') IS NULL")));
    assertTrue(
        sqlCaptor.getAllValues().stream()
            .anyMatch(
                s ->
                    s != null
                        && s.contains("JSON_TYPE(JSON_EXTRACT(json, '$.domains')) = 'NULL'")));
  }

  @Test
  void threadEntity_postgresWhereClauseMatchesMissingAndJsonNull() throws Exception {
    Handle handle = mockHandle();
    stubTableExists(handle, "thread_entity");
    stubBatch(handle, Collections.emptyList());

    new MigrationUtil(handle, ConnectionType.POSTGRES).migrateTaskDomains();

    ArgumentCaptor<String> sqlCaptor = ArgumentCaptor.forClass(String.class);
    verify(handle, atLeastOnce()).createQuery(sqlCaptor.capture());
    assertTrue(
        sqlCaptor.getAllValues().stream()
            .anyMatch(s -> s != null && s.contains("json->'domains' IS NULL")));
    assertTrue(
        sqlCaptor.getAllValues().stream()
            .anyMatch(s -> s != null && s.contains("jsonb_typeof(json->'domains') = 'null'")));
  }

  @Test
  void threadEntity_rowWithNullAbout_marksAsMigratedWithMysqlSql() throws Exception {
    Handle handle = mockHandle();
    stubTableExists(handle, "thread_entity");
    stubBatch(handle, rows("{\"type\":\"Task\"}"), Collections.emptyList());
    Update mockUpdate = mock(Update.class, RETURNS_DEEP_STUBS);
    when(handle.createUpdate(anyString())).thenReturn(mockUpdate);

    assertDoesNotThrow(() -> new MigrationUtil(handle, ConnectionType.MYSQL).migrateTaskDomains());

    ArgumentCaptor<String> sqlCaptor = ArgumentCaptor.forClass(String.class);
    verify(handle, times(1)).createUpdate(sqlCaptor.capture());
    String sql = sqlCaptor.getValue();
    assertTrue(sql.contains("JSON_SET"));
    assertTrue(sql.contains("'$.domains'"));
    assertTrue(sql.contains("CAST('[]' AS JSON)"));
  }

  @Test
  void threadEntity_rowWithNullAbout_marksAsMigratedWithPostgresSql() throws Exception {
    Handle handle = mockHandle();
    stubTableExists(handle, "thread_entity");
    stubBatch(handle, rows("{\"type\":\"Task\"}"), Collections.emptyList());
    Update mockUpdate = mock(Update.class, RETURNS_DEEP_STUBS);
    when(handle.createUpdate(anyString())).thenReturn(mockUpdate);

    assertDoesNotThrow(
        () -> new MigrationUtil(handle, ConnectionType.POSTGRES).migrateTaskDomains());

    ArgumentCaptor<String> sqlCaptor = ArgumentCaptor.forClass(String.class);
    verify(handle, times(1)).createUpdate(sqlCaptor.capture());
    String sql = sqlCaptor.getValue();
    assertTrue(sql.contains("jsonb_set"));
    assertTrue(sql.contains("'{domains}'"));
    assertTrue(sql.contains("'[]'::jsonb"));
  }

  @Test
  void threadEntity_rowWithMalformedJson_isMarkedMigratedToAvoidLoop() throws Exception {
    Handle handle = mockHandle();
    stubTableExists(handle, "thread_entity");
    stubBatch(handle, rows("not-valid-json{{{"), Collections.emptyList());
    Update mockUpdate = mock(Update.class, RETURNS_DEEP_STUBS);
    when(handle.createUpdate(anyString())).thenReturn(mockUpdate);

    assertDoesNotThrow(() -> new MigrationUtil(handle, ConnectionType.MYSQL).migrateTaskDomains());

    ArgumentCaptor<String> sqlCaptor = ArgumentCaptor.forClass(String.class);
    verify(handle, times(1)).createUpdate(sqlCaptor.capture());
    String sql = sqlCaptor.getValue();
    assertTrue(sql.contains("JSON_SET"));
    assertTrue(sql.contains("'$.domains'"));
    assertTrue(sql.contains("CAST('[]' AS JSON)"));
  }

  @Test
  void threadEntity_rowWithValidAboutButUnknownEntityType_marksAsMigrated() throws Exception {
    Handle handle = mockHandle();
    stubTableExists(handle, "thread_entity");
    // Entity.getEntityRepository() throws EntityNotFoundException in unit-test context
    // (no repositories registered) → fetchDomainIds returns [] → markThreadDomainsMigrated
    stubBatch(
        handle,
        rows("{\"about\":\"<#E::glossaryTerm::MyGlossary.MyTerm>\"}"),
        Collections.emptyList());
    Update mockUpdate = mock(Update.class, RETURNS_DEEP_STUBS);
    when(handle.createUpdate(anyString())).thenReturn(mockUpdate);

    assertDoesNotThrow(() -> new MigrationUtil(handle, ConnectionType.MYSQL).migrateTaskDomains());

    verify(handle, times(1)).createUpdate(anyString());
  }

  @Test
  void threadEntity_twoRowsSameEntityLink_bothRowsGetMigrated() throws Exception {
    Handle handle = mockHandle();
    stubTableExists(handle, "thread_entity");
    String json = "{\"about\":\"<#E::glossaryTerm::MyGlossary.MyTerm>\"}";
    stubBatch(
        handle,
        rows(json, json), // two rows pointing to the same entity
        Collections.emptyList());
    Update mockUpdate = mock(Update.class, RETURNS_DEEP_STUBS);
    when(handle.createUpdate(anyString())).thenReturn(mockUpdate);

    assertDoesNotThrow(() -> new MigrationUtil(handle, ConnectionType.MYSQL).migrateTaskDomains());

    verify(handle, times(2)).createUpdate(anyString()); // markMigrated once per row
  }

  // ─── task_entity tests ────────────────────────────────────────────────────

  @Test
  void taskEntity_insertLessThanBatchSize_terminatesAfterOneBatch_mysql() throws Exception {
    Handle handle = mockHandle();
    stubTableExists(handle, "task_entity");
    Update mockUpdate = mock(Update.class, RETURNS_DEEP_STUBS);
    when(handle.createUpdate(anyString())).thenReturn(mockUpdate);
    when(mockUpdate.execute()).thenReturn(42);

    assertDoesNotThrow(() -> new MigrationUtil(handle, ConnectionType.MYSQL).migrateTaskDomains());

    verify(handle, times(1)).createUpdate(anyString());
  }

  @Test
  void taskEntity_insertLessThanBatchSize_terminatesAfterOneBatch_postgres() throws Exception {
    Handle handle = mockHandle();
    stubTableExists(handle, "task_entity");
    Update mockUpdate = mock(Update.class, RETURNS_DEEP_STUBS);
    when(handle.createUpdate(anyString())).thenReturn(mockUpdate);
    when(mockUpdate.execute()).thenReturn(42);

    assertDoesNotThrow(
        () -> new MigrationUtil(handle, ConnectionType.POSTGRES).migrateTaskDomains());

    verify(handle, times(1)).createUpdate(anyString());
  }

  @Test
  void taskEntity_insertFullBatch_continuesUntilPartialBatch() throws Exception {
    Handle handle = mockHandle();
    stubTableExists(handle, "task_entity");
    Update mockUpdate = mock(Update.class, RETURNS_DEEP_STUBS);
    when(handle.createUpdate(anyString())).thenReturn(mockUpdate);
    when(mockUpdate.execute()).thenReturn(500, 0); // BATCH_SIZE then empty

    assertDoesNotThrow(() -> new MigrationUtil(handle, ConnectionType.MYSQL).migrateTaskDomains());

    verify(handle, times(2)).createUpdate(anyString());
  }

  @Test
  void taskEntity_mysqlSqlUsesInsertIgnore() throws Exception {
    Handle handle = mockHandle();
    stubTableExists(handle, "task_entity");
    Update mockUpdate = mock(Update.class, RETURNS_DEEP_STUBS);
    when(handle.createUpdate(anyString())).thenReturn(mockUpdate);
    when(mockUpdate.execute()).thenReturn(0);

    new MigrationUtil(handle, ConnectionType.MYSQL).migrateTaskDomains();

    ArgumentCaptor<String> sqlCaptor = ArgumentCaptor.forClass(String.class);
    verify(handle, times(1)).createUpdate(sqlCaptor.capture());
    assertTrue(sqlCaptor.getValue().contains("INSERT IGNORE"));
  }

  @Test
  void taskEntity_postgresSqlUsesBareOnConflictDoNothing() throws Exception {
    Handle handle = mockHandle();
    stubTableExists(handle, "task_entity");
    Update mockUpdate = mock(Update.class, RETURNS_DEEP_STUBS);
    when(handle.createUpdate(anyString())).thenReturn(mockUpdate);
    when(mockUpdate.execute()).thenReturn(0);

    new MigrationUtil(handle, ConnectionType.POSTGRES).migrateTaskDomains();

    ArgumentCaptor<String> sqlCaptor = ArgumentCaptor.forClass(String.class);
    verify(handle, times(1)).createUpdate(sqlCaptor.capture());
    String sql = sqlCaptor.getValue();
    assertTrue(sql.contains("ON CONFLICT DO NOTHING"));
    // Must NOT name a conflict target — the entity_relationship PK shape differs
    // across releases (3 cols on 1.12.x, 4 cols on 2.x). Bare ON CONFLICT applies
    // to any unique constraint, keeping the migration portable.
    assertFalse(sql.contains("ON CONFLICT ("));
  }

  @Test
  void taskEntity_mysqlSqlFiltersOutDeletedRelationships() throws Exception {
    Handle handle = mockHandle();
    stubTableExists(handle, "task_entity");
    Update mockUpdate = mock(Update.class, RETURNS_DEEP_STUBS);
    when(handle.createUpdate(anyString())).thenReturn(mockUpdate);
    when(mockUpdate.execute()).thenReturn(0);

    new MigrationUtil(handle, ConnectionType.MYSQL).migrateTaskDomains();

    ArgumentCaptor<String> sqlCaptor = ArgumentCaptor.forClass(String.class);
    verify(handle, times(1)).createUpdate(sqlCaptor.capture());
    String sql = sqlCaptor.getValue();
    // er_about and er_domain are filtered on deleted=FALSE so the backfill won't propagate
    // soft-deleted relationships forward.
    assertTrue(sql.contains("er_about.deleted = FALSE"));
    assertTrue(sql.contains("er_domain.deleted = FALSE"));
    // ex (the NOT EXISTS check) must NOT filter on deleted: tasks are hard-deleted only, and
    // filtering would let INSERT IGNORE collide on the PK with soft-deleted rows and drop the
    // affected-row count below BATCH_SIZE, breaking the loop early.
    assertFalse(sql.contains("ex.deleted = FALSE"));
  }

  @Test
  void taskEntity_postgresSqlFiltersOutDeletedRelationships() throws Exception {
    Handle handle = mockHandle();
    stubTableExists(handle, "task_entity");
    Update mockUpdate = mock(Update.class, RETURNS_DEEP_STUBS);
    when(handle.createUpdate(anyString())).thenReturn(mockUpdate);
    when(mockUpdate.execute()).thenReturn(0);

    new MigrationUtil(handle, ConnectionType.POSTGRES).migrateTaskDomains();

    ArgumentCaptor<String> sqlCaptor = ArgumentCaptor.forClass(String.class);
    verify(handle, times(1)).createUpdate(sqlCaptor.capture());
    String sql = sqlCaptor.getValue();
    assertTrue(sql.contains("er_about.deleted = FALSE"));
    assertTrue(sql.contains("er_domain.deleted = FALSE"));
    assertFalse(sql.contains("ex.deleted = FALSE"));
  }
}
