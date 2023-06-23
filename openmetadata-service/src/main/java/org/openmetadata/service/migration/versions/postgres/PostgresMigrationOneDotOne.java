package org.openmetadata.service.migration.versions.postgres;

import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.core.Handle;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.locator.ConnectionType;
import org.openmetadata.service.migration.MigrationFile;
import org.openmetadata.service.migration.api.MigrationStep;

@Slf4j
@MigrationFile(name = "PostgresMigrationOneDotOne")
@SuppressWarnings("unused")
public class PostgresMigrationOneDotOne implements MigrationStep {
  private CollectionDAO collectionDAO;

  private Handle handle;

  @Override
  public String getMigrationVersion() {
    return "1.1.0";
  }

  @Override
  public String getMigrationFileName() {
    return "PostgresMigrationOneDotOne";
  }

  @Override
  public String getFileUuid() {
    return "98b837ea-5941-4577-bb6d-99ca6a80ed13";
  }

  @Override
  public ConnectionType getDatabaseConnectionType() {
    return ConnectionType.POSTGRES;
  }

  @Override
  public void initialize(Handle handle) {}

  @Override
  public void preDDL() {}

  @Override
  public void runDataMigration() {}

  @Override
  public void postDDL() {}

  @Override
  public void close() {}
}
