package org.openmetadata.service.migration.api;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.openmetadata.service.util.EntityUtil.hash;

import ch.qos.logback.classic.Level;
import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;
import org.jdbi.v3.core.Handle;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.jdbi3.MigrationDAO;
import org.openmetadata.service.jdbi3.locator.ConnectionType;
import org.openmetadata.service.migration.QueryStatus;
import org.openmetadata.service.migration.utils.MigrationCodeFingerprint;
import org.openmetadata.service.migration.utils.MigrationFile;
import org.openmetadata.service.migration.utils.SqlUnit;
import org.slf4j.LoggerFactory;

class MigrationProcessImplTest {
  @TempDir Path tempDir;

  private MigrationDAO migrationDAO;
  private OpenMetadataApplicationConfig config;
  private final ListAppender<ILoggingEvent> logs = new ListAppender<>();
  private final List<Logger> loggers =
      List.of(
          (Logger) LoggerFactory.getLogger(MigrationFile.class),
          (Logger) LoggerFactory.getLogger(MigrationProcessImpl.class));

  @BeforeEach
  void setUp() {
    migrationDAO = mock(MigrationDAO.class);
    config = mock(OpenMetadataApplicationConfig.class);
    logs.start();
    loggers.forEach(logger -> logger.addAppender(logs));
  }

  @AfterEach
  void tearDown() {
    loggers.forEach(logger -> logger.detachAppender(logs));
  }

  private List<String> warnings() {
    return logs.list.stream()
        .filter(event -> event.getLevel() == Level.WARN)
        .map(ILoggingEvent::getFormattedMessage)
        .toList();
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
    assertEquals(
        List.of(
            "[MigrationWorkflow] Skipping a statement of version 2.1.0 because identical text"
                + " already ran earlier in this version: PREPARE stmt FROM @ddl"),
        warnings());
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
  void warnsWhenAStatementIsDroppedBecauseAnotherVersionRanIt() throws IOException {
    when(migrationDAO.checkIfQueryPreviouslyRan(anyString())).thenReturn("2.0.0");
    MigrationFile file = createMigrationDir("2.1.0", "UPDATE test SET a = 1;", "");

    file.parseSQLFiles();

    assertFalse(file.hasNewStatements());
    assertEquals(
        List.of(
            "[MigrationWorkflow] Skipping a statement of version 2.1.0 because identical text"
                + " already ran in version 2.0.0: UPDATE test SET a = 1"),
        warnings());
  }

  @Test
  void doesNotWarnWhenTheSameVersionRanTheStatement() throws IOException {
    when(migrationDAO.checkIfQueryPreviouslyRan(anyString())).thenReturn("2.1.0");
    MigrationFile file = createMigrationDir("2.1.0", "UPDATE test SET a = 1;", "");

    file.parseSQLFiles();

    assertFalse(file.hasNewStatements());
    assertEquals(List.of(), warnings());
  }

  @Test
  void doesNotWarnWhileReprocessingAVersion() throws IOException {
    when(migrationDAO.checkIfQueryPreviouslyRan(anyString())).thenReturn("2.0.0");
    MigrationFile file = createMigrationDir("2.1.0", "UPDATE test SET a = 1;", "");
    file.setReprocessing(true);

    file.parseSQLFiles();

    assertFalse(file.hasNewStatements());
    assertEquals(List.of(), warnings());
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
