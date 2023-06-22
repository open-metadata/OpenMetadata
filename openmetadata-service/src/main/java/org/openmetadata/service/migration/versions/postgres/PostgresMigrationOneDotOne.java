package org.openmetadata.service.migration.versions.postgres;

import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.core.Handle;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.locator.ConnectionType;
import org.openmetadata.service.migration.MigrationFile;
import org.openmetadata.service.migration.api.MigrationStep;

@Slf4j
@MigrationFile(name = "PostgresMigrationOneDotOne")
public class PostgresMigrationOneDotOne implements MigrationStep {
  private CollectionDAO collectionDAO;

  private Handle handle;

  @Override
  public double getMigrationVersion() {
    return 1.1;
  }

  @Override
  public String getMigrationFileName() {
    return "PostgresMigrationOneDotOne";
  }

  @Override
  public ConnectionType getDatabaseConnectionType() {
    return ConnectionType.POSTGRES;
  }

  @Override
  public void initialize(Handle handle) {
    this.handle = handle;
    this.collectionDAO = handle.attach(CollectionDAO.class);
  }

  @Override
  public void nonTransactionalPreDataMigrationSQL() {}

  @Override
  public void transactionalPreDataMigrationSQL() {}

  @Override
  public void runDataMigration() {}

  @Override
  public void transactionalPostDataMigrationSQL() {}

  @Override
  public void nonTransactionalPostDataMigrationSQL() {}

  @Override
  public void close() {}
}
