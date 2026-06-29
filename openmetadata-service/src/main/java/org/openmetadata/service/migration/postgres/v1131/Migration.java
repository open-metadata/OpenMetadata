package org.openmetadata.service.migration.postgres.v1131;

import static org.openmetadata.service.migration.utils.v1131.MigrationUtil.backfillDatabaseMetadataSourceConfigType;
import static org.openmetadata.service.migration.utils.v1131.MigrationUtil.migratePipelineServiceEdges;
import static org.openmetadata.service.migration.utils.v1131.MigrationUtil.redeployGovernanceWorkflows;
import static org.openmetadata.service.migration.utils.v1131.MigrationUtil.repairChildFqns;

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
    repairChildFqns(collectionDAO);
    initializeWorkflowHandler();
    redeployGovernanceWorkflows();
    backfillDatabaseMetadataSourceConfigType(handle);

    try {
      migratePipelineServiceEdges(collectionDAO, handle);
    } catch (Exception e) {
      LOG.error(
          "Failed to migrate pipeline service edges in v1131 migration. "
              + "The 'By Service' lineage view for pipeline services may show no edges; "
              + "re-running the v1131 data migration after addressing the cause will backfill them.",
          e);
    }
  }
}
