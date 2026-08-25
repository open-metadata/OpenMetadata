package org.openmetadata.service.migration.mysql.v130;

import static org.openmetadata.service.migration.utils.v130.MigrationUtil.migrateMongoDBConnStr;

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
    String updateSqlQuery =
        "UPDATE  dbservice_entity de SET json = :json "
            + "WHERE serviceType = 'MongoDB' "
            + "AND id = :id";
    migrateMongoDBConnStr(handle, updateSqlQuery);
  }
}
