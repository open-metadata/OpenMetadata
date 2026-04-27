package org.openmetadata.service.util;

import com.fasterxml.jackson.databind.node.ObjectNode;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.core.Handle;
import org.jdbi.v3.core.Jdbi;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.jdbi3.locator.ConnectionType;
import org.openmetadata.service.migration.api.MigrationProcess;
import org.openmetadata.service.migration.api.MigrationTestCase;
import org.openmetadata.service.migration.api.MigrationWorkflow;
import org.openmetadata.service.migration.api.TestResult;
import org.openmetadata.service.migration.context.MigrationWorkflowContext;

@Slf4j
public class MigrationTestRunner {

  record MigrationTestEntry(
      String version, String testName, String phase, boolean passed, String detail) {}

  private final Jdbi jdbi;
  private final ConnectionType connectionType;
  private final OpenMetadataApplicationConfig config;
  private final String nativeSQLScriptRootPath;
  private final String extensionSQLScriptRootPath;

  public MigrationTestRunner(
      Jdbi jdbi,
      ConnectionType connectionType,
      OpenMetadataApplicationConfig config,
      String nativeSQLScriptRootPath,
      String extensionSQLScriptRootPath) {
    this.jdbi = jdbi;
    this.connectionType = connectionType;
    this.config = config;
    this.nativeSQLScriptRootPath = nativeSQLScriptRootPath;
    this.extensionSQLScriptRootPath = extensionSQLScriptRootPath;
  }

  public int run(String backupPath) throws IOException {
    return run(backupPath, DatabaseBackupRestore.DEFAULT_BATCH_SIZE);
  }

  public int run(String backupPath, int batchSize) throws IOException {
    ObjectNode metadata = DatabaseBackupRestore.readBackupMetadata(backupPath);
    String backupVersion = metadata.get("version").asText();
    String backupTimestamp = metadata.has("timestamp") ? metadata.get("timestamp").asText() : "N/A";
    String backupDbType =
        metadata.has("databaseType") ? metadata.get("databaseType").asText() : "N/A";
    String sourceVersion = OpenMetadataOperations.resolveTargetVersion(metadata, backupVersion);

    DatabaseBackupRestore backupRestore =
        new DatabaseBackupRestore(
            jdbi,
            connectionType,
            DatabaseBackupRestore.extractDatabaseName(config.getDataSourceFactory().getUrl()),
            batchSize);

    LOG.info("Running migrations up to version {}", sourceVersion);
    MigrationWorkflow setupWorkflow =
        new MigrationWorkflow(
            jdbi,
            nativeSQLScriptRootPath,
            connectionType,
            extensionSQLScriptRootPath,
            config.getMigrationConfiguration().getFlywayPath(),
            config,
            false);
    setupWorkflow.setTargetVersion(sourceVersion);
    setupWorkflow.loadMigrations();
    setupWorkflow.runMigrationWorkflows(true);

    backupRestore.restore(backupPath);

    MigrationWorkflow workflow =
        new MigrationWorkflow(
            jdbi,
            nativeSQLScriptRootPath,
            connectionType,
            extensionSQLScriptRootPath,
            config.getMigrationConfiguration().getFlywayPath(),
            config,
            false);
    workflow.loadMigrations();

    List<MigrationProcess> migrations = workflow.getMigrations();
    String targetVersion =
        migrations.isEmpty() ? sourceVersion : migrations.get(migrations.size() - 1).getVersion();

    List<MigrationTestEntry> entries = new ArrayList<>();

    try (Handle handle = jdbi.open()) {
      MigrationWorkflowContext context = new MigrationWorkflowContext(handle);
      context.computeInitialContext(sourceVersion);

      for (MigrationProcess process : migrations) {
        String version = process.getVersion();
        String versionPkg = versionToPackage(version);
        MigrationTestCase testCase = null;
        try {
          testCase = loadTestCase(versionPkg);
        } catch (RuntimeException e) {
          entries.add(
              new MigrationTestEntry(
                  version, "test class instantiation", "LOAD", false, e.getMessage()));
        }

        if (testCase != null) {
          entries.addAll(runValidation(testCase::validateBefore, handle, version, "BEFORE"));
        }

        boolean migrationFailed = false;
        try {
          process.initialize(handle, jdbi);
          process.runSchemaChanges(true);
          process.runDataMigration();
          process.runPostDDLScripts(true);
          context.computeMigrationContext(process, true);
          workflow.updateMigrationStepInDB(process, context);
        } catch (Exception e) {
          migrationFailed = true;
          LOG.error("Migration {} failed", version, e);
          entries.add(
              new MigrationTestEntry(version, "migration execution", "RUN", false, e.getMessage()));
        }

        if (testCase != null && !migrationFailed) {
          entries.addAll(runValidation(testCase::validateAfter, handle, version, "AFTER"));
        } else if (!migrationFailed) {
          entries.add(new MigrationTestEntry(version, "(no tests)", "-", true, ""));
        }

        if (migrationFailed) {
          LOG.warn(
              "Migration {} failed. The database is in a partially-migrated state. "
                  + "Re-restore the backup before retrying.",
              version);
          break;
        }
      }
    }

    printSummary(entries, sourceVersion, targetVersion, backupDbType, backupTimestamp);

    long failCount = entries.stream().filter(e -> !e.passed() && !"-".equals(e.phase())).count();
    return failCount > 0 ? 1 : 0;
  }

