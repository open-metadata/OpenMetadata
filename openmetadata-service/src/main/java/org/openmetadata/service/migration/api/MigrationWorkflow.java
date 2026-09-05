package org.openmetadata.service.migration.api;

import static java.util.stream.Collectors.toSet;
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.service.util.OpenMetadataOperations.printToAsciiTable;

import java.io.File;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.ServiceLoader;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Stream;
import java.util.stream.StreamSupport;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.core.Handle;
import org.jdbi.v3.core.Jdbi;
import org.json.JSONObject;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.jdbi3.MigrationDAO;
import org.openmetadata.service.jdbi3.locator.ConnectionType;
import org.openmetadata.service.migration.QueryStatus;
import org.openmetadata.service.migration.baseline.BaselineFiles;
import org.openmetadata.service.migration.baseline.BaselineWorkflow;
import org.openmetadata.service.migration.baseline.BaselineWorkflow.BaselineAction;
import org.openmetadata.service.migration.context.MigrationContext;
import org.openmetadata.service.migration.context.MigrationWorkflowContext;
import org.openmetadata.service.migration.utils.MigrationFile;
import org.openmetadata.service.migration.utils.MigrationHistoryTable;
import org.openmetadata.service.migration.utils.MigrationHistoryTable.MigrationStatus;
import org.openmetadata.service.migration.utils.MigrationHistoryTable.MigrationType;
import org.openmetadata.service.migration.utils.MigrationHistoryTableUpgrader;
import org.openmetadata.service.migration.utils.MigrationVersionUtil;
import org.openmetadata.service.util.AsciiTable;

@Slf4j
public class MigrationWorkflow {
  public static final String SUCCESS_MSG = "Success";
  public static final String FAILED_MSG = "Failed due to : ";
  public static final String SKIPPED_MSG = "Skipped";
  public static final String CURRENT = "Current";
  public static final String UPGRADE_GATE_ERROR =
      "This OpenMetadata release cannot migrate the database directly: it must be on "
          + MigrationVersionUtil.MINIMUM_SUPPORTED_MIGRATION_VERSION
          + " or later first. Upgrade to the latest 2.0.x release and run"
          + " `./bootstrap/openmetadata-ops.sh migrate` there, then upgrade to this release."
          + " See https://docs.open-metadata.org/deployment/upgrade";
  private static final String BASELINE_DIRECTORY_NAME = "baseline";
  private static final String FLYWAY_HISTORY_TABLE = "DATABASE_CHANGE_LOG";
  private List<MigrationProcess> migrations;
  private final String nativeSQLScriptRootPath;
  private final ConnectionType connectionType;
  private final String extensionSQLScriptRootPath;
  @Getter private final OpenMetadataApplicationConfig openMetadataApplicationConfig;
  private final MigrationDAO migrationDAO;
  private final Jdbi jdbi;
  private final boolean forceMigrations;
  List<String> executedMigrations;
  private Optional<String> currentMaxMigrationVersion;
  private final BaselineWorkflow baselineWorkflow;
  private final MigrationHistoryTableUpgrader historyTableUpgrader;
  private BaselineAction baselineAction = BaselineAction.DISABLED;

  /**
   * Versions supplied by extension migration directories. {@link MigrationProcess} does not carry
   * that distinction, but the history row needs it to label the step.
   */
  private final Set<String> extensionVersions = new HashSet<>();

  public MigrationWorkflow(
      Jdbi jdbi,
      String nativeSQLScriptRootPath,
      ConnectionType connectionType,
      String extensionSQLScriptRootPath,
      OpenMetadataApplicationConfig config,
      boolean forceMigrations) {
    this.jdbi = jdbi;
    this.migrationDAO = jdbi.onDemand(MigrationDAO.class);
    this.forceMigrations = forceMigrations;
    this.nativeSQLScriptRootPath = nativeSQLScriptRootPath;
    this.connectionType = connectionType;
    this.extensionSQLScriptRootPath = extensionSQLScriptRootPath;
    this.openMetadataApplicationConfig = config;
    this.historyTableUpgrader = new MigrationHistoryTableUpgrader(jdbi, connectionType);
    this.baselineWorkflow = buildBaselineWorkflow();
  }

