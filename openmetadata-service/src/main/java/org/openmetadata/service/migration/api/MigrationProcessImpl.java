package org.openmetadata.service.migration.api;

import static org.openmetadata.service.migration.utils.v110.MigrationUtil.performSqlExecutionAndUpdate;

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
  private CollectionDAO collectionDAO;
  private MigrationDAO migrationDAO;
  private Handle handle;
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
    return migrationFile.connectionType.toString();
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
    performSqlExecutionAndUpdate(handle, migrationDAO, migrationFile.getSchemaChanges(), migrationFile.version);
  }

  @Override
  public void runDataMigration() {}

  @Override
  public void runPostDDLScripts() {
    performSqlExecutionAndUpdate(handle, migrationDAO, migrationFile.getPostDDLScripts(), migrationFile.version);
  }

  @Override
  public void close() {
    if (handle != null) {
      handle.close();
    }
  }
}
