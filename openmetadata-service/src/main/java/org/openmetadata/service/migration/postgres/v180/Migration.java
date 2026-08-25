package org.openmetadata.service.migration.postgres.v180;

import static org.openmetadata.service.migration.utils.v180.MigrationUtil.addCertificationOperationsToPolicy;
import static org.openmetadata.service.migration.utils.v180.MigrationUtil.addDenyDisplayNameRuleToBotPolicies;

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
    addCertificationOperationsToPolicy(collectionDAO);
    addDenyDisplayNameRuleToBotPolicies(collectionDAO);
  }
}