  /**
   * @param ignoredFlywayPath no longer used — the legacy Flyway scripts and their replay path are
   *     gone.
   * @deprecated use the six-argument constructor. Retained so downstream builds that still pass a
   *     Flyway path keep compiling; this repository is a library for them, and dropping a public
   *     constructor parameter would otherwise break their build before they can adapt.
   */
  @Deprecated(forRemoval = true)
  public MigrationWorkflow(
      Jdbi jdbi,
      String nativeSQLScriptRootPath,
      ConnectionType connectionType,
      String extensionSQLScriptRootPath,
      String ignoredFlywayPath,
      OpenMetadataApplicationConfig config,
      boolean forceMigrations) {
    this(
        jdbi,
        nativeSQLScriptRootPath,
        connectionType,
        extensionSQLScriptRootPath,
        config,
        forceMigrations);
  }

  /**
   * The baseline and the upgrade gate are production concerns, keyed off the presence of a
   * migration configuration. Tests that drive the engine directly with synthetic version
   * directories pass no configuration and are therefore exempt, which is what lets them keep using
   * 1.x and 0.x versions that the gate would otherwise reject.
   */
  private BaselineWorkflow buildBaselineWorkflow() {
    BaselineWorkflow result = null;
    if (openMetadataApplicationConfig != null
        && openMetadataApplicationConfig.getMigrationConfiguration() != null) {
      BaselineFiles baselineFiles = new BaselineFiles(resolveBaselinePath(), connectionType);
      result = new BaselineWorkflow(jdbi, connectionType, baselineFiles);
    }
    return result;
  }

  /**
   * Configured path wins; otherwise the baseline sits beside the native migrations, so callers that
   * point the workflow at a non-default native root (the integration-test bootstrap does) find the
   * matching baseline without extra configuration.
   */
  private String resolveBaselinePath() {
    String configured = openMetadataApplicationConfig.getMigrationConfiguration().getBaselinePath();
    String result = configured;
    if (nullOrEmpty(configured)) {
      File nativeParent = new File(nativeSQLScriptRootPath).getAbsoluteFile().getParentFile();
      result = new File(nativeParent, BASELINE_DIRECTORY_NAME).getPath();
    }
    return result;
  }

  public void loadMigrations() {
    fetchExecutedMigrations();
    enforceUpgradeGate();
    baselineAction = resolveBaselineAction();

    // Sort Migration on the basis of version
    List<MigrationFile> availableMigrations =
        getMigrationFiles(
            nativeSQLScriptRootPath,
            connectionType,
            openMetadataApplicationConfig,
            extensionSQLScriptRootPath);
    // Filter Migrations to Be Run
    this.migrations = filterAndGetMigrationsToRun(applyBaselineFloor(availableMigrations));
  }

  /**
   * Read the applied versions once, up front, so the gate and the pending computation agree.
   * Deliberately not fail-open: only a genuinely absent history table means "nothing applied yet".
   * Any other failure propagates, because mistaking a database outage for a fresh install would
   * hand an empty-looking database to the baseline installer.
   */
  private void fetchExecutedMigrations() {
    executedMigrations =
        isUpgradeGateEnabled() ? readAppliedVersionsStrictly() : readAppliedVersionsLeniently();
    currentMaxMigrationVersion =
        executedMigrations.stream().max(MigrationVersionUtil::compareVersions);
  }

  private List<String> readAppliedVersionsStrictly() {
    List<String> result;
    if (historyTableUpgrader.hasStepColumns()) {
      // Only completed steps count as applied: a STARTED row is a crash marker, and its version
      // must stay pending so the re-run finishes it.
      result = migrationDAO.getCompletedMigrationVersions();
    } else if (tableExists(MigrationHistoryTable.SERVER_CHANGE_LOG)) {
      result = migrationDAO.getMigrationVersions();
    } else {
      LOG.info("SERVER_CHANGE_LOG table doesn't exist yet, treating the database as empty");
      result = new ArrayList<>();
    }
    return result;
  }

