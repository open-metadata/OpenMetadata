package org.openmetadata.service.migration.mysql.v1100;

import org.openmetadata.service.jdbi3.locator.ConnectionType;
import lombok.SneakyThrows;
import org.openmetadata.service.migration.api.MigrationProcessImpl;
import org.openmetadata.service.migration.utils.MigrationFile;
import org.openmetadata.service.migration.utils.v1100.MigrationUtil;

public class Migration extends MigrationProcessImpl {

  public Migration(MigrationFile migrationFile) {
    super(migrationFile);
  }

  @Override
  @SneakyThrows
  public void runDataMigration() {
    MigrationUtil migrationUtil = new MigrationUtil(collectionDAO);
    migrationUtil.migrateEntityStatusForExistingEntities(handle);
    MigrationUtil migrationUtil = new MigrationUtil(ConnectionType.MYSQL);
    migrationUtil.migrateFlywayHistory(handle);
  }
}
