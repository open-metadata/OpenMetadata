package org.openmetadata.service.migration.mysql.v190;

import static org.openmetadata.service.migration.utils.v190.MigrationUtil.updateServiceCharts;

import lombok.SneakyThrows;
import org.openmetadata.service.migration.api.MigrationProcessImpl;
import org.openmetadata.service.migration.utils.MigrationFile;
import org.openmetadata.service.migration.utils.v190.MigrationUtil;

public class Migration extends MigrationProcessImpl {

  public Migration(MigrationFile migrationFile) {
    super(migrationFile);
  }

  @Override
  @SneakyThrows
  public void runDataMigration() {
    // Data Insights
    updateServiceCharts();

    // Automator
    MigrationUtil migrationUtil = new MigrationUtil(collectionDAO);
    migrationUtil.migrateAutomatorDomainToDomainsAction(handle);
    // Initialize WorkflowHandler
    initializeWorkflowHandler();
    // Update WorkflowDefinitions for GlossaryTermApprovalWorkflow
    MigrationUtil.updateGlossaryTermApprovalWorkflow();
  }
}
