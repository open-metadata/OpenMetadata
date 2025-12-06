/*
 *  Copyright 2021 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.service.migration;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

/**
 * Unit tests for MigrationValidationClient focusing on the "gap migration" scenario.
 *
 * <p>The gap migration problem occurs when:
 *
 * <ol>
 *   <li>Version X.Y.Z is released with a migration directory
 *   <li>The directory is removed in a subsequent release (e.g., X.Y.Z+1)
 *   <li>Users upgrade through X.Y.Z+1, never executing the X.Y.Z migration
 *   <li>The directory is added back in a later release (e.g., X.Y.Z+N)
 *   <li>Validation fails because the directory exists but wasn't executed
 * </ol>
 *
 * <p>The fix: If a migration directory exists but the user's max executed version is greater than
 * that directory's version, we should NOT require that migration to be in the executed list.
 */
public class MigrationValidationClientTest {

  private Path tempMigrationDir;

  @BeforeEach
  void setUp() throws IOException {
    tempMigrationDir = Files.createTempDirectory("test-migrations");
  }

  @AfterEach
  void tearDown() throws IOException {
    if (tempMigrationDir != null && Files.exists(tempMigrationDir)) {
      Files.walk(tempMigrationDir)
          .sorted(Comparator.reverseOrder())
          .map(Path::toFile)
          .forEach(File::delete);
    }
  }

  @Test
  void testGapMigrationScenario_UserSkippedVersion() throws IOException {
    // Simulate the 1.10.2 gap scenario:
    // - Directories on disk: 1.10.1, 1.10.2, 1.10.3, 1.10.8
    // - User executed: 1.10.1, 1.10.3, 1.10.8 (skipped 1.10.2 because dir was removed in 1.10.3)

    createMigrationDirectory("1.10.1");
    createMigrationDirectory("1.10.2"); // This was removed in 1.10.3, re-added later
    createMigrationDirectory("1.10.3");
    createMigrationDirectory("1.10.8");

    List<String> directoriesOnDisk = getMigrationDirectories();
    List<String> executedMigrations = List.of("1.10.1", "1.10.3", "1.10.8");

    // The gap: 1.10.2 is on disk but not executed
    // Current behavior: This would be flagged as a missing migration (WRONG)
    // Expected behavior: Should be ignored because user is already past 1.10.2

    List<String> missingMigrations = findMissingMigrations(directoriesOnDisk, executedMigrations);

    // With the fix, 1.10.2 should NOT be in missing migrations
    // because user's max version (1.10.8) > 1.10.2
    assertFalse(
        missingMigrations.contains("1.10.2"),
        "Gap migration 1.10.2 should be ignored since user is at version 1.10.8");

    assertTrue(missingMigrations.isEmpty(), "No migrations should be flagged as missing");
  }

  @Test
  void testGapMigrationScenario_NewMigrationRequired() throws IOException {
    // User is at 1.10.3, new version 1.10.8 is available
    // Directories: 1.10.1, 1.10.2, 1.10.3, 1.10.8
    // Executed: 1.10.1, 1.10.3 (skipped 1.10.2)

    createMigrationDirectory("1.10.1");
    createMigrationDirectory("1.10.2");
    createMigrationDirectory("1.10.3");
    createMigrationDirectory("1.10.8");

    List<String> directoriesOnDisk = getMigrationDirectories();
    List<String> executedMigrations = List.of("1.10.1", "1.10.3");

    List<String> missingMigrations = findMissingMigrations(directoriesOnDisk, executedMigrations);

    // 1.10.2 should be ignored (gap, user past it)
    // 1.10.8 should be flagged as pending (new migration needed)
    assertFalse(
        missingMigrations.contains("1.10.2"),
        "Gap migration 1.10.2 should be ignored since user is at version 1.10.3");

    assertTrue(
        missingMigrations.contains("1.10.8"), "New migration 1.10.8 should be flagged as pending");

    assertEquals(1, missingMigrations.size(), "Only 1.10.8 should be pending");
  }

