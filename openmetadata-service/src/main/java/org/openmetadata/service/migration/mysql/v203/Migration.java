package org.openmetadata.service.migration.mysql.v203;

import static org.openmetadata.service.migration.utils.v203.ServiceLineagePipelineRoutingMigration.removeServiceEdgesBypassingPipeline;

import lombok.SneakyThrows;
import org.openmetadata.service.migration.api.MigrationProcessImpl;
import org.openmetadata.service.migration.utils.MigrationFile;
import org.openmetadata.service.migration.utils.v203.MigrationUtil;

public class Migration extends MigrationProcessImpl {

  public Migration(MigrationFile migrationFile) {
    super(migrationFile);
  }

  @Override
  @SneakyThrows
  public void runDataMigration() {
    MigrationUtil migrationUtil = new MigrationUtil(handle);
    migrationUtil.backfillGlossaryTermRelationCardinality();
    // Drop the redundant direct service edge that pipeline-annotated lineage used to create
    // alongside its two pipeline hops, so the service graph shows one path instead of two.
    // Idempotent.
    removeServiceEdgesBypassingPipeline(collectionDAO);
  }
}
