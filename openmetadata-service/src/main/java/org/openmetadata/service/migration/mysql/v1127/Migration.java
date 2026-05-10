package org.openmetadata.service.migration.mysql.v1127;

import static org.openmetadata.service.jdbi3.locator.ConnectionType.MYSQL;

import lombok.extern.slf4j.Slf4j;
import org.openmetadata.service.migration.api.MigrationProcessImpl;
import org.openmetadata.service.migration.utils.MigrationFile;
import org.openmetadata.service.migration.utils.v1127.MigrationUtil;

@Slf4j
public class Migration extends MigrationProcessImpl {

  public Migration(MigrationFile migrationFile) {
    super(migrationFile);
  }

  @Override
  public void runDataMigration() {
    try {
      MigrationUtil migrationUtil = new MigrationUtil(handle, MYSQL);
      migrationUtil.migrateTaskDomains();
    } catch (Exception e) {
      LOG.error(
          "Failed to migrate task domains in v1127 migration. "
              + "Domain-scoped users may not see tasks in the activity feed "
              + "until a manual domain backfill is performed.",
          e);
    }
  }
}
