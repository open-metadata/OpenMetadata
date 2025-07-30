package org.openmetadata.service.migration.postgres.v190;

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
    MigrationUtil migrationUtil = new MigrationUtil(collectionDAO);
    migrationUtil.migrateAutomatorDomainToDomainsAction(handle);

    // Initialize WorkflowHandler
    initializeWorkflowHandler();
    // Update WorkflowDefinitions from fresh seed data instead of database
    // This ensures new nodes and edges are properly applied
    MigrationUtil.updateWorkflowDefinitionsFromSeedData();
  }
}
