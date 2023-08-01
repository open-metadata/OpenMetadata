package org.openmetadata.service.migration.versions.mysql.v111;

import static org.openmetadata.service.migration.versions.utils.v111.MigrationUtilV111.removeDuplicateTestCases;
import static org.openmetadata.service.migration.versions.utils.v111.MigrationUtilV111.runTestSuiteMigration;

import lombok.SneakyThrows;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.core.Handle;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.MigrationDAO;
import org.openmetadata.service.jdbi3.locator.ConnectionType;
import org.openmetadata.service.migration.MigrationFile;
import org.openmetadata.service.migration.api.MigrationStep;

@Slf4j
@MigrationFile(name = "v111_MySQLMigration")
public class MySQLMigration implements MigrationStep {
  private CollectionDAO collectionDAO;
  private MigrationDAO migrationDAO;
  private Handle handle;

  @Override
  public String getMigrationVersion() {
    return "1.1.1";
  }

  @Override
  public String getMigrationFileName() {
    return "v111_MySQLMigration";
  }

  @Override
  public String getFileUuid() {
    return "b5ba61a5-f4e7-48f0-8702-770c1af5757a";
  }

  @Override
  public ConnectionType getDatabaseConnectionType() {
    return ConnectionType.MYSQL;
  }

  @Override
  public void initialize(Handle handle) {
    this.handle = handle;
    this.collectionDAO = handle.attach(CollectionDAO.class);
    this.migrationDAO = handle.attach(MigrationDAO.class);
  }

  @Override
  public void preDDL() {}

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

  @Override
  public void postDDL() {}

  @Override
  public void close() {}
}
