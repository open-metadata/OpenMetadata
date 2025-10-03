package org.openmetadata.service.migration.postgres.v1100;

import static org.openmetadata.service.migration.utils.v1100.MigrationUtil.updateGlossaryTermApprovalWorkflow;

import lombok.SneakyThrows;
import org.openmetadata.service.jdbi3.locator.ConnectionType;
import org.openmetadata.service.migration.api.MigrationProcessImpl;
import org.openmetadata.service.migration.utils.MigrationFile;
import org.openmetadata.service.migration.utils.v1100.MigrationUtil;

public class Migration extends MigrationProcessImpl {

  public Migration(MigrationFile migrationFile) {
    super(migrationFile);
  }

  @Override
  @SneakyThrows
  public void runDataMigration() {
    MigrationUtil migrationUtil = new MigrationUtil(handle, ConnectionType.POSTGRES);
    migrationUtil.migrateEntityStatusForExistingEntities();
    migrationUtil.cleanupOrphanedDataContracts();
    // Initialize WorkflowHandler before attempting to update workflows
    // This ensures that Flowable engine is ready for validation
    initializeWorkflowHandler();

    // Update GlossaryTermApprovalWorkflow: migrate to generic tasks and add thresholds
    updateGlossaryTermApprovalWorkflow();
  }
}
