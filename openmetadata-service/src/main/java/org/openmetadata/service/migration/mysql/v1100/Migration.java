package org.openmetadata.service.migration.mysql.v1100;

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
    // Migrate Flyway schema history to server_change_log
    MigrationUtil migrationUtil = new MigrationUtil(ConnectionType.MYSQL);
    migrationUtil.migrateFlywayHistory(handle);
  }
}
