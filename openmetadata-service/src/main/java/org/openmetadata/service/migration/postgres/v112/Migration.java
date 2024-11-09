package org.openmetadata.service.migration.postgres.v112;

import static org.openmetadata.service.migration.utils.V112.MigrationUtil.fixExecutableTestSuiteFQN;
import static org.openmetadata.service.migration.utils.V112.MigrationUtil.lowerCaseUserNameAndEmail;

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
    // Run Data Migration to Remove the quoted Fqn`
    fixExecutableTestSuiteFQN(collectionDAO);
    // Run UserName Migration to make lowercase
    lowerCaseUserNameAndEmail(collectionDAO);
  }
}