  /**
   * Engine-level path for callers without a migration configuration (no baseline, no gate). Any
   * read failure is taken as "nothing applied yet", which is the long-standing behaviour for
   * embedded callers; the strict path above exists precisely because that assumption is unsafe once
   * a baseline installer is downstream of it.
   */
  private List<String> readAppliedVersionsLeniently() {
    List<String> result;
    try {
      result = migrationDAO.getMigrationVersions();
    } catch (RuntimeException e) {
      LOG.info("Could not read SERVER_CHANGE_LOG ({}), will run all migrations", e.getMessage());
      result = new ArrayList<>();
    }
    return result;
  }

  /**
   * Refuse to migrate a database that has not been through 2.0 yet. Applied before the force
   * branch on purpose: {@code --force} exists to re-run migrations, not to skip a release.
   */
  private void enforceUpgradeGate() {
    if (isUpgradeGateEnabled() && !isDatabaseAtOrAboveMinimum()) {
      throw new IllegalStateException(UPGRADE_GATE_ERROR);
    }
  }

  private boolean isUpgradeGateEnabled() {
    return baselineWorkflow != null;
  }

  private boolean isDatabaseAtOrAboveMinimum() {
    boolean result;
    if (nullOrEmpty(executedMigrations)) {
      // Nothing applied: either a fresh database, or one still carrying pre-native Flyway history.
      result = !tableExists(FLYWAY_HISTORY_TABLE);
    } else {
      result =
          MigrationVersionUtil.maxParseableVersion(executedMigrations)
              .filter(version -> !MigrationVersionUtil.isBelowMinimum(version))
              .isPresent();
    }
    return result;
  }

  private BaselineAction resolveBaselineAction() {
    return baselineWorkflow == null ? BaselineAction.DISABLED : baselineWorkflow.resolveAction();
  }

  /**
   * On a baseline-managed database the pre-2.0 history is represented by the single baseline row,
   * so the migrations it stands in for must never be offered to the runner — including under
   * {@code --force}, which every development compose passes on each boot and which would otherwise
   * replay the whole pre-2.0 chain on top of the baseline.
   */
  private List<MigrationFile> applyBaselineFloor(List<MigrationFile> availableMigrations) {
    List<MigrationFile> result = availableMigrations;
    if (isBaselineManaged()) {
      result =
          availableMigrations.stream()
              .filter(migration -> migration.isExtension || !isSupersededByBaseline(migration))
              .toList();
      logFloorFiltering(availableMigrations.size() - result.size());
    }
    return result;
  }

  /**
   * Requires the baseline feature to be on for this workflow, not merely a baseline row in the
   * database. A caller without a migration configuration is running its own migration set — the
   * integration tests drive synthetic {@code 0.0.x} versions this way — and must not have them
   * filtered out just because the database it happens to point at was installed from a baseline.
   */
  private boolean isBaselineManaged() {
    return isUpgradeGateEnabled()
        && (baselineAction == BaselineAction.RUN
            || baselineAction == BaselineAction.RESUME
            || executedMigrations.contains(MigrationVersionUtil.BASELINE_VERSION));
  }

  private boolean isSupersededByBaseline(MigrationFile migration) {
    return MigrationVersionUtil.isBelowMinimum(migration.version);
  }

  private boolean tableExists(String tableName) {
    boolean result;
    try (Handle handle = jdbi.open()) {
      String query =
          connectionType == ConnectionType.MYSQL
              ? "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE()"
                  + " AND LOWER(table_name) = LOWER(:tableName)"
              : "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = current_schema()"
                  + " AND LOWER(table_name) = LOWER(:tableName)";
      Integer count =
          handle.createQuery(query).bind("tableName", tableName).mapTo(Integer.class).one();
      result = count != null && count > 0;
    }
    return result;
  }

  private void logFloorFiltering(int filteredCount) {
    if (filteredCount > 0) {
      LOG.info(
          "[MigrationWorkflow] Skipping {} migration(s) below {} — already covered by the baseline",
          filteredCount,
          MigrationVersionUtil.MINIMUM_SUPPORTED_MIGRATION_VERSION);
    }
  }

