package org.openmetadata.service.migration.mysql.v203;

import static org.openmetadata.service.migration.utils.v203.TableAliasesSearchSettingsMigration.addAliasesSearchSettings;

import lombok.SneakyThrows;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.service.migration.api.MigrationProcessImpl;
import org.openmetadata.service.migration.utils.MigrationFile;
import org.openmetadata.service.migration.utils.v203.MigrationUtil;

@Slf4j
public class Migration extends MigrationProcessImpl {

  public Migration(final MigrationFile migrationFile) {
    super(migrationFile);
  }

  @Override
  @SneakyThrows
  public void runDataMigration() {
    MigrationUtil migrationUtil = new MigrationUtil(handle);
    migrationUtil.backfillGlossaryTermRelationCardinality();
    try {
      addAliasesSearchSettings();
    } catch (Exception e) {
      LOG.error("v203: failed to backfill the table 'aliases' search settings", e);
    }
  }
}
