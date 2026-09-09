package org.openmetadata.service.migration.mysql.v201;

import lombok.SneakyThrows;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.service.migration.api.MigrationProcessImpl;
import org.openmetadata.service.migration.utils.MigrationFile;
import org.openmetadata.service.migration.utils.v201.MigrationUtil;

@Slf4j
public class Migration extends MigrationProcessImpl {

  public Migration(MigrationFile migrationFile) {
    super(migrationFile);
  }

  @Override
  @SneakyThrows
  public void runDataMigration() {
    // Wrap WorkflowHandler init + AutoPilot re-deploy so a handler failure logs and continues
    // instead of aborting the rest of the migration. Matches v200's pattern.
    try {
      initializeWorkflowHandler();
      MigrationUtil.redeployAutoPilotWorkflow();
    } catch (Exception e) {
      LOG.error(
          "v201: failed to initialize WorkflowHandler or re-deploy AutoPilotWorkflow. "
              + "AutoPilot BPMN may still reference stale delegate fields until server restart.",
          e);
    }
    MigrationUtil.alignHybridSearchWeightsWithDefaults();
  }
}
