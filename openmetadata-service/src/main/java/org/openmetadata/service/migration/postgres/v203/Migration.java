package org.openmetadata.service.migration.postgres.v203;

import static org.openmetadata.service.migration.utils.v203.ServiceLineagePipelineRoutingMigration.removeServiceEdgesBypassingPipeline;
import static org.openmetadata.service.migration.utils.v203.TableAliasesSearchSettingsMigration.addAliasesSearchSettings;

import lombok.SneakyThrows;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.service.migration.api.MigrationProcessImpl;
import org.openmetadata.service.migration.utils.MigrationFile;
import org.openmetadata.service.migration.utils.v203.MigrationUtil;

@Slf4j
public class Migration extends MigrationProcessImpl {

  public Migration(final MigrationFile migrationFile) {
    super(migrationFile);
  }

  @Override
  @SneakyThrows
  public void runDataMigration() {
    MigrationUtil migrationUtil = new MigrationUtil(handle);
    migrationUtil.backfillGlossaryTermRelationCardinality();
    // Repair installs already upgraded to 2.0.0/2.0.1: v200 dropped DataConsumerPolicy's
    // CreateTask-Rule via a stale L1 cache (#32668), and v200 will not re-run on those installs.
    // Re-invoke the now cache-safe helpers here. Idempotent - no-op when the rules already exist.
    MigrationUtil.addCreateTaskRuleToDataConsumerPolicy(collectionDAO);
    MigrationUtil.addTaskRuleToDataConsumerPolicy(collectionDAO);
    // Drop the redundant direct service edge that pipeline-annotated lineage used to create
    // alongside its two pipeline hops, so the service graph shows one path instead of two.
    // Idempotent.
    removeServiceEdgesBypassingPipeline(collectionDAO);
    try {
      addAliasesSearchSettings();
    } catch (Exception e) {
      LOG.error("v203: failed to backfill the table 'aliases' search settings", e);
    }
  }
}
