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
package org.openmetadata.service.apps.bundles.rdf;

import java.util.List;
import java.util.Optional;
import java.util.concurrent.TimeUnit;
import java.util.function.LongConsumer;
import java.util.function.LongSupplier;
import java.util.function.Supplier;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.app.App;
import org.openmetadata.schema.entity.app.AppRunRecord;
import org.openmetadata.service.Entity;
import org.openmetadata.service.apps.bundles.searchIndex.distributed.IndexJobStatus;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.AppRepository;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.SearchReindexDAOs.SearchIndexJobDAO.SearchIndexJobRecord;
import org.openmetadata.service.jdbi3.SearchReindexDAOs.SearchReindexLockDAO.SearchReindexLockRecord;

/**
 * Defers a cron-triggered RDF full reindex while a Search reindex is active, so the two heavy apps
 * never run concurrent full entity-table scans against the database. Nothing else in the platform
 * enforces this: the apps use separate lock tables and their default crons (RDF Sat 00:00, Search
 * Sun 00:30) only avoid collision when neither overruns nor is triggered manually.
 *
 * <p>Three activity signals are checked; any one of them means "search reindex active":
 *
 * <ol>
 *   <li>the {@code SEARCH_REINDEX_LOCK} row, unexpired (distributed search runs hold it);
 *   <li>a {@code search_index_job} row in an active status whose {@code updatedAt} heartbeat is
 *       fresh — status alone is not trusted because a crashed run leaves RUNNING rows behind;
 *   <li>the latest Search app run record in a live status with a fresh timestamp. The timestamp
 *       only advances on the distributed path, so a long-running non-distributed search reindex
 *       can outlive the freshness bound — that trade was chosen deliberately: a stale-crash
 *       false-positive would silently skip every weekend RDF rebuild, which is worse than a rare
 *       concurrent run on a legacy single-server deployment.
 * </ol>
 *
 * <p>All timing is injected ({@link LongSupplier} now / {@link LongConsumer} wait) so the deferral
 * loop is testable without sleeping.
 */
@Slf4j
public class RdfReindexAdmissionGuard {

  static final String SEARCH_REINDEX_LOCK_KEY = "SEARCH_REINDEX_LOCK";
  static final String SEARCH_INDEX_APP_NAME = "SearchIndexingApplication";
  static final long DEFAULT_POLL_INTERVAL_MS = TimeUnit.SECONDS.toMillis(60);
  // Deferral happens on the app's Quartz worker, and that pool is 10 threads for every
  // native app on the server. Holding one for hours to catch a window is a poor trade when
  // the run is weekly and the next scheduled slot will retry, so the wait is deliberately
  // short: long enough to outlast a search reindex finishing up, not long enough to matter
  // to the scheduler.
  static final long DEFAULT_MAX_DEFERRAL_MS = TimeUnit.MINUTES.toMillis(30);
  static final long ACTIVITY_FRESHNESS_MS = TimeUnit.MINUTES.toMillis(10);

  private static final List<String> ACTIVE_SEARCH_JOB_STATUSES =
      List.of(
          IndexJobStatus.RUNNING.name(),
          IndexJobStatus.PROMOTING.name(),
          IndexJobStatus.READY.name(),
          IndexJobStatus.INITIALIZING.name(),
          IndexJobStatus.STOPPING.name());

  private final CollectionDAO collectionDAO;
  private final Supplier<Optional<AppRunRecord>> latestSearchRun;
  private final LongSupplier nowMillis;
  private final LongConsumer waitMillis;
  private final long pollIntervalMs;
  private final long maxDeferralMs;

  /** Outcome of {@link #awaitAdmission()}: admitted, or still contended after the deadline. */
  public record AdmissionResult(boolean admitted, String contention, long waitedMs) {}

  RdfReindexAdmissionGuard(
      CollectionDAO collectionDAO,
      Supplier<Optional<AppRunRecord>> latestSearchRun,
      LongSupplier nowMillis,
      LongConsumer waitMillis,
      long pollIntervalMs,
      long maxDeferralMs) {
    this.collectionDAO = collectionDAO;
    this.latestSearchRun = latestSearchRun;
    this.nowMillis = nowMillis;
    this.waitMillis = waitMillis;
    this.pollIntervalMs = pollIntervalMs;
    this.maxDeferralMs = maxDeferralMs;
  }

