package org.openmetadata.service.migration.mysql.v117;

import static org.openmetadata.service.migration.utils.V114.MigrationUtil.fixTestSuites;
import static org.openmetadata.service.migration.utils.V117.MigrationUtil.fixTestCases;

import lombok.SneakyThrows;
import org.jdbi.v3.core.Handle;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.migration.api.MigrationProcessImpl;
import org.openmetadata.service.migration.utils.MigrationFile;

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
  @SneakyThrows
  public void runDataMigration() {
    // testcases coming from dbt for case-sensitive services are not properly linked to a table
    fixTestCases(handle, collectionDAO);
    // Try again the 1.1.6 test suite migration
    fixTestSuites(collectionDAO);
  }
}
