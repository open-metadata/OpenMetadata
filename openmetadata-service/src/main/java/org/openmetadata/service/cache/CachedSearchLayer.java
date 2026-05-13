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
package org.openmetadata.service.cache;

import com.google.common.util.concurrent.Striped;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Duration;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.locks.Lock;
import java.util.function.Supplier;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.search.SearchRequest;

/**
 * Auth-aware response cache for {@code GET /api/v1/search/query}. Keys include the principal so
 * users with different ACLs do not see each other's filtered results. Cache key is
 * {@code om:<keyspace>:search:<sha256-hex>} where the SHA-256 input is the concatenation of every
 * field that affects the result set, plus the principal name. TTL is short
 * ({@link CacheConfig#searchTtlSeconds}, default 2s) — short TTL is deliberate: search is the
 * primary surface for create-then-search workflows in the UI (newly-tagged entities, just-added
 * domains, newly-deleted assets). A 30s TTL caused IT regressions where users couldn't see
 * their own writes for half a minute. 2s gives meaningful cache-hit ratio on rapid tab-toggle
 * and back-button navigation while keeping post-write staleness imperceptible.
 *
 * <p>Distinct from {@link CachedReadBundle}: that cache stores entity bundles by id; this one
 * stores the entire ES/OS response body for a specific (query, principal) tuple. Search itself
 * doesn't touch Redis without this layer — see plan Item 1 / cache-perf-findings.md.
 */
@Slf4j
public final class CachedSearchLayer {
  private final CacheProvider cache;
  private final String keyPrefix;
  private final int ttlSeconds;
  // Per-cache-key lock stripe for single-flight load. 100 concurrent users hitting the same
  // uncached search query collapse to one ES call: the first thread wins the lock, populates
  // the cache, the rest re-check on lock acquire and read the populated entry. Stripe count
  // shares the bundle setting since both cache layers see similar concurrency profiles.
  private final Striped<Lock> loadLocks;

  public CachedSearchLayer(CacheProvider cache, CacheKeys keys, CacheConfig config) {
    this.cache = cache;
    this.keyPrefix = keys.search();
    this.ttlSeconds = config.searchTtlSeconds;
    this.loadLocks = Striped.lazyWeakLock(Math.max(16, config.bundleLoadLockStripes));
  }

  public boolean enabled() {
    return ttlSeconds > 0 && cache != null && cache.available();
  }

  public Optional<String> get(SearchRequest request, String principalName) {
    if (!enabled()) {
      return Optional.empty();
    }
    try {
      String key = buildKey(request, principalName);
      // The provider records its own untagged hit/miss; here we record a *layer-typed* one
      // so /cache/stats can show a per-category hitRatio for "search". Don't bump the
      // aggregate counter — the provider's get() already did.
      Optional<String> hit = cache.get(key);
      CacheMetrics m = CacheMetrics.getInstance();
      if (m != null) {
        if (hit.isPresent()) {
          m.recordLayerHit("search");
        } else {
          m.recordLayerMiss("search");
        }
      }
      return hit;
    } catch (Exception e) {
      LOG.debug("Search cache get failed (treated as miss)", e);
      CacheMetrics m = CacheMetrics.getInstance();
      if (m != null) {
        m.recordError();
      }
      return Optional.empty();
    }
  }

  /**
   * Single-flight load: cache lookup first; on miss, take a per-key stripe lock, recheck the
   * cache (a concurrent waiter may have populated it), and only run the supplier if still cold.
   * The supplier is the actual ES call — under load we want exactly one of these per cache key,
   * not N (where N = concurrent users hitting the same query).
   *
   * <p>Cache-disabled fallback: degrades to {@code supplier.get()} with no locking. Same
   * behavior as if this layer didn't exist.
   *
   * <p>The supplier returns the JSON body of the upstream search response. We cache the JSON
   * (not the deserialized object) so {@link #get} can return it directly to the JAX-RS layer
   * via {@code Response.ok(json, MediaType.APPLICATION_JSON_TYPE)}.
   */
  public String loadOrCompute(
      SearchRequest request, String principalName, Supplier<String> supplier) {
    if (!enabled()) {
      return supplier.get();
    }
    String key;
    try {
      key = buildKey(request, principalName);
    } catch (Exception e) {
      LOG.debug("Search cache key build failed; falling through to compute", e);
      return supplier.get();
    }
    Optional<String> first = safeGet(key);
    if (first.isPresent()) {
      recordHit();
      return first.get();
    }
    Lock lock = loadLocks.get(key);
    lock.lock();
    try {
      Optional<String> recheck = safeGet(key);
      if (recheck.isPresent()) {
        recordHit();
        return recheck.get();
      }
      recordMiss();
      String fresh = supplier.get();
      safePut(key, fresh);
      return fresh;
    } finally {
      lock.unlock();
    }
  }

  private Optional<String> safeGet(String key) {
    try {
      return cache.get(key);
    } catch (Exception e) {
      LOG.debug("Search cache get failed (treated as miss) key={}", key, e);
      return Optional.empty();
    }
  }

