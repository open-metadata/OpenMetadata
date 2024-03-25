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

      // If we only have OM migrations, return them
      if (extensionPath == null || extensionPath.isEmpty()) {
        return availableOMNativeMigrations;
      }

      // Otherwise, fetch the extension migration and sort the results
      List<String> availableOMExtensionMigrations = getMigrationFilesFromPath(extensionPath);

      return Stream.concat(
              availableOMNativeMigrations.stream(), availableOMExtensionMigrations.stream())
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
}