  /** Versions the last {@link #loadMigrations()} decided still need to run, in execution order. */
  public List<String> getPendingVersions() {
    return migrations.stream().map(MigrationProcess::getVersion).toList();
  }

  public void validateMigrationsForServer() {
    if (!migrations.isEmpty()) {
      List<String> pendingVersions = migrations.stream().map(MigrationProcess::getVersion).toList();
      throw new IllegalStateException(
          "There are pending migrations to be run on the database: "
              + pendingVersions
              + ". Please backup your data and run `./bootstrap/openmetadata-ops.sh migrate`."
              + " You can find more information on upgrading OpenMetadata at"
              + " https://docs.open-metadata.org/deployment/upgrade ");
    }
  }

  public List<MigrationFile> getMigrationFiles(
      String nativeSQLScriptRootPath,
      ConnectionType connectionType,
      OpenMetadataApplicationConfig config,
      String extensionSQLScriptRootPath) {
    List<MigrationFile> availableOMNativeMigrations =
        getMigrationFilesFromPath(nativeSQLScriptRootPath, connectionType, config, false);

    // Get extension migrations if available
    List<MigrationFile> availableExtensionMigrations = new ArrayList<>();
    if (extensionSQLScriptRootPath != null && !extensionSQLScriptRootPath.isEmpty()) {
      availableExtensionMigrations =
          getMigrationFilesFromPath(extensionSQLScriptRootPath, connectionType, config, true);
    }

    /*
     Execution order: OpenMetadata native migrations, then extension migrations,
     sorted by version within each group.
    */
    return Stream.of(availableOMNativeMigrations.stream(), availableExtensionMigrations.stream())
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
    List<MigrationFile> applyMigrations = resolveApplyMigrations(availableMigrations);
    List<MigrationProcessExtensionProvider> extensionProviders = loadExtensionProviders();
    List<MigrationProcess> processes = new ArrayList<>();
    try {
      for (MigrationFile file : applyMigrations) {
        if (Boolean.TRUE.equals(file.isExtension)) {
          extensionVersions.add(file.version);
        }
        file.parseSQLFiles();
        if (file.isReprocessing() && !file.hasNewStatements()) {
          LOG.debug(
              "[MigrationWorkflow] Skipping version {} - reprocessing with no new SQL statements",
              file.version);
          continue;
        }
        processes.add(resolveMigrationProcess(file, extensionProviders));
      }
    } catch (Exception e) {
      LOG.error("Failed to list and add migrations to run due to ", e);
    }
    return processes;
  }

  private MigrationProcess resolveMigrationProcess(
      MigrationFile file, List<MigrationProcessExtensionProvider> extensionProviders)
      throws ReflectiveOperationException {
    if (file.isExtension) {
      // No provider handled this extension version: run SQL only, skip Java data migration.
      // Critical: do not fall through to OM's same-version native migration class.
      return extensionProviders.stream()
          .map(provider -> provider.provide(file))
          .flatMap(Optional::stream)
          .findFirst()
          .orElseGet(() -> new MigrationProcessImpl(file));
    }
    String clazzName = file.getMigrationProcessClassName();
    return (MigrationProcess)
        Class.forName(clazzName).getConstructor(MigrationFile.class).newInstance(file);
  }

  private List<MigrationProcessExtensionProvider> loadExtensionProviders() {
    return StreamSupport.stream(
            ServiceLoader.load(MigrationProcessExtensionProvider.class).spliterator(), false)
        .toList();
  }

  private static int compareReprocessingCandidates(String version1, String version2) {
    int versionComparison = MigrationVersionUtil.compareVersions(version1, version2);
    if (versionComparison != 0) {
      return versionComparison;
    }

    int baseVersionComparison =
        Boolean.compare(isBaseMigrationVersion(version1), isBaseMigrationVersion(version2));
    if (baseVersionComparison != 0) {
      return baseVersionComparison;
    }

    return version1.compareTo(version2);
  }

