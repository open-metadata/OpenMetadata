/*
 *  Copyright 2021 Collate.
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

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;

public class HashUtils {
  private static final int HASH_LENGTH = 6;

  private HashUtils() {
    // Utility class
  }

  /**
   * Generates a 6-character SHA-256 hash of the input string for deterministic name
   * truncation.
   *
   * @param input the string to hash
   * @return a 6-character hex string
   * @throws IllegalArgumentException if SHA-256 is not available
   */
  public static String hash(String input) {
    try {
      MessageDigest digest = MessageDigest.getInstance("SHA-256");
      byte[] encoded = digest.digest(input.getBytes(StandardCharsets.UTF_8));
      StringBuilder hex = new StringBuilder();
      for (byte value : encoded) {
        hex.append(String.format("%02x", value & 0xff));
      }
      return hex.substring(0, HASH_LENGTH);
    } catch (NoSuchAlgorithmException e) {
      throw new IllegalArgumentException("SHA-256 algorithm not available", e);
    }
  }
}
