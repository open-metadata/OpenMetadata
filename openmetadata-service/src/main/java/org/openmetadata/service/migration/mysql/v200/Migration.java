package org.openmetadata.service.migration.mysql.v200;

import static org.openmetadata.service.migration.utils.v200.MigrationUtil.addTableColumnSearchSettings;
import static org.openmetadata.service.migration.utils.v200.MigrationUtil.backfillAnnouncementRelationships;
import static org.openmetadata.service.migration.utils.v200.MigrationUtil.migrateLegacyActivityThreadsToActivityStream;
import static org.openmetadata.service.migration.utils.v200.MigrationUtil.migrateSuggestionsToTaskEntity;
import static org.openmetadata.service.migration.utils.v200.MigrationUtil.migrateThreadTasksToTaskEntity;

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
    addTableColumnSearchSettings();
    migrateSuggestionsToTaskEntity(handle);
    migrateThreadTasksToTaskEntity(handle);
    migrateLegacyActivityThreadsToActivityStream(handle);
    backfillAnnouncementRelationships(handle);
  }
}
