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
package org.openmetadata.service.rdf;

import java.time.Clock;
import java.util.Collection;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.function.Consumer;
import java.util.function.Supplier;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.api.configuration.rdf.RdfConfiguration;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EntityRelationship;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.config.AsyncOperationsConfiguration;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.util.AsyncService;
import org.openmetadata.service.util.PostCommitActionQueue;

@Slf4j
public final class RdfUpdater {
  private static volatile Consumer<List<RdfLiveWrite>> writeQueue;
  private static volatile RdfLiveWriteStore liveWriteStore;
  private static volatile RdfRestorePlanner restorePlanner;
  private static RdfLiveWriter writer;
  // Entities restored by the restore running on this thread; null outside a restore.
  private static final ThreadLocal<Set<RdfEntityLiveness.Endpoint>> RESTORED = new ThreadLocal<>();

  private RdfUpdater() {}

  public static void initialize(final RdfConfiguration config) {
    initialize(config, new AsyncOperationsConfiguration());
  }

  public static synchronized void initialize(
      final RdfConfiguration config,
      final AsyncOperationsConfiguration asyncOperationsConfiguration) {
    disable();
    if (Boolean.TRUE.equals(config.getEnabled())) {
      if (asyncOperationsConfiguration.getMaxConcurrentRdfWrites() > 1) {
        LOG.warn(
            "Durable live RDF delivery uses one cluster-wide writer to preserve mutation order");
      }
      final RdfLiveWriteStore store = new RdfLiveWriteStore(Entity.getJdbi(), Clock.systemUTC());
      RdfProjectionHealth.initialize(store);
      RdfRepository.initialize(config);
      final RdfRepository repository = RdfRepository.getInstance();
      writer =
          new RdfLiveWriter(
              store,
              command -> command.apply(repository),
              AsyncService.getInstance().getExecutorService());
      writeQueue = writer::enqueueAll;
      liveWriteStore = store;
      restorePlanner =
          new RdfRestorePlanner(
              new RdfRestoreSources(Entity.getCollectionDAO()), RdfEntityLiveness.database());
      writer.start();
      LOG.info("RDF updater initialized with durable, ordered live writes");
    }
  }

  public static boolean isEnabled() {
    return writeQueue != null;
  }

  public static void enqueueOntologyGraph(final CollectionDAO dao, final UUID ontologyId) {
    final RdfLiveWriteStore store = liveWriteStore;
    if (store != null) {
      dao.useHandle(
          handle ->
              store.enqueue(
                  handle, JsonUtils.pojoToJson(new RdfLiveWrite.OntologyGraph(ontologyId))));
    }
  }

  public static synchronized void disable() {
    stop();
    RdfRepository.reset();
  }

  public static synchronized void stop() {
    writeQueue = null;
    liveWriteStore = null;
    restorePlanner = null;
    if (writer != null) {
      writer.close();
      writer = null;
    }
  }

  public static void updateEntity(final EntityInterface<?> entity) {
    if (isEnabled() && isProjected(entity)) {
      submit(projection(entity));
    }
  }

  /** Projects a cascade's entities with one deferred enqueue instead of one per entity. */
  public static void updateEntities(final Collection<? extends EntityInterface<?>> entities) {
    if (isEnabled()) {
      submitAll(
          entities.stream().filter(RdfUpdater::isProjected).map(RdfUpdater::projection).toList());
    }
  }

  /**
   * The graph projects the live catalog only: a soft-deleted entity leaves it with every edge that
   * touches it, as a hard-deleted one does, and a restore puts it back
   * (ADR:2026-10-26-the-rdf-graph-projects-the-live-catalog-only).
   */
  private static RdfLiveWrite projection(final EntityInterface<?> entity) {
    return Boolean.TRUE.equals(entity.getDeleted())
        ? new RdfLiveWrite.EntityDelete(Entity.getEntityTypeFromObject(entity), entity.getId())
        : RdfLiveWrite.EntityUpdate.capture(entity);
  }

  private static boolean isProjected(final EntityInterface<?> entity) {
    return !RdfExcludedEntities.isExcluded(Entity.getEntityTypeFromObject(entity));
  }

  /**
   * Runs {@code restore} and, once it commits, re-adds the edges of every entity it restored.
   * Planning once for a whole cascade writes each edge between two restored entities once, after
   * both of its ends are live. A restore nested in another joins the outer one's plan.
   */
  public static <R> R restoring(final Supplier<R> restore) {
    if (!isEnabled() || RESTORED.get() != null) {
      return restore.get();
    }
    RESTORED.set(new LinkedHashSet<>());
    try {
      final R result = restore.get();
      submitRestorePlan(List.copyOf(RESTORED.get()));
      return result;
    } finally {
      RESTORED.remove();
    }
  }

