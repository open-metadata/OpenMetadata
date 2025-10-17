package org.openmetadata.service.migration.postgres.v1110;

import static org.openmetadata.service.migration.utils.v1110.MigrationUtil.migrateTestCaseDataContractReferences;

import lombok.SneakyThrows;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.service.migration.utils.MigrationFile;
import org.openmetadata.service.migration.utils.v1110.MigrationProcessBase;

@Slf4j
public class Migration extends MigrationProcessBase {
  public Migration(MigrationFile migrationFile) {
    super(migrationFile);
  }

  @Override
  protected String getQueryFormat() {
    return "UPDATE tag SET json = jsonb_set(json, '{recognizers}', '%s'::jsonb) "
        + "WHERE json->>'fullyQualifiedName' = '%s'";
  }

  @Override
  @SneakyThrows
  public void runDataMigration() {
    migrateTestCaseDataContractReferences(collectionDAO);
  }
}
