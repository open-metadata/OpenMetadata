package org.openmetadata.service.migration.api;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.openmetadata.service.util.EntityUtil.hash;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;
import org.jdbi.v3.core.Handle;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.mockito.InOrder;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.jdbi3.MigrationDAO;
import org.openmetadata.service.jdbi3.locator.ConnectionType;
import org.openmetadata.service.migration.QueryStatus;
import org.openmetadata.service.migration.utils.MigrationCodeFingerprint;
import org.openmetadata.service.migration.utils.MigrationFile;
import org.openmetadata.service.migration.utils.SqlUnit;

class MigrationProcessImplTest {
  private static final String SET_DDL =
      "SET @c_ddl = (SELECT IF(1 = 0, 'SELECT 1', 'ALTER TABLE t ADD COLUMN c INT'))";
  private static final String PREPARE = "PREPARE c_stmt FROM @c_ddl";
  private static final String EXECUTE = "EXECUTE c_stmt";
  private static final String DEALLOCATE = "DEALLOCATE PREPARE c_stmt";
  private static final String BLOCK_FILE =
      String.join(";\n", SET_DDL, PREPARE, EXECUTE, DEALLOCATE) + ";";

  @TempDir Path tempDir;

  private MigrationDAO migrationDAO;
  private OpenMetadataApplicationConfig config;

  @BeforeEach
  void setUp() {
    migrationDAO = mock(MigrationDAO.class);
    config = mock(OpenMetadataApplicationConfig.class);
  }

  @Test
  void delegatesReprocessingFlagToMigrationFile() throws IOException {
    MigrationFile file = createMigrationDir("1.12.3", "", "");
    file.setReprocessing(true);

    MigrationProcessImpl process = new MigrationProcessImpl(file);

    assertTrue(process.isReprocessing());
  }

  @Test
  void delegatesHasNewStatementsToMigrationFile() throws IOException {
    when(migrationDAO.checkIfQueryPreviouslyRan(anyString())).thenReturn(null);
    MigrationFile file = createMigrationDir("1.12.3", "ALTER TABLE test ADD COLUMN a INT;", "");
    file.parseSQLFiles();

    MigrationProcessImpl process = new MigrationProcessImpl(file);

    assertTrue(process.hasNewStatements());
  }

  @Test
  void reportsNoNewStatementsWhenMigrationFileHasNone() throws IOException {
    when(migrationDAO.checkIfQueryPreviouslyRan(anyString())).thenReturn(null);
    MigrationFile file = createMigrationDir("1.12.3", "", "");
    file.parseSQLFiles();

    MigrationProcessImpl process = new MigrationProcessImpl(file);

    assertFalse(process.hasNewStatements());
  }

  @Test
  void parsesEveryStatementInSqlFile() throws IOException {
    Path sqlFile = tempDir.resolve("statements.sql");
    Files.writeString(
        sqlFile, "INSERT INTO sample VALUES ('value;with-semicolon');\nUPDATE sample SET id = 2;");

    List<String> statements = MigrationFile.parseSQLFile(sqlFile.toFile(), ConnectionType.MYSQL);

    assertEquals(
        List.of("INSERT INTO sample VALUES ('value;with-semicolon')", "UPDATE sample SET id = 2"),
        statements);
  }

  @Test
  void reportsAStatementAlreadyRunInThisVersionAsSkipped() {
    Handle handle = mock(Handle.class);
    String sql = "PREPARE stmt FROM @ddl";
    when(migrationDAO.getSqlQuery("2.1.0", hash(sql))).thenReturn(sql);

    Map<String, QueryStatus> statuses =
        MigrationProcessImpl.performSqlExecutionAndUpdate(
            handle, migrationDAO, List.of(SqlUnit.of(sql)), "2.1.0", false);

    assertEquals(QueryStatus.Status.SKIPPED, statuses.get(sql).getStatus());
    verify(handle, never()).execute(sql);
    verify(migrationDAO, never()).upsertServerMigrationSQL(anyString(), anyString(), anyString());
  }

  @Test
  void executesAndRecordsANewStatement() {
    Handle handle = mock(Handle.class);
    String sql = "ALTER TABLE test ADD COLUMN a INT";

    Map<String, QueryStatus> statuses =
        MigrationProcessImpl.performSqlExecutionAndUpdate(
            handle, migrationDAO, List.of(SqlUnit.of(sql)), "2.1.0", false);

    assertEquals(QueryStatus.Status.SUCCESS, statuses.get(sql).getStatus());
    verify(handle).execute(sql);
    verify(migrationDAO).upsertServerMigrationSQL("2.1.0", sql, hash(sql));
  }

  @Test
  void dropsAStatementWhoseTextRanInAnotherVersion() throws IOException {
    when(migrationDAO.checkIfQueryPreviouslyRan(anyString())).thenReturn("2.0.0");
    MigrationFile file = createMigrationDir("2.1.0", "UPDATE test SET a = 1;", "");
    file.parseSQLFiles();

    assertFalse(file.hasNewStatements());
  }

