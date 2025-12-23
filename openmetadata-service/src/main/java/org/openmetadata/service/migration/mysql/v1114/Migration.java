package org.openmetadata.service.migration.mysql.v1114;

import lombok.SneakyThrows;
import org.openmetadata.service.jdbi3.locator.ConnectionType;
import org.openmetadata.service.migration.api.MigrationProcessImpl;
import org.openmetadata.service.migration.utils.MigrationFile;
import org.openmetadata.service.migration.utils.v1114.MigrationUtil;

public class Migration extends MigrationProcessImpl {

  public Migration(MigrationFile migrationFile) {
    super(migrationFile);
  }

  @Override
  @SneakyThrows
  public void runDataMigration() {
    MigrationUtil.checkAndLogDataLossSymptoms(handle);
    MigrationUtil.restoreBotRelationshipsIfMissing(handle, ConnectionType.MYSQL);
    MigrationUtil.updateSearchSettingsBoostConfiguration();
  }
}
