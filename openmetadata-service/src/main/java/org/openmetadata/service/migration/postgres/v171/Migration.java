package org.openmetadata.service.migration.postgres.v171;

import lombok.SneakyThrows;
import org.openmetadata.service.migration.api.MigrationProcessImpl;
import org.openmetadata.service.migration.utils.MigrationFile;

import static org.openmetadata.service.migration.utils.v171.MigrationUtil.updateServiceCharts;

public class Migration extends MigrationProcessImpl {

  public Migration(MigrationFile migrationFile) {
    super(migrationFile);
  }

  @Override
  @SneakyThrows
  public void runDataMigration() {
    updateServiceCharts();
  }
}
