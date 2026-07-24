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

import io.micrometer.core.instrument.Timer;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;
import java.util.concurrent.Semaphore;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.api.configuration.rdf.RdfConfiguration;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EntityRelationship;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.service.Entity;
import org.openmetadata.service.monitoring.OntologyMetrics;
import org.openmetadata.service.monitoring.RequestLatencyContext;
import org.openmetadata.service.util.AsyncService;
import org.openmetadata.service.util.PostCommitActionQueue;

@Slf4j
public class RdfUpdater {

  private static final int MAX_PENDING_RDF_WRITES = 1000;
  private static final int MAX_CONCURRENT_RDF_WRITES = 8;
  private static final long QUEUE_FULL_WAIT_SECONDS = 30;
  private static final AtomicInteger PENDING_WRITES = new AtomicInteger(0);
  private static final AtomicLong DROPPED_WRITES = new AtomicLong(0L);
  private static final Semaphore WRITE_PERMITS = new Semaphore(MAX_CONCURRENT_RDF_WRITES, true);
  private static final Semaphore QUEUE_PERMITS = new Semaphore(MAX_PENDING_RDF_WRITES, true);
  private static final ConcurrentMap<UUID, CompletableFuture<Void>> KEYED_WRITE_TAILS =
      new ConcurrentHashMap<>();

  private static RdfRepository rdfRepository;

  private RdfUpdater() {}

  public static void initialize(RdfConfiguration config) {
    if (config.getEnabled() != null && config.getEnabled()) {
      RdfRepository.initialize(config);
      rdfRepository = RdfRepository.getInstance();
      LOG.info("RDF updater initialized");
    } else {
      LOG.info("RDF updater disabled");
    }
  }

  public static void updateEntity(EntityInterface entity) {
    if (rdfRepository == null
        || !rdfRepository.isEnabled()
        || RdfExcludedEntities.isExcluded(Entity.getEntityTypeFromObject(entity))) {
      return;
    }
    submitAsync(
        "updateEntity " + entity.getId(),
        writeKeys(entity.getId()),
        () -> {
          Timer.Sample sample = RequestLatencyContext.startRdfOperation();
          try {
            rdfRepository.createOrUpdate(entity);
          } catch (RuntimeException exception) {
            RdfProjectionHealth.markDegraded();
            LOG.error("Failed to update entity {} in RDF", entity.getId(), exception);
          } finally {
            RequestLatencyContext.endRdfOperation(sample);
          }
        });
  }

  public static void deleteEntity(EntityReference entityReference) {
    if (rdfRepository == null
        || !rdfRepository.isEnabled()
        || RdfExcludedEntities.isExcluded(entityReference.getType())) {
      return;
    }
    submitAsync(
        "deleteEntity " + entityReference.getId(),
        writeKeys(entityReference.getId()),
        () -> {
          Timer.Sample sample = RequestLatencyContext.startRdfOperation();
          try {
            rdfRepository.delete(entityReference);
          } catch (RuntimeException exception) {
            RdfProjectionHealth.markDegraded();
            LOG.error("Failed to delete entity {} in RDF", entityReference.getId(), exception);
          } finally {
            RequestLatencyContext.endRdfOperation(sample);
          }
        });
  }

  public static void addRelationship(EntityRelationship relationship) {
    if (rdfRepository == null || !rdfRepository.isEnabled()) {
      return;
    }
    if (isGlossaryTermRelatedTo(relationship) || involvesExcludedEntity(relationship)) {
      // Glossary term ⇔ glossary term RELATED_TO is owned by the typed path
      // (addGlossaryTermRelation), which writes the precise predicate —
      // skos:exactMatch for synonym, skos:broader for broader, om:relatedTo
      // for relatedTo, etc. The generic addRelationship would unconditionally
      // write om:relatedTo on top of that, so every type change would leak a
      // residual om:relatedTo triple that nothing later cleans up. Edges whose
      // endpoint is an entity type excluded from RDF are skipped so the graph
      // never holds a dangling reference to a node that was never indexed.
      return;
    }
    submitAsync(
        "addRelationship",
        writeKeys(relationship.getFromId(), relationship.getToId()),
        () -> {
          Timer.Sample sample = RequestLatencyContext.startRdfOperation();
          try {
            rdfRepository.addRelationship(relationship);
          } catch (RuntimeException exception) {
            RdfProjectionHealth.markDegraded();
            LOG.error("Failed to add relationship in RDF", exception);
          } finally {
            RequestLatencyContext.endRdfOperation(sample);
          }
        });
  }

