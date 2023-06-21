package org.openmetadata.service.migration.api;

import org.openmetadata.service.migration.api.MigrationStep;

import java.util.List;

public class MigrationWorkflow {
  List<MigrationStep> migrations;

  public void initializeMigration() {
    // Get A DB Connection
    // Start Transaction
    // Load all migration steps and sort them by their semantic version
  }

  public void runMigrationWorkflows() {
    try {

    } catch(Exception e) {
      // Any Exception catch the error
      // Rollback the transaction
    }
  }

  public void closeMigrationWorkflow() {
    // 1. Write to DB table the version we upgraded to
    // should be the current server version
    // 2. Commit Transaction on completion
  }

  public void migrateSearchIndexes() {

  }
}
