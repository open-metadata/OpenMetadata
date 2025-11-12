package org.openmetadata.service.migration.api;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.service.util.EntityUtil.hash;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.core.Handle;
import org.jdbi.v3.core.Jdbi;
import org.openmetadata.schema.api.security.AuthenticationConfiguration;
import org.openmetadata.sdk.PipelineServiceClientInterface;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.clients.pipeline.PipelineServiceClientFactory;
import org.openmetadata.service.governance.workflows.WorkflowHandler;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.MigrationDAO;
import org.openmetadata.service.migration.QueryStatus;
import org.openmetadata.service.migration.context.MigrationContext;
import org.openmetadata.service.migration.context.MigrationOps;
import org.openmetadata.service.migration.utils.MigrationFile;
import org.openmetadata.service.security.auth.SecurityConfigurationManager;

@Slf4j
public class MigrationProcessImpl implements MigrationProcess {
  protected MigrationDAO migrationDAO;
  protected CollectionDAO collectionDAO;
  protected Jdbi jdbi;
  protected Handle handle;
  protected AuthenticationConfiguration authenticationConfiguration;
  private final MigrationFile migrationFile;
  private OpenMetadataApplicationConfig openMetadataApplicationConfig;

  public @Getter MigrationContext context;

  public MigrationProcessImpl(MigrationFile migrationFile) {
    this.migrationFile = migrationFile;
  }

  @Override
  public void initialize(Handle handle, Jdbi jdbi) {
    this.handle = handle;
    this.jdbi = jdbi;
    this.collectionDAO = handle.attach(CollectionDAO.class);
    this.migrationDAO = handle.attach(MigrationDAO.class);
    this.openMetadataApplicationConfig = this.migrationFile.openMetadataApplicationConfig;
    this.authenticationConfiguration = SecurityConfigurationManager.getCurrentAuthConfig();
  }

  public void initializeWorkflowHandler() {
    WorkflowHandler.initialize(openMetadataApplicationConfig);
  }

  public PipelineServiceClientInterface getPipelineServiceClient() {
    if (this.openMetadataApplicationConfig != null) {
      return PipelineServiceClientFactory.createPipelineServiceClient(
          this.openMetadataApplicationConfig.getPipelineServiceClientConfiguration());
    }
    return PipelineServiceClientFactory.createPipelineServiceClient(null);
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
  public String getMigrationsDir() {
    return migrationFile.getDirPath();
  }

  @Override
  public Map<String, QueryStatus> runSchemaChanges(boolean isForceMigration) {
    return performSqlExecutionAndUpdate(
        handle,
        migrationDAO,
        migrationFile.getSchemaChanges(),
        migrationFile.version,
        isForceMigration);
  }

  public static Map<String, QueryStatus> performSqlExecutionAndUpdate(
      Handle handle,
      MigrationDAO migrationDAO,
      List<String> queryList,
      String version,
      boolean isForceMigration) {
    // These are DDL Statements and will cause an Implicit commit even if part of transaction still
    // committed inplace
    Map<String, QueryStatus> queryStatusMap = new HashMap<>();
    if (!nullOrEmpty(queryList)) {
      for (String sql : queryList) {
        try {
          String previouslyRanSql = null;
          try {
            previouslyRanSql = migrationDAO.getSqlQuery(hash(sql), version);
          } catch (Exception dbException) {
            // If SERVER_MIGRATION_SQL_LOGS table doesn't exist yet, assume query hasn't run
            previouslyRanSql = null;
          }

          if ((previouslyRanSql == null || previouslyRanSql.isEmpty())) {
            handle.execute(sql);
            try {
              migrationDAO.upsertServerMigrationSQL(version, sql, hash(sql));
            } catch (Exception logException) {
              // If logging fails (table doesn't exist yet), continue - the SQL was executed
              // successfully
            }
          }
          queryStatusMap.put(
              sql, new QueryStatus(QueryStatus.Status.SUCCESS, "Successfully Executed Query"));
        } catch (Exception e) {
          String message = String.format("Failed to run sql: [%s] due to [%s]", sql, e);
          queryStatusMap.put(sql, new QueryStatus(QueryStatus.Status.FAILURE, message));
          if (!isForceMigration) {
            throw new RuntimeException(message, e);
          }
        }
      }
    }
    return queryStatusMap;
  }

  @Override
  public void runDataMigration() {}

  @Override
  public Map<String, QueryStatus> runPostDDLScripts(boolean isForceMigration) {
    return performSqlExecutionAndUpdate(
        handle,
        migrationDAO,
        migrationFile.getPostDDLScripts(),
        migrationFile.version,
        isForceMigration);
  }

  @Override
  public void close() {
    if (handle != null) {
      handle.close();
    }
  }
}
