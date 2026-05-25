package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.util.concurrent.ThreadLocalRandom;
import org.jdbi.v3.core.Jdbi;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.openmetadata.it.bootstrap.TestSuiteBootstrap;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.jdbi3.locator.ConnectionType;
import org.openmetadata.service.migration.api.MigrationWorkflow;

class ContinuousMigrationIT {

  @TempDir Path tempDir;

  @Test
  void reprocessesNativeAndExtensionWhenBothHaveNewSql() throws Exception {
    ConnectionType connectionType = currentConnectionType();
    MigrationScenario scenario = createScenario(connectionType);
    Jdbi jdbi = TestSuiteBootstrap.getJdbi();

    try {
      runWorkflow(jdbi, scenario.nativeRoot, scenario.extensionRoot, connectionType);
      assertTrue(columnExists(jdbi, connectionType, scenario.nativeTableName, "id"));
      assertTrue(columnExists(jdbi, connectionType, scenario.extensionTableName, "id"));

      appendSchemaStatement(
          scenario.nativeRoot,
          connectionType,
          scenario.nativeVersion,
          "ALTER TABLE " + scenario.nativeTableName + " ADD COLUMN native_name VARCHAR(64);");
      appendSchemaStatement(
          scenario.extensionRoot,
          connectionType,
          scenario.extensionVersion,
          "ALTER TABLE " + scenario.extensionTableName + " ADD COLUMN extension_name VARCHAR(64);");

      runWorkflow(jdbi, scenario.nativeRoot, scenario.extensionRoot, connectionType);

      assertTrue(columnExists(jdbi, connectionType, scenario.nativeTableName, "native_name"));
      assertTrue(columnExists(jdbi, connectionType, scenario.extensionTableName, "extension_name"));
      assertVersionCounts(jdbi, scenario.nativeVersion, 1, 2);
      assertVersionCounts(jdbi, scenario.extensionVersion, 1, 2);
    } finally {
      cleanupArtifacts(jdbi, scenario);
    }
  }

  @Test
  void reprocessesOnlyNativeWhenExtensionHasNoNewSql() throws Exception {
    ConnectionType connectionType = currentConnectionType();
    MigrationScenario scenario = createScenario(connectionType);
    Jdbi jdbi = TestSuiteBootstrap.getJdbi();

    try {
      runWorkflow(jdbi, scenario.nativeRoot, scenario.extensionRoot, connectionType);
      appendSchemaStatement(
          scenario.nativeRoot,
          connectionType,
          scenario.nativeVersion,
          "ALTER TABLE " + scenario.nativeTableName + " ADD COLUMN native_name VARCHAR(64);");

      runWorkflow(jdbi, scenario.nativeRoot, scenario.extensionRoot, connectionType);

      assertTrue(columnExists(jdbi, connectionType, scenario.nativeTableName, "native_name"));
      assertFalse(
          columnExists(jdbi, connectionType, scenario.extensionTableName, "extension_name"));
      assertVersionCounts(jdbi, scenario.nativeVersion, 1, 2);
      assertVersionCounts(jdbi, scenario.extensionVersion, 1, 1);
    } finally {
      cleanupArtifacts(jdbi, scenario);
    }
  }

  @Test
  void reprocessesOnlyExtensionWhenNativeHasNoNewSql() throws Exception {
    ConnectionType connectionType = currentConnectionType();
    MigrationScenario scenario = createScenario(connectionType);
    Jdbi jdbi = TestSuiteBootstrap.getJdbi();

    try {
      runWorkflow(jdbi, scenario.nativeRoot, scenario.extensionRoot, connectionType);
      appendSchemaStatement(
          scenario.extensionRoot,
          connectionType,
          scenario.extensionVersion,
          "ALTER TABLE " + scenario.extensionTableName + " ADD COLUMN extension_name VARCHAR(64);");

      runWorkflow(jdbi, scenario.nativeRoot, scenario.extensionRoot, connectionType);

      assertFalse(columnExists(jdbi, connectionType, scenario.nativeTableName, "native_name"));
      assertTrue(columnExists(jdbi, connectionType, scenario.extensionTableName, "extension_name"));
      assertVersionCounts(jdbi, scenario.nativeVersion, 1, 1);
      assertVersionCounts(jdbi, scenario.extensionVersion, 1, 2);
    } finally {
      cleanupArtifacts(jdbi, scenario);
    }
  }

  private void runWorkflow(
      Jdbi jdbi, Path nativeRoot, Path extensionRoot, ConnectionType connectionType) {
    MigrationWorkflow workflow =
        new MigrationWorkflow(
            jdbi,
            nativeRoot.toString(),
            connectionType,
            extensionRoot.toString(),
            "",
            new OpenMetadataApplicationConfig(),
            false);
    workflow.loadMigrations();
    workflow.runMigrationWorkflows(false);
  }

