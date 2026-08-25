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

package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertTrue;

import com.google.common.cache.Cache;
import com.google.common.cache.CacheBuilder;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Demonstrates the memory impact of Guava caches with large entity JSON strings. This test proves
 * that count-based caches with high maximumSize are dangerous when values vary in size from 1KB to
 * 2MB+.
 *
 * <p>Tagged as "benchmark" — excluded from default CI test runs. Run explicitly with:
 * mvn test -pl openmetadata-service -Dtest=EntityCacheMemoryTest -Dgroups=benchmark
 */
@Tag("benchmark")
class EntityCacheMemoryTest {

  private static final Logger LOG = LoggerFactory.getLogger(EntityCacheMemoryTest.class);

  /**
   * Simulates a realistic entity JSON string of a given size. In production, Table entities with
   * hundreds of columns, nested tags, profiles, and constraints can easily reach 500KB-2MB.
   */
  private static String createEntityJson(int sizeInBytes) {
    StringBuilder sb = new StringBuilder(sizeInBytes);
    sb.append("{\"columns\":[");
    while (sb.length() < sizeInBytes - 10) {
      sb.append("{\"name\":\"col_")
          .append(sb.length())
          .append("\",\"type\":\"VARCHAR\",\"description\":\"A column\"},");
    }
    sb.append("]}");
    return sb.toString();
  }

  @Test
  @DisplayName(
      "Count-based cache with maximumSize=20000 allows unbounded memory growth with large entities")
  void countBasedCache_allowsUnboundedMemory() {
    // Simulate the OLD configuration: maximumSize(20000)
    Cache<String, String> countBasedCache =
        CacheBuilder.newBuilder().maximumSize(20000).expireAfterWrite(30, TimeUnit.SECONDS).build();

    // Fill with 500 "large" entities (500KB each)
    int largeEntitySize = 500 * 1024;
    int entriesToInsert = 500;
    long totalPayloadBytes = 0;
    for (int i = 0; i < entriesToInsert; i++) {
      String json = createEntityJson(largeEntitySize);
      countBasedCache.put("entity-" + i, json);
      totalPayloadBytes += json.length();
    }

    long payloadMB = totalPayloadBytes / (1024 * 1024);

    LOG.info(
        "Count-based cache (maximumSize=20000): {} entries, ~{}MB payload retained",
        countBasedCache.size(),
        payloadMB);

    // The cache happily holds all 500 entries because 500 < 20000.
    // Deterministic assertion: all entries are retained regardless of payload size.
    assertTrue(
        countBasedCache.size() == entriesToInsert, "All entries fit within maximumSize=20000");
    assertTrue(
        payloadMB > 100,
        "Cache retained >100MB of JSON payload with just 500 entries. "
            + "At 20K entries this would be ~10GB. Actual: "
            + payloadMB
            + "MB");
  }

  @Test
  @DisplayName(
      "Weight-based cache with maximumWeight=100MB evicts large entries to stay within cap")
  void weightBasedCache_respectsMemoryCap() {
    long maxWeightBytes = 100 * 1024 * 1024L; // 100MB cap

    // Conservative upper-bound weight for a String: length() * 2 (UTF-16 worst-case) + 40 header.
    // On Java 21 with compact strings, LATIN1 content uses fewer bytes, so this slightly
    // overestimates — which is intentional for memory capping. Zero allocation, single field read.
    Cache<String, String> weightBasedCache =
        CacheBuilder.newBuilder()
            .maximumWeight(maxWeightBytes)
            .weigher((String key, String value) -> value != null ? value.length() * 2 + 40 : 0)
            .expireAfterWrite(30, TimeUnit.SECONDS)
            .build();

    int largeEntitySize = 500 * 1024; // 500KB per entity
    int entriesToInsert = 500; // Try to insert 500 × 500KB = ~250MB
    for (int i = 0; i < entriesToInsert; i++) {
      weightBasedCache.put("entity-" + i, createEntityJson(largeEntitySize));
    }

    // Weight per entry: 500KB chars * 2 bytes/char + 40 = ~1MB per entry
    // 100MB cap / ~1MB per entry ≈ 100 entries max
    long actualEntries = weightBasedCache.size();

    LOG.info(
        "Weight-based cache (maximumWeight=100MB): {} entries retained out of {} inserted",
        actualEntries,
        entriesToInsert);

    assertTrue(
        actualEntries < 150,
        "Weight-based cache should have evicted to stay within 100MB. "
            + "Retained: "
            + actualEntries
            + " (expected ~100)");
    assertTrue(
        actualEntries > 50,
        "Weight-based cache should retain at least some entries. Retained: " + actualEntries);
  }

  @Test
  @DisplayName("Mixed entity sizes: small entities get more slots, large entities get fewer")
  void weightBasedCache_handlesMixedSizes() {
    long maxWeightBytes = 50 * 1024 * 1024L; // 50MB cap

    Cache<String, String> cache =
        CacheBuilder.newBuilder()
            .maximumWeight(maxWeightBytes)
            .weigher((String key, String value) -> value != null ? value.length() * 2 + 40 : 0)
            .expireAfterWrite(30, TimeUnit.SECONDS)
            .build();

    // Insert 1000 small entities (1KB each)
    for (int i = 0; i < 1000; i++) {
      cache.put("small-" + i, createEntityJson(1024));
    }
    long afterSmall = cache.size();

    // Now insert 50 large entities (2MB each) — these should evict small ones
    for (int i = 0; i < 50; i++) {
      cache.put("large-" + i, createEntityJson(2 * 1024 * 1024));
    }
    long afterLarge = cache.size();

    LOG.info(
        "Mixed sizes: {} entries after 1000 small inserts, {} entries after 50 large (2MB) inserts",
        afterSmall,
        afterLarge);

    // After large inserts, cache should have far fewer total entries
    assertTrue(
        afterLarge < afterSmall,
        "Large entities should evict small ones. Before: " + afterSmall + ", After: " + afterLarge);
    assertTrue(
        afterLarge < 30,
        "50 × 2MB = 100MB but cap is 50MB, so at most ~12 large entries fit. Actual: "
            + afterLarge);
  }

  @Test
  @DisplayName("String weigher produces conservative upper-bound weight")
  void stringWeigher_producesConservativeWeight() {
    String smallJson = createEntityJson(1024); // 1KB
    String largeJson = createEntityJson(1024 * 1024); // 1MB

    int smallWeight = smallJson.length() * 2 + 40;
    int largeWeight = largeJson.length() * 2 + 40;

    LOG.info("1KB entity: chars={}, weight={}B", smallJson.length(), smallWeight);
    LOG.info("1MB entity: chars={}, weight={}B", largeJson.length(), largeWeight);

    // A 1KB string should weigh ~2KB in heap (UTF-16)
    assertTrue(
        smallWeight > 2000 && smallWeight < 3000,
        "1KB string should weigh ~2KB. Actual: " + smallWeight);
    // A 1MB string should weigh ~2MB in heap (UTF-16)
    assertTrue(
        largeWeight > 1_900_000 && largeWeight < 2_200_000,
        "1MB string should weigh ~2MB. Actual: " + largeWeight);
  }
}
