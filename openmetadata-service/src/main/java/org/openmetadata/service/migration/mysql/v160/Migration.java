package org.openmetadata.service.migration.mysql.v160;

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
    migrateServiceTypesAndConnections(handle, false);
    addViewAllRuleToOrgPolicy(collectionDAO);
    addEditGlossaryTermsToDataConsumerPolicy(collectionDAO);
    addDisplayNameToCustomProperty(handle, false);
    addRelationsForTableConstraints(handle, false);
  }
}