  @FunctionalInterface
  private interface ValidationSupplier {
    List<TestResult> run(Handle handle);
  }

  private List<MigrationTestEntry> runValidation(
      ValidationSupplier supplier, Handle handle, String version, String phase) {
    List<MigrationTestEntry> entries = new ArrayList<>();
    try {
      List<TestResult> results = supplier.run(handle);
      for (TestResult result : results) {
        entries.add(
            new MigrationTestEntry(
                version, result.name(), phase, result.passed(), result.detail()));
      }
    } catch (Exception e) {
      entries.add(
          new MigrationTestEntry(version, "validation error", phase, false, e.getMessage()));
    }
    return entries;
  }

  private MigrationTestCase loadTestCase(String versionPkg) {
    String className =
        String.format("org.openmetadata.service.migration.utils.%s.MigrationTest", versionPkg);
    try {
      Class<?> clazz = Class.forName(className);
      return (MigrationTestCase) clazz.getDeclaredConstructor().newInstance();
    } catch (ClassNotFoundException e) {
      return null;
    } catch (Exception e) {
      throw new RuntimeException(
          String.format("Failed to instantiate migration test class %s", className), e);
    }
  }

  static String versionToPackage(String version) {
    String base = version.contains("-") ? version.split("-")[0] : version;
    return "v" + base.replace(".", "");
  }

  private void printSummary(
      List<MigrationTestEntry> entries,
      String sourceVersion,
      String targetVersion,
      String dbType,
      String backupTimestamp) {
    int colVersion = 10;
    int colTest = 30;
    int colPhase = 8;
    int colResult = 8;

    for (MigrationTestEntry entry : entries) {
      colVersion = Math.max(colVersion, entry.version().length() + 2);
      colTest = Math.max(colTest, entry.testName().length() + 2);
    }

    String headerFmt =
        " %-" + colVersion + "s| %-" + colTest + "s| %-" + colPhase + "s| %-" + colResult + "s";
    int totalWidth = colVersion + colTest + colPhase + colResult + 7;
    String separator = "-".repeat(totalWidth);
    String doubleSeparator = "=".repeat(totalWidth);

    LOG.info(doubleSeparator);
    LOG.info(centerText("Migration Test Summary", totalWidth));
    LOG.info(doubleSeparator);
    LOG.info(" Source version  : {}", sourceVersion);
    LOG.info(" Target version  : {}", targetVersion);
    LOG.info(" Database type   : {}", dbType);
    LOG.info(" Backup timestamp: {}", backupTimestamp);
    LOG.info(separator);
    LOG.info(String.format(headerFmt, "Migration", "Test", "Phase", "Result"));
    LOG.info(separator);

    int passed = 0;
    int failed = 0;

    for (MigrationTestEntry entry : entries) {
      String result;
      if ("-".equals(entry.phase())) {
        result = "-";
      } else if (entry.passed()) {
        result = "PASS";
        passed++;
      } else {
        result = "FAIL";
        failed++;
      }

      LOG.info(String.format(headerFmt, entry.version(), entry.testName(), entry.phase(), result));

      if (!entry.passed() && !entry.detail().isEmpty() && !"-".equals(entry.phase())) {
        String detailFmt =
            " %-"
                + colVersion
                + "s|   %-"
                + (colTest - 2)
                + "s| %-"
                + colPhase
                + "s| %-"
                + colResult
                + "s";
        LOG.info(String.format(detailFmt, "", entry.detail(), "", ""));
      }
    }

    LOG.info(separator);
    LOG.info(" Total: {} passed, {} failed", passed, failed);
    LOG.info(doubleSeparator);
  }

  private static String centerText(String text, int width) {
    if (text.length() >= width) {
      return text;
    }
    int padding = (width - text.length()) / 2;
    return " ".repeat(padding) + text;
  }

  private static int compareVersions(String v1, String v2) {
    int[] parts1 = parseVersionParts(v1);
    int[] parts2 = parseVersionParts(v2);
    int length = Math.max(parts1.length, parts2.length);
    for (int i = 0; i < length; i++) {
      int p1 = i < parts1.length ? parts1[i] : 0;
      int p2 = i < parts2.length ? parts2[i] : 0;
      if (p1 != p2) {
        return Integer.compare(p1, p2);
      }
    }
    return 0;
  }

  private static int[] parseVersionParts(String version) {
    String base = version.contains("-") ? version.split("-")[0] : version;
    String[] parts = base.split("\\.");
    int[] numbers = new int[parts.length];
    for (int i = 0; i < parts.length; i++) {
      numbers[i] = Integer.parseInt(parts[i]);
    }
    return numbers;
  }
}
