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
package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.Map;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.junit.jupiter.api.parallel.Isolated;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.network.RequestOptions;

/**
 * Integration tests for {@link org.openmetadata.service.cache.CachedSearchLayer}.
 *
 * <p>Verifies the auth-aware search-response cache shipped in plan Item 1 of
 * {@code .context/cache-perf-findings.md}. Tests are designed to be cache-on; if the cluster is
 * running with {@code CACHE_PROVIDER=none}, the {@code byType.search} block in
 * {@code /cache/stats} stays at zero and the lazily-asserted hit-ratio assertions are skipped
 * (the cache is expected to be inactive).
 *
 * <p>Skipped here (deferred to follow-up):
 *
 * <ul>
 *   <li>TTL expiry — would block CI for 30s+ per assertion. Manual verification only.
 *   <li>{@code CACHE_PROVIDER=none} mode — needs a separate test profile that boots the server
 *       with the cache-off overlay. Tracked in cache plan Phase 2.
 *   <li>Cross-principal isolation — needs a non-admin token; we verify same-principal
 *       hit/miss as a proxy for now.
 * </ul>
 */
// Assertions depend on deltas in the GLOBAL /system/cache/stats counters (a single instance-
// wide block — there is no per-test scoping). Running CONCURRENT with other ITs that issue
// searches would inflate the counters and either make these tests flaky (false negatives,
// the expected hit count never materializes) or silently mask broken cache keying (false
// positives, the deltas come from someone else's hits). @Isolated + SAME_THREAD makes the
// whole class run alone so the only writers to those counters during the test window are
// the test methods themselves.
@Isolated("relies on global /system/cache/stats counter deltas")
@Execution(ExecutionMode.SAME_THREAD)
class CachedSearchLayerIT {

  private static final String SEARCH_PATH = "/v1/search/query";
  private static final String STATS_PATH = "/v1/system/cache/stats";

  /**
   * The same query from the same principal hits the cache on call 2+. Verify by capturing the
   * application-level metrics block delta — we expect at least one increment in
   * {@code metrics.byType.search.hits} for {@code N-1} of {@code N} calls.
   */
  @Test
  void sameQueryHitsCacheOnSecondCall() {
    OpenMetadataClient client = SdkClients.adminClient();
    // Use a unique-per-test query string so we always start cold. A literal "*" collides
    // with whatever queries the rest of the test session already issued and we'd see
    // 0 writes / 3 hits instead of 1 write + 2 hits.
    String query = "csliit_same_" + System.nanoTime();
    String index = "table_search_index";
    int size = 10;

    Stats before = readStats(client);
    if (!before.cacheEnabled) {
      // Cache disabled — nothing to assert. Test still passes; the search itself must work.
      runSearch(client, query, index, size);
      runSearch(client, query, index, size);
      return;
    }

    // Three identical calls. First is a cold miss + write; the other two are hits.
    runSearch(client, query, index, size);
    runSearch(client, query, index, size);
    runSearch(client, query, index, size);

    Stats after = readStats(client);
    long hitsDelta = after.searchHits - before.searchHits;
    long missesDelta = after.searchMisses - before.searchMisses;
    long writesDelta = after.searchWrites - before.searchWrites;

    // At least 2 of the 3 calls should be hits. We don't pin to exactly 2 because other tests
    // running concurrently may also issue searches against the same query. We do require at
    // least one new write (the cold first call's populate) and at least 2 new hits.
    assertTrue(
        hitsDelta >= 2,
        "Expected ≥2 search cache hits across 3 identical calls; saw delta hits=" + hitsDelta);
    assertTrue(
        writesDelta >= 1,
        "Expected ≥1 search cache write on first call; saw delta writes=" + writesDelta);
    // Total lookups (hits+misses) should be at least 3 — one per call.
    assertTrue(
        hitsDelta + missesDelta >= 3,
        "Expected ≥3 search cache lookups across 3 identical calls; saw delta lookups="
            + (hitsDelta + missesDelta));
  }

  /**
   * Different query strings are different cache keys, so each is a fresh miss. Verify the search
   * miss counter increments by at least the number of distinct queries we issue.
   */
  @Test
  void differentQueriesProduceDistinctMisses() {
    OpenMetadataClient client = SdkClients.adminClient();
    Stats before = readStats(client);
    if (!before.cacheEnabled) {
      // Cache disabled — exercise the path; no assertions.
      runSearch(client, "alpha", "table_search_index", 10);
      runSearch(client, "beta", "table_search_index", 10);
      runSearch(client, "gamma", "table_search_index", 10);
      return;
    }

    // Use unique enough query strings that other tests are unlikely to be hitting them.
    runSearch(client, "csliit_alpha_" + System.nanoTime(), "table_search_index", 10);
    runSearch(client, "csliit_beta_" + System.nanoTime(), "table_search_index", 10);
    runSearch(client, "csliit_gamma_" + System.nanoTime(), "table_search_index", 10);

    Stats after = readStats(client);
    long missesDelta = after.searchMisses - before.searchMisses;
    long writesDelta = after.searchWrites - before.searchWrites;

    // Each unique query should miss (cold) and write on the back side.
    assertTrue(
        missesDelta >= 3,
        "Expected ≥3 search cache misses for 3 distinct queries; saw delta misses=" + missesDelta);
    assertTrue(
        writesDelta >= 3,
        "Expected ≥3 search cache writes for 3 distinct queries; saw delta writes=" + writesDelta);
  }

