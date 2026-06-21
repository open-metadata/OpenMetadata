package org.openmetadata.service.migration.api;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

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
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.jdbi3.MigrationDAO;
import org.openmetadata.service.jdbi3.locator.ConnectionType;
import org.openmetadata.service.migration.QueryStatus;
import org.openmetadata.service.migration.utils.MigrationFile;
import org.slf4j.LoggerFactory;

class MigrationProcessImplTest {

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
  void warnsButDoesNotAbortWhenRecordingMigrationStatementFails() {
    Handle handle = mock(Handle.class);
    when(migrationDAO.getSqlQuery(anyString(), anyString())).thenReturn(null);
    doThrow(new RuntimeException("Incorrect string value"))
        .when(migrationDAO)
        .upsertServerMigrationSQL(anyString(), anyString(), anyString());

    Logger logger = (Logger) LoggerFactory.getLogger(MigrationProcessImpl.class);
    ListAppender<ILoggingEvent> appender = new ListAppender<>();
    appender.start();
    logger.addAppender(appender);
    try {
      Map<String, QueryStatus> result =
          MigrationProcessImpl.performSqlExecutionAndUpdate(
              handle,
              migrationDAO,
              List.of("ALTER TABLE entity_relationship ADD COLUMN relationType VARCHAR(64)"),
              "1.13.0",
              false);

      assertEquals(QueryStatus.Status.SUCCESS, result.values().iterator().next().getStatus());
      assertTrue(
          appender.list.stream()
              .anyMatch(
                  event ->
                      event.getLevel() == Level.WARN
                          && event
                              .getFormattedMessage()
                              .contains("Failed to record migration statement")));
    } finally {
      logger.detachAppender(appender);
    }
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
