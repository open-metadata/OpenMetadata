package org.openmetadata.service.migration.postgres.v131;

import static org.openmetadata.service.migration.utils.v131.MigrationUtil.migrateCronExpression;

import lombok.SneakyThrows;
import org.jdbi.v3.core.Handle;
import org.openmetadata.service.migration.api.MigrationProcessImpl;
import org.openmetadata.service.migration.utils.MigrationFile;

public class Migration extends MigrationProcessImpl {

  private Handle handle;

  public Migration(MigrationFile migrationFile) {
    super(migrationFile);
  }

  @Override
  public void initialize(Handle handle) {
    super.initialize(handle);
    this.handle = handle;
  }

  @Override
  @SneakyThrows
  public void runDataMigration() {
    migrateCronExpression(handle);
  }
}
