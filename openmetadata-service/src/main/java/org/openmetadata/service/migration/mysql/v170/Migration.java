package org.openmetadata.service.migration.mysql.v170;

import static org.openmetadata.service.migration.utils.v170.MigrationUtil.createServiceCharts;
import static org.openmetadata.service.migration.utils.v170.MigrationUtil.runLineageMigrationForNonNullColumn;
import static org.openmetadata.service.migration.utils.v170.MigrationUtil.runLineageMigrationForNullColumn;
import static org.openmetadata.service.migration.utils.v170.MigrationUtil.runMigrationForDataProductsLineage;
import static org.openmetadata.service.migration.utils.v170.MigrationUtil.runMigrationForDomainLineage;
import static org.openmetadata.service.migration.utils.v170.MigrationUtil.runMigrationServiceLineage;
import static org.openmetadata.service.migration.utils.v170.MigrationUtil.updateDataInsightsApplication;
import static org.openmetadata.service.migration.utils.v170.MigrationUtil.updateGovernanceWorkflowDefinitions;
import static org.openmetadata.service.migration.utils.v170.MigrationUtil.updateLineageBotPolicy;

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
    // Governance
    initializeWorkflowHandler();
    updateGovernanceWorkflowDefinitions();
    updateDataInsightsApplication();

    // Lineage
    runLineageMigrationForNullColumn(handle);
    runLineageMigrationForNonNullColumn(handle);
    runMigrationServiceLineage(handle);
    runMigrationForDomainLineage(handle);
    runMigrationForDataProductsLineage(handle);

    // DI
    createServiceCharts();

    updateLineageBotPolicy();
  }
}