  public static RdfReindexAdmissionGuard forProduction(CollectionDAO collectionDAO) {
    return new RdfReindexAdmissionGuard(
        collectionDAO,
        RdfReindexAdmissionGuard::fetchLatestSearchAppRun,
        System::currentTimeMillis,
        RdfReindexAdmissionGuard::sleepQuietly,
        DEFAULT_POLL_INTERVAL_MS,
        DEFAULT_MAX_DEFERRAL_MS);
  }

  /**
   * Non-empty when a search reindex is currently active, with a human-readable description of the
   * signal for logs and the deferred-run error message.
   */
  public Optional<String> currentContention() {
    Optional<String> result = lockContention();
    if (result.isEmpty()) {
      result = activeJobContention();
    }
    if (result.isEmpty()) {
      result = appRunContention();
    }
    return result;
  }

  /** Polls until the search reindex clears or the deferral window is exhausted. */
  public AdmissionResult awaitAdmission() {
    long startedAt = nowMillis.getAsLong();
    long deadline = startedAt + maxDeferralMs;
    AdmissionResult result = null;
    while (result == null) {
      Optional<String> contention = currentContention();
      long now = nowMillis.getAsLong();
      if (contention.isEmpty()) {
        result = new AdmissionResult(true, null, now - startedAt);
      } else if (now >= deadline) {
        result = new AdmissionResult(false, contention.get(), now - startedAt);
      } else if (Thread.currentThread().isInterrupted()) {
        // Without this check an interrupt would make every subsequent wait return
        // immediately and the loop would hammer the DB until the deadline.
        result = new AdmissionResult(false, contention.get(), now - startedAt);
      } else {
        LOG.info(
            "RDF reindex deferred: {}. Re-checking in {} ms", contention.get(), pollIntervalMs);
        waitMillis.accept(pollIntervalMs);
      }
    }
    return result;
  }

  private Optional<String> lockContention() {
    SearchReindexLockRecord lock =
        collectionDAO.searchReindexLockDAO().findByKey(SEARCH_REINDEX_LOCK_KEY);
    Optional<String> result = Optional.empty();
    // Expiry is compared here rather than via lock.isExpired(), which reads the wall clock.
    if (lock != null && lock.expiresAt() > nowMillis.getAsLong()) {
      result =
          Optional.of(
              String.format(
                  "search reindex lock held by job %s on server %s",
                  lock.jobId(), lock.serverId()));
    }
    return result;
  }

  private Optional<String> activeJobContention() {
    List<SearchIndexJobRecord> activeJobs =
        collectionDAO.searchIndexJobDAO().findByStatuses(ACTIVE_SEARCH_JOB_STATUSES);
    long freshAfter = nowMillis.getAsLong() - ACTIVITY_FRESHNESS_MS;
    return activeJobs.stream()
        .filter(job -> job.updatedAt() >= freshAfter)
        .findFirst()
        .map(
            job ->
                String.format(
                    "search index job %s is %s (heartbeat %d)",
                    job.id(), job.status(), job.updatedAt()));
  }

  private Optional<String> appRunContention() {
    long freshAfter = nowMillis.getAsLong() - ACTIVITY_FRESHNESS_MS;
    return latestSearchRun
        .get()
        .filter(RdfReindexAdmissionGuard::isLiveRunStatus)
        .filter(run -> run.getTimestamp() != null && run.getTimestamp() >= freshAfter)
        .map(
            run ->
                String.format(
                    "latest %s app run is %s (timestamp %d)",
                    SEARCH_INDEX_APP_NAME, run.getStatus().value(), run.getTimestamp()));
  }

  private static boolean isLiveRunStatus(AppRunRecord run) {
    return run.getStatus() == AppRunRecord.Status.RUNNING
        || run.getStatus() == AppRunRecord.Status.STARTED;
  }

  private static Optional<AppRunRecord> fetchLatestSearchAppRun() {
    Optional<AppRunRecord> result = Optional.empty();
    try {
      AppRepository appRepository = (AppRepository) Entity.getEntityRepository(Entity.APPLICATION);
      App searchApp = appRepository.getDao().findEntityByName(SEARCH_INDEX_APP_NAME);
      result = appRepository.getLatestAppRunsOptional(searchApp);
    } catch (EntityNotFoundException e) {
      LOG.debug("Search indexing app is not installed; no app-run contention possible");
    }
    return result;
  }

  private static void sleepQuietly(long millis) {
    try {
      Thread.sleep(millis);
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
    }
  }
}
