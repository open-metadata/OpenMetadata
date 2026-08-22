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
import org.openmetadata.service.migration.utils.MigrationVersionUtil;

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

  /**
   * Applied versions, restricted to the range this release still ships directories for.
   *
   * <p>An upgraded cluster keeps its full history — those rows are an audit trail and are never
   * deleted — but the pre-2.0 entries no longer have a matching directory on disk, and the baseline
   * row stands in for all of them at once. Comparing the raw lists would therefore report every
   * long-running installation as broken.
   */
  public List<String> getCurrentVersionsForValidation() {
    return migrationDAO.getMigrationVersions().stream()
        .filter(version -> !MigrationVersionUtil.BASELINE_VERSION.equals(version))
        .filter(MigrationValidationClient::isWithinSupportedRange)
        .sorted()
        .toList();
  }

  /** Extension versions are supplied by downstream distributions and are never floored. */
  private static boolean isWithinSupportedRange(String version) {
    return version.contains("-") || !MigrationVersionUtil.isBelowMinimum(version);
  }

  private List<String> loadExpectedMigrationList() {
    try {
      String nativePath = config.getMigrationConfiguration().getNativePath();
      String extensionPath = config.getMigrationConfiguration().getExtensionPath();

      List<String> availableOMNativeMigrations = getMigrationFilesFromPath(nativePath);

      if (extensionPath == null || extensionPath.isEmpty()) {
        return withinSupportedRange(availableOMNativeMigrations.stream());
      }

      // Otherwise, fetch the extension migration and sort all results
      List<String> availableOMExtensionMigrations = getMigrationFilesFromPath(extensionPath);

      return withinSupportedRange(
          Stream.concat(
              availableOMNativeMigrations.stream(), availableOMExtensionMigrations.stream()));
    } catch (Exception e) {
      LOG.error("Error loading expected migration list", e);
      return List.of();
    }
  }

  private static List<String> withinSupportedRange(Stream<String> versions) {
    return versions.filter(MigrationValidationClient::isWithinSupportedRange).sorted().toList();
  }

  private List<String> getMigrationFilesFromPath(String path) {
    return Arrays.stream(Objects.requireNonNull(new File(path).listFiles(File::isDirectory)))
        .map(File::getName)
        .sorted()
        .toList();
  }
}
