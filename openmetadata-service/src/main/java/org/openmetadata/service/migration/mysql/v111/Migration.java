package org.openmetadata.service.migration.mysql.v111;

import static org.openmetadata.service.migration.utils.v111.MigrationUtilV111.removeDuplicateTestCases;
import static org.openmetadata.service.migration.utils.v111.MigrationUtilV111.runTestSuiteMigration;

import lombok.SneakyThrows;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.core.Handle;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.migration.api.MigrationProcessImpl;
import org.openmetadata.service.migration.utils.MigrationFile;

@Slf4j
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
    String getSql =
        "SELECT t1.id AS id1, t2.id AS id2 FROM test_suite t1 JOIN test_suite t2 ON JSON_EXTRACT(t1.json, '$.executableEntityReference.fullyQualifiedName') = JSON_EXTRACT(t2.json, '$.executableEntityReference.fullyQualifiedName') AND t1.id != t2.id";
    removeDuplicateTestCases(collectionDAO, handle, getSql);

    String updateSql = "UPDATE test_suite SET json = :json, fqnHash = :fqnHash WHERE id = :id";
    String resultListSql = "select json from test_suite  where JSON_EXTRACT(json, '$.executable') = true";
    runTestSuiteMigration(collectionDAO, handle, getSql, updateSql, resultListSql);
  }
}