  private void writeMigrationFiles(
      Path nativeRoot, ConnectionType connectionType, String version, String schemaSql)
      throws Exception {
    Path dbDir =
        Files.createDirectories(
            nativeRoot
                .resolve(version)
                .resolve(connectionType == ConnectionType.MYSQL ? "mysql" : "postgres"));
    Files.writeString(dbDir.resolve("schemaChanges.sql"), schemaSql);
    Files.writeString(dbDir.resolve("postDataMigrationSQLScript.sql"), "");
  }

  private void appendSchemaStatement(
      Path nativeRoot, ConnectionType connectionType, String version, String schemaSql)
      throws Exception {
    Path schemaFile =
        nativeRoot
            .resolve(version)
            .resolve(connectionType == ConnectionType.MYSQL ? "mysql" : "postgres")
            .resolve("schemaChanges.sql");
    Files.writeString(schemaFile, System.lineSeparator() + schemaSql, StandardOpenOption.APPEND);
  }

  private boolean columnExists(
      Jdbi jdbi, ConnectionType connectionType, String tableName, String columnName) {
    String query =
        connectionType == ConnectionType.MYSQL
            ? "SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = :tableName AND column_name = :columnName"
            : "SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = :tableName AND column_name = :columnName";
    return jdbi.withHandle(
            handle ->
                handle
                    .createQuery(query)
                    .bind("tableName", tableName)
                    .bind("columnName", columnName)
                    .mapTo(Integer.class)
                    .one())
        == 1;
  }

  private int countByVersion(Jdbi jdbi, String tableName, String version) {
    return jdbi.withHandle(
        handle ->
            handle
                .createQuery("SELECT COUNT(*) FROM " + tableName + " WHERE version = :version")
                .bind("version", version)
                .mapTo(Integer.class)
                .one());
  }

  private void assertVersionCounts(
      Jdbi jdbi, String version, int expectedChangeLogCount, int expectedSqlLogCount) {
    assertEquals(expectedChangeLogCount, countByVersion(jdbi, "SERVER_CHANGE_LOG", version));
    assertEquals(expectedSqlLogCount, countByVersion(jdbi, "SERVER_MIGRATION_SQL_LOGS", version));
  }

  private void cleanupArtifacts(Jdbi jdbi, MigrationScenario scenario) {
    jdbi.useHandle(
        handle -> {
          handle.execute("DROP TABLE IF EXISTS " + scenario.nativeTableName);
          handle.execute("DROP TABLE IF EXISTS " + scenario.extensionTableName);
          handle
              .createUpdate("DELETE FROM SERVER_MIGRATION_SQL_LOGS WHERE version = :version")
              .bind("version", scenario.nativeVersion)
              .execute();
          handle
              .createUpdate("DELETE FROM SERVER_CHANGE_LOG WHERE version = :version")
              .bind("version", scenario.nativeVersion)
              .execute();
          handle
              .createUpdate("DELETE FROM SERVER_MIGRATION_SQL_LOGS WHERE version = :version")
              .bind("version", scenario.extensionVersion)
              .execute();
          handle
              .createUpdate("DELETE FROM SERVER_CHANGE_LOG WHERE version = :version")
              .bind("version", scenario.extensionVersion)
              .execute();
        });
  }

  private MigrationScenario createScenario(ConnectionType connectionType) throws Exception {
    String version = "0.0." + ThreadLocalRandom.current().nextInt(1, Integer.MAX_VALUE);
    String nativeTableName =
        "it_continuous_native_"
            + Integer.toUnsignedString(ThreadLocalRandom.current().nextInt(), 36);
    String extensionTableName =
        "it_continuous_extension_"
            + Integer.toUnsignedString(ThreadLocalRandom.current().nextInt(), 36);
    Path nativeRoot = Files.createDirectories(tempDir.resolve("native"));
    Path extensionRoot = Files.createDirectories(tempDir.resolve("extension"));
    writeMigrationFiles(
        nativeRoot, connectionType, version, "CREATE TABLE " + nativeTableName + " (id INT);");
    writeMigrationFiles(
        extensionRoot,
        connectionType,
        version + "-collate",
        "CREATE TABLE " + extensionTableName + " (id INT);");
    return new MigrationScenario(
        nativeRoot,
        extensionRoot,
        version,
        version + "-collate",
        nativeTableName,
        extensionTableName);
  }

  private ConnectionType currentConnectionType() {
    return "mysql".equalsIgnoreCase(System.getProperty("databaseType", "postgres"))
        ? ConnectionType.MYSQL
        : ConnectionType.POSTGRES;
  }

  private record MigrationScenario(
      Path nativeRoot,
      Path extensionRoot,
      String nativeVersion,
      String extensionVersion,
      String nativeTableName,
      String extensionTableName) {}
}
