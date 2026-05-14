package org.openmetadata.service.migration.postgres.v1129;

import static org.openmetadata.service.migration.utils.v1129.MigrationUtil.addTriggerOperationToDefaultPolicies;

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
    addTriggerOperationToDefaultPolicies(collectionDAO);
  }
}
