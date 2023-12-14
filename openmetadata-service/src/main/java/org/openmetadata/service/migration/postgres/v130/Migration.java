package org.openmetadata.service.migration.postgres.v130;

import static org.openmetadata.service.migration.utils.v130.MigrationUtil.migrateTestCaseIncidentStatus;

import org.jdbi.v3.core.Handle;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.migration.api.MigrationProcessImpl;
import org.openmetadata.service.migration.utils.MigrationFile;

public class Migration extends MigrationProcessImpl {
  private CollectionDAO collectionDAO;

  private Handle handle;

  public Migration(MigrationFile migrationFile) {
    super(migrationFile);
  }

  @Override
  public void initialize(Handle handle) {
    super.initialize(handle);
    this.handle = handle;
    this.collectionDAO = handle.attach(CollectionDAO.class);
  }

  @Override
  public void runDataMigration() {
    migrateTestCaseIncidentStatus(handle, collectionDAO, 100);
  }
}
