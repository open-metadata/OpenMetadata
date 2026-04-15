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
 * heap bytes so that {@code maximumWeight} caps total heap consumed by the cache.
 */
public final class CacheWeighers {

  private static final int ESTIMATED_BYTES_PER_LINEAGE_NODE = 2048;
  private static final int STRING_OBJECT_OVERHEAD = 40;
  private static final int DEFAULT_OBJECT_WEIGHT = 4096;

  private CacheWeighers() {}

  /**
   * Weigher for caches whose values are JSON {@link String}s. Accounts for Java's UTF-16 internal
   * representation (2 bytes per char) plus ~40 bytes of String object overhead.
   */
  public static <K> Weigher<K, String> stringWeigher() {
    return (key, value) -> value != null ? value.length() * 2 + STRING_OBJECT_OVERHEAD : 0;
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
   * Lightweight weigher that estimates object heap size using {@code toString().length()} as a
   * proxy. Avoids the cost of full JSON serialization on every cache put. The estimate is rough but
   * sufficient for memory-cap purposes.
   */
  public static <K, V> Weigher<K, V> toStringWeigher() {
    return (key, value) -> {
      if (value == null) {
        return 0;
      }
      try {
        return value.toString().length() * 2 + STRING_OBJECT_OVERHEAD;
      } catch (Exception e) {
        return DEFAULT_OBJECT_WEIGHT;
      }
    };
  }
}
