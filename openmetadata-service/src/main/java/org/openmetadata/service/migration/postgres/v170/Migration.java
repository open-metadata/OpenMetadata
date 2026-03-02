package org.openmetadata.service.migration.postgres.v170;

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
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.service.migration.api.MigrationProcessImpl;
import org.openmetadata.service.migration.utils.MigrationFile;

@Slf4j
public class Migration extends MigrationProcessImpl {

  public Migration(MigrationFile migrationFile) {
    super(migrationFile);
  }

  @Override
  @SneakyThrows
  public void runDataMigration() {
    // Governance - wrap in try-catch to prevent blocking other migrations
    try {
      initializeWorkflowHandler();
      updateGovernanceWorkflowDefinitions();
      updateDataInsightsApplication();
    } catch (Exception e) {
      LOG.error(
          "Failed to initialize WorkflowHandler or update workflows in v170 migration. "
              + "Workflow features may not work correctly until server restart.",
          e);
    }

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
