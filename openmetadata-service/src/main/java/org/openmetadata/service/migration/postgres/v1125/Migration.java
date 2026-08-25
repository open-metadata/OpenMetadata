package org.openmetadata.service.migration.postgres.v1125;

import lombok.SneakyThrows;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.service.jdbi3.locator.ConnectionType;
import org.openmetadata.service.migration.api.MigrationProcessImpl;
import org.openmetadata.service.migration.utils.MigrationFile;
import org.openmetadata.service.migration.utils.v1125.MigrationUtil;

@Slf4j
public class Migration extends MigrationProcessImpl {

  public Migration(MigrationFile migrationFile) {
    super(migrationFile);
  }

  @Override
  @SneakyThrows
  public void runDataMigration() {
    try {
      MigrationUtil.migrateWorkflowDefinitions();
    } catch (Exception e) {
      LOG.error(
          "Failed to migrate workflow definitions in v1125 migration. "
              + "Include fields feature may not work correctly until server restart.",
          e);
    }
    try {
      MigrationUtil.migrateCertificationToTagUsage(handle, ConnectionType.POSTGRES);
    } catch (Exception e) {
      LOG.error(
          "Failed to migrate certification from entity JSON to tag_usage in v1125 migration. "
              + "Certification data may be inconsistent until re-saved.",
          e);
    }
  }
}
