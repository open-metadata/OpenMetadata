package org.openmetadata.service.migration.api;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.core.Handle;
import org.jdbi.v3.core.Jdbi;
import org.openmetadata.service.jdbi3.MigrationDAO;
import org.openmetadata.service.migration.Migration;

@Slf4j
public class MigrationWorkflow {
  private final List<MigrationStep> migrations;
  private final MigrationDAO migrationDAO;
  private final Jdbi jdbi;
  private boolean ignoreFileChecksum = false;

  public MigrationWorkflow(Jdbi jdbi, List<MigrationStep> migrationSteps, boolean ignoreFileChecksum) {
    this.jdbi = jdbi;
    this.migrationDAO = jdbi.onDemand(MigrationDAO.class);
    this.ignoreFileChecksum = ignoreFileChecksum;
    // Sort Migration on the basis of version
    migrationSteps.sort(Comparator.comparing(MigrationStep::getMigrationVersion));

    // Filter Migrations to Be Run
    this.migrations = filterAndGetMigrationsToRun(migrationSteps);
  }

  public static void validateMigrationsForServer(Jdbi jdbi, List<MigrationStep> migrations) {
    if (!migrations.isEmpty()) {
      migrations.sort(Comparator.comparing(MigrationStep::getMigrationVersion));
      String maxMigration = migrations.get(migrations.size() - 1).getMigrationVersion();
      Optional<String> lastMigratedServer = Migration.lastMigratedServer(jdbi);
      if (lastMigratedServer.isEmpty()) {
        throw new IllegalStateException(
            "Could not validate Server migrations in the database. Make sure you have run `./bootstrap/bootstrap_storage.sh migrate-all` at least once.");
      } else {
        if (lastMigratedServer.get().compareTo(maxMigration) < 0) {
          throw new IllegalStateException(
              "There are pending migrations to be run on the database."
                  + " Please backup your data and run `./bootstrap/bootstrap_storage.sh migrate-all`."
                  + " You can find more information on upgrading OpenMetadata at"
                  + " https://docs.open-metadata.org/deployment/upgrade ");
        }
      }
    } else {
      LOG.info("No Server Migration Files Found in the system.");
    }
  }

  private List<MigrationStep> filterAndGetMigrationsToRun(List<MigrationStep> migrations) {
    LOG.debug("Filtering Server Migrations");
    String maxMigration = migrations.get(migrations.size() - 1).getMigrationVersion();
    List<MigrationStep> result = new ArrayList<>();

    for (MigrationStep step : migrations) {
      String checksum = migrationDAO.getVersionMigrationChecksum(String.valueOf(step.getMigrationVersion()));
      if (checksum != null) {
        // Version Exist on DB this was run
        if (maxMigration.compareTo(step.getMigrationVersion()) < 0) {
          // This a new Step file
          result.add(step);
        } else if (ignoreFileChecksum || !checksum.equals(step.getFileUuid())) {
          // This migration step was ran already, if checksum is equal this step can be ignored
          LOG.warn(
              "[Migration Workflow] You are changing an older Migration File. This is not advised. Add your changes to latest Migrations.");
          result.add(step);
        }
      } else {
        // Version does not exist on DB, this step was not run
        result.add(step);
      }
    }
    return result;
  }

  @SuppressWarnings("unused")
  private void initializeMigrationWorkflow() {}

  public void runMigrationWorkflows() {
    try (Handle transactionHandler = jdbi.open()) {
      LOG.info("[MigrationWorkflow] WorkFlow Started");
      try {

        for (MigrationStep step : migrations) {
          // Initialise Migration Steps
          LOG.info(
              "[MigrationStep] Initialized, Version: {}, DatabaseType: {}, FileName: {}",
              step.getMigrationVersion(),
              step.getDatabaseConnectionType(),
              step.getMigrationFileName());
          step.initialize(transactionHandler);

          LOG.info(
              "[MigrationStep] Running PreDataSQLs, Version: {}, DatabaseType: {}, FileName: {}",
              step.getMigrationVersion(),
              step.getDatabaseConnectionType(),
              step.getMigrationFileName());
          step.preDDL();

          LOG.info("[MigrationStep] Transaction Started");

          // Run Database Migration for all the Migration Steps
          LOG.info(
              "[MigrationStep] Running DataMigration, Version: {}, DatabaseType: {}, FileName: {}",
              step.getMigrationVersion(),
              step.getDatabaseConnectionType(),
              step.getMigrationFileName());
          step.runDataMigration();

          // Run Database Migration for all the Migration Steps
          LOG.info(
              "[MigrationStep] Running TransactionalPostDataSQLs, Version: {}, DatabaseType: {}, FileName: {}",
              step.getMigrationVersion(),
              step.getDatabaseConnectionType(),
              step.getMigrationFileName());
          step.postDDL();

          // Handle Migration Closure
          LOG.info(
              "[MigrationStep] Update Migration Status, Version: {}, DatabaseType: {}, FileName: {}",
              step.getMigrationVersion(),
              step.getDatabaseConnectionType(),
              step.getMigrationFileName());
          updateMigrationStepInDB(step);
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

  public void updateMigrationStepInDB(MigrationStep step) {
    migrationDAO.upsertServerMigration(step.getMigrationVersion(), step.getMigrationFileName(), step.getFileUuid());
  }

  public void migrateSearchIndexes() {}
}
