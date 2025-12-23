package org.openmetadata.service.migration.api;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.service.util.EntityUtil.hash;
import static org.openmetadata.service.util.OpenMetadataOperations.printToAsciiTable;

import java.io.File;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Stream;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.flywaydb.core.api.configuration.ClassicConfiguration;
import org.flywaydb.core.api.configuration.Configuration;
import org.flywaydb.core.internal.database.postgresql.PostgreSQLParser;
import org.flywaydb.core.internal.parser.Parser;
import org.flywaydb.core.internal.parser.ParsingContext;
import org.flywaydb.core.internal.resource.filesystem.FileSystemResource;
import org.flywaydb.core.internal.sqlscript.SqlStatementIterator;
import org.flywaydb.database.mysql.MySQLParser;
import org.jdbi.v3.core.Handle;
import org.jdbi.v3.core.Jdbi;
import org.json.JSONObject;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.jdbi3.MigrationDAO;
import org.openmetadata.service.jdbi3.locator.ConnectionType;
import org.openmetadata.service.migration.QueryStatus;
import org.openmetadata.service.migration.context.MigrationContext;
import org.openmetadata.service.migration.context.MigrationWorkflowContext;
import org.openmetadata.service.migration.utils.FlywayMigrationFile;
import org.openmetadata.service.migration.utils.MigrationFile;
import org.openmetadata.service.util.AsciiTable;

@Slf4j
public class MigrationWorkflow {
  public static final String SUCCESS_MSG = "Success";
  public static final String FAILED_MSG = "Failed due to : ";
  public static final String CURRENT = "Current";
  private List<MigrationProcess> migrations;
  private final String nativeSQLScriptRootPath;
  private final ConnectionType connectionType;
  private final String extensionSQLScriptRootPath;
  private final String flywayPath;
  @Getter private final OpenMetadataApplicationConfig openMetadataApplicationConfig;
  private final MigrationDAO migrationDAO;
  private final Jdbi jdbi;
  private final boolean forceMigrations;
  List<String> executedMigrations;
  private Optional<String> currentMaxMigrationVersion;

  public MigrationWorkflow(
      Jdbi jdbi,
      String nativeSQLScriptRootPath,
      ConnectionType connectionType,
      String extensionSQLScriptRootPath,
      String flywayPath,
      OpenMetadataApplicationConfig config,
      boolean forceMigrations) {
    this.jdbi = jdbi;
    this.migrationDAO = jdbi.onDemand(MigrationDAO.class);
    this.forceMigrations = forceMigrations;
    this.nativeSQLScriptRootPath = nativeSQLScriptRootPath;
    this.connectionType = connectionType;
    this.extensionSQLScriptRootPath = extensionSQLScriptRootPath;
    this.flywayPath = flywayPath;
    this.openMetadataApplicationConfig = config;
  }

  public void loadMigrations() {
    // Migrate Flyway history if this is a force migration on an existing database that was
    // previously managed by Flyway. This must happen BEFORE parsing SQL files.
    // 1. Migrate DATABASE_CHANGE_LOG entries to SERVER_CHANGE_LOG
    // 2. Pre-populate SERVER_MIGRATION_SQL_LOGS so flyway queries don't re-execute
    // NOTE: DO NOT REMOVE
    if (hasExistingFlywayHistory()) {
      migrateFlywayToServerChangeLogs();
      prePopulateFlywayMigrationSQLLogs();
    }

    // Sort Migration on the basis of version
    List<MigrationFile> availableMigrations =
        getMigrationFiles(
            nativeSQLScriptRootPath,
            connectionType,
            openMetadataApplicationConfig,
            extensionSQLScriptRootPath,
            flywayPath);
    // Filter Migrations to Be Run
    this.migrations = filterAndGetMigrationsToRun(availableMigrations);
  }

  public void validateMigrationsForServer() {
    if (!migrations.isEmpty()) {
      throw new IllegalStateException(
          "There are pending migrations to be run on the database."
              + " Please backup your data and run `./bootstrap/openmetadata-ops.sh migrate`."
              + " You can find more information on upgrading OpenMetadata at"
              + " https://docs.open-metadata.org/deployment/upgrade ");
    }
  }