  /**
   * Records entities a restore turned live. Their own triples come from {@link #updateEntity}; the
   * restore plan adds the edges and the references to them that their soft delete removed.
   */
  public static void recordRestored(final Collection<? extends EntityInterface<?>> entities) {
    if (isEnabled()) {
      final List<RdfEntityLiveness.Endpoint> restored =
          entities.stream()
              .filter(RdfUpdater::isProjected)
              .map(
                  entity ->
                      new RdfEntityLiveness.Endpoint(
                          Entity.getEntityTypeFromObject(entity), entity.getId()))
              .toList();
      final Set<RdfEntityLiveness.Endpoint> scope = RESTORED.get();
      if (scope == null) {
        submitRestorePlan(restored);
      } else {
        scope.addAll(restored);
      }
    }
  }

  private static void submitRestorePlan(final List<RdfEntityLiveness.Endpoint> restored) {
    final RdfRestorePlanner planner = restorePlanner;
    final Consumer<List<RdfLiveWrite>> queue = writeQueue;
    if (planner != null && queue != null && !restored.isEmpty()) {
      PostCommitActionQueue.runOrDefer(() -> enqueueRestorePlan(planner, queue, restored));
    }
  }

  private static void enqueueRestorePlan(
      final RdfRestorePlanner planner,
      final Consumer<List<RdfLiveWrite>> queue,
      final List<RdfEntityLiveness.Endpoint> restored) {
    try {
      final List<RdfLiveWrite> plan = planner.plan(restored);
      if (!plan.isEmpty()) {
        queue.accept(plan);
      }
    } catch (RuntimeException exception) {
      // The restore has committed; without the plan the graph misses these entities' edges until
      // a reindex, which a degraded projection asks for.
      LOG.error("Failed to plan the RDF restore of {} entities", restored.size(), exception);
      RdfProjectionHealth.markDegraded(exception);
    }
  }

  public static void deleteEntity(final EntityReference entity) {
    if (isEnabled() && !RdfExcludedEntities.isExcluded(entity.getType())) {
      submit(new RdfLiveWrite.EntityDelete(entity.getType(), entity.getId()));
    }
  }

  public static void addRelationship(final EntityRelationship relationship) {
    submitRelationship(relationship, false);
  }

  public static void removeRelationship(final EntityRelationship relationship) {
    submitRelationship(relationship, true);
  }

  private static void submitRelationship(
      final EntityRelationship relationship, final boolean remove) {
    if (isEnabled() && shouldIndexRelationship(relationship)) {
      submit(RdfLiveWrite.RelationshipChange.capture(relationship, remove));
    }
  }

  private static boolean shouldIndexRelationship(final EntityRelationship relationship) {
    // Typed glossary hooks own these edges; the generic hook would leak an extra om:relatedTo.
    final boolean typedGlossaryRelation =
        Entity.GLOSSARY_TERM.equals(relationship.getFromEntity())
            && Entity.GLOSSARY_TERM.equals(relationship.getToEntity())
            && relationship.getRelationshipType() == Relationship.RELATED_TO;
    return !typedGlossaryRelation
        && !RdfExcludedEntities.isExcluded(relationship.getFromEntity())
        && !RdfExcludedEntities.isExcluded(relationship.getToEntity());
  }

  public static void addGlossaryTermRelation(
      final UUID fromId, final UUID toId, final String relationType) {
    submit(new RdfLiveWrite.GlossaryRelationChange(fromId, toId, relationType, false));
  }

  public static void removeGlossaryTermRelation(
      final UUID fromId, final UUID toId, final String relationType) {
    submit(new RdfLiveWrite.GlossaryRelationChange(fromId, toId, relationType, true));
  }

  /**
   * Records a write to the serving graph that bypassed the live-write queue, so reasoning results
   * computed before it stop passing for current. A write that cannot be recorded marks the
   * projection degraded instead, which makes their freshness unknown rather than wrongly current.
   */
  public static void recordUntrackedWrite() {
    final RdfLiveWriteStore store = liveWriteStore;
    if (store != null) {
      try {
        store.recordUntrackedWrite();
      } catch (RuntimeException exception) {
        RdfProjectionHealth.markDegraded(exception);
      }
    }
  }

  private static void submit(final RdfLiveWrite command) {
    submitAll(List.of(command));
  }

  private static void submitAll(final List<RdfLiveWrite> commands) {
    final Consumer<List<RdfLiveWrite>> queue = writeQueue;
    if (queue != null && !commands.isEmpty()) {
      PostCommitActionQueue.runOrDefer(() -> queue.accept(commands));
    }
  }
}
