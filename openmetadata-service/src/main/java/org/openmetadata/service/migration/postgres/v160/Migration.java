package org.openmetadata.service.migration.postgres.v160;

import static org.openmetadata.service.migration.utils.v160.MigrationUtil.addDisplayNameToCustomProperty;
import static org.openmetadata.service.migration.utils.v160.MigrationUtil.addEditGlossaryTermsToDataConsumerPolicy;
import static org.openmetadata.service.migration.utils.v160.MigrationUtil.addRelationsForTableConstraints;
import static org.openmetadata.service.migration.utils.v160.MigrationUtil.addViewAllRuleToOrgPolicy;
import static org.openmetadata.service.migration.utils.v160.MigrationUtil.migrateServiceTypesAndConnections;

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
    migrateServiceTypesAndConnections(handle, true);
    addViewAllRuleToOrgPolicy(collectionDAO);
    addEditGlossaryTermsToDataConsumerPolicy(collectionDAO);
    addDisplayNameToCustomProperty(handle, true);
    addRelationsForTableConstraints(handle, true);
  }
}