  public List<MigrationFile> getMigrationFiles(
      String nativeSQLScriptRootPath,
      ConnectionType connectionType,
      OpenMetadataApplicationConfig config,
      String extensionSQLScriptRootPath,
      String flywayPath) {
    List<MigrationFile> availableOMNativeMigrations =
        getMigrationFilesFromPath(nativeSQLScriptRootPath, connectionType, config, false);

    // Get Flyway migrations first (they should run before native migrations)
    List<FlywayMigrationFile> availableFlywayMigrations =
        FlywayMigrationFile.getFlywayMigrationFiles(
            flywayPath, connectionType, config, migrationDAO);

    // Get extension migrations if available
    List<MigrationFile> availableExtensionMigrations = new ArrayList<>();
    if (extensionSQLScriptRootPath != null && !extensionSQLScriptRootPath.isEmpty()) {
      availableExtensionMigrations =
          getMigrationFilesFromPath(extensionSQLScriptRootPath, connectionType, config, true);
    }

    /*
     Combined execution order:
       1. Flyway migrations (legacy SQL files from Flyway)
       2. OpenMetadata native migrations
       3. Extension migrations
     All sorted by version within their respective groups
    */
    return Stream.of(
            availableFlywayMigrations.stream().map(f -> (MigrationFile) f),
            availableOMNativeMigrations.stream(),
            availableExtensionMigrations.stream())
        .flatMap(stream -> stream)
        .sorted()
        .toList();
  }

  public List<MigrationFile> getMigrationFilesFromPath(
      String path,
      ConnectionType connectionType,
      OpenMetadataApplicationConfig config,
      Boolean isExtension) {
    return Arrays.stream(Objects.requireNonNull(new File(path).listFiles(File::isDirectory)))
        .map(dir -> new MigrationFile(dir, migrationDAO, connectionType, config, isExtension))
        .sorted()
        .toList();
  }

  private List<MigrationProcess> filterAndGetMigrationsToRun(
      List<MigrationFile> availableMigrations) {
    LOG.debug("Filtering Server Migrations");
    try {
      executedMigrations = migrationDAO.getMigrationVersions();
    } catch (Exception e) {
      // SERVER_CHANGE_LOG table doesn't exist yet, run all migrations including Flyway
      LOG.info(
          "SERVER_CHANGE_LOG table doesn't exist yet, will run all migrations including Flyway");
      executedMigrations = new ArrayList<>();
    }
    currentMaxMigrationVersion =
        executedMigrations.stream().max(MigrationWorkflow::compareVersions);
    List<MigrationFile> applyMigrations;
    if (!nullOrEmpty(executedMigrations) && !forceMigrations) {
      applyMigrations = getMigrationsToApply(executedMigrations, availableMigrations);
    } else {
      applyMigrations = availableMigrations;
    }
    List<MigrationProcess> processes = new ArrayList<>();
    try {
      for (MigrationFile file : applyMigrations) {
        file.parseSQLFiles();
        String extClazzName = null;
        if (file.version.contains("collate")) {
          extClazzName = file.getMigrationProcessExtClassName();
        }
        if (extClazzName != null) {
          MigrationProcess collateProcess =
              (MigrationProcess)
                  Class.forName(extClazzName).getConstructor(MigrationFile.class).newInstance(file);
          processes.add(collateProcess);
        } else {
          String clazzName = file.getMigrationProcessClassName();
          MigrationProcess openMetadataProcess =
              (MigrationProcess)
                  Class.forName(clazzName).getConstructor(MigrationFile.class).newInstance(file);
          processes.add(openMetadataProcess);
        }
      }
    } catch (Exception e) {
      LOG.error("Failed to list and add migrations to run due to ", e);
    }
    return processes;
  }

  private static int compareVersions(String version1, String version2) {
    int[] v1Parts = parseVersion(version1);
    int[] v2Parts = parseVersion(version2);

    int length = Math.max(v1Parts.length, v2Parts.length);
    for (int i = 0; i < length; i++) {
      int part1 = i < v1Parts.length ? v1Parts[i] : 0;
      int part2 = i < v2Parts.length ? v2Parts[i] : 0;
      if (part1 != part2) {
        return Integer.compare(part1, part2);
      }
    }
    return 0; // Versions are equal
  }