  private static boolean isBaseMigrationVersion(String version) {
    return !version.contains("-");
  }

  private record ReleaseTrain(int major, int minor) implements Comparable<ReleaseTrain> {
    private static ReleaseTrain fromVersion(String version) {
      int[] parts = MigrationVersionUtil.parseVersion(version);
      return new ReleaseTrain(parts[0], parts[1]);
    }

    @Override
    public int compareTo(ReleaseTrain another) {
      int result = Integer.compare(major, another.major);
      if (result == 0) {
        result = Integer.compare(minor, another.minor);
      }
      return result;
    }
  }

  // Package-private for testing
  List<MigrationFile> resolveApplyMigrations(List<MigrationFile> availableMigrations) {
    LOG.debug("Filtering Server Migrations");
    if (executedMigrations == null) {
      // Direct callers (tests) that bypass loadMigrations still need the applied versions read.
      fetchExecutedMigrations();
    }
    List<MigrationFile> applyMigrations;
    if (!nullOrEmpty(executedMigrations) && !forceMigrations) {
      applyMigrations = getMigrationsToApply(executedMigrations, availableMigrations);
    } else {
      applyMigrations = availableMigrations;
    }
    return applyMigrations;
  }

  /**
   * We'll take the max from native migrations and double-check if there's any extension migration
   * pending to be applied
   */
  public List<MigrationFile> getMigrationsToApply(
      List<String> executedMigrations, List<MigrationFile> availableMigrations) {
    Set<String> executedSet = new HashSet<>(executedMigrations);
    List<MigrationFile> migrationsToApply = new ArrayList<>();
    migrationsToApply.addAll(processNativeMigrations(executedSet, availableMigrations));
    migrationsToApply.addAll(processExtensionMigrations(executedSet, availableMigrations));
    return migrationsToApply;
  }

  private List<MigrationFile> processNativeMigrations(
      Set<String> executedMigrations, List<MigrationFile> availableMigrations) {
    List<MigrationFile> nativeMigrations =
        availableMigrations.stream().filter(m -> !m.isExtension).toList();
    Set<String> reprocessingVersions =
        getReprocessingVersions(executedMigrations, nativeMigrations);
    if (reprocessingVersions.isEmpty()) {
      return nativeMigrations;
    }
    List<MigrationFile> result = new ArrayList<>();
    for (MigrationFile migration : nativeMigrations) {
      if (reprocessingVersions.contains(migration.version)) {
        result.add(migration.copyWithReprocessing(true));
      } else if (!executedMigrations.contains(migration.version)) {
        result.add(migration.copyWithReprocessing(false));
      }
    }
    return result;
  }

  private List<MigrationFile> processExtensionMigrations(
      Set<String> executedMigrations, List<MigrationFile> availableMigrations) {
    List<MigrationFile> extensionMigrations =
        availableMigrations.stream().filter(migration -> migration.isExtension).toList();
    Set<String> reprocessingVersions =
        getReprocessingVersions(executedMigrations, extensionMigrations);
    List<MigrationFile> result = new ArrayList<>();
    for (MigrationFile migration : extensionMigrations) {
      if (reprocessingVersions.contains(migration.version)) {
        result.add(migration.copyWithReprocessing(true));
      } else if (!executedMigrations.contains(migration.version)) {
        result.add(migration.copyWithReprocessing(false));
      }
    }
    return result;
  }

  private Set<String> getReprocessingVersions(
      Set<String> executedMigrations, List<MigrationFile> availableMigrations) {
    Set<String> availableVersions =
        availableMigrations.stream().map(migration -> migration.version).collect(toSet());
    Optional<String> maxExecuted =
        executedMigrations.stream()
            .filter(availableVersions::contains)
            .max(MigrationWorkflow::compareReprocessingCandidates);
    if (maxExecuted.isEmpty()) {
      return Set.of();
    }

    Set<String> reprocessingVersions = new HashSet<>();
    ReleaseTrain currentReleaseTrain = ReleaseTrain.fromVersion(maxExecuted.get());
    getMaxExecutedVersionForReleaseTrain(
            currentReleaseTrain, executedMigrations, availableMigrations)
        .ifPresent(reprocessingVersions::add);

    getPreviousReleaseTrain(currentReleaseTrain, availableMigrations)
        .flatMap(
            releaseTrain ->
                getMaxExecutedVersionForReleaseTrain(
                    releaseTrain, executedMigrations, availableMigrations))
        .ifPresent(reprocessingVersions::add);
    return reprocessingVersions;
  }

