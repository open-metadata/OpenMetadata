package org.openmetadata.service.migration.postgres.v110;

import static org.openmetadata.service.migration.utils.v110.MigrationUtil.dataMigrationFQNHashing;
import static org.openmetadata.service.migration.utils.v110.MigrationUtil.testSuitesMigration;

import java.util.Collections;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.service.migration.QueryStatus;
import org.openmetadata.service.migration.api.MigrationProcessImpl;
import org.openmetadata.service.migration.utils.MigrationFile;

@Slf4j
@SuppressWarnings("unused")
public class Migration extends MigrationProcessImpl {
  public Migration(MigrationFile migrationFile) {
    super(migrationFile);
  }

  @Override
  public void runDataMigration() {
    String envVariableValue = System.getenv("MIGRATION_LIMIT_PARAM");
    if (envVariableValue != null) {
      dataMigrationFQNHashing(handle, collectionDAO, Integer.parseInt(envVariableValue));
    } else {
      dataMigrationFQNHashing(handle, collectionDAO, 1000);
    }
  }

  @Override
  public Map<String, QueryStatus> runPostDDLScripts(boolean isForceMigration) {
    super.runPostDDLScripts(isForceMigration);
    testSuitesMigration(collectionDAO);
    return Collections.emptyMap();
  }
}