  private void safePut(String key, String value) {
    if (value == null) return;
    try {
      cache.set(key, value, Duration.ofSeconds(ttlSeconds));
      CacheMetrics m = CacheMetrics.getInstance();
      if (m != null) m.recordLayerWrite("search");
    } catch (Exception e) {
      LOG.debug("Search cache put failed key={}", key, e);
      CacheMetrics m = CacheMetrics.getInstance();
      if (m != null) m.recordError();
    }
  }

  private static void recordHit() {
    CacheMetrics m = CacheMetrics.getInstance();
    if (m != null) m.recordLayerHit("search");
  }

  private static void recordMiss() {
    CacheMetrics m = CacheMetrics.getInstance();
    if (m != null) m.recordLayerMiss("search");
  }

  public void put(SearchRequest request, String principalName, String responseJson) {
    if (!enabled() || responseJson == null) {
      return;
    }
    try {
      String key = buildKey(request, principalName);
      cache.set(key, responseJson, Duration.ofSeconds(ttlSeconds));
      CacheMetrics m = CacheMetrics.getInstance();
      if (m != null) {
        m.recordLayerWrite("search");
      }
    } catch (Exception e) {
      LOG.debug("Search cache put failed (cache miss next time)", e);
      CacheMetrics m = CacheMetrics.getInstance();
      if (m != null) {
        m.recordError();
      }
    }
  }

  /**
   * Build a deterministic cache key from every SearchRequest field that affects the result set,
   * plus the principal name. Each field is length-prefixed before concatenation so a value that
   * happens to contain our delimiter sequence ({@code "|idx="}, {@code "|q="}, etc.) cannot
   * collide with a different (principal, index, query, …) tuple. Without length-prefixing,
   * an attacker (or an unlucky query) supplying {@code query="|q=foo"} would produce the same
   * preimage as {@code query="|q="} with index "foo", and Redis would serve the wrong cached
   * response.
   */
  String buildKey(SearchRequest request, String principalName) {
    StringBuilder sb = new StringBuilder(512);
    appendField(sb, "p", safe(principalName));
    appendField(sb, "idx", safe(request.getIndex()));
    appendField(sb, "q", safe(request.getQuery()));
    appendField(sb, "from", String.valueOf(request.getFrom()));
    appendField(sb, "size", String.valueOf(request.getSize()));
    appendField(sb, "qf", safe(request.getQueryFilter()));
    appendField(sb, "pf", safe(request.getPostFilter()));
    appendField(sb, "sf", safe(request.getSortFieldParam()));
    appendField(sb, "so", safe(request.getSortOrder()));
    appendField(sb, "fs", String.valueOf(request.getFetchSource()));
    appendField(sb, "inc", joinList(request.getIncludeSourceFields()));
    appendField(sb, "exc", joinList(request.getExcludeSourceFields()));
    appendField(sb, "d", String.valueOf(request.getDeleted()));
    appendField(sb, "h", String.valueOf(request.getIsHierarchy()));
    appendField(sb, "ag", String.valueOf(request.getIncludeAggregations()));
    appendField(sb, "ex", String.valueOf(request.getExplain()));
    appendField(sb, "tt", String.valueOf(request.getTrackTotalHits()));
    appendField(sb, "dom", domainsKey(request));
    appendField(sb, "adf", String.valueOf(request.getApplyDomainFilter()));
    appendField(sb, "sa", safe(searchAfterKey(request)));
    return keyPrefix + ":" + sha256Hex(sb.toString());
  }

  /**
   * Length-prefixed field encoding: {@code name=<utf8-byte-length>:value|}. The byte length
   * makes the value impossible to confuse with the surrounding key structure — any sequence of
   * delimiters inside the value is just data because the parser would have to count those bytes
   * first to even see them. We never actually parse the resulting string (it's just hashed),
   * but the unambiguous serialization means two distinct logical tuples can never produce the
   * same preimage.
   */
  private static void appendField(StringBuilder sb, String name, String value) {
    String v = value == null ? "" : value;
    byte[] bytes = v.getBytes(java.nio.charset.StandardCharsets.UTF_8);
    sb.append(name).append('=').append(bytes.length).append(':').append(v).append('|');
  }

  private static String safe(Object o) {
    return o == null ? "" : o.toString();
  }

  private static String joinList(List<?> list) {
    return list == null || list.isEmpty()
        ? ""
        : String.join(",", list.stream().map(Object::toString).toList());
  }

  private static String domainsKey(SearchRequest request) {
    if (request.getDomains() == null || request.getDomains().isEmpty()) {
      return "";
    }
    StringBuilder sb = new StringBuilder();
    for (var ref : request.getDomains()) {
      if (ref != null && ref.getId() != null) {
        sb.append(ref.getId()).append(',');
      }
    }
    return sb.toString();
  }

  private static String searchAfterKey(SearchRequest request) {
    var sa = request.getSearchAfter();
    return sa == null ? "" : sa.toString();
  }

  private static String sha256Hex(String input) {
    try {
      MessageDigest md = MessageDigest.getInstance("SHA-256");
      byte[] hash = md.digest(input.getBytes(java.nio.charset.StandardCharsets.UTF_8));
      StringBuilder hex = new StringBuilder(hash.length * 2);
      for (byte b : hash) {
        hex.append(String.format("%02x", b));
      }
      return hex.toString();
    } catch (NoSuchAlgorithmException e) {
      throw new IllegalStateException("SHA-256 not available", e);
    }
  }
}
