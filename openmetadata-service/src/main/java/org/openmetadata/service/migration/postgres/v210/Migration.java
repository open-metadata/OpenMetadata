package org.openmetadata.service.migration.postgres.v210;

import static org.openmetadata.service.migration.utils.v210.MigrationUtil.addAliasesSearchSettings;

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
    // Backfill the 'aliases' searchField/highlightField onto the table assetTypeConfiguration
    // for clusters upgrading from a pre-2.1.0 baseline. See v210.MigrationUtil for why the
    // additive settings merge alone does not reach it.
    addAliasesSearchSettings();
  }
}
