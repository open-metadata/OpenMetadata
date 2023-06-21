package org.openmetadata.service.migration.api;

import java.util.Arrays;
import java.util.Comparator;
import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.core.Handle;
import org.jdbi.v3.core.Jdbi;
import org.openmetadata.service.jdbi3.MigrationDAO;

@Slf4j
public class MigrationWorkflow {
  private final List<MigrationStep> migrations;
  private final MigrationDAO migrationDAO;
  private final Jdbi jdbi;

  public MigrationWorkflow(Jdbi jdbi, List<MigrationStep> migrationSteps) {
    this.jdbi = jdbi;
    this.migrationDAO = jdbi.onDemand(MigrationDAO.class);
    this.migrations = migrationSteps;
    // Sort Migration on the basis of version
    migrations.sort(Comparator.comparing(MigrationStep::getMigrationVersion));
  }

  public MigrationWorkflow(Jdbi jdbi, MigrationStep... migrationSteps) {
    this.jdbi = jdbi;
    this.migrationDAO = jdbi.onDemand(MigrationDAO.class);
    this.migrations = Arrays.asList(migrationSteps);
    // Sort Migration on the basis of version
    migrations.sort(Comparator.comparing(MigrationStep::getMigrationVersion));
  }

  private void initializeMigration() {}

  public void runMigrationWorkflows() {
    try (Handle transactionHandler = jdbi.open()) {
      try {
        LOG.info("[MigrationWorkflow] Transaction Started");
        // Begin Transaction
        transactionHandler.begin();

        // Initialise Migration Steps
        migrations.forEach((step) -> step.initialize(transactionHandler));

        // Run Database Migration for all the Migration Steps
        for (MigrationStep step : migrations) {
          step.runDBMigration();
        }

        // Run Database Migration for all the Migration Steps
        for (MigrationStep step : migrations) {
          step.runDataMigration();
        }

        // Commit Transaction
        LOG.info("[MigrationWorkflow] Committing Transaction");
        transactionHandler.commit();
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
    // TODO
    // 1. Write to DB table the version we upgraded to
    // should be the current server version

    // 2. Commit Transaction on completion
  }

  public void migrateSearchIndexes() {}
}
