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

import java.time.Duration;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;

/**
 * Negative cache for "we looked, this entity doesn't exist" verdicts. Short TTL ({@link
 * CacheConfig#notFoundTtlSeconds}, default 30s) so a freshly-created entity isn't shadowed for
 * long. Invalidated on entity create via the {@link Invalidatable} registry — without that
 * invalidation, a UI flow that creates an entity and immediately reads it would hit the
 * negative cache and 404 for up to 30s.
 *
 * <p>Targets: typo'd FQN lookups, references to deleted entities embedded in old links, repeat
 * lookups for entities that were never created. Each of these would otherwise hammer the DB
 * with a wasted SELECT on every retry.
 *
 * <p>Cache-off semantics: {@link #enabled()} returns false when {@code notFoundTtlSeconds <= 0}
 * or the provider is unavailable. {@link #isMarkedNotFound} then returns false (treat as
 * "we don't know"), forcing the caller down the normal DB path. Same-shape contract as the
 * other optional layers.
 */
@Slf4j
public final class NotFoundCache implements Invalidatable {
  private final CacheProvider cache;
  private final CacheKeys keys;
  private final int ttlSeconds;

  public NotFoundCache(CacheProvider cache, CacheKeys keys, CacheConfig config) {
    this.cache = cache;
    this.keys = keys;
    this.ttlSeconds = config.notFoundTtlSeconds;
  }

  public boolean enabled() {
    return ttlSeconds > 0 && cache != null && cache.available();
  }

  public boolean isMarkedNotFoundById(String type, UUID id) {
    if (!enabled()) return false;
    try {
      return cache.get(keys.notFoundById(type, id)).isPresent();
    } catch (Exception e) {
      LOG.debug("notFound cache read failed (treated as not-cached) type={} id={}", type, id, e);
      return false;
    }
  }

  public boolean isMarkedNotFoundByName(String type, String fqn) {
    if (!enabled()) return false;
    try {
      return cache.get(keys.notFoundByName(type, fqn)).isPresent();
    } catch (Exception e) {
      LOG.debug("notFound cache read failed (treated as not-cached) type={} fqn={}", type, fqn, e);
      return false;
    }
  }

  public void markNotFoundById(String type, UUID id) {
    if (!enabled()) return;
    try {
      cache.set(keys.notFoundById(type, id), "1", Duration.ofSeconds(ttlSeconds));
    } catch (Exception e) {
      LOG.debug("notFound cache write failed type={} id={}", type, id, e);
    }
  }

  public void markNotFoundByName(String type, String fqn) {
    if (!enabled()) return;
    try {
      cache.set(keys.notFoundByName(type, fqn), "1", Duration.ofSeconds(ttlSeconds));
    } catch (Exception e) {
      LOG.debug("notFound cache write failed type={} fqn={}", type, fqn, e);
    }
  }

  /**
   * Drop the negative-cache markers for this (type, id, fqn) on entity create / restore.
   * Without this, a freshly-created entity would 404 for up to 30s after a prior failed lookup.
   */
  @Override
  public void invalidate(String type, UUID id, String fqn) {
    if (!enabled()) return;
    try {
      if (id != null) cache.del(keys.notFoundById(type, id));
      if (fqn != null) cache.del(keys.notFoundByName(type, fqn));
    } catch (Exception e) {
      LOG.debug("notFound cache invalidate failed type={} id={} fqn={}", type, id, fqn, e);
    }
  }
}
