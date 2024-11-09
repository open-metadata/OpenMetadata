package org.openmetadata.service.migration.mysql.v157;

import static org.openmetadata.service.migration.utils.v157.MigrationUtil.migrateTableDiffParams;

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
    migrateTableDiffParams(handle, collectionDAO, authenticationConfiguration, false);
  }
}
