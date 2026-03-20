package org.openmetadata.service.migration.postgres.v1124;

import lombok.SneakyThrows;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.service.migration.api.MigrationProcessImpl;
import org.openmetadata.service.migration.utils.MigrationFile;
import org.openmetadata.service.migration.utils.v1124.MigrationUtil;

@Slf4j
public class Migration extends MigrationProcessImpl {

  public Migration(MigrationFile migrationFile) {
    super(migrationFile);
  }

  @Override
  @SneakyThrows
  public void runDataMigration() {
    try {
      MigrationUtil.migrateWebhookSecretKeyToAuthType(handle);
    } catch (Exception e) {
      LOG.error(
          "Failed to migrate webhook secretKey to authType in v1124 migration. "
              + "Webhook authentication may not work correctly until re-saved.",
          e);
    }
    try {
      MigrationUtil.migrateWorkflowDefinitions();
    } catch (Exception e) {
      LOG.error(
          "Failed to migrate workflow definitions in v1124 migration. "
              + "Include fields feature may not work correctly until server restart.",
          e);
    }
  }
}
