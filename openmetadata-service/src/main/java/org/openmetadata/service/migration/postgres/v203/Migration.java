package org.openmetadata.service.migration.postgres.v203;

import static org.openmetadata.service.migration.utils.v203.MigrationUtil.seedSearchIndexMappings;

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
    seedSearchIndexMappings();
  }
}
