package org.openmetadata.service.migration.postgres.v1109;

import static org.openmetadata.service.migration.utils.v1109.MigrationUtil.handleMissing1102Migration;

import lombok.SneakyThrows;
import org.openmetadata.service.jdbi3.locator.ConnectionType;
import org.openmetadata.service.migration.api.MigrationProcessImpl;
import org.openmetadata.service.migration.utils.MigrationFile;

public class Migration extends MigrationProcessImpl {

  private final MigrationFile migrationFile;

  public Migration(MigrationFile migrationFile) {
    super(migrationFile);
    this.migrationFile = migrationFile;
  }

  @Override
  @SneakyThrows
  public void runDataMigration() {
    // Handle missing 1.10.2 migration for users who upgraded through 1.10.3-1.10.7
    String nativePath =
        migrationFile.openMetadataApplicationConfig.getMigrationConfiguration().getNativePath();
    handleMissing1102Migration(migrationDAO, ConnectionType.POSTGRES, nativePath);
  }
}