  public static void removeRelationship(EntityRelationship relationship) {
    if (rdfRepository == null || !rdfRepository.isEnabled()) {
      return;
    }
    if (isGlossaryTermRelatedTo(relationship) || involvesExcludedEntity(relationship)) {
      // See addRelationship — the typed removal path
      // (removeGlossaryTermRelation) owns these deletions, and edges touching
      // an RDF-excluded entity type are skipped to match the add path.
      return;
    }
    submitAsync(
        "removeRelationship",
        writeKeys(relationship.getFromId(), relationship.getToId()),
        () -> {
          Timer.Sample sample = RequestLatencyContext.startRdfOperation();
          try {
            rdfRepository.removeRelationship(relationship);
          } catch (RuntimeException exception) {
            RdfProjectionHealth.markDegraded();
            LOG.error("Failed to remove relationship in RDF", exception);
          } finally {
            RequestLatencyContext.endRdfOperation(sample);
          }
        });
  }

  private static boolean isGlossaryTermRelatedTo(EntityRelationship relationship) {
    return Entity.GLOSSARY_TERM.equals(relationship.getFromEntity())
        && Entity.GLOSSARY_TERM.equals(relationship.getToEntity())
        && relationship.getRelationshipType() == Relationship.RELATED_TO;
  }

  private static boolean involvesExcludedEntity(EntityRelationship relationship) {
    return RdfExcludedEntities.isExcluded(relationship.getFromEntity())
        || RdfExcludedEntities.isExcluded(relationship.getToEntity());
  }

  public static boolean isEnabled() {
    return rdfRepository != null && rdfRepository.isEnabled();
  }

  public static void disable() {
    rdfRepository = null;
    RdfRepository.reset();
    LOG.info("RDF updater disabled");
  }

  public static void addGlossaryTermRelation(UUID fromTermId, UUID toTermId, String relationType) {
    if (rdfRepository == null || !rdfRepository.isEnabled()) {
      return;
    }
    submitAsync(
        "addGlossaryTermRelation",
        writeKeys(fromTermId, toTermId),
        () -> {
          try {
            rdfRepository.addGlossaryTermRelation(fromTermId, toTermId, relationType);
          } catch (RuntimeException exception) {
            RdfProjectionHealth.markDegraded();
            LOG.error(
                "Failed to add glossary term relation {} -> {} ({}) to RDF",
                fromTermId,
                toTermId,
                relationType,
                exception);
          }
        });
  }

  public static void removeGlossaryTermRelation(
      UUID fromTermId, UUID toTermId, String relationType) {
    if (rdfRepository == null || !rdfRepository.isEnabled()) {
      return;
    }
    submitAsync(
        "removeGlossaryTermRelation",
        writeKeys(fromTermId, toTermId),
        () -> {
          try {
            rdfRepository.removeGlossaryTermRelation(fromTermId, toTermId, relationType);
          } catch (RuntimeException exception) {
            RdfProjectionHealth.markDegraded();
            LOG.error(
                "Failed to remove glossary term relation {} -> {} ({}) from RDF",
                fromTermId,
                toTermId,
                relationType,
                exception);
          }
        });
  }

  // Bounded fire-and-forget submission: request threads never wait for Fuseki,
  // but writes touching the same entity id are chained in submission order.
  // This preserves the old synchronous hook ordering for per-entity RDF state
  // while still allowing unrelated entities to use AsyncService concurrently.
  private static void submitAsync(String description, Set<UUID> writeKeys, Runnable task) {
    PostCommitActionQueue.runOrDefer(() -> submitAsyncAfterCommit(description, writeKeys, task));
  }

  private static void submitAsyncAfterCommit(
      String description, Set<UUID> writeKeys, Runnable task) {
    if (!acquireQueuePermit(description)) {
      return;
    }
    final int newCount = PENDING_WRITES.incrementAndGet();
    OntologyMetrics.recordRdfQueueDepth(newCount);
    submitPendingWrite(description, writeKeys, measureQueueLag(task));
  }

  private static boolean acquireQueuePermit(final String description) {
    try {
      if (QUEUE_PERMITS.tryAcquire(QUEUE_FULL_WAIT_SECONDS, TimeUnit.SECONDS)) {
        return true;
      }
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
    }
    recordDroppedWrite(description);
    return false;
  }

