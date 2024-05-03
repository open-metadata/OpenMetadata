package org.openmetadata.service.migration.api;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.service.util.EntityUtil.hash;

import java.util.List;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.core.Handle;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.MigrationDAO;
import org.openmetadata.service.migration.context.MigrationContext;
import org.openmetadata.service.migration.context.MigrationOps;
import org.openmetadata.service.migration.utils.MigrationFile;

@Slf4j
public class MigrationProcessImpl implements MigrationProcess {
  protected MigrationDAO migrationDAO;
  protected CollectionDAO collectionDAO;
  protected Handle handle;
  private final MigrationFile migrationFile;

  public @Getter MigrationContext context;

  public MigrationProcessImpl(MigrationFile migrationFile) {
    this.migrationFile = migrationFile;
  }

  @Override
  public void initialize(Handle handle) {
    this.handle = handle;
    this.collectionDAO = handle.attach(CollectionDAO.class);
    this.migrationDAO = handle.attach(MigrationDAO.class);
  }

  @Override
  public List<MigrationOps> getMigrationOps() {
    return List.of();
  }

  @Override
  public String getDatabaseConnectionType() {
    return migrationFile.connectionType.label;
  }

  @Override
  public String getVersion() {
    return migrationFile.version;
  }

  @Override
  public String getMigrationsPath() {
    return migrationFile.getMigrationsFilePath();
  }

  @Override
  public String getSchemaChangesFilePath() {
    return migrationFile.getSchemaChangesFile();
  }

  @Override
  public String getPostDDLScriptFilePath() {
    return migrationFile.getPostDDLScriptFile();
  }

  @Override
  public void runSchemaChanges() {
    performSqlExecutionAndUpdate(
        handle, migrationDAO, migrationFile.getSchemaChanges(), migrationFile.version);
  }

  public static void performSqlExecutionAndUpdate(
      Handle handle, MigrationDAO migrationDAO, List<String> queryList, String version) {
    // These are DDL Statements and will cause an Implicit commit even if part of transaction still
    // committed inplace
    if (!nullOrEmpty(queryList)) {
      for (String sql : queryList) {
        try {
          String previouslyRanSql = migrationDAO.getSqlQuery(hash(sql), version);
          if ((previouslyRanSql == null || previouslyRanSql.isEmpty())) {
            handle.execute(sql);
            migrationDAO.upsertServerMigrationSQL(version, sql, hash(sql));
          }
        } catch (Exception e) {
          String message = String.format("Failed to run sql: [%s] due to [%s]", sql, e);
          throw new RuntimeException(message, e);
        }
      }
    }
  }

  @Override
  public void runDataMigration() {}

  @Override
  public void runPostDDLScripts() {
    performSqlExecutionAndUpdate(
        handle, migrationDAO, migrationFile.getPostDDLScripts(), migrationFile.version);
  }

  @Override
  public void close() {
    if (handle != null) {
      handle.close();
    }
  }
}
