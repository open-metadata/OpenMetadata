package org.openmetadata.service.migration.utils;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import java.io.File;
import java.nio.charset.StandardCharsets;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.flywaydb.core.api.configuration.ClassicConfiguration;
import org.flywaydb.core.api.configuration.Configuration;
import org.flywaydb.core.internal.database.postgresql.PostgreSQLParser;
import org.flywaydb.core.internal.parser.Parser;
import org.flywaydb.core.internal.parser.ParsingContext;
import org.flywaydb.core.internal.resource.filesystem.FileSystemResource;
import org.flywaydb.core.internal.sqlscript.SqlStatementIterator;
import org.flywaydb.database.mysql.MySQLParser;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.jdbi3.MigrationDAO;
import org.openmetadata.service.jdbi3.locator.ConnectionType;
import org.openmetadata.service.util.EntityUtil;

@Slf4j
public class MigrationFile implements Comparable<MigrationFile> {
  public final int[] versionNumbers;
  public final String version;
  public final ConnectionType connectionType;
  public final OpenMetadataApplicationConfig openMetadataApplicationConfig;

  public final File dir;
  public final Boolean isExtension;
  public final String dbPackageName;

  protected final MigrationDAO migrationDAO;
  protected final List<SqlUnit> schemaChanges;
  protected final List<SqlUnit> postDDLScripts;
  private boolean reprocessing;
  public static final String DEFAULT_MIGRATION_PROCESS_CLASS =
      "org.openmetadata.service.migration.api.MigrationProcessImpl";

  public MigrationFile(
      File dir,
      MigrationDAO migrationDAO,
      ConnectionType connectionType,
      OpenMetadataApplicationConfig config,
      Boolean isExtension) {
    this.dir = dir;
    this.isExtension = isExtension;
    this.version = dir.getName();
    this.connectionType = connectionType;
    this.migrationDAO = migrationDAO;
    this.openMetadataApplicationConfig = config;
    this.dbPackageName = connectionType == ConnectionType.MYSQL ? "mysql" : "postgres";
    versionNumbers = convertToNumber(version);
    schemaChanges = new ArrayList<>();
    postDDLScripts = new ArrayList<>();
  }

  /**
   * The order migrations run in: by version number, and on equal numbers the native (or Flyway)
   * version before the extension one, so 1.6.0 runs before 1.6.0-collate.
   */
  @Override
  public int compareTo(MigrationFile another) {
    int result = compareVersionNumbers(another.versionNumbers);
    if (result == 0) {
      result = Boolean.compare(isExtension, another.isExtension);
    }
    return result;
  }

  public boolean biggerThan(String version) {
    int[] numbers = convertToNumber(version);
    int compare = compareVersionNumbers(numbers);
    return compare > 0;
  }

  public void parseSQLFiles() {
    schemaChanges.clear();
    postDDLScripts.clear();

    if (new File(getSchemaChangesFile()).isFile()) {
      try {
        for (SqlUnit unit : parseSqlUnits(new File(getSchemaChangesFile()), connectionType)) {
          if (!isApplied(unit)) {
            schemaChanges.add(unit);
          }
        }
      } catch (Exception e) {
        throw new RuntimeException(
            "Failed to parse schema changes file: " + getSchemaChangesFile(), e);
      }
    }
    if (new File(getPostDDLScriptFile()).isFile()) {
      try {
        for (SqlUnit unit : parseSqlUnits(new File(getPostDDLScriptFile()), connectionType)) {
          if (!isApplied(unit)) {
            postDDLScripts.add(unit);
          }
        }
      } catch (Exception e) {
        throw new RuntimeException(
            "Failed to parse post DDL script file: " + getPostDDLScriptFile(), e);
      }
    }
  }

  /** The file's statements as the units the runner executes: MySQL guarded blocks are grouped. */
  public static List<SqlUnit> parseSqlUnits(File sqlFile, ConnectionType connectionType) {
    List<String> statements = parseSQLFile(sqlFile, connectionType);
    return connectionType == ConnectionType.MYSQL
        ? GuardedBlockGrouper.group(statements, sqlFile.getPath())
        : statements.stream().map(SqlUnit::of).toList();
  }

  public static List<String> parseSQLFile(File sqlFile, ConnectionType connectionType) {
    List<String> statements = new ArrayList<>();
    ParsingContext parsingContext = new ParsingContext();
    Configuration configuration = new ClassicConfiguration();
    Parser parser = new PostgreSQLParser(configuration, parsingContext);
    if (connectionType == ConnectionType.MYSQL) {
      parser = new MySQLParser(configuration, parsingContext);
    }

    try (SqlStatementIterator iterator =
        parser.parse(
            new FileSystemResource(
                null, sqlFile.getAbsolutePath(), StandardCharsets.UTF_8, true))) {
      while (iterator.hasNext()) {
        statements.add(iterator.next().getSql());
      }
    } catch (Exception e) {
      throw new RuntimeException("Failed to parse SQL file: " + sqlFile.getPath(), e);
    }
    return statements;
  }

