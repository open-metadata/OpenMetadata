package org.openmetadata.service.migration.mysql.v141;

import static org.openmetadata.service.migration.utils.v141.MigrationUtil.migrateAnnouncementsTimeFormat;

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
    migrateAnnouncementsTimeFormat(handle, false);
  }
}
