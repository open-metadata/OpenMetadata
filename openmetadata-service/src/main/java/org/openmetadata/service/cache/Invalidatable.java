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

import java.util.UUID;

/**
 * Contract for any cache layer that holds entity-keyed data and needs to drop entries when the
 * entity is mutated. Registered with {@link CacheBundle#registerInvalidatable(Invalidatable)} so
 * the central remote-invalidation handler and {@link CacheBundle#invalidateEntity} can fan a
 * single (type, id, fqn) tuple out to every registered layer.
 *
 * <p>Adding a new cache layer? Implement this interface, call {@code registerInvalidatable} in
 * {@link CacheBundle#run}. The compiler enforces that you didn't forget — the registration is
 * trivial code, but missing it means the layer silently serves stale data after writes.
 *
 * <p>Implementations must be safe to call when the cache is disabled. The contract is "do
 * nothing if you're not actually holding the data"; never throw on a no-op invalidate.
 */
public interface Invalidatable {

  /**
   * Drop every cached entry that may be affected by a write to the entity identified by
   * {@code (type, id, fqn)}. Either {@code id} or {@code fqn} may be null when the writer doesn't
   * have both; implementations should drop what they can.
   *
   * <p>Called on the local pod via {@link CacheBundle#invalidateEntity(String, UUID, String)},
   * which is wired into {@code EntityRepository.invalidateCacheForEntity} (called from
   * {@code postCreate}, write-through bulk update paths, and the admin invalidate endpoint).
   * Note that {@code postUpdate} / {@code postDelete} / {@code restoreEntity} do NOT call
   * this fan-out today — they rely on the write-through cache + L1 eviction. If a new
   * Invalidatable needs to react to those events, add the wiring there. Remote pods invoke
   * the same fan-out via the {@code CacheInvalidationPubSub} subscriber.
   *
   * <p>Both paths are best-effort; an exception here is logged and swallowed at the
   * caller — never let a cache hiccup take down a write path.
   */
  void invalidate(String type, UUID id, String fqn);
}
