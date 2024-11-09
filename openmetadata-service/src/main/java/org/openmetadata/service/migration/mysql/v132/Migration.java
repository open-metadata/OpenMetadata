package org.openmetadata.service.migration.mysql.v132;

import static org.openmetadata.service.migration.utils.v132.MigrationUtil.migrateDbtConfigType;

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
    String getDbtPipelinesQuery =
        "SELECT * from ingestion_pipeline_entity ipe WHERE JSON_EXTRACT(json, '$.pipelineType') = 'dbt'";
    String updateSqlQuery =
        "UPDATE ingestion_pipeline_entity ipe SET json = :json "
            + "WHERE JSON_EXTRACT(json, '$.pipelineType') = 'dbt'"
            + "AND id = :id";
    migrateDbtConfigType(handle, updateSqlQuery, getDbtPipelinesQuery);
  }
}
