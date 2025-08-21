package org.openmetadata.service.migration.postgres.v1100;

import static org.openmetadata.service.migration.utils.v1100.MigrationUtil.updateGlossaryTermApprovalWorkflowWithThresholds;

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

    // Update GlossaryTermApprovalWorkflow with approval and rejection thresholds
    updateGlossaryTermApprovalWorkflowWithThresholds();
  }
}
