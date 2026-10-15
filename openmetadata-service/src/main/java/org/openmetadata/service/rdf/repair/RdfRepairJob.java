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
package org.openmetadata.service.rdf.repair;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.OptionalLong;
import java.util.function.BooleanSupplier;
import java.util.function.LongSupplier;
import java.util.function.Supplier;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.app.App;
import org.openmetadata.schema.entity.app.AppExtension;
import org.openmetadata.schema.entity.app.AppRunRecord;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.apps.ApplicationHandler;
import org.openmetadata.service.apps.bundles.rdf.RdfReindexRunLock;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.AppRepository;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.RdfInfraDAOs.RdfReindexLockDAO;
import org.openmetadata.service.jobs.ScheduledRepairJob;
import org.openmetadata.service.rdf.OntologyLoader;
import org.openmetadata.service.rdf.RdfExcludedEntities;
import org.openmetadata.service.rdf.RdfRepository;
import org.openmetadata.service.rdf.RdfUpdater;
import org.openmetadata.service.search.SearchRepairJob;

/**
 * The scheduled repair of the RDF projection ({@link ScheduledRepairJob}), which replaces the
 * weekly RdfIndexApp rebuild. Each pass:
 *
 * <ol>
 *   <li>starts a full rebuild if the projection was never built, lost its data, or its last full
 *       build failed a day or more ago ({@link RdfProjectionCheck});
 *   <li>re-projects the entities changed since the last pass whose projection is missing or stale
 *       ({@link ChangedEntitiesRdfRepair});
 *   <li>once a day, removes the entities whose rows are gone ({@link RdfOrphanSweep}).
 * </ol>
 *
 * Fixes go through the live write queue, so the cluster's one RDF writer applies them in turn
 * with the live writes. A pass waits while an RDF rebuild runs, while the store does not answer,
 * and while live writes are more than {@link #SETTLE} behind: entities still queued would look
 * stale and be queued twice.
 */
@Slf4j
public class RdfRepairJob extends ScheduledRepairJob {
  static final String NAME = "rdfRepair";

  /** The {@code rdf_reindex_lock} row the server running a pass holds. */
  public static final String LOCK_KEY = "RDF_REPAIR_LOCK";

  private static final String RDF_INDEX_APP = "RdfIndexApp";
  private static final String ALL_ENTITIES = "all";

  private static volatile RdfRepairJob running;

  private final Supplier<RdfRepository> rdf;
  private final Steps steps;
  private final LongSupplier clock;

  /**
   * The parts of a pass.
   *
   * @param rebuildRunning whether an RDF rebuild runs on any server
   * @param oldestQueuedWriteAt when the oldest live write still queued was queued
   */
  record Steps(
      RdfProjectionCheck projectionCheck,
      ChangedEntitiesRdfRepair changedEntities,
      RdfOrphanSweep orphanSweep,
      BooleanSupplier rebuildRunning,
      Supplier<OptionalLong> oldestQueuedWriteAt) {
    static Steps of(final CollectionDAO collectionDAO, final Supplier<RdfRepository> rdf) {
      final RdfReindexLockDAO locks = collectionDAO.rdfReindexLockDAO();
      final BooleanSupplier rebuildRunning = () -> RdfReindexRunLock.isHeld(locks);
      final RdfProjectedEntities projected =
          new RdfProjectedEntities(
              query -> rdf.get().executeSparqlQueryDirect(query, "json"),
              () -> rdf.get().getBaseUri());
      final RdfProjectionCheck.Probes probes =
          new RdfProjectionCheck.Probes(
              () -> latestRebuild(collectionDAO),
              () -> holdsOntology(rdf.get()),
              rebuildRunning,
              () -> SearchRepairJob.isReindexRunning(collectionDAO));
      return new Steps(
          new RdfProjectionCheck(probes, RdfRepairJob::startFullRebuild),
          new ChangedEntitiesRdfRepair(
              projected, RdfRepairJob::projectedTypes, RdfUpdater::refreshEntity),
          new RdfOrphanSweep(projected, RdfUpdater::refreshEntity),
          rebuildRunning,
          RdfUpdater::oldestQueuedWriteAt);
    }
  }

  /** The server's RDF repair, against whichever RDF repository is current when a pass runs. */
  public RdfRepairJob(final CollectionDAO collectionDAO) {
    this(
        collectionDAO,
        RdfRepository::getInstanceOrNull,
        Steps.of(collectionDAO, RdfRepository::getInstanceOrNull),
        System::currentTimeMillis);
  }

  RdfRepairJob(
      final CollectionDAO collectionDAO,
      final Supplier<RdfRepository> rdf,
      final Steps steps,
      final LongSupplier clock) {
    super(
        NAME,
        passLock(collectionDAO.rdfReindexLockDAO()),
        collectionDAO.projectionRepairStateDAO(),
        clock);
    this.rdf = rdf;
    this.steps = steps;
    this.clock = clock;
  }

