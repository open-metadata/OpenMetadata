package org.openmetadata.service.migration.api;

import java.util.List;
import java.util.Map;
import org.jdbi.v3.core.Handle;
import org.jdbi.v3.core.Jdbi;
import org.openmetadata.service.migration.QueryStatus;
import org.openmetadata.service.migration.context.MigrationOps;

public interface MigrationProcess {
  interface MigrationProcessCallback {
    void call();
  }

  // This version should match the server version
  // Ex: if the server is 1.0.0 the migration version for that server is 1.0.0
  // This version is used to sort all the upgrade migrations and apply them in order

  void initialize(Handle handle, Jdbi jdbi);

  List<MigrationOps> getMigrationOps();

  String getDatabaseConnectionType();

  String getVersion();

  String getMigrationsPath();

  String getSchemaChangesFilePath();

  String getPostDDLScriptFilePath();

  // Handle Non-transactional supported SQLs here Example changes in table struct (DDL
  Map<String, QueryStatus> runSchemaChanges(boolean isForceMigration);

  // This method is to run code to fix any data
  void runDataMigration();

  // This method is to run SQL which can be part of the transaction post data migrations
  Map<String, QueryStatus> runPostDDLScripts(boolean isForceMigration);

  void close();
}
