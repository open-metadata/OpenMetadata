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
 * Configuration for server-side Guava caches. Each cache group can be tuned independently. Caches
 * that don't have a specific override fall back to the default values.
 *
 * <p>Entity caches use weight-based eviction (bytes) because entity JSON sizes vary wildly (1KB to
 * 2MB+). Other caches use count-based eviction because they store small, fixed-size objects.
 */
@Getter
@Setter
public class CacheConfiguration {

  // --- Defaults (fallback for caches without specific config) ---

  @JsonProperty
  @Min(1)
  private long defaultMaxSizeBytes = 50 * 1024 * 1024L; // 50 MB

  @JsonProperty
  @Min(1)
  private int defaultTTLSeconds = 300; // 5 minutes

  // --- Entity JSON caches (CACHE_WITH_ID, CACHE_WITH_NAME) ---
  // These cache serialized entity JSON strings. Sizes vary from 1KB (simple entities)
  // to 2MB+ (tables with hundreds of columns). Weight-based eviction is required.

  @JsonProperty
  @Min(1)
  private long entityCacheMaxSizeBytes = 100 * 1024 * 1024L; // 100 MB

  @JsonProperty
  @Min(1)
  private int entityCacheTTLSeconds = 30;

  // --- Lineage graph cache ---
  // Caches SearchLineageResult objects. Count-based because the put() already
  // rejects graphs above the mediumGraphThreshold.

  @JsonProperty
  @Min(1)
  private int lineageCacheMaxEntries = 50;

  @JsonProperty
  @Min(1)
  private int lineageCacheTTLSeconds = 300;

  // --- Auth caches (SubjectCache: user context + policies) ---

  @JsonProperty
  @Min(1)
  private int authCacheMaxEntries = 5000;

  @JsonProperty
  @Min(1)
  private int authCacheTTLSeconds = 120;
}
