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
package org.openmetadata.service.migration.utils;

import java.util.Collection;
import java.util.Optional;
import lombok.extern.slf4j.Slf4j;

/**
 * Version parsing and comparison for migration version strings ({@code major.minor.patch}, where
 * patch may carry a {@code -suffix} such as {@code -collate} or {@code -baseline}). Extracted from
 * {@code MigrationWorkflow} so the upgrade gate, baseline workflow, and validation client share one
 * implementation.
 */
@Slf4j
public final class MigrationVersionUtil {

  /**
   * Databases below this migration version cannot upgrade directly to this release; they must first
   * run the migrations of a 2.0.x release.
   */
  public static final String MINIMUM_SUPPORTED_MIGRATION_VERSION = "2.0.0";

  /**
   * SERVER_CHANGE_LOG version recorded by a baseline install. Parses as {@code [2,0,0]} (the dash
   * suffix is tolerated by {@link #parseVersion}) while remaining a distinct primary key from the
   * real {@code 2.0.0} row written by the incremental 2.0.0 migration.
   */
  public static final String BASELINE_VERSION = "2.0.0-baseline";

  private MigrationVersionUtil() {}

  /**
   * Parse a version string into an array of integers. Follows the format {@code
   * major.minor.patch}; patch can contain a {@code -suffix}. Throws on strings with fewer than
   * three dot-separated parts or non-numeric major/minor.
   */
  public static int[] parseVersion(String version) {
    String[] parts = version.split("\\.");
    int[] numbers = new int[parts.length];
    numbers[0] = Integer.parseInt(parts[0]);
    numbers[1] = Integer.parseInt(parts[1]);
    if (parts[2].contains("-")) {
      String[] extensionParts = parts[2].split("-");
      numbers[2] = Integer.parseInt(extensionParts[0]);
    } else {
      numbers[2] = Integer.parseInt(parts[2]);
    }
    return numbers;
  }

  public static int compareVersions(String version1, String version2) {
    int[] v1Parts = parseVersion(version1);
    int[] v2Parts = parseVersion(version2);
    int result = 0;
    int length = Math.max(v1Parts.length, v2Parts.length);
    for (int i = 0; i < length && result == 0; i++) {
      int part1 = i < v1Parts.length ? v1Parts[i] : 0;
      int part2 = i < v2Parts.length ? v2Parts[i] : 0;
      result = Integer.compare(part1, part2);
    }
    return result;
  }

  public static boolean isParseable(String version) {
    boolean result = true;
    try {
      parseVersion(version);
    } catch (RuntimeException e) {
      result = false;
    }
    return result;
  }

  /** True when the version parses and sorts below {@link #MINIMUM_SUPPORTED_MIGRATION_VERSION}. */
  public static boolean isBelowMinimum(String version) {
    return isParseable(version)
        && compareVersions(version, MINIMUM_SUPPORTED_MIGRATION_VERSION) < 0;
  }

  /**
   * Highest parseable version among the given strings. Unparseable entries (corrupt or hand-edited
   * SERVER_CHANGE_LOG rows) are skipped with a warning instead of failing the whole computation.
   */
  public static Optional<String> maxParseableVersion(Collection<String> versions) {
    return versions.stream()
        .filter(MigrationVersionUtil::warnIfUnparseable)
        .max(MigrationVersionUtil::compareVersions);
  }

  private static boolean warnIfUnparseable(String version) {
    boolean parseable = isParseable(version);
    if (!parseable) {
      LOG.warn("Skipping unparseable migration version '{}'", version);
    }
    return parseable;
  }
}
