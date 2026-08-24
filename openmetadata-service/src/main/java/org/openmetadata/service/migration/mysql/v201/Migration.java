package org.openmetadata.service.migration.mysql.v201;

import static org.openmetadata.service.migration.utils.v201.MigrationUtil.backfillSourceConfigTypes;

import org.openmetadata.service.migration.api.MigrationProcessImpl;
import org.openmetadata.service.migration.utils.MigrationFile;

public class Migration extends MigrationProcessImpl {

  public Migration(MigrationFile migrationFile) {
    super(migrationFile);
  }

  @Override
  public void runDataMigration() {
    backfillSourceConfigTypes(collectionDAO);
  }
}
