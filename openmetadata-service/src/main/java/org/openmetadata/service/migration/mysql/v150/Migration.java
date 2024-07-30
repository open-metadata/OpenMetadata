package org.openmetadata.service.migration.mysql.v150;

import static org.openmetadata.service.migration.utils.v150.MigrationUtil.createSystemDICharts;
import static org.openmetadata.service.migration.utils.v150.MigrationUtil.deleteLegacyDataInsightPipelines;
import static org.openmetadata.service.migration.utils.v150.MigrationUtil.migrateTestCaseDimension;

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
    migrateTestCaseDimension(handle, collectionDAO);
    createSystemDICharts();
    deleteLegacyDataInsightPipelines(pipelineServiceClient);
  }
}
