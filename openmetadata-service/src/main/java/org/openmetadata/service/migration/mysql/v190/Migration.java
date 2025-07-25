package org.openmetadata.service.migration.mysql.v190;

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
    // Updating WorkflowDefinition
    initializeWorkflowHandler();
    updateWorkflowDefinitions();
  }
}
