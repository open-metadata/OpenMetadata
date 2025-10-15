package org.openmetadata.service.migration.mysql.v1110;

import lombok.SneakyThrows;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.service.jdbi3.locator.ConnectionType;
import org.openmetadata.service.migration.utils.MigrationFile;
import org.openmetadata.service.migration.utils.v1110.MigrationProcessBase;
import org.openmetadata.service.migration.utils.v1110.MigrationUtil;

@Slf4j
public class Migration extends MigrationProcessBase {
  public Migration(MigrationFile migrationFile) {
    super(migrationFile);
  }

  @Override
  protected String getQueryFormat() {
    return "UPDATE tag SET json = JSON_SET(json, '$.recognizers', CAST('%s' AS JSON)) "
        + "WHERE JSON_EXTRACT(json, '$.fullyQualifiedName') = '%s'";
  }

  @Override
  @SneakyThrows
  public void runDataMigration() {
    MigrationUtil migrationUtil = new MigrationUtil(ConnectionType.MYSQL);
    migrationUtil.migrateFlywayHistory(handle);
  }
}
