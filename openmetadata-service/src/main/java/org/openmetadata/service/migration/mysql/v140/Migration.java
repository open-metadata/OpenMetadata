package org.openmetadata.service.migration.mysql.v140;

import static org.openmetadata.service.migration.utils.v140.MigrationUtil.migrateGenericToWebhook;
import static org.openmetadata.service.migration.utils.v140.MigrationUtil.migrateTablePartition;
import static org.openmetadata.service.migration.utils.v140.MigrationUtil.migrateTestCaseResolution;

import lombok.SneakyThrows;
import org.openmetadata.service.migration.api.MigrationProcessImpl;
import org.openmetadata.service.migration.utils.MigrationFile;

public class Migration extends MigrationProcessImpl {

  public Migration(MigrationFile migrationFile) {
    super(migrationFile);
  }

  @Override
  @SneakyThrows
  public void runDataMigration() {
    // Migrate Table Partition
    migrateTablePartition(handle, collectionDAO);

    // Migrate Generic to Webhook
    migrateGenericToWebhook(collectionDAO);

    // Migrate Test case resolution status
    migrateTestCaseResolution(handle, collectionDAO);
  }
}
