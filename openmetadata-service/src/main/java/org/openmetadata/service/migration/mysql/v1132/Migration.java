package org.openmetadata.service.migration.mysql.v1132;

import static org.openmetadata.service.migration.utils.v1132.MigrationUtil.fixOwnerDisplayNameAggregation;

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
    fixOwnerDisplayNameAggregation();
  }
}
