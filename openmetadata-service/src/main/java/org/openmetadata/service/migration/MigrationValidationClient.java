package org.openmetadata.service.migration;

import java.io.File;
import java.util.Arrays;
import java.util.List;
import java.util.Objects;
import java.util.stream.Stream;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.jdbi3.MigrationDAO;

@Slf4j
public class MigrationValidationClient {
  @Getter public static MigrationValidationClient instance;

  private final MigrationDAO migrationDAO;
  private final OpenMetadataApplicationConfig config;
  @Getter private final List<String> expectedMigrationList;

  private MigrationValidationClient(
      MigrationDAO migrationDAO, OpenMetadataApplicationConfig config) {
    this.migrationDAO = migrationDAO;
    this.config = config;
    this.expectedMigrationList = loadExpectedMigrationList();
  }

  public static MigrationValidationClient initialize(
      MigrationDAO migrationDAO, OpenMetadataApplicationConfig config) {

    if (instance == null) {
      instance = new MigrationValidationClient(migrationDAO, config);
    }
    return instance;
  }

  public List<String> getCurrentVersions() {
    return migrationDAO.getMigrationVersions();
  }

  private List<String> loadExpectedMigrationList() {
    try {
      String nativePath = config.getMigrationConfiguration().getNativePath();
      String extensionPath = config.getMigrationConfiguration().getExtensionPath();

      List<String> availableOMNativeMigrations = getMigrationFilesFromPath(nativePath);

      // Get Flyway versions from server_change_log (they have metrics = NULL)
      List<String> expectedFlywayVersions = getExpectedFlywayVersions();

      // If we only have OM and Flyway migrations, return them
      if (extensionPath == null || extensionPath.isEmpty()) {
        return Stream.concat(expectedFlywayVersions.stream(), availableOMNativeMigrations.stream())
            .sorted()
            .toList();
      }

      // Otherwise, fetch the extension migration and sort all results
      List<String> availableOMExtensionMigrations = getMigrationFilesFromPath(extensionPath);

      return Stream.of(
              expectedFlywayVersions.stream(),
              availableOMNativeMigrations.stream(),
              availableOMExtensionMigrations.stream())
          .flatMap(s -> s)
          .sorted()
          .toList();
    } catch (Exception e) {
      LOG.error("Error loading expected migration list", e);
      return List.of();
    }
  }

  private List<String> getMigrationFilesFromPath(String path) {
    return Arrays.stream(Objects.requireNonNull(new File(path).listFiles(File::isDirectory)))
        .map(File::getName)
        .sorted()
        .toList();
  }

  private List<String> getExpectedFlywayVersions() {
    try {
      // Query server_change_log for versions where migrationFileName contains 'flyway'
      return migrationDAO.getFlywayMigrationVersions();
    } catch (Exception e) {
      // If there's an error (e.g., table doesn't exist yet), return empty list
      LOG.debug("Could not fetch Flyway versions from SERVER_CHANGE_LOG: {}", e.getMessage());
      return List.of();
    }
  }
}
