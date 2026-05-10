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

import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Duration;
import java.util.List;
import java.util.Optional;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.search.SearchRequest;

/**
 * Auth-aware response cache for {@code GET /api/v1/search/query}. Keys include the principal so
 * users with different ACLs do not see each other's filtered results. Cache key is
 * {@code om:<keyspace>:search:<sha256-hex>} where the SHA-256 input is the concatenation of every
 * field that affects the result set, plus the principal name. TTL is short
 * ({@link CacheConfig#searchTtlSeconds}, default 30s) — search is approximate and cache misses
 * after writes self-heal within the TTL window.
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

  public CachedSearchLayer(CacheProvider cache, CacheKeys keys, CacheConfig config) {
    this.cache = cache;
    this.keyPrefix = keys.search();
    this.ttlSeconds = config.searchTtlSeconds;
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
   * plus the principal name. Order matters — we serialize fields in a fixed order so the same
   * logical request maps to the same key regardless of object construction order.
   */
  String buildKey(SearchRequest request, String principalName) {
    StringBuilder sb = new StringBuilder(512);
    sb.append("p=").append(safe(principalName)).append('|');
    sb.append("idx=").append(safe(request.getIndex())).append('|');
    sb.append("q=").append(safe(request.getQuery())).append('|');
    sb.append("from=").append(request.getFrom()).append('|');
    sb.append("size=").append(request.getSize()).append('|');
    sb.append("qf=").append(safe(request.getQueryFilter())).append('|');
    sb.append("pf=").append(safe(request.getPostFilter())).append('|');
    sb.append("sf=").append(safe(request.getSortFieldParam())).append('|');
    sb.append("so=").append(safe(request.getSortOrder())).append('|');
    sb.append("fs=").append(request.getFetchSource()).append('|');
    sb.append("inc=").append(joinList(request.getIncludeSourceFields())).append('|');
    sb.append("exc=").append(joinList(request.getExcludeSourceFields())).append('|');
    sb.append("d=").append(request.getDeleted()).append('|');
    sb.append("h=").append(request.getIsHierarchy()).append('|');
    sb.append("ag=").append(request.getIncludeAggregations()).append('|');
    sb.append("ex=").append(request.getExplain()).append('|');
    sb.append("tt=").append(request.getTrackTotalHits()).append('|');
    sb.append("dom=").append(domainsKey(request)).append('|');
    sb.append("adf=").append(request.getApplyDomainFilter()).append('|');
    sb.append("sa=").append(safe(searchAfterKey(request)));
    return keyPrefix + ":" + sha256Hex(sb.toString());
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
