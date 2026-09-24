package org.openmetadata.service.migration.api;

import java.util.List;
import java.util.Map;
import org.jdbi.v3.core.Handle;
import org.jdbi.v3.core.Jdbi;
import org.openmetadata.service.migration.QueryStatus;
import org.openmetadata.service.migration.context.MigrationOps;

/**
 * Migration framework interface that supports two implementation approaches:
 * 1. Native SQL migrations
 * 2. Java-based migrations
 *
 * <p><strong>Migration Execution Order:</strong>
 * Migrations are executed in a specific sequence that must be maintained:
 * <ol>
 *   <li><b>Initialize</b> - Set up migration context, database connections, and services</li>
 *   <li><b>Schema Changes</b> - Execute DDL statements to modify database schema (tables, columns)</li>
 *   <li><b>Data Migration</b> - Run Java code to transform or fix data in the updated schema</li>
 *   <li><b>Post-DDL Scripts</b> - Run final SQL statements that depend on migrated data (indexes, constraints)</li>
 * </ol>
 *
 * <p><strong>IMPORTANT:</strong> For <em>ALL</em> migration types including pure Java migrations,
 * you MUST create the following directory structure in the bootstrap directory:
 *
 * <pre>
 * bootstrap/
 * └── migrations/
 *     └── [version]/        # e.g. "1.2.0"
 *         ├── mysql/
 *         │   ├── schemaChanges.sql             # Can be empty for Java-only migrations
 *         │   └── postDataMigrationSQLScript.sql # Can be empty for Java-only migrations
 *         └── postgres/
 *             ├── schemaChanges.sql             # Can be empty for Java-only migrations
 *             └── postDataMigrationSQLScript.sql # Can be empty for Java-only migrations
 * </pre>
 *
 * <p>The migration discovery process searches for these directories to identify available migrations.
 * Even for pure Java migrations, the directory structure MUST exist - SQL files can be empty but the
 * directory structure is mandatory.
 *
 * <p>Native OpenMetadata Java migrations must follow this naming convention:
 * {@code org.openmetadata.service.migration.[dbPackageName].[versionPackage].Migration}
 * Example: {@code org.openmetadata.service.migration.postgres.v120.Migration}
 *
 * <p>Migrations that ship outside of OpenMetadata (extension migration directories) are resolved
 * by implementations of {@link MigrationProcessExtensionProvider} registered via
 * {@code java.util.ServiceLoader}. When no provider handles a given extension version, the
 * workflow falls back to {@link MigrationProcessImpl} (SQL changes only, no Java data migration).
 *
 * <p>Java migrations should extend {@code MigrationProcessImpl} and override required methods,
 * particularly {@code runDataMigration()} and {@code getMigrationOps()}.
 */
public interface MigrationProcess {
  interface MigrationProcessCallback {
    void call();
  }

  // This version should match the server version
  // Ex: if the server is 1.0.0 the migration version for that server is 1.0.0
  // This version is used to sort all the upgrade migrations and apply them in order

  void initialize(Handle handle, Jdbi jdbi);

  List<MigrationOps> getMigrationOps();

  String getDatabaseConnectionType();

  String getVersion();

  String getMigrationsPath();

  String getSchemaChangesFilePath();

  String getPostDDLScriptFilePath();

  String getMigrationsDir();

  // Handle Non-transactional supported SQLs here Example changes in table struct (DDL
  Map<String, QueryStatus> runSchemaChanges(boolean isForceMigration);

  // This method is to run code to fix any data. Implementations must be idempotent because
  // force mode and continuous reprocessing can invoke it multiple times for the same version.
  void runDataMigration();

  /**
   * Revision of this version's Java data migration. Bump it when the migration's behaviour changes
   * and deployments that already applied the previous revision have to run it again.
   */
  default String getDataMigrationRevision() {
    return "1";
  }

  /**
   * Stable identity of this version's Java data migration, or {@code null} when the version ships
   * no Java work. The workflow records the identity once the migration succeeds, so a version that
   * is reprocessed on every deployment runs its data migration only while that identity is still
   * unrecorded.
   */
  default String getDataMigrationIdentity() {
    return null;
  }

  // This method is to run SQL which can be part of the transaction post data migrations
  Map<String, QueryStatus> runPostDDLScripts(boolean isForceMigration);

  boolean isReprocessing();

  boolean hasNewStatements();

  void close();
}
