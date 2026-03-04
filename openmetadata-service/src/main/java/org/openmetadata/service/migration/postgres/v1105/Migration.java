package org.openmetadata.service.migration.postgres.v1105;

import static org.openmetadata.service.migration.utils.v1105.MigrationUtil.updateGlossaryTermApprovalWorkflow;

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
    // Initialize WorkflowHandler and update workflows - wrap in try-catch to prevent blocking other
    // migrations
    try {
      initializeWorkflowHandler();
      updateGlossaryTermApprovalWorkflow();
    } catch (Exception e) {
      LOG.error(
          "Failed to initialize WorkflowHandler or update workflows in v1105 migration. "
              + "Workflow features may not work correctly until server restart.",
          e);
    }
  }
}