  /*
   * Parse a version string into an array of integers
   * Follows the format major.minor.patch, patch can contain -extension
   */
  private static int[] parseVersion(String version) {
    String[] parts = version.split("\\.");
    int[] numbers = new int[parts.length];
    // Major
    numbers[0] = Integer.parseInt(parts[0]);

    // Minor
    numbers[1] = Integer.parseInt(parts[1]);

    // Patch can contain -extension
    if (parts[2].contains("-")) {
      String[] extensionParts = parts[2].split("-");
      numbers[2] = Integer.parseInt(extensionParts[0]);
    } else {
      numbers[2] = Integer.parseInt(parts[2]);
    }
    return numbers;
  }

  /**
   * We'll take the max from native migrations and double-check if there's any extension migration
   * pending to be applied
   */
  public List<MigrationFile> getMigrationsToApply(
      List<String> executedMigrations, List<MigrationFile> availableMigrations) {
    List<MigrationFile> migrationsToApply = new ArrayList<>();
    List<MigrationFile> nativeMigrationsToApply =
        processNativeMigrations(executedMigrations, availableMigrations);
    List<MigrationFile> extensionMigrationsToApply =
        processExtensionMigrations(executedMigrations, availableMigrations);

    migrationsToApply.addAll(nativeMigrationsToApply);
    migrationsToApply.addAll(extensionMigrationsToApply);
    return migrationsToApply;
  }

  private List<MigrationFile> processNativeMigrations(
      List<String> executedMigrations, List<MigrationFile> availableMigrations) {
    Stream<MigrationFile> availableNativeMigrations =
        availableMigrations.stream().filter(migration -> !migration.isExtension);
    Optional<String> maxMigration =
        executedMigrations.stream().max(MigrationWorkflow::compareVersions);
    if (maxMigration.isPresent()) {
      return availableNativeMigrations
          .filter(migration -> migration.biggerThan(maxMigration.get()))
          .toList();
    }
    return availableNativeMigrations.toList();
  }

  private List<MigrationFile> processExtensionMigrations(
      List<String> executedMigrations, List<MigrationFile> availableMigrations) {
    return availableMigrations.stream()
        .filter(migration -> migration.isExtension)
        .filter(migration -> !executedMigrations.contains(migration.version))
        .toList();
  }

  public void printMigrationInfo() {
    LOG.info("Following Migrations will be performed, with Force Migration : {}", forceMigrations);
    List<String> columns = Arrays.asList("Version", "ConnectionType", "MigrationsFilePath");
    List<List<String>> allRows = new ArrayList<>();
    for (MigrationProcess process : migrations) {
      List<String> row = new ArrayList<>();
      row.add(process.getVersion());
      row.add(process.getDatabaseConnectionType());
      row.add(process.getMigrationsPath());
      allRows.add(row);
    }
    printToAsciiTable(columns.stream().toList(), allRows, "No Server Migration To be Run");
  }

  /**
   * Run the Migration Workflow
   * @param computeAllContext If true, compute the context for each executed migration. Otherwise, we'll only compute
   *                          the context for the initial and last state of the database.
   */
  public void runMigrationWorkflows(boolean computeAllContext) {
    List<String> columns =
        Arrays.asList(
            "Version",
            "Initialization",
            "SchemaChanges",
            "DataMigration",
            "PostDDLScripts",
            "Context");
    List<List<String>> allRows = new ArrayList<>();
    try (Handle transactionHandler = jdbi.open()) {
      MigrationWorkflowContext context = new MigrationWorkflowContext(transactionHandler);
      String currentVersion = currentMaxMigrationVersion.orElse(CURRENT);
      LOG.debug("Current Max version {}", currentVersion);
      // Add the current version context
      context.computeInitialContext(currentVersion);
      allRows.add(
          List.of(
              currentVersion,
              CURRENT,
              CURRENT,
              CURRENT,
              CURRENT,
              context.getMigrationContext().get(currentVersion).getResults().toString()));
      LOG.info("[MigrationWorkflow] WorkFlow Started");
      try {
        for (MigrationProcess process : migrations) {
          // Initialise Migration Steps
          LOG.info(
              "[MigrationWorkFlow] Migration Run started for Version: {}, with Force Migration : {}",
              process.getVersion(),
              forceMigrations);

          List<String> row = new ArrayList<>();
          row.add(process.getVersion());
          try {
            // Initialize
            runStepAndAddStatus(row, () -> process.initialize(transactionHandler, jdbi));

            // Schema Changes
            runSchemaChanges(row, process);

            // Data Migration
            runStepAndAddStatus(row, process::runDataMigration);

            // Post DDL Scripts
            runPostDDLChanges(row, process);

            // Build Context only if required (during ops), or if it's the last migration
            context.computeMigrationContext(
                process, computeAllContext || migrations.indexOf(process) == migrations.size() - 1);
            row.add(
                context.getMigrationContext().get(process.getVersion()).getResults().toString());

            // Handle Migration Closure
            updateMigrationStepInDB(process, context);
          } finally {
            allRows.add(row);
            LOG.info(
                "[MigrationWorkFlow] Migration Run finished for Version: {}", process.getVersion());
          }
        }
        printToAsciiTable(columns, allRows, "Status Unavailable");
      } catch (Exception e) {
        // Any Exception catch the error
        LOG.error("Encountered Exception in MigrationWorkflow", e);
        throw e;
      }
    }
    LOG.info("[MigrationWorkflow] WorkFlow Completed");
  }

