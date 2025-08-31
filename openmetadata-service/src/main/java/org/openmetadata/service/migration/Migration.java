package org.openmetadata.service.migration;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Collections;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.core.Jdbi;
import org.jdbi.v3.core.statement.StatementException;
import org.openmetadata.service.jdbi3.MigrationDAO;

@Slf4j
public final class Migration {
  private Migration() {}

  /**
   * Run a query to retrieve the last migrated version from the DATABASE_CHANGE_LOG table.
   * This table is maintained by the native migration system.
   */
  public static Optional<String> lastMigrated(Jdbi jdbi) {
    try {
      return jdbi.withExtension(MigrationDAO.class, MigrationDAO::getMaxVersion);
    } catch (StatementException e) {
      throw new IllegalArgumentException(
          "Exception encountered when trying to obtain last migrated version."
              + " Make sure you have run `./bootstrap/openmetadata-ops.sh migrate` at least once.",
          e);
    }
  }

  public static String lastMigrationFile(MigrationConfiguration conf) throws IOException {
    List<String> migrationFiles = getMigrationVersions(conf);
    return Collections.max(migrationFiles);
  }

  /** Read the native migrations path from the config and return a list of all version directories. */
  private static List<String> getMigrationVersions(MigrationConfiguration conf) throws IOException {
    try (Stream<String> names =
        Files.walk(Paths.get(conf.getNativePath()), 1)
            .filter(Files::isDirectory)
            .map(Path::getFileName)
            .map(Path::toString)
            .filter(name -> name.matches("\\d+\\.\\d+\\.\\d+.*"))) {

      return names.collect(Collectors.toList());
    }
  }
}
