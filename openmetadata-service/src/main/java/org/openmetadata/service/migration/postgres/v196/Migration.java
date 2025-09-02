package org.openmetadata.service.migration.postgres.v196;

import lombok.SneakyThrows;
import org.openmetadata.service.migration.api.MigrationProcessImpl;
import org.openmetadata.service.migration.utils.MigrationFile;
import org.openmetadata.service.migration.utils.v196.MigrationUtil;

public class Migration extends MigrationProcessImpl {

  public Migration(MigrationFile migrationFile) {
    super(migrationFile);
  }

  @Override
  @SneakyThrows
  public void runDataMigration() {
    // Automator
    MigrationUtil migrationUtil = new MigrationUtil(collectionDAO);
    migrationUtil.migrateAutomatorTagsAndTerms(handle);
  }
}
