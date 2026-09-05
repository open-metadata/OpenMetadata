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

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;

class MigrationVersionUtilTest {

  @Test
  void parseVersionHandlesPlainAndSuffixedVersions() {
    assertArrayEquals(new int[] {1, 13, 4}, MigrationVersionUtil.parseVersion("1.13.4"));
    assertArrayEquals(new int[] {2, 0, 0}, MigrationVersionUtil.parseVersion("2.0.0"));
    assertArrayEquals(new int[] {1, 12, 1}, MigrationVersionUtil.parseVersion("1.12.1-collate"));
    assertArrayEquals(
        new int[] {2, 0, 0},
        MigrationVersionUtil.parseVersion(MigrationVersionUtil.BASELINE_VERSION));
  }

  @Test
  void parseVersionRejectsMalformedVersions() {
    assertThrows(RuntimeException.class, () -> MigrationVersionUtil.parseVersion("2.0"));
    assertThrows(RuntimeException.class, () -> MigrationVersionUtil.parseVersion("not-a-version"));
    assertThrows(RuntimeException.class, () -> MigrationVersionUtil.parseVersion(""));
  }

  @Test
  void compareVersionsOrdersNumerically() {
    assertTrue(MigrationVersionUtil.compareVersions("1.2.0", "1.10.0") < 0);
    assertTrue(MigrationVersionUtil.compareVersions("2.0.0", "1.13.4") > 0);
    assertTrue(MigrationVersionUtil.compareVersions("0.0.15", "1.1.0") < 0);
    assertEquals(0, MigrationVersionUtil.compareVersions("2.0.0", "2.0.0-baseline"));
  }

  @Test
  void isBelowMinimumComparesAgainstTwoZero() {
    assertTrue(MigrationVersionUtil.isBelowMinimum("1.13.4"));
    assertTrue(MigrationVersionUtil.isBelowMinimum("0.0.15"));
    assertTrue(MigrationVersionUtil.isBelowMinimum("1.12.1-collate"));
    assertFalse(MigrationVersionUtil.isBelowMinimum("2.0.0"));
    assertFalse(MigrationVersionUtil.isBelowMinimum(MigrationVersionUtil.BASELINE_VERSION));
    assertFalse(MigrationVersionUtil.isBelowMinimum("2.1.0"));
    assertFalse(MigrationVersionUtil.isBelowMinimum("garbage"));
  }

  @Test
  void maxParseableVersionSkipsUnparseableRows() {
    Optional<String> max =
        MigrationVersionUtil.maxParseableVersion(
            List.of("1.13.4", "not-a-version", "2.0.0", "0.0.15"));
    assertEquals(Optional.of("2.0.0"), max);
  }

  @Test
  void maxParseableVersionEmptyWhenNothingParses() {
    assertEquals(
        Optional.empty(), MigrationVersionUtil.maxParseableVersion(List.of("garbage", "x.y.z")));
    assertEquals(Optional.empty(), MigrationVersionUtil.maxParseableVersion(List.of()));
  }
}