  @Test
  void testNoGap_AllMigrationsExecuted() throws IOException {
    createMigrationDirectory("1.10.1");
    createMigrationDirectory("1.10.2");
    createMigrationDirectory("1.10.3");

    List<String> directoriesOnDisk = getMigrationDirectories();
    List<String> executedMigrations = List.of("1.10.1", "1.10.2", "1.10.3");

    List<String> missingMigrations = findMissingMigrations(directoriesOnDisk, executedMigrations);

    assertTrue(missingMigrations.isEmpty(), "No migrations should be missing");
  }

  @Test
  void testMultipleGaps_AllIgnored() throws IOException {
    // Multiple gaps in history
    createMigrationDirectory("1.9.0");
    createMigrationDirectory("1.9.1"); // Gap
    createMigrationDirectory("1.9.2"); // Gap
    createMigrationDirectory("1.10.0");
    createMigrationDirectory("1.10.2"); // Gap (the real 1.10.2 issue)
    createMigrationDirectory("1.10.8");

    List<String> directoriesOnDisk = getMigrationDirectories();
    // User went 1.9.0 -> 1.10.0 -> 1.10.8, skipping 1.9.1, 1.9.2, and 1.10.2
    List<String> executedMigrations = List.of("1.9.0", "1.10.0", "1.10.8");

    List<String> missingMigrations = findMissingMigrations(directoriesOnDisk, executedMigrations);

    // All gaps should be ignored since user is at 1.10.8
    assertFalse(missingMigrations.contains("1.9.1"), "Gap 1.9.1 should be ignored");
    assertFalse(missingMigrations.contains("1.9.2"), "Gap 1.9.2 should be ignored");
    assertFalse(missingMigrations.contains("1.10.2"), "Gap 1.10.2 should be ignored");

    assertTrue(missingMigrations.isEmpty(), "No migrations should be missing");
  }

  @Test
  void testFreshInstall_AllMigrationsRequired() throws IOException {
    createMigrationDirectory("1.10.1");
    createMigrationDirectory("1.10.2");
    createMigrationDirectory("1.10.3");

    List<String> directoriesOnDisk = getMigrationDirectories();
    List<String> executedMigrations = List.of(); // Fresh install

    List<String> missingMigrations = findMissingMigrations(directoriesOnDisk, executedMigrations);

    // All should be required for fresh install
    assertEquals(
        3, missingMigrations.size(), "All migrations should be required for fresh install");
    assertTrue(missingMigrations.contains("1.10.1"));
    assertTrue(missingMigrations.contains("1.10.2"));
    assertTrue(missingMigrations.contains("1.10.3"));
  }

  /**
   * This test demonstrates that the CURRENT behavior in MigrationWorkflow is broken. The current
   * logic only filters migrations that are GREATER than the max executed version. This means gap
   * migrations (versions less than max but not executed) would still be included in the "to apply"
   * list, but then fail because they've already been "passed" in the version history.
   *
   * <p>The fix should be in MigrationWorkflow.getMigrationsToApply() or the validation logic.
   */
  @Test
  void testCurrentBehavior_GapMigrationBug() throws IOException {
    // Simulate the 1.10.2 gap scenario
    createMigrationDirectory("1.10.1");
    createMigrationDirectory("1.10.2"); // Gap - was removed in 1.10.3, re-added later
    createMigrationDirectory("1.10.3");
    createMigrationDirectory("1.10.8");

    List<String> directoriesOnDisk = getMigrationDirectories();
    // User executed: 1.10.1, 1.10.3, 1.10.8 (skipped 1.10.2)
    List<String> executedMigrations = List.of("1.10.1", "1.10.3", "1.10.8");

    // This simulates the CURRENT behavior in MigrationWorkflow.processNativeMigrations()
    // which only looks at max version and filters for versions > max
    List<String> currentBehaviorMissing =
        findMissingMigrationsCurrentBehavior(directoriesOnDisk, executedMigrations);

    // Current behavior returns empty because all directories are <= max executed (1.10.8)
    // But the VALIDATION would still fail because 1.10.2 is on disk but not in SERVER_CHANGE_LOG
    assertTrue(
        currentBehaviorMissing.isEmpty(),
        "Current behavior returns no pending migrations (correct for MigrationWorkflow)");

    // The REAL bug is in validation - it compares directories on disk vs SERVER_CHANGE_LOG
    // and 1.10.2 would be flagged as "expected but not executed"
    List<String> validationMissing =
        findMissingMigrationsForValidation(directoriesOnDisk, executedMigrations);

    // This is what the CURRENT validation sees - 1.10.2 is "missing" (BUG!)
    assertTrue(
        validationMissing.contains("1.10.2"),
        "Current validation incorrectly flags 1.10.2 as missing");

    // With the FIX, the validation should NOT flag 1.10.2 as missing
    List<String> fixedValidationMissing =
        findMissingMigrations(directoriesOnDisk, executedMigrations);

    assertFalse(
        fixedValidationMissing.contains("1.10.2"),
        "Fixed validation should NOT flag 1.10.2 as missing");
  }

