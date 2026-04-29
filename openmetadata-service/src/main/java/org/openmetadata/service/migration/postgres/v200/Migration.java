package org.openmetadata.service.migration.postgres.v200;

import static org.openmetadata.service.jdbi3.locator.ConnectionType.POSTGRES;
import static org.openmetadata.service.migration.utils.v200.MigrationUtil.addTableColumnSearchSettings;
import static org.openmetadata.service.migration.utils.v200.MigrationUtil.backfillAnnouncementRelationships;
import static org.openmetadata.service.migration.utils.v200.MigrationUtil.backfillVersionMetadata;
import static org.openmetadata.service.migration.utils.v200.MigrationUtil.migrateLegacyActivityThreadsToActivityStream;
import static org.openmetadata.service.migration.utils.v200.MigrationUtil.migrateSuggestionsToTaskEntity;
import static org.openmetadata.service.migration.utils.v200.MigrationUtil.migrateThreadTasksToTaskEntity;

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
    addTableColumnSearchSettings();
    migrateSuggestionsToTaskEntity(handle, POSTGRES);
    migrateThreadTasksToTaskEntity(handle, POSTGRES);
    migrateLegacyActivityThreadsToActivityStream(handle, POSTGRES);
    backfillAnnouncementRelationships(handle);
    try {
      backfillVersionMetadata(handle);
    } catch (Exception e) {
      LOG.error(
          "Failed to backfill versionNum and changedFieldKeys in v200 migration. "
              + "Version timeline filtering may not work correctly until the migration is re-run.",
          e);
    }
  }
}