  private static PassLock passLock(final RdfReindexLockDAO locks) {
    return new PassLock() {
      @Override
      public boolean tryAcquire(
          final String passId, final String serverId, final long now, final long expiresAt) {
        return locks.tryAcquireLock(LOCK_KEY, passId, serverId, now, expiresAt);
      }

      @Override
      public void renew(
          final String passId, final String serverId, final long now, final long expiresAt) {
        locks.updateHeartbeat(LOCK_KEY, passId, now, expiresAt);
      }

      @Override
      public void release(final String passId) {
        locks.releaseLock(LOCK_KEY, passId);
      }
    };
  }

  @Override
  public void start() {
    super.start();
    running = this;
  }

  @Override
  public void stop() throws InterruptedException {
    running = null;
    super.stop();
  }

  /** The RDF repair this server runs, once it started. */
  public static Optional<RdfRepairJob> running() {
    return Optional.ofNullable(running);
  }

  @Override
  protected boolean isReady() {
    final Optional<String> wait = reasonToWait();
    wait.ifPresent(reason -> LOG.info("RDF repair pass waits: {}", reason));
    return wait.isEmpty();
  }

  private Optional<String> reasonToWait() {
    final RdfRepository current = rdf.get();
    final Optional<String> reason;
    if (current == null || !current.isEnabled() || !current.isStorageReachable()) {
      reason = Optional.of("the RDF store does not answer");
    } else if (steps.rebuildRunning().getAsBoolean()) {
      reason = Optional.of("an RDF rebuild is running");
    } else if (isLiveWriteQueueBehind()) {
      reason = Optional.of("live RDF writes are still queued");
    } else {
      reason = Optional.empty();
    }
    return reason;
  }

  private boolean isLiveWriteQueueBehind() {
    final OptionalLong oldest = steps.oldestQueuedWriteAt().get();
    return oldest.isPresent() && clock.getAsLong() - oldest.getAsLong() > SETTLE.toMillis();
  }

  @Override
  protected void checkProjection() throws InterruptedException {
    steps.projectionCheck().rebuildIfNeeded();
  }

  @Override
  protected int repairChanged(final long since, final long until, final Runnable heartbeat)
      throws Exception {
    return steps.changedEntities().repair(since, until, heartbeat);
  }

  /** RDF orphans are judged by whether their row exists, so the time does not matter. */
  @Override
  protected void sweep(final long untouchedSince, final Runnable heartbeat) {
    try {
      steps.orphanSweep().sweep(projectedTypes(), heartbeat);
    } catch (RuntimeException e) {
      LOG.warn("RDF repair could not count the projected entities; the next sweep tries again", e);
    }
  }

  /** The entity types RDF projects: every repository-backed type but time series and exclusions. */
  static List<String> projectedTypes() {
    return Entity.getEntityList().stream()
        .filter(entityType -> !RdfExcludedEntities.isExcluded(entityType))
        .filter(entityType -> !Entity.isTimeSeriesEntity(entityType))
        .filter(Entity::hasEntityRepository)
        .sorted()
        .toList();
  }

  private static Optional<AppRunRecord> latestRebuild(final CollectionDAO collectionDAO) {
    final List<String> latest =
        collectionDAO
            .appExtensionTimeSeriesDao()
            .listAppExtensionByName(
                RDF_INDEX_APP, 1, 0, AppExtension.ExtensionType.STATUS.toString());
    return latest.isEmpty()
        ? Optional.empty()
        : Optional.ofNullable(JsonUtils.readValue(latest.getFirst(), AppRunRecord.class));
  }

  /** Whether the store holds the ontology graph; a store that came back empty does not. */
  private static boolean holdsOntology(final RdfRepository rdf) {
    final String answer =
        rdf.executeSparqlQueryDirect(
            "ASK { GRAPH <" + OntologyLoader.ONTOLOGY_GRAPH + "> { ?s ?p ?o } }", "json");
    return JsonUtils.readTree(answer).path("boolean").asBoolean(false);
  }

  /** Starts an RdfIndexApp run that rebuilds the whole projection. */
  public static void startFullRebuild() {
    try {
      final AppRepository apps = (AppRepository) Entity.getEntityRepository(Entity.APPLICATION);
      final App app = apps.getByName(null, RDF_INDEX_APP, apps.getFields("owners,bot,pipelines"));
      ApplicationHandler.getInstance()
          .triggerApplicationOnDemand(
              app,
              Entity.getCollectionDAO(),
              Entity.getSearchRepository(),
              Map.of("entities", List.of(ALL_ENTITIES), "recreateIndex", true),
              NAME);
    } catch (EntityNotFoundException notInstalled) {
      LOG.warn("The RDF projection needs a full rebuild, but {} is not installed", RDF_INDEX_APP);
    }
  }
}
