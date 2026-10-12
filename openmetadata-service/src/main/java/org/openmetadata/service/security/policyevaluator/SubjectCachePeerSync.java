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

package org.openmetadata.service.security.policyevaluator;

import io.dropwizard.lifecycle.Managed;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import java.util.function.LongSupplier;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.service.Entity;
import org.openmetadata.service.cache.Invalidatable;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.EntityDAO;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.util.FullyQualifiedName;

/**
 * Applies user, team, role and policy writes served by other pods to this pod's authorization
 * caches when no Redis pub/sub carries them (e.g. a domain added to a user through pod A reaches
 * pod B within one poll instead of after the 15-minute user context TTL).
 */
@Slf4j
public class SubjectCachePeerSync implements Managed {
  static final long POLL_INTERVAL_MS = 5_000;
  // Rescans this far behind the last poll so a late commit or a skewed writer clock is not missed
  static final long OVERLAP_MS = 60_000;

  record WatchedTable(String entityType, EntityDAO<?> dao) {}

  private final List<WatchedTable> tables;
  private final List<Invalidatable> invalidators;
  private final LongSupplier clock;
  private final Map<String, Long> seenVersions = new HashMap<>();
  private final Map<String, Integer> rowCounts = new HashMap<>();
  private long watermark;
  private ScheduledExecutorService scheduler;

  public SubjectCachePeerSync(CollectionDAO dao) {
    this(
        List.of(
            new WatchedTable(Entity.USER, dao.userDAO()),
            new WatchedTable(Entity.TEAM, dao.teamDAO()),
            new WatchedTable(Entity.ROLE, dao.roleDAO()),
            new WatchedTable(Entity.POLICY, dao.policyDAO())),
        List.of(EntityRepository::onRemoteCacheInvalidate, SubjectCache.invalidator()),
        System::currentTimeMillis);
  }

  SubjectCachePeerSync(
      List<WatchedTable> tables, List<Invalidatable> invalidators, LongSupplier clock) {
    this.tables = tables;
    this.invalidators = invalidators;
    this.clock = clock;
  }

  @Override
  public void start() {
    watermark = clock.getAsLong();
    tables.forEach(table -> rowCounts.put(table.entityType(), countRows(table)));
    scheduler =
        Executors.newSingleThreadScheduledExecutor(
            runnable -> {
              Thread thread = new Thread(runnable, "subject-cache-peer-sync");
              thread.setDaemon(true);
              return thread;
            });
    scheduler.scheduleWithFixedDelay(
        this::syncSafely, POLL_INTERVAL_MS, POLL_INTERVAL_MS, TimeUnit.MILLISECONDS);
  }

  @Override
  public void stop() {
    if (scheduler != null) {
      scheduler.shutdownNow();
    }
  }

  void sync() {
    long pollStart = clock.getAsLong();
    for (WatchedTable table : tables) {
      evictChangedRows(table);
      evictOnRemovedRows(table);
    }
    watermark = pollStart;
    seenVersions.values().removeIf(version -> version < pollStart - 2 * OVERLAP_MS);
  }

  private void syncSafely() {
    try {
      sync();
    } catch (Exception e) {
      LOG.warn("Could not apply peer writes to the authorization caches", e);
    }
  }

  private void evictChangedRows(WatchedTable table) {
    List<String> rows =
        table.dao().listChangedSince(table.dao().getTableName(), watermark - OVERLAP_MS);
    for (String row : rows) {
      String[] idVersionName = row.split("\\|", 3);
      Long version = Long.valueOf(idVersionName[1]);
      Long seen = seenVersions.put(table.entityType() + idVersionName[0], version);
      if (!Objects.equals(seen, version)) {
        evict(
            table.entityType(),
            UUID.fromString(idVersionName[0]),
            FullyQualifiedName.quoteName(idVersionName[2]));
      }
    }
  }

  // A hard delete leaves no row to find by updatedAt (e.g. a removed role), so watch the row count
  private void evictOnRemovedRows(WatchedTable table) {
    if (Entity.USER.equals(table.entityType())) {
      return;
    }
    int count = countRows(table);
    Integer previous = rowCounts.put(table.entityType(), count);
    if (previous != null && count < previous) {
      evict(table.entityType(), null, null);
    }
  }

  private int countRows(WatchedTable table) {
    return Entity.USER.equals(table.entityType()) ? 0 : table.dao().listTotalCount();
  }

  private void evict(String entityType, UUID id, String fqn) {
    invalidators.forEach(invalidator -> invalidator.invalidate(entityType, id, fqn));
  }
}
