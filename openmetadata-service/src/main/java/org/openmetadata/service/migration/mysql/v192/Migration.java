package org.openmetadata.service.migration.mysql.v192;

import lombok.SneakyThrows;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.service.migration.api.MigrationProcessImpl;
import org.openmetadata.service.migration.utils.MigrationFile;
import org.openmetadata.service.migration.utils.v192.HybridStorageMigrationUtil;

/**
 * Migration for version 1.9.2
 * Implements hybrid storage approach:
 * 1. Populate targetFQN and tagFQN columns in tag_usage table
 * 2. Update entity JSONs to include tags, owners, domains, dataProducts
 */
@Slf4j
public class Migration extends MigrationProcessImpl {

  public Migration(MigrationFile migrationFile) {
    super(migrationFile);
  }

  @Override
  @SneakyThrows
  public void runDataMigration() {
    LOG.info("Starting hybrid storage migration for v1.9.2");
    
    // The schema changes (adding targetFQN column) should have already been applied
    // by the schemaChanges.sql script before this data migration runs
    
    HybridStorageMigrationUtil migrationUtil = new HybridStorageMigrationUtil(collectionDAO, handle);
    
    // Step 1: Populate FQN columns in tag_usage table
    LOG.info("Step 1: Populating FQN columns in tag_usage table");
    migrationUtil.populateTagUsageFQNColumns();
    
    // Step 2: Update entity JSONs to include relationships
    LOG.info("Step 2: Updating entity JSONs to include relationships");
    migrationUtil.updateEntityJsonsWithRelationships();
    
    LOG.info("Completed hybrid storage migration for v1.9.2");
  }
}