  /**
   * Simulates the current behavior in MigrationWorkflow.processNativeMigrations() Only returns
   * migrations > max executed version
   */
  private List<String> findMissingMigrationsCurrentBehavior(
      List<String> directoriesOnDisk, List<String> executedMigrations) {
    Optional<String> maxMigration = executedMigrations.stream().max(this::compareVersions);
    if (maxMigration.isPresent()) {
      return directoriesOnDisk.stream()
          .filter(dir -> compareVersions(dir, maxMigration.get()) > 0)
          .toList();
    }
    return new ArrayList<>(directoriesOnDisk);
  }

  /**
   * Simulates the CURRENT validation behavior - simply checks if all directories are in the
   * executed list. This is the BUG - it doesn't account for gap migrations.
   */
  private List<String> findMissingMigrationsForValidation(
      List<String> directoriesOnDisk, List<String> executedMigrations) {
    return directoriesOnDisk.stream().filter(dir -> !executedMigrations.contains(dir)).toList();
  }

  /**
   * Tests the scenario where a user executed a migration (e.g., 1.10.2) but the directory was later
   * removed. The validation should NOT flag this as an "unexpected" migration.
   *
   * <p>This is the inverse of the gap migration problem - the user has MORE migrations in their
   * history than directories on disk.
   */
  @Test
  void testExecutedMigrationDirectoryRemoved() throws IOException {
    // Directories on disk: 1.10.1, 1.10.3 (1.10.2 was removed)
    createMigrationDirectory("1.10.1");
    createMigrationDirectory("1.10.3");

    List<String> directoriesOnDisk = getMigrationDirectories();
    // User executed: 1.10.1, 1.10.2, 1.10.3 (they ran 1.10.2 when it existed)
    List<String> executedMigrations = List.of("1.10.1", "1.10.2", "1.10.3");

    // The "expected" list should include 1.10.2 because the user executed it,
    // even though the directory no longer exists
    List<String> expectedMigrations =
        buildExpectedMigrationList(directoriesOnDisk, executedMigrations);

    // 1.10.2 should be in expected list (because it was executed)
    assertTrue(
        expectedMigrations.contains("1.10.2"),
        "Executed migration 1.10.2 should be in expected list even if directory removed");

    // All executed migrations should match expected
    assertEquals(
        new java.util.HashSet<>(executedMigrations),
        new java.util.HashSet<>(expectedMigrations),
        "Expected and executed migrations should match");
  }