  private void runSchemaChanges(List<String> row, MigrationProcess process) {
    try {
      List<String> schemaChangesColumns = Arrays.asList("Query", "Query Status");
      Map<String, QueryStatus> queryStatusMap = process.runSchemaChanges(forceMigrations);
      List<List<String>> allSchemaChangesRows =
          new ArrayList<>(
              queryStatusMap.entrySet().stream()
                  .map(
                      entry ->
                          Arrays.asList(
                              entry.getKey(),
                              String.format(
                                  "Status : %s , Message: %s",
                                  entry.getValue().getStatus(), entry.getValue().getMessage())))
                  .toList());
      LOG.info(
          "[MigrationWorkflow] Version : {} Run Schema Changes Query Status", process.getVersion());
      LOG.debug(
          new AsciiTable(schemaChangesColumns, allSchemaChangesRows, true, "", "No New Queries")
              .render());
      row.add(SUCCESS_MSG);
    } catch (Exception e) {
      row.add(FAILED_MSG + e.getMessage());
      if (!forceMigrations) {
        throw e;
      }
    }
  }

  private void runPostDDLChanges(List<String> row, MigrationProcess process) {
    try {
      List<String> schemaChangesColumns = Arrays.asList("Query", "Query Status");
      Map<String, QueryStatus> queryStatusMap = process.runPostDDLScripts(forceMigrations);
      List<List<String>> allSchemaChangesRows =
          new ArrayList<>(
              queryStatusMap.entrySet().stream()
                  .map(
                      entry ->
                          Arrays.asList(
                              entry.getKey(),
                              String.format(
                                  "Status : %s , Message: %s",
                                  entry.getValue().getStatus(), entry.getValue().getMessage())))
                  .toList());
      LOG.info("[MigrationWorkflow] Version : {} Run Post DDL Query Status", process.getVersion());
      LOG.debug(
          new AsciiTable(schemaChangesColumns, allSchemaChangesRows, true, "", "No New Queries")
              .render());
      row.add(SUCCESS_MSG);
    } catch (Exception e) {
      row.add(FAILED_MSG + e.getMessage());
      if (!forceMigrations) {
        throw e;
      }
    }
  }

  private void runStepAndAddStatus(
      List<String> row, MigrationProcess.MigrationProcessCallback process) {
    try {
      process.call();
      row.add(SUCCESS_MSG);
    } catch (Exception e) {
      row.add(FAILED_MSG + e.getMessage());
      if (!forceMigrations) {
        throw e;
      }
    }
  }

  public void updateMigrationStepInDB(
      MigrationProcess step, MigrationWorkflowContext workflowContext) {
    MigrationContext context = workflowContext.getMigrationContext().get(step.getVersion());
    JSONObject metrics = new JSONObject(context.getResults());
    migrationDAO.upsertServerMigration(
        step.getVersion(),
        step.getMigrationsPath(),
        UUID.randomUUID().toString(),
        metrics.toString());
  }

  private boolean hasExistingFlywayHistory() {
    try (Handle handle = jdbi.open()) {
      String checkTableQuery =
          connectionType == ConnectionType.MYSQL
              ? "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'DATABASE_CHANGE_LOG'"
              : "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = current_schema() AND table_name = 'DATABASE_CHANGE_LOG'";

      Integer tableExists = handle.createQuery(checkTableQuery).mapTo(Integer.class).one();
      if (tableExists == null || tableExists == 0) {
        return false;
      }

      String countQuery =
          connectionType == ConnectionType.MYSQL
              ? "SELECT COUNT(*) FROM DATABASE_CHANGE_LOG WHERE success = true"
              : "SELECT COUNT(*) FROM \"DATABASE_CHANGE_LOG\" WHERE success = true";

      Integer count = handle.createQuery(countQuery).mapTo(Integer.class).one();
      return count != null && count > 0;
    } catch (Exception e) {
      LOG.debug("Error checking for existing Flyway history: {}", e.getMessage());
      return false;
    }
  }

