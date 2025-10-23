package org.openmetadata.service.migration.api;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.service.util.OpenMetadataOperations.printToAsciiTable;

import java.io.File;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Stream;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
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
}
