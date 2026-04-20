package org.openmetadata.service.migration.mysql.v1127;

import lombok.SneakyThrows;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.service.migration.api.MigrationProcessImpl;
import org.openmetadata.service.migration.utils.MigrationFile;
import org.openmetadata.service.migration.utils.v1127.MigrationUtil;

@Slf4j
public class Migration extends MigrationProcessImpl {

  public Migration(MigrationFile migrationFile) {
    super(migrationFile);
  }

  @Override
  @SneakyThrows
  public void runDataMigration() {
    try {
      MigrationUtil.backfillConfigSourceEnvHash(handle);
    } catch (Exception e) {
      LOG.error(
          "Failed to backfill env_hash in v1127 migration. "
              + "Configs with configSource=AUTO may be overwritten by ENV values on next restart. "
              + "Operators can prevent this by setting configSource=DB in YAML for affected settings.",
          e);
    }
  }
}