  private void migrateFlywayToServerChangeLogs() {
    LOG.info("Migrating Flyway history from DATABASE_CHANGE_LOG to SERVER_CHANGE_LOG");

    try (Handle handle = jdbi.open()) {
      // Check if Flyway records have already been migrated
      String checkMigratedQuery =
          connectionType == ConnectionType.MYSQL
              ? """
              SELECT COUNT(*) FROM SERVER_CHANGE_LOG scl
              INNER JOIN DATABASE_CHANGE_LOG dcl ON CONCAT('0.0.', CAST(dcl.version AS UNSIGNED)) = scl.version
              WHERE scl.migrationfilename LIKE '%flyway%'
              """
              : """
              SELECT COUNT(*) FROM SERVER_CHANGE_LOG scl
              INNER JOIN "DATABASE_CHANGE_LOG" dcl ON '0.0.' || CAST(dcl.version AS INTEGER) = scl.version
              WHERE scl.migrationfilename LIKE '%flyway%'
              """;

      try {
        Integer alreadyMigrated = handle.createQuery(checkMigratedQuery).mapTo(Integer.class).one();
        if (alreadyMigrated != null && alreadyMigrated > 0) {
          LOG.info("Flyway records already migrated to SERVER_CHANGE_LOG, skipping");
          return;
        }
      } catch (Exception e) {
        // SERVER_CHANGE_LOG might not exist yet, continue with migration
        LOG.debug("Could not check if already migrated: {}", e.getMessage());
      }

      // Insert v0.0.0 baseline record if not present
      String insertBaselineQuery =
          connectionType == ConnectionType.MYSQL
              ? """
              INSERT IGNORE INTO SERVER_CHANGE_LOG (version, migrationfilename, checksum, installed_on, metrics)
              VALUES ('0.0.0', 'bootstrap/sql/migrations/flyway/com.mysql.cj.jdbc.Driver/v000__create_server_change_log.sql', '0', NOW(), NULL)
              """
              : """
              INSERT INTO SERVER_CHANGE_LOG (version, migrationfilename, checksum, installed_on, metrics)
              VALUES ('0.0.0', 'bootstrap/sql/migrations/flyway/org.postgresql.Driver/v000__create_server_change_log.sql', '0', current_timestamp, NULL)
              ON CONFLICT (version) DO NOTHING
              """;

      try {
        handle.createUpdate(insertBaselineQuery).execute();
      } catch (Exception e) {
        LOG.debug("Could not insert baseline record: {}", e.getMessage());
      }

      // Migrate Flyway migration records to SERVER_CHANGE_LOG
      String dbDir = connectionType == ConnectionType.MYSQL ? "mysql" : "postgres";
      String insertQuery =
          connectionType == ConnectionType.MYSQL
              ? String.format(
                  """
                  INSERT INTO SERVER_CHANGE_LOG (version, migrationfilename, checksum, installed_on, metrics)
                  SELECT CONCAT('0.0.', CAST(version AS UNSIGNED)) as version,
                         CASE
                           WHEN script LIKE 'v%%__.sql' THEN CONCAT('bootstrap/sql/migrations/flyway/%s/', script)
                           ELSE CONCAT('bootstrap/sql/migrations/flyway/%s/v', version, '__', REPLACE(LOWER(description), ' ', '_'), '.sql')
                         END as migrationfilename,
                         '0' as checksum,
                         installed_on,
                         NULL as metrics
                  FROM DATABASE_CHANGE_LOG
                  WHERE CONCAT('0.0.', CAST(version AS UNSIGNED)) NOT IN (SELECT version FROM SERVER_CHANGE_LOG)
                  AND success = true
                  """,
                  "com.mysql.cj.jdbc.Driver", "com.mysql.cj.jdbc.Driver")
              : String.format(
                  """
                  INSERT INTO SERVER_CHANGE_LOG (version, migrationfilename, checksum, installed_on, metrics)
                  SELECT '0.0.' || CAST(version AS INTEGER) as version,
                         CASE
                           WHEN script LIKE 'v%%__.sql' THEN 'bootstrap/sql/migrations/flyway/%s/' || script
                           ELSE 'bootstrap/sql/migrations/flyway/%s/v' || version || '__' || REPLACE(LOWER(description), ' ', '_') || '.sql'
                         END as migrationfilename,
                         '0' as checksum,
                         installed_on,
                         NULL as metrics
                  FROM "DATABASE_CHANGE_LOG"
                  WHERE '0.0.' || CAST(version AS INTEGER) NOT IN (SELECT version FROM SERVER_CHANGE_LOG)
                  AND success = true
                  """,
                  "org.postgresql.Driver", "org.postgresql.Driver");

      int migratedCount = handle.createUpdate(insertQuery).execute();
      LOG.info("Migrated {} Flyway records to SERVER_CHANGE_LOG", migratedCount);

      // Drop the old DATABASE_CHANGE_LOG table after successful migration
      String dropTableQuery =
          connectionType == ConnectionType.MYSQL
              ? "DROP TABLE IF EXISTS DATABASE_CHANGE_LOG"
              : "DROP TABLE IF EXISTS \"DATABASE_CHANGE_LOG\"";

      try {
        handle.createUpdate(dropTableQuery).execute();
        LOG.info("Dropped legacy DATABASE_CHANGE_LOG table");
      } catch (Exception e) {
        LOG.warn("Could not drop DATABASE_CHANGE_LOG table: {}", e.getMessage());
      }

    } catch (Exception e) {
      LOG.error("Error during Flyway history migration to SERVER_CHANGE_LOG", e);
    }
  }

