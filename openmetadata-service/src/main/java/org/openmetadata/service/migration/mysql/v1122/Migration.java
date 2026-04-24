package org.openmetadata.service.migration.mysql.v1122;

import java.util.Map;
import lombok.SneakyThrows;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.service.migration.QueryStatus;
import org.openmetadata.service.migration.api.MigrationProcessImpl;
import org.openmetadata.service.migration.utils.MigrationFile;
import org.openmetadata.service.migration.utils.v1122.MigrationUtil;

@Slf4j
public class Migration extends MigrationProcessImpl {
  public Migration(MigrationFile migrationFile) {
    super(migrationFile);
  }

  @Override
  @SneakyThrows
  public void runDataMigration() {
    // Workflow definition migration - wrap in try-catch to prevent blocking other migrations
    try {
      MigrationUtil.migrateWorkflowDefinitions();
    } catch (Exception e) {
      LOG.error(
          "Failed to migrate workflow definitions in v1122 migration. "
              + "Workflow features may not work correctly until server restart.",
          e);
    }
  }

  @Override
  public Map<String, QueryStatus> runPostDDLScripts(boolean isForceMigration) {
    Map<String, QueryStatus> result = super.runPostDDLScripts(isForceMigration);
    result.putAll(
        MigrationUtil.setRecognizersForSensitiveTags(
            handle, getVersion(), migrationDAO, isForceMigration));
    return result;
  }
}
