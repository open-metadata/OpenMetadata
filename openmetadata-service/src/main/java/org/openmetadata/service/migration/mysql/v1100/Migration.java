package org.openmetadata.service.migration.mysql.v1100;

import lombok.SneakyThrows;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.service.jdbi3.locator.ConnectionType;
import org.openmetadata.service.migration.utils.MigrationFile;
import org.openmetadata.service.migration.utils.v1100.MigrationProcessBase;
import org.openmetadata.service.migration.utils.v1100.MigrationUtil;

@Slf4j
public class Migration extends MigrationProcessBase {
  public Migration(MigrationFile migrationFile) {
    super(migrationFile);
  }

  @Override
  @SneakyThrows
  public void runDataMigration() {
    MigrationUtil migrationUtil = new MigrationUtil(handle, ConnectionType.MYSQL);
    migrationUtil.migrateEntityStatusForExistingEntities();
    migrationUtil.cleanupOrphanedDataContracts();
  }

  @Override
  protected String getQueryFormat() {
    return "UPDATE tag SET json = JSON_SET(json, '$.recognizers', CAST('%s' AS JSON)) "
        + "WHERE JSON_EXTRACT(json, '$.fullyQualifiedName') = '%s'";
  }
}
