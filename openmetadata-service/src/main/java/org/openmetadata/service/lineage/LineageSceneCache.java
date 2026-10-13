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

package org.openmetadata.service.lineage;

import com.google.common.cache.Cache;
import com.google.common.cache.CacheBuilder;
import java.util.Optional;
import java.util.concurrent.TimeUnit;
import org.openmetadata.schema.api.lineage.LineageBand;
import org.openmetadata.schema.api.lineage.LineageLens;
import org.openmetadata.schema.api.lineage.LineageScene;
import org.openmetadata.service.search.lineage.LineageGraphConfiguration;

public final class LineageSceneCache {
  private static final LineageSceneCache INSTANCE =
      new LineageSceneCache(LineageGraphConfiguration.fromSettings());

  private final Cache<Key, LineageScene> cache;
  private final boolean enabled;

  LineageSceneCache(LineageGraphConfiguration configuration) {
    enabled = configuration.isEnableCaching();
    cache =
        CacheBuilder.newBuilder()
            .maximumSize(50)
            .expireAfterWrite(configuration.getCacheTTLSeconds(), TimeUnit.SECONDS)
            .build();
  }

  public static LineageSceneCache getInstance() {
    return INSTANCE;
  }

  public Optional<LineageScene> get(Key key) {
    return enabled && key != null ? Optional.ofNullable(cache.getIfPresent(key)) : Optional.empty();
  }

  public void put(Key key, LineageScene scene) {
    if (enabled && key != null && scene != null) {
      cache.put(key, scene);
    }
  }

  public void invalidateAll() {
    cache.invalidateAll();
  }

  public record Key(
      LineageLens lens,
      LineageBand band,
      int upstreamDepth,
      int downstreamDepth,
      int size,
      String queryFilter,
      boolean includeDeleted) {}
}
