package org.openmetadata.service.migration.api;

import org.jdbi.v3.core.Handle;
import org.openmetadata.service.jdbi3.locator.ConnectionType;

public interface MigrationStep {
  // This version should match the server version
  // Ex: if the server is 1.0.0 the migration version for that server is 1.0.0
  // This version is used to sort all the upgrade migrations and apply them in order
  String getMigrationVersion();

  String getMigrationFileName();

  String getFileUuid();

  ConnectionType getDatabaseConnectionType();

  void initialize(Handle handle);

  // Handle Non-transactional supported SQLs here Example changes in table struct (DDL
  void preDDL();

  // This method is to run code to fix any data
  void runDataMigration();

  // This method is to run SQL which can be part of the transaction post data migrations
  void postDDL();

  void close();
}
