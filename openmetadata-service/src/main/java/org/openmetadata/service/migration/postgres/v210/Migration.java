package org.openmetadata.service.migration.postgres.v210;

import lombok.SneakyThrows;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.service.migration.api.MigrationProcessImpl;
import org.openmetadata.service.migration.utils.MigrationFile;
import org.openmetadata.service.migration.utils.v210.SupersetChartFqnCollisionFix;

@Slf4j
public class Migration extends MigrationProcessImpl {

  public Migration(MigrationFile migrationFile) {
    super(migrationFile);
  }

  @Override
  @SneakyThrows
  public void runDataMigration() {
    try {
      SupersetChartFqnCollisionFix.fixSupersetChartFqnCollision(handle, collectionDAO);
    } catch (Exception e) {
      LOG.error("Failed to fix Superset chart/dashboard FQN collisions in v210 migration.", e);
    }
  }
}
