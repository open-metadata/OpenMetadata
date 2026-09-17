/*
 *  Copyright 2026 Collate.
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

import java.util.Collection;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.locks.ReentrantLock;
import java.util.function.Function;
import java.util.function.Supplier;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.jdbi3.CollectionDAO;

/**
 * Resolves which index a live write should target while a reindex populates a staged index.
 *
 * <p>Registrations made by the JVM that is running the reindex are held locally. Every <i>other</i>
 * JVM — a second API replica, or an API server running while {@code openmetadata-ops.sh} reindexes
 * in a separate process — learns about staged indices from the {@code search_index_job} rows the
 * distributed coordinator already persists. Without that shared view those nodes resolve writes
 * through the canonical alias into the index that promotion is about to delete, so the edits are
 * silently lost at the alias swap.
 *
 * <p>The shared view is a snapshot refreshed at most once per {@link #SHARED_VIEW_TTL_MS}; it is
 * bounded by the number of registered entity types (it is replaced wholesale, never accumulated).
 * A stale snapshot is safe in both directions: before promotion it points at the staged index that
 * is about to become live, and after promotion the staged index <i>is</i> the live index, since
 * promotion swaps the alias onto it and deletes the old one.
 */
@Slf4j
public final class StagedIndexRouting {

  private static final long SHARED_VIEW_TTL_MS = 5_000L;
  private static final int MAX_JOBS_SCANNED = 10;

  /** Job states in which a staged index may exist but has not yet been promoted. */
  private static final List<String> IN_FLIGHT_STATUSES =
      List.of("INITIALIZING", "READY", "RUNNING");

  private final Map<String, String> localByCanonicalIndex = new ConcurrentHashMap<>();
  private final Function<String, String> canonicalIndexResolver;
  private final Supplier<CollectionDAO> daoSupplier;
  private final ReentrantLock refreshLock = new ReentrantLock();
  private final long sharedViewTtlMillis;

  private volatile Map<String, String> sharedByCanonicalIndex = Map.of();
  private volatile long sharedLoadedAt = 0L;

  public StagedIndexRouting(
      Function<String, String> canonicalIndexResolver, Supplier<CollectionDAO> daoSupplier) {
    this(canonicalIndexResolver, daoSupplier, SHARED_VIEW_TTL_MS);
  }

  /** Visible for testing: a negative TTL refreshes the shared view on every read. */
  StagedIndexRouting(
      Function<String, String> canonicalIndexResolver,
      Supplier<CollectionDAO> daoSupplier,
      long sharedViewTtlMillis) {
    this.canonicalIndexResolver = canonicalIndexResolver;
    this.daoSupplier = daoSupplier;
    this.sharedViewTtlMillis = sharedViewTtlMillis;
  }

  /** Record that live writes for {@code canonicalIndex} must go to {@code stagedIndex}. */
  public void register(String canonicalIndex, String stagedIndex) {
    localByCanonicalIndex.put(canonicalIndex, stagedIndex);
  }

  /** Clear the routing for {@code canonicalIndex} when it still maps to {@code stagedIndex}. */
  public boolean unregister(String canonicalIndex, String stagedIndex) {
    return localByCanonicalIndex.remove(canonicalIndex, stagedIndex);
  }

  /**
   * Returns the staged index that live writes for {@code canonicalIndex} must target, or {@code
   * null} when no reindex is staging that index anywhere in the cluster.
   */
  public String resolve(String canonicalIndex) {
    String staged = localByCanonicalIndex.get(canonicalIndex);
    if (staged == null) {
      staged = sharedView().get(canonicalIndex);
    }
    return staged;
  }

  /** Every staged index currently being populated, from this JVM and from any other. */
  public Collection<String> stagedIndices() {
    Set<String> all = new HashSet<>(localByCanonicalIndex.values());
    all.addAll(sharedView().values());
    return all;
  }

  private Map<String, String> sharedView() {
    if (isSharedViewStale() && refreshLock.tryLock()) {
      try {
        if (isSharedViewStale()) {
          refreshSharedView();
        }
      } finally {
        refreshLock.unlock();
      }
    }
    return sharedByCanonicalIndex;
  }

  private boolean isSharedViewStale() {
    return System.currentTimeMillis() - sharedLoadedAt > sharedViewTtlMillis;
  }

  /**
   * Reloads the snapshot from in-flight job rows. On failure the previous snapshot is retained
   * rather than cleared — dropping it would silently reinstate the write-loss this class exists to
   * prevent.
   */
  private void refreshSharedView() {
    CollectionDAO dao = daoSupplier.get();
    if (dao == null) {
      sharedLoadedAt = System.currentTimeMillis();
      return;
    }
    try {
      Map<String, String> refreshed = readInFlightStagedIndices(dao);
      sharedByCanonicalIndex = refreshed;
      sharedLoadedAt = System.currentTimeMillis();
    } catch (Exception e) {
      sharedLoadedAt = System.currentTimeMillis();
      LOG.warn(
          "Could not refresh staged-index routing from search_index_job; keeping previous snapshot {}",
          sharedByCanonicalIndex,
          e);
    }
  }

  private Map<String, String> readInFlightStagedIndices(CollectionDAO dao) {
    Map<String, String> byCanonicalIndex = new HashMap<>();
    List<CollectionDAO.SearchIndexJobDAO.SearchIndexJobRecord> jobs =
        dao.searchIndexJobDAO().findByStatusesWithLimit(IN_FLIGHT_STATUSES, MAX_JOBS_SCANNED);
    for (CollectionDAO.SearchIndexJobDAO.SearchIndexJobRecord job : jobs) {
      addStagedIndicesFrom(job, byCanonicalIndex);
    }
    return byCanonicalIndex;
  }

  private void addStagedIndicesFrom(
      CollectionDAO.SearchIndexJobDAO.SearchIndexJobRecord job,
      Map<String, String> byCanonicalIndex) {
    if (job.stagedIndexMapping() == null) {
      return;
    }
    Map<String, String> byEntityType = parseStagedIndexMapping(job);
    for (Map.Entry<String, String> entry : byEntityType.entrySet()) {
      String canonicalIndex = canonicalIndexResolver.apply(entry.getKey());
      if (canonicalIndex != null && entry.getValue() != null) {
        byCanonicalIndex.put(canonicalIndex, entry.getValue());
      }
    }
  }

  @SuppressWarnings("unchecked")
  private Map<String, String> parseStagedIndexMapping(
      CollectionDAO.SearchIndexJobDAO.SearchIndexJobRecord job) {
    Map<String, String> parsed;
    try {
      parsed = JsonUtils.readValue(job.stagedIndexMapping(), Map.class);
    } catch (Exception e) {
      LOG.warn("Ignoring unreadable stagedIndexMapping on search_index_job {}", job.id(), e);
      parsed = Map.of();
    }
    return parsed == null ? Map.of() : parsed;
  }
}
