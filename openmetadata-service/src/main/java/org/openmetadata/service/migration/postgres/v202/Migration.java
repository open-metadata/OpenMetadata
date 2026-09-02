package org.openmetadata.service.migration.postgres.v202;

import static org.openmetadata.service.migration.utils.v202.TableAliasesSearchSettingsMigration.addAliasesSearchSettings;

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
    // is not worth failing an upgrade over. Matches v201's pattern.
    try {
      addAliasesSearchSettings();
    } catch (Exception e) {
      LOG.error("v202: failed to backfill the table 'aliases' search settings", e);
    }
  }
}
