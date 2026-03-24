package org.openmetadata.service.migration.utils.v1104;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.RETURNS_DEEP_STUBS;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;
import org.jdbi.v3.core.Handle;
import org.jdbi.v3.core.statement.Update;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.openmetadata.service.jdbi3.locator.ConnectionType;

class MigrationUtilTest {
  private static final String GLOSSARY_EXTENSION_COUNT_POSTGRES =
      "SELECT COUNT(*) FROM entity_extension "
          + "WHERE jsonSchema = 'glossaryTerm' AND json ?? 'status' AND NOT json ?? 'entityStatus'";
  private static final String DATA_CONTRACT_EXTENSION_COUNT_POSTGRES =
      "SELECT COUNT(*) FROM entity_extension "
          + "WHERE jsonSchema = 'dataContract' AND json ?? 'status' AND NOT json ?? 'entityStatus'";
  private static final String GLOSSARY_EXTENSION_COUNT_MY_SQL =
      "SELECT COUNT(*) FROM entity_extension "
          + "WHERE jsonSchema = 'glossaryTerm' AND JSON_CONTAINS_PATH(json, 'one', '$.status') = 1 "
          + "AND JSON_CONTAINS_PATH(json, 'one', '$.entityStatus') = 0";
  private static final String DATA_CONTRACT_EXTENSION_COUNT_MY_SQL =
      "SELECT COUNT(*) FROM entity_extension "
          + "WHERE jsonSchema = 'dataContract' AND JSON_CONTAINS_PATH(json, 'one', '$.status') = 1 "
          + "AND JSON_CONTAINS_PATH(json, 'one', '$.entityStatus') = 0";

  private Handle handle;
  private Update update;

  @BeforeEach
  void setUp() {
    handle = mock(Handle.class, RETURNS_DEEP_STUBS);
    update = mock(Update.class);
    when(handle.createUpdate(anyString())).thenReturn(update);
  }

  @Test
  void migrateEntityExtensionStatusUsesPostgresBatchStatements() {
    when(handle.createQuery(GLOSSARY_EXTENSION_COUNT_POSTGRES).mapTo(Integer.class).one())
        .thenReturn(650);
    when(handle.createQuery(DATA_CONTRACT_EXTENSION_COUNT_POSTGRES).mapTo(Integer.class).one())
        .thenReturn(650);
    when(update.execute()).thenReturn(500, 150, 500, 150);

    MigrationUtil migrationUtil = new MigrationUtil(handle, ConnectionType.POSTGRES);

    assertDoesNotThrow(migrationUtil::migrateEntityExtensionStatus);

    ArgumentCaptor<String> sqlCaptor = ArgumentCaptor.forClass(String.class);
    verify(handle, times(4)).createUpdate(sqlCaptor.capture());

    List<String> updateSql = sqlCaptor.getAllValues();
    assertTrue(updateSql.stream().allMatch(sql -> sql.contains("jsonb_set")));
    assertTrue(updateSql.stream().anyMatch(sql -> sql.contains("jsonSchema = 'glossaryTerm'")));
    assertTrue(updateSql.stream().anyMatch(sql -> sql.contains("jsonSchema = 'dataContract'")));
    assertTrue(
        updateSql.stream()
            .filter(sql -> sql.contains("jsonSchema = 'dataContract'"))
            .allMatch(sql -> sql.contains("WHEN t.json->>'status' = 'Active'")));
  }

  @Test
  void migrateEntityExtensionStatusUsesMysqlBatchStatements() {
    when(handle.createQuery(GLOSSARY_EXTENSION_COUNT_MY_SQL).mapTo(Integer.class).one())
        .thenReturn(700);
    when(handle.createQuery(DATA_CONTRACT_EXTENSION_COUNT_MY_SQL).mapTo(Integer.class).one())
        .thenReturn(700);
    when(update.execute()).thenReturn(500, 200, 500, 200);

    MigrationUtil migrationUtil = new MigrationUtil(handle, ConnectionType.MYSQL);

    assertDoesNotThrow(migrationUtil::migrateEntityExtensionStatus);

    ArgumentCaptor<String> sqlCaptor = ArgumentCaptor.forClass(String.class);
    verify(handle, times(4)).createUpdate(sqlCaptor.capture());

    List<String> updateSql = sqlCaptor.getAllValues();
    assertTrue(updateSql.stream().allMatch(sql -> sql.contains("JSON_SET(JSON_REMOVE")));
    assertTrue(
        updateSql.stream()
            .filter(sql -> sql.contains("jsonSchema = 'dataContract'"))
            .allMatch(
                sql ->
                    sql.contains(
                        "WHEN JSON_UNQUOTE(JSON_EXTRACT(t.json, '$.status')) = 'Active'")));
  }

  @Test
  void migrateEntityExtensionStatusContinuesAfterGlossaryExtensionFailures() {
    when(handle.createQuery(GLOSSARY_EXTENSION_COUNT_POSTGRES).mapTo(Integer.class).one())
        .thenThrow(new IllegalStateException("glossary extension query failed"));
    when(handle.createQuery(DATA_CONTRACT_EXTENSION_COUNT_POSTGRES).mapTo(Integer.class).one())
        .thenReturn(0);

    MigrationUtil migrationUtil = new MigrationUtil(handle, ConnectionType.POSTGRES);

    assertDoesNotThrow(migrationUtil::migrateEntityExtensionStatus);

    verify(handle, never()).createUpdate(anyString());
    verify(handle.createQuery(DATA_CONTRACT_EXTENSION_COUNT_POSTGRES).mapTo(Integer.class)).one();
  }
}
