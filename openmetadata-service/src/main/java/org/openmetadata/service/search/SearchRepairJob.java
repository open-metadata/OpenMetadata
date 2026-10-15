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

import java.io.IOException;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.LongSupplier;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.app.App;
import org.openmetadata.service.Entity;
import org.openmetadata.service.apps.ApplicationHandler;
import org.openmetadata.service.apps.bundles.searchIndex.OrphanedDocumentsSweep;
import org.openmetadata.service.apps.bundles.searchIndex.distributed.IndexJobStatus;
import org.openmetadata.service.jdbi3.AppRepository;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.SearchReindexDAOs.SearchReindexLockDAO;
import org.openmetadata.service.jobs.ScheduledRepairJob;

/**
 * The scheduled repair of search ({@link ScheduledRepairJob}). Each pass:
 *
 * <ol>
 *   <li>rebuilds the indexes that are missing or were created by a live write ({@link
 *       SearchIndexCheck});
 *   <li>rebuilds the documents of rows changed since the last pass that are missing or older than
 *       their row, and the documents that inherit from a changed row and were read just before it
 *       changed ({@link ChangedDocumentsRepair});
 *   <li>once a day, deletes the documents whose rows are gone ({@link OrphanedDocumentsSweep}).
 * </ol>
 */
@Slf4j
public class SearchRepairJob extends ScheduledRepairJob {
  static final String NAME = "searchRepair";

  /** The {@code search_reindex_lock} row the server running a pass holds. */
  public static final String LOCK_KEY = "SEARCH_REPAIR_LOCK";

  private static final String SEARCH_INDEXING_APP = "SearchIndexingApplication";
  private static final List<String> ACTIVE_REINDEX_STATUSES =
      List.of(
          IndexJobStatus.INITIALIZING.name(),
          IndexJobStatus.READY.name(),
          IndexJobStatus.RUNNING.name(),
          IndexJobStatus.PROMOTING.name());

  private final SearchRepository searchRepository;
  private final SearchIndexCheck indexCheck;
  private final ChangedDocumentsRepair changedDocuments;

  /** The checks a pass runs. */
  record Steps(SearchIndexCheck indexCheck, ChangedDocumentsRepair changedDocuments) {
    static Steps of(final CollectionDAO collectionDAO, final SearchRepository searchRepository) {
      final SearchDocumentRebuilder rebuilder = new SearchDocumentRebuilder(searchRepository);
      return new Steps(
          new SearchIndexCheck(
              searchRepository,
              () -> isReindexRunning(collectionDAO),
              SearchRepairJob::triggerForcedReindex),
          new ChangedDocumentsRepair(
              searchRepository, rebuilder, new SearchScopeRepair(searchRepository, rebuilder)));
    }
  }

  public SearchRepairJob(
      final CollectionDAO collectionDAO, final SearchRepository searchRepository) {
    this(
        collectionDAO,
        searchRepository,
        Steps.of(collectionDAO, searchRepository),
        System::currentTimeMillis);
  }

  SearchRepairJob(
      final CollectionDAO collectionDAO,
      final SearchRepository searchRepository,
      final Steps steps,
      final LongSupplier clock) {
    super(
        NAME,
        passLock(collectionDAO.searchReindexLockDAO()),
        collectionDAO.projectionRepairStateDAO(),
        clock);
    this.searchRepository = searchRepository;
    this.indexCheck = steps.indexCheck();
    this.changedDocuments = steps.changedDocuments();
  }

  private static PassLock passLock(final SearchReindexLockDAO locks) {
    return new PassLock() {
      @Override
      public boolean tryAcquire(
          final String passId, final String serverId, final long now, final long expiresAt) {
        return locks.tryAcquireLock(LOCK_KEY, passId, serverId, now, expiresAt);
      }

      @Override
      public void renew(
          final String passId, final String serverId, final long now, final long expiresAt) {
        locks.refreshLock(LOCK_KEY, passId, serverId, now, expiresAt);
      }

      @Override
      public void release(final String passId) {
        locks.releaseLock(LOCK_KEY, passId);
      }
    };
  }

  @Override
  protected boolean isReady() {
    final boolean available = searchRepository.getSearchClient().isClientAvailable();
    if (!available) {
      LOG.info("Search is unavailable; the repair pass waits for it");
    }
    return available;
  }

  @Override
  protected void checkProjection() throws IOException, InterruptedException {
    indexCheck.repairUnusableIndexes();
  }

  @Override
  protected int repairChanged(final long since, final long until, final Runnable heartbeat)
      throws Exception {
    return changedDocuments.repair(since, until, heartbeat);
  }

  @Override
  protected void sweep(final long untouchedSince, final Runnable heartbeat) {
    for (final String entityType : changedDocuments.repairableTypes()) {
      sweepType(entityType, untouchedSince);
      heartbeat.run();
    }
  }

  private void sweepType(final String entityType, final long untouchedSince) {
    try {
      final long removed =
          OrphanedDocumentsSweep.removeOrphans(searchRepository, entityType, untouchedSince);
      if (removed > 0) {
        LOG.info("Search repair removed {} {} documents whose rows are gone", removed, entityType);
      }
    } catch (IOException | RuntimeException e) {
      LOG.warn(
          "Search repair could not sweep {} documents; the next sweep tries again", entityType, e);
    }
  }

  /** Whether a reindex is building or promoting indexes on any server. */
  public static boolean isReindexRunning(final CollectionDAO collectionDAO) {
    return !collectionDAO.searchIndexJobDAO().findByStatuses(ACTIVE_REINDEX_STATUSES).isEmpty();
  }

  /** Starts a reindex that builds new indexes for {@code entityTypes}. */
  static void triggerForcedReindex(final Set<String> entityTypes) {
    final AppRepository apps = (AppRepository) Entity.getEntityRepository(Entity.APPLICATION);
    final App app =
        apps.getByName(null, SEARCH_INDEXING_APP, apps.getFields("owners,bot,pipelines"));
    LOG.warn("Search repair starts a reindex of {} to rebuild their indexes", entityTypes);
    ApplicationHandler.getInstance()
        .triggerApplicationOnDemand(
            app,
            Entity.getCollectionDAO(),
            Entity.getSearchRepository(),
            Map.of("entities", List.copyOf(entityTypes), "force", true),
            NAME);
  }
}
