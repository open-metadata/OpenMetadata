package org.openmetadata.service.migration.postgres.v211;

import org.openmetadata.service.migration.api.MigrationProcessImpl;
import org.openmetadata.service.migration.utils.DataMigrationStep;
import org.openmetadata.service.migration.utils.MigrationFile;
import org.openmetadata.service.migration.utils.v211.IncidentOpenIntervalMigration;

public class Migration extends MigrationProcessImpl {
  public Migration(MigrationFile migrationFile) {
    super(migrationFile);
  }

  @Override
  public void runDataMigration() {
    DataMigrationStep.runOnce(
        migrationDAO,
        getVersion(),
        "incident-open-intervals",
        () -> IncidentOpenIntervalMigration.backfill(handle));
  }
}
