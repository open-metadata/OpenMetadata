package org.openmetadata.service.migration.mysql.v1129;

import static org.openmetadata.service.jdbi3.locator.ConnectionType.MYSQL;
import static org.openmetadata.service.migration.utils.v1129.MigrationUtil.addTriggerOperationToDefaultBotPolicies;
import static org.openmetadata.service.migration.utils.v1129.MigrationUtil.addTriggerRuleToDataStewardPolicy;

import lombok.extern.slf4j.Slf4j;
import org.openmetadata.service.migration.api.MigrationProcessImpl;
import org.openmetadata.service.migration.utils.MigrationFile;
import org.openmetadata.service.migration.utils.v1129.MigrationUtil;

@Slf4j
public class Migration extends MigrationProcessImpl {

  public Migration(MigrationFile migrationFile) {
    super(migrationFile);
  }

  @Override
  public void runDataMigration() {
    try {
      addTriggerOperationToDefaultBotPolicies(collectionDAO);
      addTriggerRuleToDataStewardPolicy(collectionDAO);
    } catch (Exception ex) {
      LOG.error(
          "Failed to migrate bot/steward trigger policies in v1129 migration. "
              + "Affected identities may lose trigger access until manually updated.",
          ex);
    }
    try {
      MigrationUtil migrationUtil = new MigrationUtil(handle, MYSQL);
      migrationUtil.migrateTaskDomains();
    } catch (Exception e) {
      LOG.error(
          "Failed to migrate task domains in v1129 migration. "
              + "Domain-scoped users may not see tasks in the activity feed "
              + "until a manual domain backfill is performed.",
          e);
    }
  }
}
