package org.openmetadata.service.migration.postgres.v1110;

import java.util.Map;
import lombok.SneakyThrows;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.service.jdbi3.locator.ConnectionType;
import org.openmetadata.service.migration.QueryStatus;
import org.openmetadata.service.migration.api.MigrationProcessImpl;
import org.openmetadata.service.migration.utils.MigrationFile;
import org.openmetadata.service.migration.utils.v1110.MigrationUtil;

@Slf4j
public class Migration extends MigrationProcessImpl {
  private final MigrationUtil migrationUtil;

  public Migration(MigrationFile migrationFile) {
    super(migrationFile);
    this.migrationUtil = new MigrationUtil(ConnectionType.POSTGRES, migrationFile);
  }

  @Override
  public Map<String, QueryStatus> runPostDDLScripts(boolean isForceMigration) {
    Map<String, QueryStatus> result = super.runPostDDLScripts(isForceMigration);
    result.putAll(
        migrationUtil.setRecognizersForSensitiveTags(
            "UPDATE tag SET json = jsonb_set(json, '{recognizers}', ?::jsonb) "
                + "WHERE json->>'fullyQualifiedName' = ?",
            handle,
            migrationDAO,
            isForceMigration));
    return result;
  }

  @Override
  @SneakyThrows
  public void runDataMigration() {
    this.migrationUtil.migrateFlywayHistory(handle);
  }
}
