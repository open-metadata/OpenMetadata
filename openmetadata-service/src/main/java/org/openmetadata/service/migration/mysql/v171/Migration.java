package org.openmetadata.service.migration.mysql.v171;

import static org.openmetadata.service.migration.utils.v171.MigrationUtil.updateServiceCharts;
import static org.openmetadata.service.migration.utils.v171.MigrationUtil.updateWorkflowDefinitions;

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
    updateServiceCharts();

    // The workflow backfill is the only step that backfills a default WorkflowConfiguration
    // (storeStageStatus=false) onto pre-1.7.1 WorkflowDefinitions, which otherwise have
    // config = null. A failure must propagate out of runDataMigration() so MigrationWorkflow
    // does not record this version's data-migration identity, and the next migrate/startup
    // retries the backfill (see DataMigrationStep: "A step that fails records nothing, so the
    // next run retries it"). Swallowing it — as the previous try-catch did — records the
    // version as complete and leaves config = null permanently, which later throws a raw
    // NullPointerException from config.getStoreStageStatus() on every edit/redeploy.
    initializeWorkflowHandler();
    updateWorkflowDefinitions();
  }
}
