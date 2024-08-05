package org.openmetadata.service.migration.postgres.v150;

import static org.openmetadata.service.migration.utils.v150.MigrationUtil.createSystemDICharts;
import static org.openmetadata.service.migration.utils.v150.MigrationUtil.deleteLegacyDataInsightPipelines;
import static org.openmetadata.service.migration.utils.v150.MigrationUtil.migrateAutomatorOwner;
import static org.openmetadata.service.migration.utils.v150.MigrationUtil.migrateTestCaseDimension;
import static org.openmetadata.service.migration.utils.v150.MigrationUtil.updateDataInsightsApplication;

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
    updateDataInsightsApplication();
    migrateAutomatorOwner(handle, collectionDAO);
  }
}
