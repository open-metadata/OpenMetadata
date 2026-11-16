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

package org.openmetadata.service.fernet.rotation;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.stream.Collectors;
import java.util.stream.IntStream;

/**
 * Where a stored value is: a column of one row, or one Redis string or hash field.
 *
 * @param store the table name, or {@value #REDIS}
 * @param container the column, the hash field, or empty for a Redis string
 * @param keyColumns the primary key columns in ordinal order, or {@code key} for Redis
 * @param keyValues the row's key values as the database returned them, or the Redis key
 */
record Location(String store, String container, List<String> keyColumns, List<Object> keyValues) {
  static final String REDIS = "redis";
  private static final String REDIS_KEY = "key";
  private static final String ENTITY_TABLE_SUFFIX = "_entity";
  private static final Set<String> NAMED_TABLES =
      Set.of("entity_extension", "openmetadata_settings");
  private static final int DIGEST_LENGTH = 12;

  Location {
    keyColumns = List.copyOf(keyColumns);
    keyValues = List.copyOf(keyValues);
    if (keyColumns.size() != keyValues.size()) {
      throw new IllegalArgumentException("A key names one column per value");
    }
  }

  static Location ofRedis(String key, String field) {
    return new Location(REDIS, field, List.of(REDIS_KEY), List.of(key));
  }

  /**
   * Rows of entity tables, {@code entity_extension} and {@code openmetadata_settings} print their
   * key. Every other row and every Redis key prints a digest of its key, because some keys are
   * credentials.
   */
  String printable() {
    String place =
        keyValues.isEmpty() ? "(no primary key)" : printsKey() ? namedKey() : digestedKey();
    return store + " " + place + (container.isEmpty() ? "" : " " + container);
  }

  private boolean printsKey() {
    String table = store.toLowerCase(Locale.ROOT);
    return table.endsWith(ENTITY_TABLE_SUFFIX) || NAMED_TABLES.contains(table);
  }

  private String namedKey() {
    return IntStream.range(0, keyColumns.size())
        .mapToObj(i -> keyColumns.get(i) + "=" + keyValues.get(i))
        .collect(Collectors.joining(","));
  }

  private String digestedKey() {
    String joined = keyValues.stream().map(String::valueOf).collect(Collectors.joining("\u0000"));
    return REDIS_KEY + "=" + digest(joined);
  }

  static String digest(String text) {
    try {
      byte[] digest =
          MessageDigest.getInstance("SHA-256").digest(text.getBytes(StandardCharsets.UTF_8));
      return HexFormat.of().formatHex(digest).substring(0, DIGEST_LENGTH);
    } catch (NoSuchAlgorithmException e) {
      throw new IllegalStateException(e);
    }
  }
}
