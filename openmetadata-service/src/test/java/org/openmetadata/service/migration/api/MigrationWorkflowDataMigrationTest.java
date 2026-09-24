package org.openmetadata.service.migration.api;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.CALLS_REAL_METHODS;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import org.jdbi.v3.core.Jdbi;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.jdbi3.MigrationDAO;
import org.openmetadata.service.jdbi3.locator.ConnectionType;
import org.openmetadata.service.migration.utils.MigrationFile;

/**
 * Selection of Java data migrations during continuous reprocessing (issue #33045).
 *
 * <p>The shape this guards is the one 1.13.5 shipped in: a version already in SERVER_CHANGE_LOG,
 * both SQL files empty, and all of its work in {@code migration.{mysql,postgres}.vXYZ.Migration}.
 * 1.2.0 stands in for it because a released version's migration class stays in the tree for as
 * long as upgrades from it are supported, whereas 1.13.5's was later replaced by SQL in 1.13.6.
 */
class MigrationWorkflowDataMigrationTest {

  private static final String JAVA_ONLY_VERSION = "1.2.0";
  private static final String SQL_ONLY_VERSION = "1.12.3";

  @TempDir Path tempDir;

  private MigrationDAO migrationDAO;
  private OpenMetadataApplicationConfig config;
  private Jdbi jdbi;

  @BeforeEach
  void setUp() {
    migrationDAO = mock(MigrationDAO.class);
    config = mock(OpenMetadataApplicationConfig.class);
    jdbi = mock(Jdbi.class);
    when(jdbi.onDemand(any())).thenReturn(migrationDAO);
    when(migrationDAO.checkIfQueryPreviouslyRan(anyString())).thenReturn(null);
  }

  @ParameterizedTest
  @EnumSource(ConnectionType.class)
  void javaOnlyMigrationOnARecordedVersionIsSelected(ConnectionType connectionType)
      throws IOException {
    MigrationFile javaOnly = migrationDir(JAVA_ONLY_VERSION, connectionType, "");
    when(migrationDAO.getMigrationVersions()).thenReturn(List.of(JAVA_ONLY_VERSION));

    List<MigrationProcess> processes =
        workflow(connectionType).filterAndGetMigrationsToRun(List.of(javaOnly));

    assertEquals(List.of(JAVA_ONLY_VERSION), versionsOf(processes));
    assertTrue(processes.get(0).isReprocessing());
    assertNotNull(processes.get(0).getDataMigrationIdentity());
  }

  @ParameterizedTest
  @EnumSource(ConnectionType.class)
  void javaOnlyMigrationIsDroppedOnceItsIdentityIsRecorded(ConnectionType connectionType)
      throws IOException {
    MigrationFile javaOnly = migrationDir(JAVA_ONLY_VERSION, connectionType, "");
    when(migrationDAO.getMigrationVersions()).thenReturn(List.of(JAVA_ONLY_VERSION));
    when(migrationDAO.getSqlQuery(JAVA_ONLY_VERSION, identityOf(javaOnly)))
        .thenReturn("-- data migration already recorded");

    List<MigrationProcess> processes =
        workflow(connectionType).filterAndGetMigrationsToRun(List.of(javaOnly));

    assertEquals(List.of(), versionsOf(processes));
  }

  @ParameterizedTest
  @EnumSource(ConnectionType.class)
  void reprocessedVersionWithoutJavaMigrationIsStillDropped(ConnectionType connectionType)
      throws IOException {
    MigrationFile sqlOnly = migrationDir(SQL_ONLY_VERSION, connectionType, "");
    when(migrationDAO.getMigrationVersions()).thenReturn(List.of(SQL_ONLY_VERSION));

    List<MigrationProcess> processes =
        workflow(connectionType).filterAndGetMigrationsToRun(List.of(sqlOnly));

    assertEquals(List.of(), versionsOf(processes));
  }

  @ParameterizedTest
  @EnumSource(ConnectionType.class)
  void appendedSqlStillSelectsAReprocessedVersion(ConnectionType connectionType)
      throws IOException {
    MigrationFile sqlOnly =
        migrationDir(SQL_ONLY_VERSION, connectionType, "ALTER TABLE test ADD COLUMN a INT;");
    when(migrationDAO.getMigrationVersions()).thenReturn(List.of(SQL_ONLY_VERSION));

    List<MigrationProcess> processes =
        workflow(connectionType).filterAndGetMigrationsToRun(List.of(sqlOnly));

    assertEquals(List.of(SQL_ONLY_VERSION), versionsOf(processes));
  }

  @Test
  void pendingCheckTreatsAMissingSqlLogTableAsNothingRecorded() throws IOException {
    MigrationFile javaOnly = migrationDir(JAVA_ONLY_VERSION, ConnectionType.MYSQL, "");
    when(migrationDAO.getSqlQuery(anyString(), anyString()))
        .thenThrow(new RuntimeException("SERVER_MIGRATION_SQL_LOGS is missing"));

    assertTrue(
        workflow(ConnectionType.MYSQL).hasPendingDataMigration(processFor(javaOnly)),
        "an unreadable log means the migration has not run");
  }

