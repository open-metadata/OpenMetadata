package org.openmetadata.service.migration.mysql.v1129;

import static org.openmetadata.service.migration.utils.v1129.MigrationUtil.addTriggerOperationToDefaultBotPolicies;
import static org.openmetadata.service.migration.utils.v1129.MigrationUtil.addTriggerRuleToDataStewardPolicy;

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
    addTriggerOperationToDefaultBotPolicies(collectionDAO);
    addTriggerRuleToDataStewardPolicy(collectionDAO);
  }
}
