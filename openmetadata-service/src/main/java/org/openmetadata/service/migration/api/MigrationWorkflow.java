package org.openmetadata.service.migration.api;

import java.io.File;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.core.Handle;
import org.jdbi.v3.core.Jdbi;
import org.openmetadata.service.jdbi3.MigrationDAO;
import org.openmetadata.service.jdbi3.locator.ConnectionType;
import org.openmetadata.service.migration.utils.MigrationFile;

@Slf4j
public class MigrationWorkflow {
  private List<MigrationProcess> migrations;

  private final String nativeSQLScriptRootPath;
  private final ConnectionType connectionType;
  private final String extensionSQLScriptRootPath;
  private final MigrationDAO migrationDAO;
  private final Jdbi jdbi;

  private final boolean forceMigrations;

  public MigrationWorkflow(
      Jdbi jdbi,
      String nativeSQLScriptRootPath,
      ConnectionType connectionType,
      String extensionSQLScriptRootPath,
      boolean forceMigrations) {
    this.jdbi = jdbi;
    this.migrationDAO = jdbi.onDemand(MigrationDAO.class);
    this.forceMigrations = forceMigrations;
    this.nativeSQLScriptRootPath = nativeSQLScriptRootPath;
    this.connectionType = connectionType;
    this.extensionSQLScriptRootPath = extensionSQLScriptRootPath;
  }

  public void loadMigrations() {
    // Sort Migration on the basis of version
    List<MigrationFile> availableMigrations =
        getMigrationFiles(nativeSQLScriptRootPath, connectionType, extensionSQLScriptRootPath);
    // Filter Migrations to Be Run
    this.migrations = filterAndGetMigrationsToRun(availableMigrations);
  }

  public void validateMigrationsForServer() {
    if (!migrations.isEmpty()) {
      throw new IllegalStateException(
          "There are pending migrations to be run on the database."
              + " Please backup your data and run `./bootstrap/bootstrap_storage.sh migrate-all`."
              + " You can find more information on upgrading OpenMetadata at"
              + " https://docs.open-metadata.org/deployment/upgrade ");
    }
  }

  public List<MigrationFile> getMigrationFiles(
      String nativeSQLScriptRootPath, ConnectionType connectionType, String extensionSQLScriptRootPath) {
    List<MigrationFile> availableOMNativeMigrations =
        getMigrationFilesFromPath(nativeSQLScriptRootPath, connectionType);

    // If we only have OM migrations, return them
    if (extensionSQLScriptRootPath == null || extensionSQLScriptRootPath.isEmpty()) {
      return availableOMNativeMigrations;
    }

    // Otherwise, fetch the extension migrations and sort the executions
    List<MigrationFile> availableExtensionMigrations =
        getMigrationFilesFromPath(extensionSQLScriptRootPath, connectionType);

    /*
     If we create migrations version as:
       - OpenMetadata: 1.1.0, 1.1.1, 1.2.0
       - Extension: 1.1.0-extension, 1.2.0-extension
     The end result will be 1.1.0, 1.1.0-extension, 1.1.1, 1.2.0, 1.2.0-extension
    */
    return Stream.concat(availableOMNativeMigrations.stream(), availableExtensionMigrations.stream())
        .sorted()
        .collect(Collectors.toList());
  }

  public List<MigrationFile> getMigrationFilesFromPath(String path, ConnectionType connectionType) {
    return Arrays.stream(Objects.requireNonNull(new File(path).listFiles(File::isDirectory)))
        .map(dir -> new MigrationFile(dir, migrationDAO, connectionType))
        .sorted()
        .collect(Collectors.toList());
  }

  private List<MigrationProcess> filterAndGetMigrationsToRun(List<MigrationFile> availableMigrations) {
    LOG.debug("Filtering Server Migrations");
    Optional<String> previousMaxMigration = migrationDAO.getMaxServerMigrationVersion();
    List<MigrationFile> applyMigrations;
    if (previousMaxMigration.isPresent() && !forceMigrations) {
      applyMigrations =
          availableMigrations.stream()
              .filter(migration -> migration.biggerThan(previousMaxMigration.get()))
              .collect(Collectors.toList());
    } else {
      applyMigrations = availableMigrations;
    }
    List<MigrationProcess> processes = new ArrayList<>();
    try {
      for (MigrationFile file : applyMigrations) {
        file.parseSQLFiles();
        String clazzName = file.getMigrationProcessClassName();
        MigrationProcess process =
            (MigrationProcess) Class.forName(clazzName).getConstructor(MigrationFile.class).newInstance(file);
        processes.add(process);
      }
    } catch (Exception e) {
      LOG.error("Failed to list and add migrations to run due to ", e);
    }
    return processes;
  }

  @SuppressWarnings("unused")
  private void initializeMigrationWorkflow() {}

  public void runMigrationWorkflows() {
    try (Handle transactionHandler = jdbi.open()) {
      LOG.info("[MigrationWorkflow] WorkFlow Started");
      try {
        for (MigrationProcess process : migrations) {
          // Initialise Migration Steps
          LOG.info(
              "[MigrationProcess] Initialized, Version: {}, DatabaseType: {}, FileName: {}",
              process.getVersion(),
              process.getDatabaseConnectionType(),
              process.getMigrationsPath());
          process.initialize(transactionHandler);

          LOG.info(
              "[MigrationProcess] Running Schema Changes, Version: {}, DatabaseType: {}, FileName: {}",
              process.getVersion(),
              process.getDatabaseConnectionType(),
              process.getSchemaChangesFilePath());
          process.runSchemaChanges();

          LOG.info("[MigrationStep] Transaction Started");

          // Run Database Migration for all the Migration Steps
          LOG.info(
              "[MigrationProcess] Running Data Migrations, Version: {}, DatabaseType: {}, FileName: {}",
              process.getVersion(),
              process.getDatabaseConnectionType(),
              process.getSchemaChangesFilePath());
          process.runDataMigration();

          // Run Database Migration for all the Migration Steps
          LOG.info(
              "[MigrationProcess] Running Post DDL Scripts, Version: {}, DatabaseType: {}, FileName: {}",
              process.getVersion(),
              process.getDatabaseConnectionType(),
              process.getPostDDLScriptFilePath());
          process.runPostDDLScripts();

          // Handle Migration Closure
          LOG.info(
              "[MigrationStep] Update Migration Status, Version: {}, DatabaseType: {}, FileName: {}",
              process.getVersion(),
              process.getDatabaseConnectionType(),
              process.getMigrationsPath());
          updateMigrationStepInDB(process);
        }

      } catch (Exception e) {
        // Any Exception catch the error
        // Rollback the transaction
        LOG.error("Encountered Exception in MigrationWorkflow", e);
        LOG.info("[MigrationWorkflow] Rolling Back Transaction");
        throw e;
      }
    }
    LOG.info("[MigrationWorkflow] WorkFlow Completed");
  }

  public void closeMigrationWorkflow() {
    // 1. Write to DB table the version we upgraded to
    // should be the current server version

    // 2. Commit Transaction on completion
  }

  public void updateMigrationStepInDB(MigrationProcess step) {
    migrationDAO.upsertServerMigration(step.getVersion(), step.getMigrationsPath(), UUID.randomUUID().toString());
  }

  public void migrateSearchIndexes() {}
}
