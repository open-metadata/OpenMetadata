package org.openmetadata.service.migration.api;

public interface MigrationStep {
  // This version should match the server version
  // Ex: if the server is 1.0.0 the migration version for that server is 1.0.0
  // This version is used to sort all the upgrade migrations and apply them in order
  public String getMigrationVersion();

  // This method is to run the db migration like flyway
  public void runDBMigration();

  // This method is to run code to fix any data
  public void runDataMigration();

  public void close();
}
