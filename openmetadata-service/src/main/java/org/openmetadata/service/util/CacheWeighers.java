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

package org.openmetadata.service.util;

import com.google.common.cache.Weigher;
import org.openmetadata.schema.api.lineage.SearchLineageResult;

/**
 * Reusable {@link Weigher} implementations for Guava caches. Weight is expressed in approximate
 * bytes so that {@code maximumWeight} caps total heap consumed by the cache.
 */
public final class CacheWeighers {

  private static final int ESTIMATED_BYTES_PER_LINEAGE_NODE = 2048;

  private CacheWeighers() {}

  /**
   * Weigher for caches whose values are JSON {@link String}s. Weight = string length (≈ bytes for
   * ASCII/UTF-8 JSON).
   */
  public static <K> Weigher<K, String> stringWeigher() {
    return (key, value) -> value != null ? value.length() : 0;
  }

  /**
   * Weigher for caches whose values are {@link SearchLineageResult}. Weight = estimated heap from
   * node count × ~2 KB per node.
   */
  public static <K> Weigher<K, SearchLineageResult> lineageResultWeigher() {
    return (key, value) -> {
      if (value == null || value.getNodes() == null) {
        return 0;
      }
      return value.getNodes().size() * ESTIMATED_BYTES_PER_LINEAGE_NODE;
    };
  }

  /**
   * Weigher that estimates object size by serializing to JSON and measuring byte length. Use
   * sparingly — serialization on every put is expensive. Prefer {@link #stringWeigher()} when the
   * cached value is already a String.
   */
  public static <K, V> Weigher<K, V> jsonSerializationWeigher() {
    return (key, value) -> {
      if (value == null) {
        return 0;
      }
      try {
        return org.openmetadata.schema.utils.JsonUtils.pojoToJson(value).length();
      } catch (Exception e) {
        return 4096;
      }
    };
  }
}