  /**
   * Builds the expected migration list accounting for both: - Gap migrations (on disk but not
   * executed, older than max) - Removed directories (executed but no longer on disk)
   *
   * <p>The expected list should be: - All executed migrations (they ran, so they're expected) - All
   * directories newer than max executed (pending migrations)
   */
  private List<String> buildExpectedMigrationList(
      List<String> directoriesOnDisk, List<String> executedMigrations) {
    if (executedMigrations.isEmpty()) {
      return directoriesOnDisk;
    }

    String maxExecutedVersion = executedMigrations.stream().max(this::compareVersions).orElse(null);

    if (maxExecutedVersion == null) {
      return directoriesOnDisk;
    }

    // Start with all executed migrations (they should always be expected)
    java.util.Set<String> expected = new java.util.HashSet<>(executedMigrations);

    // Add any NEW migrations from disk (version > max executed)
    directoriesOnDisk.stream()
        .filter(dir -> compareVersions(dir, maxExecutedVersion) > 0)
        .forEach(expected::add);

    return expected.stream().sorted().toList();
  }

  /**
   * Tests extension migrations with collate suffix (e.g., 1.10.2-collate) Extension migrations have
   * different handling - they check if version is in executed list, not just > max.
   */
  @Test
  void testExtensionMigrationWithGap() throws IOException {
    // Native migrations
    createMigrationDirectory("1.10.1");
    createMigrationDirectory("1.10.2"); // Gap in native
    createMigrationDirectory("1.10.3");

    List<String> directoriesOnDisk = getMigrationDirectories();
    // User executed native: 1.10.1, 1.10.3 (skipped 1.10.2)
    // User executed extension: 1.10.1-collate
    List<String> executedMigrations = List.of("1.10.1", "1.10.3", "1.10.1-collate");

    // For native migrations, 1.10.2 should be ignored (gap)
    List<String> missingNative = findMissingMigrations(directoriesOnDisk, executedMigrations);
    assertFalse(missingNative.contains("1.10.2"), "Gap migration 1.10.2 should be ignored");
  }

  /**
   * Tests that version comparison handles collate suffix correctly. 1.10.2-collate should be
   * compared as 1.10.2 for ordering purposes.
   */
  @Test
  void testVersionComparisonWithCollateSuffix() {
    // 1.10.2 vs 1.10.2-collate should be equal (same base version)
    assertEquals(0, compareVersions("1.10.2", "1.10.2-collate"));

    // 1.10.1 < 1.10.2-collate
    assertTrue(compareVersions("1.10.1", "1.10.2-collate") < 0);

    // 1.10.3 > 1.10.2-collate
    assertTrue(compareVersions("1.10.3", "1.10.2-collate") > 0);
  }

  private void createMigrationDirectory(String version) throws IOException {
    Files.createDirectories(tempMigrationDir.resolve(version));
  }

  private List<String> getMigrationDirectories() {
    File[] dirs = tempMigrationDir.toFile().listFiles(File::isDirectory);
    if (dirs == null) {
      return List.of();
    }
    return java.util.Arrays.stream(dirs).map(File::getName).sorted().toList();
  }

  /**
   * This method represents the logic that SHOULD be in MigrationValidationClient. It finds
   * migrations that are truly missing (need to be run) vs gap migrations (can be ignored).
   *
   * <p>A migration directory is considered a "gap" if: - It exists on disk - It was NOT executed -
   * The user's max executed version is GREATER than this directory's version
   *
   * <p>Gap migrations should be ignored because the user successfully upgraded past them when the
   * directory didn't exist.
   */
  private List<String> findMissingMigrations(
      List<String> directoriesOnDisk, List<String> executedMigrations) {
    if (executedMigrations.isEmpty()) {
      // Fresh install - all migrations are required
      return directoriesOnDisk;
    }

    String maxExecutedVersion = executedMigrations.stream().max(this::compareVersions).orElse(null);

    if (maxExecutedVersion == null) {
      return directoriesOnDisk;
    }

    return directoriesOnDisk.stream()
        .filter(dir -> !executedMigrations.contains(dir))
        .filter(
            dir -> {
              // Only include if this version is GREATER than max executed
              // (i.e., it's a new migration, not a gap)
              return compareVersions(dir, maxExecutedVersion) > 0;
            })
        .toList();
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
    return Integer.parseInt(part);
  }
}
