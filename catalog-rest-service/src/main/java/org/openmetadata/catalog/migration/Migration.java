package org.openmetadata.catalog.migration;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.core.Jdbi;
import org.jdbi.v3.core.statement.StatementException;
import org.openmetadata.catalog.jdbi3.MigrationDAO;

@Slf4j
public final class Migration {

  /**
   * Run a query to MySQL to retrieve the last migrated Flyway version. If the Flyway table DATABASE_CHANGE_LOG does not
   * exist, we will stop the Catalog App and inform users how to run Flyway.
   *
   * @param jdbi JDBI connection
   * @return Last migrated version, e.g., "003"
   */
  public static Optional<String> lastMigrated(Jdbi jdbi) {
    try {
      return jdbi.withExtension(MigrationDAO.class, MigrationDAO::getMaxVersion);
    } catch (StatementException e) {
      System.out.println(
          "Exception encountered when trying to obtain last migrated Flyway version."
              + " Make sure you have run `./bootstrap/bootstrap_storage.sh migrate-all` at least once.");
      System.exit(1);
    }
    return Optional.empty();
  }

  public static String lastMigrationFile(MigrationConfiguration conf) throws IOException {
    List<String> migrationFiles = getMigrationVersions(conf);
    return Collections.max(migrationFiles);
  }

  /**
   * Read the migrations path from the Catalog YAML config and return a list of all the files' versions.
   *
   * @param conf Catalog migration config
   * @return List of migration files' versions
   * @throws IOException If we cannot read the files
   */
  private static List<String> getMigrationVersions(MigrationConfiguration conf) throws IOException {
    try (Stream<String> names =
        Files.walk(Paths.get(conf.getPath()))
            .filter(Files::isRegularFile)
            .map(Path::toFile)
            .map(File::getName)
            .map(Migration::cleanName)) {

      return names.collect(Collectors.toList());
    }
  }

  /**
   * Given a Flyway migration filename, e.g., v001__my_file.sql, return the version information "001".
   *
   * @param name Flyway migration filename
   * @return File version
   */
  private static String cleanName(String name) {
    return Arrays.asList(name.split("_")).get(0).replace("v", "");
  }
}
