package org.openmetadata.service.migration.postgres.v1100;

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
    MigrationUtil migrationUtil = new MigrationUtil(handle, ConnectionType.POSTGRES);
    migrationUtil.migrateEntityStatusForExistingEntities();
    migrationUtil.cleanupOrphanedDataContracts();
  }

  @Override
  protected String getQueryFormat() {
    return "UPDATE tag SET json = jsonb_set(json, '{recognizers}', '%s'::jsonb) "
        + "WHERE json->>'fullyQualifiedName' = '%s'";
  }
}
