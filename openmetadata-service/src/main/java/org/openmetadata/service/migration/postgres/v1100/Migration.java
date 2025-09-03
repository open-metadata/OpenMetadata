package org.openmetadata.service.migration.postgres.v1100;

import lombok.extern.slf4j.Slf4j;
import org.openmetadata.service.jdbi3.locator.ConnectionType;
import org.openmetadata.service.migration.api.MigrationProcessImpl;
import org.openmetadata.service.migration.utils.MigrationFile;
import org.openmetadata.service.migration.utils.v1100.MigrationUtil;

@Slf4j
public class Migration extends MigrationProcessImpl {

  public Migration(MigrationFile migrationFile) {
    super(migrationFile);
  }

  @Override
  public void runDataMigration() {
    MigrationUtil migrationUtil = new MigrationUtil(ConnectionType.POSTGRES);
    migrationUtil.migrateFlywayHistory(handle);
  }
}