  @Test
  void aVersionWithoutJavaWorkIsNeverPendingAndIsNeverRecorded() throws IOException {
    MigrationFile sqlOnly = migrationDir(SQL_ONLY_VERSION, ConnectionType.MYSQL, "");
    MigrationWorkflow workflow = workflow(ConnectionType.MYSQL);
    MigrationProcess process = processFor(sqlOnly);

    assertFalse(workflow.hasPendingDataMigration(process));

    workflow.recordDataMigration(process);
    verify(migrationDAO, never()).upsertServerMigrationSQL(anyString(), anyString(), anyString());
  }

  @Test
  void aSucceededDataMigrationIsRecordedUnderItsIdentity() throws IOException {
    MigrationFile javaOnly = migrationDir(JAVA_ONLY_VERSION, ConnectionType.MYSQL, "");
    MigrationProcess process = processFor(javaOnly);

    workflow(ConnectionType.MYSQL).recordDataMigration(process);

    verify(migrationDAO)
        .upsertServerMigrationSQL(
            JAVA_ONLY_VERSION,
            "-- data migration org.openmetadata.service.migration.mysql.v120.Migration revision 1",
            process.getDataMigrationIdentity());
  }

  @Test
  void failingToRecordTheRunDoesNotFailAMigrationThatSucceeded() throws IOException {
    MigrationFile javaOnly = migrationDir(JAVA_ONLY_VERSION, ConnectionType.MYSQL, "");
    doThrow(new RuntimeException("SERVER_MIGRATION_SQL_LOGS rejected the write"))
        .when(migrationDAO)
        .upsertServerMigrationSQL(anyString(), anyString(), anyString());

    assertDoesNotThrow(
        () -> workflow(ConnectionType.MYSQL).recordDataMigration(processFor(javaOnly)));
  }

  @Test
  void aProcessThatDoesNotExtendMigrationProcessImplIsNeverPending() {
    // Extension providers may implement MigrationProcess directly. The interface default reports
    // no identity, so they keep the selection behaviour they had before this ledger existed.
    MigrationProcess directImplementation = mock(MigrationProcess.class, CALLS_REAL_METHODS);

    assertFalse(workflow(ConnectionType.MYSQL).hasPendingDataMigration(directImplementation));
    verify(migrationDAO, never()).getSqlQuery(anyString(), anyString());
  }

  @Test
  void aFailedDataMigrationIsNotReportedAsRun() {
    MigrationWorkflow forced =
        new MigrationWorkflow(jdbi, "", ConnectionType.MYSQL, "", "", config, true);
    List<String> row = new ArrayList<>();

    assertFalse(
        forced.runStepAndAddStatus(
            row,
            () -> {
              throw new IllegalStateException("data migration blew up");
            }),
        "a swallowed failure under --force must not count as a run");
    assertTrue(row.get(0).startsWith(MigrationWorkflow.FAILED_MSG));
  }

  @Test
  void aFailedDataMigrationStopsTheWorkflowWhenNotForced() {
    MigrationWorkflow workflow = workflow(ConnectionType.MYSQL);

    assertThrows(
        IllegalStateException.class,
        () ->
            workflow.runStepAndAddStatus(
                new ArrayList<>(),
                () -> {
                  throw new IllegalStateException("data migration blew up");
                }));
  }

  private MigrationWorkflow workflow(ConnectionType connectionType) {
    return new MigrationWorkflow(jdbi, "", connectionType, "", "", config, false);
  }

  private List<String> versionsOf(List<MigrationProcess> processes) {
    return processes.stream().map(MigrationProcess::getVersion).toList();
  }

  private MigrationProcess processFor(MigrationFile file) {
    try {
      return (MigrationProcess)
          Class.forName(file.getMigrationProcessClassName())
              .getConstructor(MigrationFile.class)
              .newInstance(file);
    } catch (ReflectiveOperationException e) {
      throw new AssertionError("Could not resolve the migration class for " + file.version, e);
    }
  }

  private String identityOf(MigrationFile file) {
    return processFor(file).getDataMigrationIdentity();
  }

  private MigrationFile migrationDir(
      String version, ConnectionType connectionType, String schemaChangesSql) throws IOException {
    Path versionDir = tempDir.resolve(version);
    Path dbDir = versionDir.resolve(connectionType == ConnectionType.MYSQL ? "mysql" : "postgres");
    Files.createDirectories(dbDir);
    Files.writeString(dbDir.resolve("schemaChanges.sql"), schemaChangesSql);
    Files.writeString(dbDir.resolve("postDataMigrationSQLScript.sql"), "");
    return new MigrationFile(versionDir.toFile(), migrationDAO, connectionType, config, false);
  }
}
