package org.openmetadata.service.rdf;

import io.micrometer.core.instrument.Timer;
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
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.api.configuration.rdf.RdfConfiguration;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EntityRelationship;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.service.Entity;
import org.openmetadata.service.monitoring.RequestLatencyContext;
import org.openmetadata.service.util.AsyncService;

@Slf4j
public class RdfUpdater {

  private static final int MAX_PENDING_RDF_WRITES = 1000;
  private static final AtomicInteger pendingWrites = new AtomicInteger(0);
  private static final AtomicLong droppedWrites = new AtomicLong(0L);
  private static final ConcurrentMap<UUID, CompletableFuture<Void>> keyedWriteTails =
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
    if (rdfRepository == null || !rdfRepository.isEnabled()) {
      return;
    }
    submitAsync(
        "updateEntity " + entity.getId(),
        writeKeys(entity.getId()),
        () -> {
          Timer.Sample sample = RequestLatencyContext.startRdfOperation();
          try {
            rdfRepository.createOrUpdate(entity);
          } catch (Exception e) {
            LOG.error("Failed to update entity {} in RDF", entity.getId(), e);
          } finally {
            RequestLatencyContext.endRdfOperation(sample);
          }
        });
  }

  public static void deleteEntity(EntityReference entityReference) {
    if (rdfRepository == null || !rdfRepository.isEnabled()) {
      return;
    }
    submitAsync(
        "deleteEntity " + entityReference.getId(),
        writeKeys(entityReference.getId()),
        () -> {
          Timer.Sample sample = RequestLatencyContext.startRdfOperation();
          try {
            rdfRepository.delete(entityReference);
          } catch (Exception e) {
            LOG.error("Failed to delete entity {} in RDF", entityReference.getId(), e);
          } finally {
            RequestLatencyContext.endRdfOperation(sample);
          }
        });
  }

  public static void addRelationship(EntityRelationship relationship) {
    if (rdfRepository == null || !rdfRepository.isEnabled()) {
      return;
    }
    if (isGlossaryTermRelatedTo(relationship)) {
      // Glossary term ⇔ glossary term RELATED_TO is owned by the typed path
      // (addGlossaryTermRelation), which writes the precise predicate —
      // skos:exactMatch for synonym, skos:broader for broader, om:relatedTo
      // for relatedTo, etc. The generic addRelationship would unconditionally
      // write om:relatedTo on top of that, so every type change would leak a
      // residual om:relatedTo triple that nothing later cleans up.
      return;
    }
    submitAsync(
        "addRelationship",
        writeKeys(relationship.getFromId(), relationship.getToId()),
        () -> {
          Timer.Sample sample = RequestLatencyContext.startRdfOperation();
          try {
            rdfRepository.addRelationship(relationship);
          } catch (Exception e) {
            LOG.error("Failed to add relationship in RDF", e);
          } finally {
            RequestLatencyContext.endRdfOperation(sample);
          }
        });
  }

  public static void removeRelationship(EntityRelationship relationship) {
    if (rdfRepository == null || !rdfRepository.isEnabled()) {
      return;
    }
    if (isGlossaryTermRelatedTo(relationship)) {
      // See addRelationship — the typed removal path
      // (removeGlossaryTermRelation) owns these deletions.
      return;
    }
    submitAsync(
        "removeRelationship",
        writeKeys(relationship.getFromId(), relationship.getToId()),
        () -> {
          Timer.Sample sample = RequestLatencyContext.startRdfOperation();
          try {
            rdfRepository.removeRelationship(relationship);
          } catch (Exception e) {
            LOG.error("Failed to remove relationship in RDF", e);
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
          } catch (Exception e) {
            LOG.error(
                "Failed to add glossary term relation {} -> {} ({}) to RDF",
                fromTermId,
                toTermId,
                relationType,
                e);
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
          } catch (Exception e) {
            LOG.error(
                "Failed to remove glossary term relation {} -> {} ({}) from RDF",
                fromTermId,
                toTermId,
                relationType,
                e);
          }
        });
  }

  private static void submitAsync(String description, Runnable task) {
    submitAsync(description, Set.of(), task);
  }

  // Bounded fire-and-forget submission: request threads never wait for Fuseki,
  // but writes touching the same entity id are chained in submission order.
  // This preserves the old synchronous hook ordering for per-entity RDF state
  // while still allowing unrelated entities to use AsyncService concurrently.
  private static void submitAsync(String description, Set<UUID> writeKeys, Runnable task) {
    int newCount = pendingWrites.incrementAndGet();
    if (newCount > MAX_PENDING_RDF_WRITES) {
      pendingWrites.decrementAndGet();
      long dropped = droppedWrites.incrementAndGet();
      if (dropped == 1 || dropped % 100 == 0) {
        LOG.warn(
            "Dropping RDF {} due to backpressure (pending={}, total dropped={})",
            description,
            newCount - 1,
            dropped);
      }
      return;
    }

    Set<UUID> orderedKeys = normalizeWriteKeys(writeKeys);
    if (!orderedKeys.isEmpty()) {
      submitKeyedAsync(description, orderedKeys, task);
      return;
    }

    try {
      AsyncService.getInstance()
          .execute(
              () -> {
                try {
                  task.run();
                } finally {
                  pendingWrites.decrementAndGet();
                }
              });
    } catch (RuntimeException e) {
      pendingWrites.decrementAndGet();
      LOG.error("Failed to submit RDF {} to async executor", description, e);
    }
  }

  private static void submitKeyedAsync(String description, Set<UUID> writeKeys, Runnable task) {
    CompletableFuture<Void> next;
    synchronized (keyedWriteTails) {
      CompletableFuture<?>[] previous =
          writeKeys.stream()
              .map(
                  key -> keyedWriteTails.getOrDefault(key, CompletableFuture.completedFuture(null)))
              .toArray(CompletableFuture[]::new);
      CompletableFuture<Void> previousWrites =
          CompletableFuture.allOf(previous).handle((ignored, error) -> null);
      next =
          previousWrites.thenRunAsync(
              () -> {
                try {
                  task.run();
                } finally {
                  pendingWrites.decrementAndGet();
                }
              },
              AsyncService.getInstance().getExecutorService());
      for (UUID key : writeKeys) {
        keyedWriteTails.put(key, next);
      }
    }

    next.whenComplete(
        (ignored, error) -> {
          synchronized (keyedWriteTails) {
            for (UUID key : writeKeys) {
              keyedWriteTails.remove(key, next);
            }
          }
          if (error != null) {
            LOG.error("RDF {} failed while running in keyed async queue", description, error);
          }
        });
  }

  private static Set<UUID> writeKeys(UUID... keys) {
    if (keys == null || keys.length == 0) {
      return Set.of();
    }
    return normalizeWriteKeys(Arrays.asList(keys));
  }

  private static Set<UUID> normalizeWriteKeys(Iterable<UUID> keys) {
    if (keys == null) {
      return Set.of();
    }
    List<UUID> filtered = new ArrayList<>();
    for (UUID key : keys) {
      if (key != null) {
        filtered.add(key);
      }
    }
    filtered.sort(Comparator.comparing(UUID::toString));
    return new LinkedHashSet<>(filtered);
  }
}
