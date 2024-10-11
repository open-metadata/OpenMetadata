package org.openmetadata.service.migration.postgres.v160;

import static org.openmetadata.service.migration.utils.v160.MigrationUtil.addAppExtensionName;
import static org.openmetadata.service.migration.utils.v160.MigrationUtil.migrateServiceTypesAndConnections;

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
    addAppExtensionName(handle, collectionDAO, authenticationConfiguration, true);
    migrateServiceTypesAndConnections(handle, true);
  }
}