  private Optional<String> getMaxExecutedVersionForReleaseTrain(
      ReleaseTrain releaseTrain,
      Set<String> executedMigrations,
      List<MigrationFile> availableMigrations) {
    return availableMigrations.stream()
        .filter(migration -> ReleaseTrain.fromVersion(migration.version).equals(releaseTrain))
        .map(migration -> migration.version)
        .filter(executedMigrations::contains)
        .max(MigrationWorkflow::compareReprocessingCandidates);
  }

  private Optional<ReleaseTrain> getPreviousReleaseTrain(
      ReleaseTrain currentReleaseTrain, List<MigrationFile> availableMigrations) {
    return availableMigrations.stream()
        .map(migration -> ReleaseTrain.fromVersion(migration.version))
        .filter(releaseTrain -> releaseTrain.compareTo(currentReleaseTrain) < 0)
        .max(ReleaseTrain::compareTo);
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
    prepareDatabase();
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
          markStepStarted(process);
          try {
            // Initialize
            runStepAndAddStatus(row, () -> process.initialize(transactionHandler, jdbi));

            // Schema Changes
            runSchemaChanges(row, process);

            if (shouldRunDataMigration(process)) {
              runStepAndAddStatus(row, process::runDataMigration);
            } else {
              LOG.info(
                  "[MigrationWorkflow] Skipping data migration for reprocessed previous release train version: {}",
                  process.getVersion());
              row.add(SKIPPED_MSG);
            }

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
            markStepOutcome(process, row);
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

  /**
   * Schema work the runner owns, done before any migration executes: bring an older history table
   * up to shape, and install the consolidated baseline when this is an empty database. Only the
   * migrate path reaches this — the server's startup validation loads and checks without writing.
   */
  private void prepareDatabase() {
    if (baselineWorkflow != null) {
      historyTableUpgrader.ensureSchema();
      baselineWorkflow.runIfRequired();
    }
  }

  private boolean shouldRunDataMigration(MigrationProcess process) {
    boolean result = true;
    if (process.isReprocessing() && currentMaxMigrationVersion.isPresent()) {
      result =
          MigrationVersionUtil.compareVersions(
                  process.getVersion(), currentMaxMigrationVersion.get())
              == 0;
    }
    return result;
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

  /**
   * Record that a version is mid-flight before touching it, so a crash leaves a STARTED row that
   * both names the culprit and keeps the version pending for the next run.
   */
  private void markStepStarted(MigrationProcess step) {
    if (baselineWorkflow != null) {
      migrationDAO.upsertServerMigrationWithStatus(
          step.getVersion(),
          step.getMigrationsPath(),
          UUID.randomUUID().toString(),
          new JSONObject().toString(),
          migrationTypeOf(step).name(),
          MigrationStatus.STARTED.name());
    }
  }

  /**
   * Close out the step. Under {@code --force} phase failures are swallowed to let the run continue,
   * so the row status is the only place that remembers a version did not apply cleanly.
   */
  private void markStepOutcome(MigrationProcess step, List<String> row) {
    if (baselineWorkflow != null) {
      boolean failed = row.stream().anyMatch(status -> status.startsWith(FAILED_MSG));
      MigrationStatus status = failed ? MigrationStatus.FAILED : MigrationStatus.COMPLETED;
      migrationDAO.updateServerMigrationStatus(step.getVersion(), status.name());
    }
  }

  private MigrationType migrationTypeOf(MigrationProcess step) {
    return extensionVersions.contains(step.getVersion())
        ? MigrationType.EXTENSION
        : MigrationType.NATIVE;
  }
}
