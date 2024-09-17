package org.openmetadata.service.migration.postgres.v111;

import static org.openmetadata.service.migration.utils.v111.MigrationUtilV111.removeDuplicateTestCases;
import static org.openmetadata.service.migration.utils.v111.MigrationUtilV111.runTestSuiteMigration;

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
    String getSql =
        "SELECT t1.id AS id1, t2.id AS id2 FROM test_suite t1 JOIN test_suite t2 ON t1.json -> 'executableEntityReference' -> 'fullyQualifiedName' = t2.json -> 'executableEntityReference' -> 'fullyQualifiedName' AND t1.id != t2.id;";
    removeDuplicateTestCases(collectionDAO, handle, getSql);

    String updateSql =
        "UPDATE test_suite SET json = :json::jsonb, fqnHash = :fqnHash WHERE id = :id;";
    String resultListSql = "SELECT json FROM test_suite WHERE json -> 'executable' = 'true'";
    runTestSuiteMigration(collectionDAO, handle, getSql, updateSql, resultListSql);
  }
}