  public String getMigrationProcessClassName() {
    String clazzName =
        String.format(
            "org.openmetadata.service.migration.%s.%s.Migration",
            dbPackageName, getVersionPackageName());
    try {
      Class.forName(clazzName);
    } catch (ClassNotFoundException e) {
      return DEFAULT_MIGRATION_PROCESS_CLASS;
    }
    return clazzName;
  }

  public String getVersionPackageName() {
    StringBuilder arrayAsString = new StringBuilder();
    for (int versionNumber : versionNumbers) {
      arrayAsString.append(versionNumber);
    }
    return "v" + arrayAsString;
  }

  public String getMigrationsFilePath() {
    if (connectionType == ConnectionType.MYSQL) {
      return Paths.get(dir.getAbsolutePath(), "mysql").toString();
    } else {
      return Paths.get(dir.getAbsolutePath(), "postgres").toString();
    }
  }

  public String getSchemaChangesFile() {
    if (connectionType == ConnectionType.MYSQL) {
      return Paths.get(dir.getAbsolutePath(), "mysql", "schemaChanges.sql").toString();
    } else {
      return Paths.get(dir.getAbsolutePath(), "postgres", "schemaChanges.sql").toString();
    }
  }

  public String getPostDDLScriptFile() {
    if (connectionType == ConnectionType.MYSQL) {
      return Paths.get(dir.getAbsolutePath(), "mysql", "postDataMigrationSQLScript.sql").toString();
    } else {
      return Paths.get(dir.getAbsolutePath(), "postgres", "postDataMigrationSQLScript.sql")
          .toString();
    }
  }

  public List<SqlUnit> getSchemaChanges() {
    return schemaChanges;
  }

  public List<SqlUnit> getPostDDLScripts() {
    return postDDLScripts;
  }

  public String getDirPath() {
    return this.dir.getAbsolutePath();
  }

  private int[] convertToNumber(String version) {
    final String[] split = version.split("\\-")[0].split("\\.");
    int[] numbers = new int[split.length];
    for (int i = 0; i < split.length; i++) {
      numbers[i] = Integer.parseInt(split[i]);
    }
    return numbers;
  }

  private int compareVersionNumbers(int[] another) {
    final int maxLength = Math.max(versionNumbers.length, another.length);
    for (int i = 0; i < maxLength; i++) {
      final int left = i < versionNumbers.length ? versionNumbers[i] : 0;
      final int right = i < another.length ? another[i] : 0;
      if (left != right) {
        return left < right ? -1 : 1;
      }
    }
    return 0;
  }

  public boolean isReprocessing() {
    return reprocessing;
  }

  public void setReprocessing(boolean reprocessing) {
    this.reprocessing = reprocessing;
  }

  public MigrationFile copyWithReprocessing(boolean reprocessing) {
    MigrationFile copy =
        new MigrationFile(
            dir, migrationDAO, connectionType, openMetadataApplicationConfig, isExtension);
    copy.schemaChanges.addAll(schemaChanges);
    copy.postDDLScripts.addAll(postDDLScripts);
    copy.setReprocessing(reprocessing);
    return copy;
  }

  public boolean hasNewStatements() {
    return !schemaChanges.isEmpty() || !postDDLScripts.isEmpty();
  }

  /**
   * A unit is applied once its own checksum is recorded. Runners before units recorded a guarded
   * block's statements one by one, so a block also counts as applied when every one of its
   * statements was recorded under this version. Rows recorded under another version belong to
   * another block that reused the same names, and a block interrupted part way has a statement
   * missing, so both run again as a whole.
   */
  protected boolean isApplied(SqlUnit unit) {
    String executedInVersion = executedInVersion(unit.checksum());
    warnIfExecutedByAnotherVersion(executedInVersion, unit.text());
    return executedInVersion != null || (unit.isBlock() && isRecordedOneByOne(unit));
  }

  private boolean isRecordedOneByOne(SqlUnit unit) {
    return unit.statements().stream()
        .allMatch(statement -> isRecordedInThisVersion(EntityUtil.hash(statement)));
  }

  private boolean isRecordedInThisVersion(String checksum) {
    try {
      return !nullOrEmpty(migrationDAO.getSqlQuery(version, checksum));
    } catch (Exception e) {
      // If SERVER_MIGRATION_SQL_LOGS table doesn't exist yet, assume query hasn't run
      return false;
    }
  }

  private String executedInVersion(String checksum) {
    try {
      return migrationDAO.checkIfQueryPreviouslyRan(checksum);
    } catch (Exception e) {
      // If SERVER_MIGRATION_SQL_LOGS table doesn't exist yet, assume query hasn't run
      return null;
    }
  }

  // A reprocessed version is parsed on every start; its skips were reported when it was applied.
  private void warnIfExecutedByAnotherVersion(String executedInVersion, String query) {
    if (!reprocessing && executedInVersion != null && !executedInVersion.equals(version)) {
      LOG.warn(
          "[MigrationWorkflow] Skipping a statement of version {} because identical text already"
              + " ran in version {}: {}",
          version,
          executedInVersion,
          query);
    }
  }
}
