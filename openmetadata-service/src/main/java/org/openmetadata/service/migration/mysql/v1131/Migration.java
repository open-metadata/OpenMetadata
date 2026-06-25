package org.openmetadata.service.migration.mysql.v1131;

import static org.openmetadata.service.migration.utils.v1131.MigrationUtil.redeployGovernanceWorkflows;
import static org.openmetadata.service.migration.utils.v1131.MigrationUtil.repairChildFqns;

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
    repairChildFqns(collectionDAO);
    initializeWorkflowHandler();
    redeployGovernanceWorkflows();
  }
}
