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

package org.openmetadata.service.search;

import static java.util.stream.Collectors.toUnmodifiableMap;

import io.dropwizard.lifecycle.Managed;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import java.util.function.Consumer;
import java.util.function.LongSupplier;
import java.util.function.Supplier;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.service.jdbi3.SearchReindexDAOs.SearchIndexWriteRouteDAO;
import org.openmetadata.service.jdbi3.SearchReindexDAOs.SearchIndexWriteRouteDAO.WriteRoute;

/**
 * Where live writes for an entity index go while a reindex builds its replacement. The server
 * running the reindex registers each index it builds; every server reads the registrations about
 * once a second, so a write handled by any of them reaches the index that will be promoted. A
 * registration lapses when its owner stops renewing it, so a reindex that dies stops capturing
 * writes on its own.
 */
@Slf4j
public class StagedIndexRoutes implements Managed {
  static final long REFRESH_INTERVAL_MS = 1_000L;
  static final long LEASE_MS = 30_000L;

  /** How long a change takes to reach every server that refreshes on schedule. */
  public static final long PROPAGATION_MS = 3 * REFRESH_INTERVAL_MS;

  private final Supplier<SearchIndexWriteRouteDAO> routeStore;
  private final Supplier<String> ownerId;
  private final LongSupplier clock;
  private final Map<String, String> owned = new ConcurrentHashMap<>();
  private volatile Map<String, String> shared = Map.of();
  private volatile long lastChangeAt;
  private ScheduledExecutorService refresher;

  public StagedIndexRoutes(
      final Supplier<SearchIndexWriteRouteDAO> routeStore,
      final Supplier<String> ownerId,
      final LongSupplier clock) {
    this.routeStore = routeStore;
    this.ownerId = ownerId;
    this.clock = clock;
  }

  /** Sends live writes for {@code canonicalIndex} to {@code stagedIndex}, on every server. */
  public void register(final String canonicalIndex, final String stagedIndex) {
    owned.put(canonicalIndex, stagedIndex);
    lastChangeAt = clock.getAsLong();
    final long leaseExpiresAt = lastChangeAt + LEASE_MS;
    persist(
        store -> store.upsert(canonicalIndex, stagedIndex, ownerId.get(), leaseExpiresAt),
        canonicalIndex);
  }

  /** Stops routing {@code canonicalIndex} to {@code stagedIndex}; false when it was not routed. */
  public boolean unregister(final String canonicalIndex, final String stagedIndex) {
    final boolean removed = owned.remove(canonicalIndex, stagedIndex);
    if (removed) {
      lastChangeAt = clock.getAsLong();
      shared = withoutRoute(shared, canonicalIndex, stagedIndex);
      persist(store -> store.delete(canonicalIndex, stagedIndex), canonicalIndex);
    }
    return removed;
  }

  /** The index a reindex is building to replace {@code canonicalIndex}, if any. */
  public Optional<String> stagedIndexFor(final String canonicalIndex) {
    return Optional.ofNullable(owned.getOrDefault(canonicalIndex, shared.get(canonicalIndex)));
  }

  /** Every index a reindex on any server is building now. */
  public Set<String> stagedIndexes() {
    final Set<String> stagedIndexes = new HashSet<>(shared.values());
    stagedIndexes.addAll(owned.values());
    return stagedIndexes;
  }

  /** Blocks until every server that refreshes on schedule has seen this server's last change. */
  public void awaitPropagation() throws InterruptedException {
    final long remaining = lastChangeAt + PROPAGATION_MS - clock.getAsLong();
    if (remaining > 0) {
      Thread.sleep(remaining);
    }
  }

  /** Renews this server's registrations and reads every server's. */
  void refresh() {
    final SearchIndexWriteRouteDAO store = routeStore.get();
    if (store != null) {
      final long now = clock.getAsLong();
      if (!owned.isEmpty()) {
        store.renew(List.copyOf(owned.values()), now + LEASE_MS);
      }
      shared =
          store.listLive(now).stream()
              .collect(
                  toUnmodifiableMap(
                      WriteRoute::canonicalIndex, WriteRoute::stagedIndex, (first, last) -> last));
    }
  }

  @Override
  public synchronized void start() {
    if (refresher == null || refresher.isShutdown()) {
      refresher =
          Executors.newSingleThreadScheduledExecutor(
              Thread.ofPlatform().name("search-write-routes").daemon().factory());
      refresher.scheduleWithFixedDelay(
          this::refreshQuietly, 0, REFRESH_INTERVAL_MS, TimeUnit.MILLISECONDS);
    }
  }

  @Override
  public synchronized void stop() {
    if (refresher != null) {
      refresher.shutdownNow();
    }
  }

  private void refreshQuietly() {
    try {
      refresh();
    } catch (RuntimeException e) {
      LOG.warn("Could not refresh search write routes; keeping the ones last read", e);
    }
  }

  /** A route that cannot be stored still applies on this server, as it did before routes were shared. */
  private void persist(
      final Consumer<SearchIndexWriteRouteDAO> change, final String canonicalIndex) {
    final SearchIndexWriteRouteDAO store = routeStore.get();
    try {
      if (store != null) {
        change.accept(store);
      }
    } catch (RuntimeException e) {
      LOG.warn(
          "Could not share the write route for {}; only this server will follow it",
          canonicalIndex,
          e);
    }
  }

  private static Map<String, String> withoutRoute(
      final Map<String, String> routes, final String canonicalIndex, final String stagedIndex) {
    final Map<String, String> remaining = new HashMap<>(routes);
    remaining.remove(canonicalIndex, stagedIndex);
    return Map.copyOf(remaining);
  }
}
