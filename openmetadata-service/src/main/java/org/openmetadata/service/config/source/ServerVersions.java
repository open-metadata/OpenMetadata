/*
 *  Copyright 2026 Collate
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

package org.openmetadata.service.config.source;

import java.util.Arrays;
import java.util.regex.Pattern;

/** Orders server versions such as {@code 2.1.0} and {@code 2.1.0-SNAPSHOT} by their numbers. */
final class ServerVersions {
  private static final Pattern NUMBERS = Pattern.compile("^\\d+(\\.\\d+)*");
  private static final Pattern DOT = Pattern.compile("\\.");

  private ServerVersions() {}

  /** Whether {@code version} is older than {@code other}; unknown versions are never older. */
  static boolean isOlder(String version, String other) {
    int[] left = numbersOf(version);
    int[] right = numbersOf(other);
    return left.length > 0 && right.length > 0 && Arrays.compare(left, right) < 0;
  }

  private static int[] numbersOf(String version) {
    var matcher = version == null ? null : NUMBERS.matcher(version);
    return matcher != null && matcher.find()
        ? Arrays.stream(DOT.split(matcher.group())).mapToInt(Integer::parseInt).toArray()
        : new int[0];
  }
}
