package org.openmetadata.service.migration.mysql.v110;

import static org.openmetadata.service.migration.utils.v110.MigrationUtil.dataMigrationFQNHashing;
import static org.openmetadata.service.migration.utils.v110.MigrationUtil.testSuitesMigration;

import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.core.Handle;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.migration.api.MigrationProcessImpl;
import org.openmetadata.service.migration.utils.MigrationFile;

@Slf4j
@SuppressWarnings("unused")
public class Migration extends MigrationProcessImpl {
  private CollectionDAO collectionDAO;
  private Handle handle;

  public Migration(MigrationFile migrationFile) {
    super(migrationFile);
  }

  @Override
  public void initialize(Handle handle) {
    super.initialize(handle);
    this.handle = handle;
    this.collectionDAO = handle.attach(CollectionDAO.class);
  }

  @Override
  public void runDataMigration() {
    // FQN Hashing Migrations
    String envVariableValue = System.getenv("MIGRATION_LIMIT_PARAM");
    if (envVariableValue != null) {
      dataMigrationFQNHashing(handle, collectionDAO, Integer.parseInt(envVariableValue));
    } else {
      dataMigrationFQNHashing(handle, collectionDAO, 1000);
    }
  }

  @Override
  public void runPostDDLScripts() {
    super.runPostDDLScripts();
    testSuitesMigration(collectionDAO);
  }
}
