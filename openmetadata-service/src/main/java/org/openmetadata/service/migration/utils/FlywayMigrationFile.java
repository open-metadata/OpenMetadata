package org.openmetadata.service.migration.utils;

import java.io.File;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.flywaydb.core.api.configuration.ClassicConfiguration;
import org.flywaydb.core.api.configuration.Configuration;
import org.flywaydb.core.internal.database.postgresql.PostgreSQLParser;
import org.flywaydb.core.internal.parser.Parser;
import org.flywaydb.core.internal.parser.ParsingContext;
import org.flywaydb.core.internal.resource.filesystem.FileSystemResource;
import org.flywaydb.core.internal.sqlscript.SqlStatementIterator;
import org.flywaydb.database.mysql.MySQLParser;
import org.jetbrains.annotations.Nullable;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.jdbi3.MigrationDAO;
import org.openmetadata.service.jdbi3.locator.ConnectionType;
import org.openmetadata.service.util.EntityUtil;

public class FlywayMigrationFile extends MigrationFile {
  private static final Pattern FLYWAY_FILE_PATTERN =
      Pattern.compile("^[vV](\\d+(?:\\.\\d+)*)__.*\\.sql$");

  private final File sqlFile;

  public FlywayMigrationFile(
      File sqlFile,
      MigrationDAO migrationDAO,
      ConnectionType connectionType,
      OpenMetadataApplicationConfig config) {
    super(createFlywayVersionDir(sqlFile), migrationDAO, connectionType, config, false);
    this.sqlFile = sqlFile;
  }

  private static File createFlywayVersionDir(File sqlFile) {
    // Create a virtual directory with semantic version name that doesn't need to exist
    String flywayVersion = extractVersionFromFilename(sqlFile.getName());
    String semanticVersion = String.format("0.0.%d", Integer.parseInt(flywayVersion));
    // Return a virtual directory - it doesn't need to exist since we override file methods
    return new File(sqlFile.getParent(), semanticVersion);
  }

  private static String extractVersionFromFilename(String filename) {
    Matcher matcher = FLYWAY_FILE_PATTERN.matcher(filename);
    if (matcher.matches()) {
      return matcher.group(1);
    }
    throw new IllegalArgumentException("Invalid Flyway migration filename: " + filename);
  }

  @Override
  public void parseSQLFiles() {
    if (sqlFile.exists() && sqlFile.isFile()) {
      try {
        final ParsingContext parsingContext = new ParsingContext();
        Configuration configuration = new ClassicConfiguration();
        Parser parser = new PostgreSQLParser(configuration, parsingContext);
        if (connectionType == ConnectionType.MYSQL) {
          parser = new MySQLParser(configuration, parsingContext);
        }

        try (SqlStatementIterator sqlIterator =
            parser.parse(
                new FileSystemResource(
                    null, sqlFile.getAbsolutePath(), StandardCharsets.UTF_8, true))) {
          while (sqlIterator.hasNext()) {
            String sqlStatement = sqlIterator.next().getSql();
            if (!checkIfQueryPreviouslyRan(sqlStatement)) {
              schemaChanges.add(sqlStatement);
            }
          }
        }
      } catch (Exception e) {
        throw new RuntimeException(
            "Failed to parse Flyway migration file: " + sqlFile.getPath(), e);
      }
    }
  }

  @Override
  public String getSchemaChangesFile() {
    return sqlFile.getAbsolutePath();
  }

  @Override
  public String getPostDDLScriptFile() {
    // Flyway files don't have separate post DDL scripts
    return "";
  }

  @Override
  public String getMigrationsFilePath() {
    return sqlFile.getAbsolutePath();
  }

  public static boolean isFlywayMigrationFile(File file) {
    return file.isFile() && FLYWAY_FILE_PATTERN.matcher(file.getName()).matches();
  }

  public static List<FlywayMigrationFile> getFlywayMigrationFiles(
      String flywayPath,
      ConnectionType connectionType,
      OpenMetadataApplicationConfig config,
      MigrationDAO migrationDAO) {
    List<FlywayMigrationFile> flywayMigrations = new ArrayList<>();

    if (flywayPath == null || flywayPath.isEmpty()) {
      return flywayMigrations;
    }

    File flywayDir = new File(flywayPath);
    if (!flywayDir.exists() || !flywayDir.isDirectory()) {
      return flywayMigrations;
    }

    // Get database-specific subdirectory using the actual directory names
    File[] sqlFiles = getFiles(connectionType, flywayDir);

    if (sqlFiles != null) {
      Arrays.stream(sqlFiles)
          .map(file -> new FlywayMigrationFile(file, migrationDAO, connectionType, config))
          .sorted()
          .forEach(flywayMigrations::add);
    }

    return flywayMigrations;
  }

  private static File @Nullable [] getFiles(ConnectionType connectionType, File flywayDir) {
    String dbSubDir =
        connectionType == ConnectionType.MYSQL
            ? "com.mysql.cj.jdbc.Driver"
            : "org.postgresql.Driver";
    File dbSpecificDir = new File(flywayDir, dbSubDir);

    if (!dbSpecificDir.exists() || !dbSpecificDir.isDirectory()) {
      // Try legacy naming convention
      String legacyDbSubDir = connectionType == ConnectionType.MYSQL ? "mysql" : "postgresql";
      dbSpecificDir = new File(flywayDir, legacyDbSubDir);
      if (!dbSpecificDir.exists() || !dbSpecificDir.isDirectory()) {
        // Try the root flyway directory
        dbSpecificDir = flywayDir;
      }
    }

    return dbSpecificDir.listFiles((dir1, name) -> FLYWAY_FILE_PATTERN.matcher(name).matches());
  }

  private boolean checkIfQueryPreviouslyRan(String query) {
    try {
      String checksum = EntityUtil.hash(query);
      String sqlStatement = migrationDAO.checkIfQueryPreviouslyRan(checksum);
      return sqlStatement != null;
    } catch (Exception e) {
      // If SERVER_MIGRATION_SQL_LOGS table doesn't exist yet, assume query hasn't run
      return false;
    }
  }
}