  private void prePopulateFlywayMigrationSQLLogs() {
    LOG.info("Pre-populating SERVER_MIGRATION_SQL_LOGS with existing Flyway SQL statements");

    if (flywayPath == null || flywayPath.isEmpty()) {
      return;
    }

    String dbSubDir =
        connectionType == ConnectionType.MYSQL
            ? "com.mysql.cj.jdbc.Driver"
            : "org.postgresql.Driver";
    File flywayDir = new File(flywayPath, dbSubDir);

    if (!flywayDir.exists() || !flywayDir.isDirectory()) {
      LOG.info("Flyway migration directory does not exist: {}", flywayDir.getPath());
      return;
    }

    File[] sqlFiles = flywayDir.listFiles((dir, name) -> name.endsWith(".sql"));
    if (sqlFiles == null || sqlFiles.length == 0) {
      return;
    }

    Pattern versionPattern = Pattern.compile("v(\\d+)__.*\\.sql");
    ParsingContext parsingContext = new ParsingContext();
    Configuration configuration = new ClassicConfiguration();
    Parser parser =
        connectionType == ConnectionType.MYSQL
            ? new MySQLParser(configuration, parsingContext)
            : new PostgreSQLParser(configuration, parsingContext);

    int totalStatements = 0;
    for (File sqlFile : sqlFiles) {
      Matcher matcher = versionPattern.matcher(sqlFile.getName());
      if (!matcher.matches()) {
        continue;
      }

      String flywayVersion = matcher.group(1);
      // Parse as integer to remove leading zeros (e.g., "001" -> 1)
      String omVersion = "0.0." + Integer.parseInt(flywayVersion);

      try (SqlStatementIterator iterator =
          parser.parse(
              new FileSystemResource(
                  null, sqlFile.getAbsolutePath(), StandardCharsets.UTF_8, true))) {
        while (iterator.hasNext()) {
          String sql = iterator.next().getSql();
          if (sql != null && !sql.isBlank()) {
            String checksum = hash(sql);
            try {
              String existingQuery = migrationDAO.checkIfQueryPreviouslyRan(checksum);
              if (existingQuery == null) {
                migrationDAO.upsertServerMigrationSQL(omVersion, sql, checksum);
                totalStatements++;
              }
            } catch (Exception e) {
              LOG.debug(
                  "Error inserting SQL statement from {}: {}", sqlFile.getName(), e.getMessage());
            }
          }
        }
      } catch (Exception e) {
        LOG.warn("Failed to parse SQL file {}: {}", sqlFile.getName(), e.getMessage());
      }
    }

    LOG.info(
        "Pre-populated {} Flyway SQL statements into SERVER_MIGRATION_SQL_LOGS", totalStatements);
  }
}
