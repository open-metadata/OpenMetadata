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
package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.junit.jupiter.api.parallel.Isolated;
import org.openmetadata.schema.system.EventPublisherJob;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.apps.bundles.searchIndex.distributed.IndexJobStatus;
import org.openmetadata.service.apps.bundles.searchIndex.distributed.JobRecoveryManager;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.SearchReindexDAOs.SearchIndexJobDAO.JobSnapshot;
import org.openmetadata.service.jdbi3.SearchReindexDAOs.SearchIndexJobDAO.RecordCounts;
import org.openmetadata.service.jdbi3.SearchReindexDAOs.SearchIndexJobDAO.SearchIndexJobRecord;

/**
 * The search reindex orphan sweep against the real search_index_job and search_reindex_lock tables
 * on MySQL and Postgres. Isolated because it holds the cluster-wide reindex lock that every search
 * reindex needs.
 */
@Isolated
@Execution(ExecutionMode.SAME_THREAD)
public class SearchReindexOrphanSweepIT {
  private static final String REINDEX_LOCK_KEY = "SEARCH_REINDEX_LOCK";
  private static final String TEST_NAME = "SearchReindexOrphanSweepIT";
  private static final long STALE_FOR_MS = TimeUnit.MINUTES.toMillis(15);
  private static final long LOCK_TTL_MS = TimeUnit.MINUTES.toMillis(5);

  private final List<String> jobIds = new ArrayList<>();
  private final List<String> lockHolders = new ArrayList<>();
  private CollectionDAO dao;

  @BeforeEach
  void connect() {
    dao = Entity.getCollectionDAO();
  }

  @AfterEach
  void removeRows() {
    lockHolders.forEach(holder -> dao.searchReindexLockDAO().releaseLock(REINDEX_LOCK_KEY, holder));
    jobIds.forEach(jobId -> dao.searchIndexJobDAO().delete(jobId));
  }

  /**
   * #38016: the sweep failed orphans without taking the reindex lock. While another server's sweep
   * or a running reindex holds it, the orphan is left for a later sweep.
   */
  @Test
  void sweepLeavesAnOrphanForALaterSweepWhileTheReindexLockIsHeld() {
    final long now = System.currentTimeMillis();
    final String jobId = insertJob(IndexJobStatus.INITIALIZING, now - STALE_FOR_MS);
    holdLock(UUID.randomUUID().toString(), now + LOCK_TTL_MS);

    new JobRecoveryManager(dao).performStartupRecovery();

    assertEquals(IndexJobStatus.INITIALIZING.name(), job(jobId).status());
  }

  /**
   * With its updatedAt stale and the lock expired, nothing shows the job is alive, so it is failed.
   * A live coordinator keeps both fresh while it builds partitions (see
   * DistributedSearchIndexExecutorTest#createJobRenewsTheJobsOwnLockWhileItsPartitionsAreBuilt).
   */
  @Test
  void sweepFailsAStaleJobOnceTheLockHasExpired() {
    final long now = System.currentTimeMillis();
    final String jobId = insertJob(IndexJobStatus.INITIALIZING, now - STALE_FOR_MS);
    holdLock(UUID.randomUUID().toString(), now - TimeUnit.MINUTES.toMillis(1));

    new JobRecoveryManager(dao).performStartupRecovery();

    final SearchIndexJobRecord job = job(jobId);
    assertEquals(IndexJobStatus.FAILED.name(), job.status());
    assertEquals("Job abandoned due to server crash or shutdown", job.errorMessage());
  }

  @Test
  void failingAJobMissesOnceItWasWrittenAfterItWasRead() {
    final long readAt = System.currentTimeMillis();
    final String jobId = insertJob(IndexJobStatus.RUNNING, readAt);
    dao.searchIndexJobDAO().touchJob(jobId, readAt + 1);

    assertEquals(0, failIfUnchanged(jobId, IndexJobStatus.RUNNING, readAt));
    assertEquals(IndexJobStatus.RUNNING.name(), job(jobId).status());

    assertEquals(1, failIfUnchanged(jobId, IndexJobStatus.RUNNING, readAt + 1));
    assertEquals(IndexJobStatus.FAILED.name(), job(jobId).status());
  }

  @Test
  void anInitializingJobIsMarkedReady() {
    final long now = System.currentTimeMillis();
    final String jobId = insertJob(IndexJobStatus.INITIALIZING, now);

    assertEquals(1, dao.searchIndexJobDAO().markReadyIfInitializing(jobId, "{}", now + 1));

    final SearchIndexJobRecord job = job(jobId);
    assertEquals(IndexJobStatus.READY.name(), job.status());
    assertEquals(now + 1, job.updatedAt());
  }

  @Test
  void aJobFailedWhileItsPartitionsWereBuiltIsNotMarkedReady() {
    final long now = System.currentTimeMillis();
    final String jobId = insertJob(IndexJobStatus.INITIALIZING, now);
    assertEquals(1, failIfUnchanged(jobId, IndexJobStatus.INITIALIZING, now));

    assertEquals(0, dao.searchIndexJobDAO().markReadyIfInitializing(jobId, "{}", now + 1));
    assertEquals(IndexJobStatus.FAILED.name(), job(jobId).status());
  }

  private String insertJob(final IndexJobStatus status, final long updatedAt) {
    final String jobId = UUID.randomUUID().toString();
    dao.searchIndexJobDAO()
        .insert(
            jobId,
            status.name(),
            JsonUtils.pojoToJson(new EventPublisherJob().withEntities(Set.of("table"))),
            "staged_it_",
            0,
            0,
            0,
            0,
            "{}",
            TEST_NAME,
            updatedAt - TimeUnit.MINUTES.toMillis(1),
            updatedAt,
            null);
    jobIds.add(jobId);
    return jobId;
  }

  private void holdLock(final String holder, final long expiresAt) {
    assertTrue(
        dao.searchReindexLockDAO()
            .tryAcquireLock(
                REINDEX_LOCK_KEY, holder, TEST_NAME, expiresAt - LOCK_TTL_MS, expiresAt),
        "another search reindex holds the lock");
    lockHolders.add(holder);
  }

  private int failIfUnchanged(
      final String jobId, final IndexJobStatus readStatus, final long readUpdatedAt) {
    return dao.searchIndexJobDAO()
        .failIfUnchanged(
            new JobSnapshot(jobId, readStatus.name(), readUpdatedAt),
            new RecordCounts(0, 0, 0),
            System.currentTimeMillis(),
            TEST_NAME);
  }

  private SearchIndexJobRecord job(final String jobId) {
    return dao.searchIndexJobDAO().findById(jobId);
  }
}
