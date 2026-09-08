package org.openmetadata.service.migration.mysql.v1135;

import static org.openmetadata.service.migration.utils.v1135.DataInsightChartMigration.alignDataAssetChartScope;

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
      alignDataAssetChartScope();
    } catch (Exception e) {
      LOG.error("v1135: failed to align the data asset scope of the Data Insights charts", e);
    }
  }
}
