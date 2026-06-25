package org.openmetadata.service.migration.mysql.v200;

import static org.openmetadata.service.jdbi3.locator.ConnectionType.MYSQL;
import static org.openmetadata.service.migration.utils.v1130.MigrationUtil.addTableColumnSearchSettings;
import static org.openmetadata.service.migration.utils.v200.MigrationUtil.addCreateTaskRuleToDataConsumerPolicy;
import static org.openmetadata.service.migration.utils.v200.MigrationUtil.addTaskAuthorPolicyToDataConsumerRole;
import static org.openmetadata.service.migration.utils.v200.MigrationUtil.addTaskRuleToDataConsumerPolicy;
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
    // The helper itself lives in v1130 (where the tableColumn entity was
    // introduced) but we also invoke it here so deploys upgrading from a
    // 1.13.0 baseline that hasn't run v200 yet still register column-search.
    // Reprocessing of an already-applied 1.13.0 with no new SQL skips
    // runDataMigration() per PR #26571, so this dual-invoke is required to
    // close that path. The helper is idempotent — safe on every run.
    addTableColumnSearchSettings();
    migrateSuggestionsToTaskEntity(handle, MYSQL);
    migrateThreadTasksToTaskEntity(handle, MYSQL);
    migrateLegacyActivityThreadsToActivityStream(handle, MYSQL);
    backfillAnnouncementRelationships(handle);
    addTaskAuthorPolicyToDataConsumerRole(collectionDAO);
    addCreateTaskRuleToDataConsumerPolicy(collectionDAO);
    addTaskRuleToDataConsumerPolicy(collectionDAO);
  }
}
