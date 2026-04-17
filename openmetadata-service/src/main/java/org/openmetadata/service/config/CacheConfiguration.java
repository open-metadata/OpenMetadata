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
package org.openmetadata.service.config;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.Min;
import lombok.Getter;
import lombok.Setter;

/**
 * Configuration for server-side Guava caches. Each cache group can be tuned independently.
 *
 * <p>Entity caches use weight-based eviction (bytes) because entity JSON sizes vary wildly (1KB to
 * 2MB+). Other caches use count-based eviction because they store small, fixed-size objects.
 */
@Getter
@Setter
public class CacheConfiguration {

  /**
   * 100 MB — safe for most deployments (2-8 GB heap). Customers with large heap (12 GB+) can
   * increase to 500 MB for better cache hit rates on large Table entities.
   */
  public static final long DEFAULT_ENTITY_CACHE_MAX_SIZE_BYTES = 100 * 1024 * 1024L;

  /**
   * 30 seconds — short TTL because entity mutations are frequent during ingestion. Matches the
   * original value used before this configuration was introduced.
   */
  public static final int DEFAULT_ENTITY_CACHE_TTL_SECONDS = 30;

  /** 5000 entries — sufficient for most deployments. User objects are small (~1-5 KB each). */
  public static final int DEFAULT_AUTH_CACHE_MAX_ENTRIES = 5000;

  /** 5000 entries — RBAC query objects are small. Reduced from original 10K for safety. */
  public static final int DEFAULT_RBAC_CACHE_MAX_ENTRIES = 5000;

  // --- Entity JSON caches (CACHE_WITH_ID, CACHE_WITH_NAME) ---

  @JsonProperty
  @Min(1)
  private long entityCacheMaxSizeBytes = DEFAULT_ENTITY_CACHE_MAX_SIZE_BYTES;

  @JsonProperty
  @Min(1)
  private int entityCacheTTLSeconds = DEFAULT_ENTITY_CACHE_TTL_SECONDS;

  // --- Auth caches (SubjectCache: user context + policies) ---
  // TTLs are hardcoded (2 min for policies, 15 min for user context) because they serve
  // different freshness needs. Only max entries is configurable.

  @JsonProperty
  @Min(1)
  private int authCacheMaxEntries = DEFAULT_AUTH_CACHE_MAX_ENTRIES;

  // --- RBAC cache (OpenSearch query DSL for role-based access control) ---

  @JsonProperty
  @Min(1)
  private int rbacCacheMaxEntries = DEFAULT_RBAC_CACHE_MAX_ENTRIES;
}
