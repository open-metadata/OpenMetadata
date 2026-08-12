package org.openmetadata.service.migration.mysql.v210;

import static org.openmetadata.service.jdbi3.locator.ConnectionType.MYSQL;

import lombok.SneakyThrows;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.service.migration.api.MigrationProcessImpl;
import org.openmetadata.service.migration.utils.MigrationFile;
import org.openmetadata.service.migration.utils.v210.MigrationUtil;

@Slf4j
public class Migration extends MigrationProcessImpl {

  public Migration(MigrationFile migrationFile) {
    super(migrationFile);
  }

  @Override
  @SneakyThrows
  public void runDataMigration() {
    initializeWorkflowHandler();
    MigrationUtil migrationUtil = new MigrationUtil(handle, MYSQL);
    try {
      migrationUtil.archiveLegacyThreadStorage();
    } catch (Exception e) {
      LOG.error("v210: failed to archive legacy thread storage", e);
    }
    try {
      migrationUtil.renameKnowledgeCenterClassification();
    } catch (Exception e) {
      LOG.error("v210: failed to rename KnowledgeCenter classification to ContextCenter", e);
    }
  }
}
