package org.openmetadata.service.migration.postgres.v1130;

import lombok.SneakyThrows;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.service.migration.api.MigrationProcessImpl;
import org.openmetadata.service.migration.utils.MigrationFile;
import org.openmetadata.service.migration.utils.v1130.MigrationUtil;

@Slf4j
public class Migration extends MigrationProcessImpl {

  public Migration(MigrationFile migrationFile) {
    super(migrationFile);
  }

  @Override
  @SneakyThrows
  public void runDataMigration() {
    MigrationUtil.updateOwnerChartFormulas();
    try {
      MigrationUtil.migrateWebhookSecretKeyToAuthType(handle);
    } catch (Exception e) {
      LOG.error(
          "Failed to migrate webhook secretKey to authType in v1130 migration. "
              + "Webhook authentication may not work correctly until re-saved.",
          e);
    }
  }
}
