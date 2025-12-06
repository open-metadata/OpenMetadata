package org.openmetadata.service.migration;

import java.io.File;
import java.util.Arrays;
import java.util.HashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;
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

      List<String> executedMigrations = getExecutedMigrations();
      List<String> availableOMNativeMigrations = getMigrationFilesFromPath(nativePath);

      // Filter out gap migrations from native migrations
      List<String> filteredNativeMigrations =
          filterGapMigrations(availableOMNativeMigrations, executedMigrations);

      // Get Flyway versions from server_change_log (they have metrics = NULL)
      List<String> expectedFlywayVersions = getExpectedFlywayVersions();

      // Build the expected list including:
      // 1. All executed migrations (even if directory was removed)
      // 2. All filtered native/extension migrations from disk
      // 3. All Flyway versions
      Set<String> expectedSet = new HashSet<>(executedMigrations);
      expectedSet.addAll(filteredNativeMigrations);
      expectedSet.addAll(expectedFlywayVersions);

      // If we only have OM and Flyway migrations, return them
      if (extensionPath == null || extensionPath.isEmpty()) {
        return expectedSet.stream().sorted().toList();
      }

      // Otherwise, fetch the extension migration and add them
      List<String> availableOMExtensionMigrations = getMigrationFilesFromPath(extensionPath);
      // Filter out gap migrations from extension migrations
      List<String> filteredExtensionMigrations =
          filterGapMigrations(availableOMExtensionMigrations, executedMigrations);

      expectedSet.addAll(filteredExtensionMigrations);

      return expectedSet.stream().sorted().toList();
    } catch (Exception e) {
      LOG.error("Error loading expected migration list", e);
      return List.of();
    }
  }

  /**
   * Filters out "gap migrations" from the list of available migrations.
   *
   * <p>A gap migration occurs when a migration directory was removed in a release and later
   * re-added. Users who upgraded through the release without the directory never executed that
   * migration and shouldn't be required to have it in their history.
   *
   * <p>A migration is considered a "gap" if:
   *
   * <ul>
   *   <li>It exists on disk (in availableMigrations)
   *   <li>It was NOT executed (not in executedMigrations)
   *   <li>The user's max executed version is GREATER than this migration's version
   * </ul>
   *
   * @param availableMigrations List of migration versions found on disk
   * @param executedMigrations List of migration versions that have been executed
   * @return Filtered list excluding gap migrations
   */
  private List<String> filterGapMigrations(
      List<String> availableMigrations, List<String> executedMigrations) {
    if (executedMigrations.isEmpty()) {
      // Fresh install - all migrations are expected
      return availableMigrations;
    }

    // Since executedMigrations is non-empty, max() will always return a value
    String maxVersion = executedMigrations.stream().max(this::compareVersions).orElseThrow();
    Set<String> executedSet = new HashSet<>(executedMigrations);

    return availableMigrations.stream()
        .filter(
            version -> {
              // Include if already executed
              if (executedSet.contains(version)) {
                return true;
              }
              // Include if it's a new migration (version > max executed)
              // Exclude if it's a gap migration (version <= max executed but not executed)
              boolean isNewMigration = compareVersions(version, maxVersion) > 0;
              if (!isNewMigration) {
                LOG.debug(
                    "Ignoring gap migration {} (user already at version {})", version, maxVersion);
              }
              return isNewMigration;
            })
        .toList();
  }

  private List<String> getExecutedMigrations() {
    try {
      return migrationDAO.getMigrationVersions();
    } catch (Exception e) {
      LOG.debug("Could not fetch executed migrations: {}", e.getMessage());
      return List.of();
    }
  }

  private int compareVersions(String v1, String v2) {
    String[] parts1 = v1.split("\\.");
    String[] parts2 = v2.split("\\.");

    int length = Math.max(parts1.length, parts2.length);
    for (int i = 0; i < length; i++) {
      int p1 = i < parts1.length ? parseVersionPart(parts1[i]) : 0;
      int p2 = i < parts2.length ? parseVersionPart(parts2[i]) : 0;
      if (p1 != p2) {
        return Integer.compare(p1, p2);
      }
    }
    return 0;
  }

  private int parseVersionPart(String part) {
    if (part.contains("-")) {
      part = part.split("-")[0];
    }
    try {
      return Integer.parseInt(part);
    } catch (NumberFormatException e) {
      return 0;
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
