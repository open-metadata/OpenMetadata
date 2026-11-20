package org.openmetadata.service.migration.mysql.v212;

import org.openmetadata.service.migration.api.MigrationProcessImpl;
import org.openmetadata.service.migration.utils.DataMigrationStep;
import org.openmetadata.service.migration.utils.MigrationFile;
import org.openmetadata.service.migration.utils.v212.IncidentGroupingMigration;

public class Migration extends MigrationProcessImpl {
  public Migration(MigrationFile migrationFile) {
    super(migrationFile);
  }

  @Override
  public void runDataMigration() {
    DataMigrationStep.runOnce(
        migrationDAO,
        getVersion(),
        "incident-grouping-lookup",
        () -> IncidentGroupingMigration.backfill(handle));
  }
}