  private static void recordDroppedWrite(final String description) {
    final long dropped = DROPPED_WRITES.incrementAndGet();
    RdfProjectionHealth.markDegraded();
    OntologyMetrics.recordRdfQueueDrop();
    if (dropped == 1 || dropped % 100 == 0) {
      LOG.warn(
          "Dropping RDF {} after waiting {}s for queue capacity (total dropped={})",
          description,
          QUEUE_FULL_WAIT_SECONDS,
          dropped);
    }
  }

  private static void submitPendingWrite(
      final String description, final Set<UUID> writeKeys, final Runnable task) {
    final Set<UUID> orderedKeys = normalizeWriteKeys(writeKeys);
    final Runnable boundedTask = withWritePermit(task);
    if (orderedKeys.isEmpty()) {
      submitUnkeyedAsync(description, boundedTask);
    } else {
      submitKeyedAsync(description, orderedKeys, boundedTask);
    }
  }

  private static void submitUnkeyedAsync(final String description, final Runnable task) {
    try {
      AsyncService.getInstance()
          .execute(
              () -> {
                try {
                  task.run();
                } finally {
                  decrementPendingWrites();
                }
              });
    } catch (RuntimeException e) {
      decrementPendingWrites();
      RdfProjectionHealth.markDegraded();
      LOG.error("Failed to submit RDF {} to async executor", description, e);
    }
  }

  private static void submitKeyedAsync(String description, Set<UUID> writeKeys, Runnable task) {
    CompletableFuture<Void> next = null;
    synchronized (KEYED_WRITE_TAILS) {
      final CompletableFuture<?>[] previous =
          writeKeys.stream()
              .map(
                  key ->
                      KEYED_WRITE_TAILS.getOrDefault(key, CompletableFuture.completedFuture(null)))
              .toArray(CompletableFuture[]::new);
      final CompletableFuture<Void> previousWrites =
          CompletableFuture.allOf(previous).handle((ignored, error) -> null);
      try {
        next = previousWrites.thenRunAsync(task, AsyncService.getInstance().getExecutorService());
      } catch (RuntimeException e) {
        decrementPendingWrites();
        RdfProjectionHealth.markDegraded();
        LOG.error("Failed to submit RDF {} to keyed async executor", description, e);
      }
      if (next != null) {
        for (UUID key : writeKeys) {
          KEYED_WRITE_TAILS.put(key, next);
        }
      }
    }

    if (next != null) {
      registerCompletion(description, writeKeys, next);
    }
  }

  private static void registerCompletion(
      final String description,
      final Set<UUID> writeKeys,
      final CompletableFuture<Void> submittedWrite) {
    submittedWrite.whenComplete(
        (ignored, error) -> completeKeyedWrite(description, writeKeys, submittedWrite, error));
  }

  private static void completeKeyedWrite(
      final String description,
      final Set<UUID> writeKeys,
      final CompletableFuture<Void> submittedWrite,
      final Throwable error) {
    synchronized (KEYED_WRITE_TAILS) {
      for (UUID key : writeKeys) {
        KEYED_WRITE_TAILS.remove(key, submittedWrite);
      }
    }
    decrementPendingWrites();
    if (error != null) {
      RdfProjectionHealth.markDegraded();
      LOG.error("RDF {} failed while running in keyed async queue", description, error);
    }
  }

  private static Runnable measureQueueLag(final Runnable task) {
    final long queuedAt = System.nanoTime();
    return () -> {
      OntologyMetrics.recordRdfQueueLag(Duration.ofNanos(System.nanoTime() - queuedAt));
      task.run();
    };
  }

  private static Runnable withWritePermit(final Runnable task) {
    return () -> {
      WRITE_PERMITS.acquireUninterruptibly();
      try {
        task.run();
      } finally {
        WRITE_PERMITS.release();
      }
    };
  }

  static int maxConcurrentWrites() {
    return MAX_CONCURRENT_RDF_WRITES;
  }

  private static void decrementPendingWrites() {
    QUEUE_PERMITS.release();
    OntologyMetrics.recordRdfQueueDepth(PENDING_WRITES.decrementAndGet());
  }

  private static Set<UUID> writeKeys(UUID... keys) {
    final Iterable<UUID> values = keys == null ? List.of() : Arrays.asList(keys);
    return normalizeWriteKeys(values);
  }

  private static Set<UUID> normalizeWriteKeys(Iterable<UUID> keys) {
    final List<UUID> filtered = new ArrayList<>();
    if (keys != null) {
      for (UUID key : keys) {
        if (key != null) {
          filtered.add(key);
        }
      }
    }
    filtered.sort(Comparator.comparing(UUID::toString));
    return new LinkedHashSet<>(filtered);
  }
}