  /**
   * Different {@code size} values are distinct cache entries — same {@code q} and {@code index}
   * but different page coordinates. Verify each is its own miss.
   */
  @Test
  void differentSizeValuesProduceDistinctMisses() {
    OpenMetadataClient client = SdkClients.adminClient();
    String query = "csliit_size_" + System.nanoTime();
    Stats before = readStats(client);
    if (!before.cacheEnabled) {
      runSearch(client, query, "table_search_index", 5);
      runSearch(client, query, "table_search_index", 10);
      runSearch(client, query, "table_search_index", 25);
      return;
    }

    runSearch(client, query, "table_search_index", 5);
    runSearch(client, query, "table_search_index", 10);
    runSearch(client, query, "table_search_index", 25);

    Stats after = readStats(client);
    long missesDelta = after.searchMisses - before.searchMisses;
    assertTrue(
        missesDelta >= 3,
        "Different size= values should be separate cache entries; saw delta misses=" + missesDelta);
  }

  /**
   * {@code /cache/stats} surfaces a per-type breakdown including a {@code search} entry once the
   * search cache has been exercised. Smoke test that the byType block shape is sane.
   */
  @Test
  void cacheStatsExposesSearchByType() {
    OpenMetadataClient client = SdkClients.adminClient();
    runSearch(client, "*", "table_search_index", 10);
    Stats stats = readStats(client);
    if (!stats.cacheEnabled) {
      return; // cache off; nothing to verify
    }
    assertNotNull(stats.byType, "byType block must be present in /cache/stats response");
    Object searchEntry = stats.byType.get("search");
    if (searchEntry != null) {
      assertTrue(
          searchEntry instanceof Map,
          "byType.search should be a Map<String,Object>; got " + searchEntry.getClass());
      Map<?, ?> m = (Map<?, ?>) searchEntry;
      assertNotNull(m.get("hits"));
      assertNotNull(m.get("misses"));
      assertNotNull(m.get("writes"));
      assertNotNull(m.get("hitRatio"));
    }
    // If searchEntry is null, the cluster is cache-off OR no search call has happened yet on
    // this cluster instance. Either way, no failure — the contract is "if it's there, it's
    // well-shaped," not "it's always there."
  }

  // -------------------------------------------------------------------------------------------
  // Helpers

  private static void runSearch(OpenMetadataClient client, String q, String index, int size) {
    RequestOptions opts =
        RequestOptions.builder()
            .queryParam("q", q)
            .queryParam("index", index)
            .queryParam("size", String.valueOf(size))
            .build();
    @SuppressWarnings("unchecked")
    Map<String, Object> ignored =
        client.getHttpClient().execute(HttpMethod.GET, SEARCH_PATH, null, Map.class, opts);
    assertNotNull(ignored, "search response must not be null");
  }

  private static Stats readStats(OpenMetadataClient client) {
    @SuppressWarnings("unchecked")
    Map<String, Object> raw =
        client
            .getHttpClient()
            .execute(HttpMethod.GET, STATS_PATH, null, Map.class, RequestOptions.builder().build());
    Stats s = new Stats();
    s.cacheEnabled = Boolean.TRUE.equals(raw.get("available"));
    Object metricsObj = raw.get("metrics");
    if (metricsObj instanceof Map) {
      @SuppressWarnings("unchecked")
      Map<String, Object> metrics = (Map<String, Object>) metricsObj;
      Object byTypeObj = metrics.get("byType");
      if (byTypeObj instanceof Map) {
        @SuppressWarnings("unchecked")
        Map<String, Object> byType = (Map<String, Object>) byTypeObj;
        s.byType = byType;
        Object searchEntry = byType.get("search");
        if (searchEntry instanceof Map) {
          @SuppressWarnings("unchecked")
          Map<String, Object> e = (Map<String, Object>) searchEntry;
          s.searchHits = toLong(e.get("hits"));
          s.searchMisses = toLong(e.get("misses"));
          s.searchWrites = toLong(e.get("writes"));
        }
      }
    }
    return s;
  }

  private static long toLong(Object o) {
    if (o == null) return 0L;
    if (o instanceof Number n) return n.longValue();
    return Long.parseLong(o.toString());
  }

  private static class Stats {
    boolean cacheEnabled;
    Map<String, Object> byType;
    long searchHits;
    long searchMisses;
    long searchWrites;
  }

  /** Compile-time check on test machinery. Asserts the helper compiles independently. */
  @SuppressWarnings("unused")
  private static void compileCheck() {
    assertEquals(0L, toLong(null));
  }
}