  @Test
  void runsAGuardedBlockOnOneHandleAndRecordsItOnce() {
    Handle handle = mock(Handle.class);
    SqlUnit block = new SqlUnit(List.of(SET_DDL, PREPARE, EXECUTE, DEALLOCATE));

    MigrationProcessImpl.performSqlExecutionAndUpdate(
        handle, migrationDAO, List.of(block), "2.1.0", false);

    InOrder order = inOrder(handle);
    order.verify(handle).execute(SET_DDL);
    order.verify(handle).execute(PREPARE);
    order.verify(handle).execute(EXECUTE);
    order.verify(handle).execute(DEALLOCATE);
    verify(migrationDAO).upsertServerMigrationSQL("2.1.0", block.text(), block.checksum());
  }

  @Test
  void recordsNothingWhenAStatementOfABlockFails() {
    Handle handle = mock(Handle.class);
    when(handle.execute(EXECUTE)).thenThrow(new IllegalStateException("killed"));
    SqlUnit block = new SqlUnit(List.of(SET_DDL, PREPARE, EXECUTE, DEALLOCATE));

    assertThrows(
        RuntimeException.class,
        () ->
            MigrationProcessImpl.performSqlExecutionAndUpdate(
                handle, migrationDAO, List.of(block), "2.1.0", false));

    verify(handle, never()).execute(DEALLOCATE);
    verify(migrationDAO, never()).upsertServerMigrationSQL(anyString(), anyString(), anyString());
  }

  @Test
  void rerunsTheWholeBlockWhenOnlyItsSetAndPrepareWereRecorded() throws IOException {
    when(migrationDAO.checkIfQueryPreviouslyRan(hash(SET_DDL))).thenReturn("2.1.0");
    when(migrationDAO.checkIfQueryPreviouslyRan(hash(PREPARE))).thenReturn("2.1.0");
    MigrationFile file = createMigrationDir("2.1.0", BLOCK_FILE, "");

    file.parseSQLFiles();

    assertEquals(1, file.getSchemaChanges().size());
    assertEquals(4, file.getSchemaChanges().get(0).statements().size());
  }

  @Test
  void aBlockRecordedStatementByStatementIsAppliedOnlyWhenReprocessed() throws IOException {
    for (String statement : List.of(SET_DDL, PREPARE, EXECUTE, DEALLOCATE)) {
      when(migrationDAO.checkIfQueryPreviouslyRan(hash(statement))).thenReturn("2.1.0");
    }
    MigrationFile reprocessed = createMigrationDir("2.1.0", BLOCK_FILE, "");
    reprocessed.setReprocessing(true);
    MigrationFile pending = createMigrationDir("2.1.0-pending", BLOCK_FILE, "");

    reprocessed.parseSQLFiles();
    pending.parseSQLFiles();

    assertFalse(reprocessed.hasNewStatements());
    assertTrue(pending.hasNewStatements());
  }

  @Test
  void aBlockRecordedAsAUnitIsApplied() throws IOException {
    SqlUnit block = new SqlUnit(List.of(SET_DDL, PREPARE, EXECUTE, DEALLOCATE));
    when(migrationDAO.checkIfQueryPreviouslyRan(block.checksum())).thenReturn("2.1.0");
    MigrationFile file = createMigrationDir("2.1.0", BLOCK_FILE, "");

    file.parseSQLFiles();

    assertFalse(file.hasNewStatements());
  }

  @Test
  void cutsTheRecordedTextToTheColumnLength() {
    assertEquals(10000, MigrationProcessImpl.truncateToLoggedLength("x".repeat(10001)).length());
    assertEquals(
        9999,
        MigrationProcessImpl.truncateToLoggedLength("x".repeat(9999) + "\uD83D\uDE00").length());
    assertEquals("short", MigrationProcessImpl.truncateToLoggedLength("short"));
  }

  @Test
  void reportsNoDataMigrationIdentityWhenRunDataMigrationIsNotOverridden() throws IOException {
    MigrationFile file = createMigrationDir("1.12.3", "", "");

    assertNull(new MigrationProcessImpl(file).getDataMigrationIdentity());
  }

  @Test
  void derivesAStableIdentityForAJavaDataMigration() throws IOException {
    MigrationFile file = createMigrationDir("1.12.3", "", "");

    String identity = new DataMigration(file).getDataMigrationIdentity();

    assertNotNull(identity);
    assertEquals(identity, new DataMigration(file).getDataMigrationIdentity());
  }

  @Test
  void identityIsTheFingerprintOfTheMigrationCode() throws IOException {
    MigrationFile file = createMigrationDir("1.12.3", "", "");

    assertEquals(
        MigrationCodeFingerprint.of(DataMigration.class),
        new DataMigration(file).getDataMigrationIdentity());
  }

  static class DataMigration extends MigrationProcessImpl {
    DataMigration(MigrationFile migrationFile) {
      super(migrationFile);
    }

    @Override
    public void runDataMigration() {}
  }

  private MigrationFile createMigrationDir(
      String version, String schemaChangesSql, String postDdlSql) throws IOException {
    Path versionDir = tempDir.resolve(version);
    Path mysqlDir = versionDir.resolve("mysql");
    Files.createDirectories(mysqlDir);
    Files.writeString(mysqlDir.resolve("schemaChanges.sql"), schemaChangesSql);
    Files.writeString(mysqlDir.resolve("postDataMigrationSQLScript.sql"), postDdlSql);

    return new MigrationFile(
        versionDir.toFile(), migrationDAO, ConnectionType.MYSQL, config, false);
  }
}
