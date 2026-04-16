package org.openmetadata.service.migration.mysql.v1126;

import lombok.SneakyThrows;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.service.migration.api.MigrationProcessImpl;
import org.openmetadata.service.migration.utils.MigrationFile;
import org.openmetadata.service.migration.utils.v1126.MigrationUtil;

@Slf4j
public class Migration extends MigrationProcessImpl {

  public Migration(MigrationFile migrationFile) {
    super(migrationFile);
  }

  @Override
  @SneakyThrows
  public void runDataMigration() {
    try {
      MigrationUtil.migratePipelineServiceEdges(collectionDAO);
    } catch (Exception e) {
      LOG.error(
          "Failed to migrate pipeline service edges in v1126 migration. "
              + "The 'By Service' lineage view for pipeline services may be incomplete "
              + "until a full reindex is performed.",
          e);
    }

    try {
      MigrationUtil.revertWebhookAuthTypeToSecretKey(handle);
    } catch (Exception e) {
      LOG.error("Failed to revert webhook authType to secretKey in v1126 migration.", e);
    }
  }
}
