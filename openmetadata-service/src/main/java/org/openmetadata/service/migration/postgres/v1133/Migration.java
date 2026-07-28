package org.openmetadata.service.migration.postgres.v1133;

import static org.openmetadata.service.jdbi3.locator.ConnectionType.POSTGRES;
import static org.openmetadata.service.migration.utils.v1133.MigrationUtil.backfillDataContractTestSuiteRelationships;

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
    try {
      backfillDataContractTestSuiteRelationships(handle, POSTGRES);
    } catch (Exception e) {
      LOG.error("v1133: failed to backfill dataContract -> testSuite relationships", e);
    }
  }
}
