package org.openmetadata.service.migration.mysql.v1136;

import static org.openmetadata.service.migration.utils.v1136.TableAliasesSearchSettingsMigration.addAliasesSearchSettings;

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
    // Log and continue rather than abort: alias search degrades to not matching synonyms, which
    // is not worth failing an upgrade over.
    try {
      addAliasesSearchSettings();
    } catch (Exception e) {
      LOG.error("v1136: failed to backfill the table 'aliases' search settings", e);
    }
  }
}
