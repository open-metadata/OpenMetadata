package org.openmetadata.service.migration.api;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

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
import org.openmetadata.service.migration.utils.MigrationCodeFingerprint;
import org.openmetadata.service.migration.utils.MigrationFile;
import org.openmetadata.service.migration.utils.SqlUnit;
import org.openmetadata.service.security.auth.SecurityConfigurationManager;

@Slf4j
public class MigrationProcessImpl implements MigrationProcess {
  private static final int MAX_LOGGED_STATEMENT_LENGTH = 10000;
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
    WorkflowHandler.initialize(openMetadataApplicationConfig, true);
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
      List<SqlUnit> units,
      String version,
      boolean isForceMigration) {
    // These are DDL Statements and will cause an Implicit commit even if part of transaction still
    // committed inplace
    Map<String, QueryStatus> queryStatusMap = new HashMap<>();
    if (!nullOrEmpty(units)) {
      for (SqlUnit unit : units) {
        try {
          queryStatusMap.put(
              unit.text(), executeUnlessAlreadyRun(handle, migrationDAO, unit, version));
        } catch (Exception e) {
          String message = String.format("Failed to run sql: [%s] due to [%s]", unit.text(), e);
          queryStatusMap.put(unit.text(), new QueryStatus(QueryStatus.Status.FAILURE, message));
          if (!isForceMigration) {
            throw new RuntimeException(message, e);
          }
        }
      }
    }
    return queryStatusMap;
  }

  // A unit's statements run on this one handle, so a guarded block's PREPARE is still there for its
  // EXECUTE. The unit is recorded only after its last statement, so an interrupted block reruns
  // whole.
  private static QueryStatus executeUnlessAlreadyRun(
      Handle handle, MigrationDAO migrationDAO, SqlUnit unit, String version) {
    if (ranInVersion(migrationDAO, unit, version)) {
      LOG.warn(
          "[MigrationWorkflow] Skipping a statement of version {} because identical text already"
              + " ran earlier in this version: {}",
          version,
          unit.text());
      return new QueryStatus(
          QueryStatus.Status.SKIPPED, "Identical statement already executed in version " + version);
    }
    unit.statements().forEach(handle::execute);
    recordExecution(migrationDAO, unit, version);
    return new QueryStatus(QueryStatus.Status.SUCCESS, "Successfully Executed Query");
  }

  private static boolean ranInVersion(MigrationDAO migrationDAO, SqlUnit unit, String version) {
    try {
      return !nullOrEmpty(migrationDAO.getSqlQuery(version, unit.checksum()));
    } catch (Exception dbException) {
      // If SERVER_MIGRATION_SQL_LOGS table doesn't exist yet, assume query hasn't run
      return false;
    }
  }

  private static void recordExecution(MigrationDAO migrationDAO, SqlUnit unit, String version) {
    try {
      migrationDAO.upsertServerMigrationSQL(
          version, truncateToLoggedLength(unit.text()), unit.checksum());
    } catch (Exception logException) {
      // If logging fails (table doesn't exist yet), continue - the SQL was executed successfully
    }
  }

  // SERVER_MIGRATION_SQL_LOGS.sqlStatement holds 10000 characters. Lookups use the checksum of the
  // full text, so only the stored copy is cut.
  static String truncateToLoggedLength(String text) {
    int end = Math.min(text.length(), MAX_LOGGED_STATEMENT_LENGTH);
    if (end < text.length() && Character.isHighSurrogate(text.charAt(end - 1))) {
      end--;
    }
    return text.substring(0, end);
  }

  @Override
  public void runDataMigration() {}

  @Override
  public String getDataMigrationIdentity() {
    return overridesDataMigration() ? MigrationCodeFingerprint.of(getClass()) : null;
  }

  private boolean overridesDataMigration() {
    try {
      return getClass().getMethod("runDataMigration").getDeclaringClass()
          != MigrationProcessImpl.class;
    } catch (NoSuchMethodException e) {
      return false;
    }
  }

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
  public boolean isReprocessing() {
    return migrationFile.isReprocessing();
  }

  @Override
  public boolean hasNewStatements() {
    return migrationFile.hasNewStatements();
  }

  @Override
  public void close() {
    if (handle != null) {
      handle.close();
    }
  }
}
