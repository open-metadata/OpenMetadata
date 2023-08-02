package org.openmetadata.service.migration.versions.postgres.v111;

import static org.openmetadata.service.migration.versions.utils.v110.MigrationUtil.performSqlExecutionAndUpdation;
import static org.openmetadata.service.migration.versions.utils.v111.MigrationUtilV111.removeDuplicateTestCases;
import static org.openmetadata.service.migration.versions.utils.v111.MigrationUtilV111.runTestSuiteMigration;

import java.util.List;
import lombok.SneakyThrows;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.core.Handle;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.MigrationDAO;
import org.openmetadata.service.jdbi3.locator.ConnectionType;
import org.openmetadata.service.migration.MigrationFile;
import org.openmetadata.service.migration.api.MigrationStep;

@Slf4j
@MigrationFile(name = "v111_PostgresMigration")
public class PostgresMigration implements MigrationStep {
  private CollectionDAO collectionDAO;
  private MigrationDAO migrationDAO;
  private Handle handle;

  @Override
  public String getMigrationVersion() {
    return "1.1.1";
  }

  @Override
  public String getMigrationFileName() {
    return "v111_PostgresMigration";
  }

  @Override
  public String getFileUuid() {
    return "a3b76f92-e7cd-461c-90de-e394c91b73d3";
  }

  @Override
  public ConnectionType getDatabaseConnectionType() {
    return ConnectionType.POSTGRES;
  }

  @Override
  public void initialize(Handle handle) {
    this.handle = handle;
    this.collectionDAO = handle.attach(CollectionDAO.class);
    this.migrationDAO = handle.attach(MigrationDAO.class);
  }

  @Override
  public void preDDL() {
    // Update Test Suite to have FqnHash as column instead of nameHash
    List<String> queryList = List.of("ALTER TABLE test_suite RENAME COLUMN nameHash TO fqnHash;");
    performSqlExecutionAndUpdation(this, migrationDAO, handle, queryList);
  }

  @Override
  @SneakyThrows
  public void runDataMigration() {

    String getSql =
        "SELECT t1.id AS id1, t2.id AS id2 FROM test_suite t1 JOIN test_suite t2 ON t1.json -> 'executableEntityReference' -> 'fullyQualifiedName' = t2.json -> 'executableEntityReference' -> 'fullyQualifiedName' AND t1.id != t2.id;";
    removeDuplicateTestCases(collectionDAO, handle, getSql);

    String updateSql = "UPDATE test_suite SET json = :json::jsonb, fqnHash = :fqnHash WHERE id = :id;";
    String resultListSql = "SELECT json FROM test_suite WHERE json -> 'executable' = 'true'";
    runTestSuiteMigration(collectionDAO, handle, getSql, updateSql, resultListSql);
  }

  @Override
  public void postDDL() {}

  @Override
  public void close() {}
}
