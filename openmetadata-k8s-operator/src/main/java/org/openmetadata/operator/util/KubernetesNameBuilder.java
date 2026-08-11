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

package org.openmetadata.operator.util;

/**
 * Utility for building deterministic Kubernetes resource names within a length limit.
 */
public final class KubernetesNameBuilder {

  private static final int HASH_LENGTH = 6;

  private KubernetesNameBuilder() {
    // Utility class
  }

  public static String fitNameWithHash(
      String baseName, int maxBaseLength, String fallbackBaseName) {
    if (maxBaseLength < 1) {
      throw new IllegalArgumentException(
          "Kubernetes resource name must allow at least one character");
    }

    if (fallbackBaseName == null || fallbackBaseName.isEmpty()) {
      throw new IllegalArgumentException("fallbackBaseName must not be null or empty");
    }

    String candidate = baseName == null ? "" : baseName;
    if (candidate.length() > maxBaseLength) {
      String hash = HashUtils.hash(candidate).substring(0, Math.min(HASH_LENGTH, maxBaseLength));
      int maxPrefixLength = maxBaseLength - hash.length() - 1;

      if (maxPrefixLength > 0) {
        String prefix = trimTrailingSeparators(candidate.substring(0, maxPrefixLength));
        if (!prefix.isEmpty()) {
          return prefix + "-" + hash;
        }

        String fallbackPrefix =
            trimTrailingSeparators(
                fallbackBaseName.substring(
                    0, Math.min(fallbackBaseName.length(), maxPrefixLength)));
        if (!fallbackPrefix.isEmpty()) {
          return fallbackPrefix + "-" + hash;
        }
      }

      return hash;
    }

    if (candidate.isEmpty()) {
      candidate = fallbackBaseName;
    }

    if (candidate.length() > maxBaseLength) {
      throw new IllegalStateException(
          "Fallback name exceeds max base length (" + maxBaseLength + ")");
    }

    return candidate;
  }

  private static String trimTrailingSeparators(String value) {
    return value.replaceAll("[^a-z0-9]+$", "");
  }
}
