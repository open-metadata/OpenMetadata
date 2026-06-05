package org.openmetadata.service.migration.mysql.v11211;

import static org.openmetadata.service.migration.utils.v11211.MigrationUtil.repairPipelineTaskFqns;

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
    repairPipelineTaskFqns(handle, collectionDAO);
  }
}
