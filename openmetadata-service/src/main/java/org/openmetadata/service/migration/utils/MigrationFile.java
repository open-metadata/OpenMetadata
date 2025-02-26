package org.openmetadata.service.migration.utils;

import java.io.File;
import java.nio.charset.StandardCharsets;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.List;
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

public class MigrationFile implements Comparable<MigrationFile> {
  public final int[] versionNumbers;
  public final String version;
  public final ConnectionType connectionType;
  public final OpenMetadataApplicationConfig openMetadataApplicationConfig;

  public final File dir;
  public final Boolean isExtension;
  public final String dbPackageName;

  private final MigrationDAO migrationDAO;
  private final List<String> schemaChanges;
  private final List<String> postDDLScripts;
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

  @Override
  public int compareTo(MigrationFile another) {
    return compareVersionNumbers(another.versionNumbers);
  }

  public boolean biggerThan(String version) {
    int[] numbers = convertToNumber(version);
    int compare = compareVersionNumbers(numbers);
    return compare > 0;
  }

  public void parseSQLFiles() {
    final ParsingContext parsingContext = new ParsingContext();
    Configuration configuration = new ClassicConfiguration();
    Parser parser = new PostgreSQLParser(configuration, parsingContext);
    if (connectionType == ConnectionType.MYSQL) {
      parser = new MySQLParser(configuration, parsingContext);
    }
    if (new File(getSchemaChangesFile()).isFile()) {
      try (SqlStatementIterator schemaChangesIterator =
          parser.parse(
              new FileSystemResource(null, getSchemaChangesFile(), StandardCharsets.UTF_8, true))) {
        while (schemaChangesIterator.hasNext()) {
          String sqlStatement = schemaChangesIterator.next().getSql();
          if (!checkIfQueryPreviouslyRan(sqlStatement)) {
            schemaChanges.add(sqlStatement);
          }
        }
      }
    }
    if (new File(getPostDDLScriptFile()).isFile()) {
      try (SqlStatementIterator schemaChangesIterator =
          parser.parse(
              new FileSystemResource(null, getPostDDLScriptFile(), StandardCharsets.UTF_8, true))) {
        while (schemaChangesIterator.hasNext()) {
          String sqlStatement = schemaChangesIterator.next().getSql();
          if (!checkIfQueryPreviouslyRan(sqlStatement)) {
            postDDLScripts.add(sqlStatement);
          }
        }
      }
    }
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

  public String getMigrationProcessExtClassName() {
    String clazzName =
        String.format(
            "io.collate.service.migration.%s.%s.Migration", dbPackageName, getVersionPackageName());
    try {
      Class.forName(clazzName);
    } catch (ClassNotFoundException e) {
      return null;
    }
    return clazzName;
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

  public List<String> getSchemaChanges() {
    return schemaChanges;
  }

  public List<String> getPostDDLScripts() {
    return postDDLScripts;
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

  private String getVersionPackageName() {
    StringBuilder arrayAsString = new StringBuilder();
    for (int versionNumber : versionNumbers) {
      arrayAsString.append(versionNumber);
    }
    return "v" + arrayAsString;
  }

  private boolean checkIfQueryPreviouslyRan(String query) {
    String checksum = EntityUtil.hash(query);
    String sqlStatement = migrationDAO.checkIfQueryPreviouslyRan(checksum);
    return sqlStatement != null;
  }
}
