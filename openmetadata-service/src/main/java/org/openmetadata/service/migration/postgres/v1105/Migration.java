package org.openmetadata.service.migration.postgres.v1105;

import static org.openmetadata.service.migration.utils.v1105.MigrationUtil.updateGlossaryTermApprovalWorkflow;

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
    // Initialize WorkflowHandler before attempting to update workflows
    // This ensures that Flowable engine is ready for validation
    initializeWorkflowHandler();
    // Update GlossaryTermApprovalWorkflow: migrate to generic tasks and add thresholds
    updateGlossaryTermApprovalWorkflow();
  }
}
