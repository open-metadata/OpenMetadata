package org.openmetadata.service.migration.api;

import java.util.Comparator;
import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.core.Handle;
import org.jdbi.v3.core.Jdbi;
import org.openmetadata.service.jdbi3.MigrationDAO;
import org.openmetadata.service.jdbi3.locator.ConnectionType;

@Slf4j
public class MigrationWorkflow {
  private final List<MigrationStep> migrations;
  private final MigrationDAO migrationDAO;
  private final Jdbi jdbi;
  private final ConnectionType workflowDatabaseConnectionType;

  public MigrationWorkflow(Jdbi jdbi, ConnectionType type, List<MigrationStep> migrationSteps) {
    this.jdbi = jdbi;
    this.workflowDatabaseConnectionType = type;

    // Validate Migration
    validateMigrations(migrationSteps);

    this.migrationDAO = jdbi.onDemand(MigrationDAO.class);
    this.migrations = migrationSteps;
    // Sort Migration on the basis of version
    migrations.sort(Comparator.comparing(MigrationStep::getMigrationVersion));
  }

  private void validateMigrations(List<MigrationStep> migrationSteps) {
    for (MigrationStep step : migrationSteps) {
      if (!step.getDatabaseConnectionType().equals(this.workflowDatabaseConnectionType)) {
        throw new IllegalArgumentException(
            String.format(
                "Provided Migration File is for Database Connection %s", step.getDatabaseConnectionType().toString()));
      }
    }
  }

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
              "[MigrationStep] Running NonTransactionalPreDataSQLs, Version: {}, DatabaseType: {}, FileName: {}",
              step.getMigrationVersion(),
              step.getDatabaseConnectionType(),
              step.getMigrationFileName());
          step.nonTransactionalPreDataMigrationSQL();

          LOG.info("[MigrationStep] Transaction Started");

          // Begin Transaction
          transactionHandler.begin();

          // Run Database Migration for all the Migration Steps
          LOG.info(
              "[MigrationStep] Running TransactionalPreDataSQLs, Version: {}, DatabaseType: {}, FileName: {}",
              step.getMigrationVersion(),
              step.getDatabaseConnectionType(),
              step.getMigrationFileName());
          step.transactionalPreDataMigrationSQL();

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
          step.transactionalPostDataMigrationSQL();

          transactionHandler.commit();
          LOG.info("[MigrationStep] Committing Transaction");

          LOG.info(
              "[MigrationStep] Running NonTransactionalPostDataSQLs, Version: {}, DatabaseType: {}, FileName: {}",
              step.getMigrationVersion(),
              step.getDatabaseConnectionType(),
              step.getMigrationFileName());
          step.nonTransactionalPostDataMigrationSQL();

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
        transactionHandler.rollback();
      }
    }
  }

  public void closeMigrationWorkflow() {
    // 1. Write to DB table the version we upgraded to
    // should be the current server version

    // 2. Commit Transaction on completion
  }

  public void updateMigrationStepInDB(MigrationStep step) {
    migrationDAO.upsertServerMigration(String.valueOf(step.getMigrationVersion()), step.getMigrationFileName(), true);
  }

  public void migrateSearchIndexes() {}
}
