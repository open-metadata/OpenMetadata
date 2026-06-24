package org.openmetadata.service.rdf;

import io.micrometer.core.instrument.Timer;
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
    if (rdfRepository == null
        || !rdfRepository.isEnabled()
        || RdfExcludedEntities.isExcluded(entityReference.getType())) {
      return;
    }
    submitAsync(
        "deleteEntity " + entityReference.getId(),
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
    if (isGlossaryTermRelatedTo(relationship) || involvesExcludedEntity(relationship)) {
      // See addRelationship — the typed removal path
      // (removeGlossaryTermRelation) owns these deletions, and edges touching
      // an RDF-excluded entity type are skipped to match the add path.
      return;
    }
    submitAsync(
        "removeRelationship",
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

  public static void addGlossaryTermRelation(
      java.util.UUID fromTermId, java.util.UUID toTermId, String relationType) {
    if (rdfRepository == null || !rdfRepository.isEnabled()) {
      return;
    }
    submitAsync(
        "addGlossaryTermRelation",
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
      java.util.UUID fromTermId, java.util.UUID toTermId, String relationType) {
    if (rdfRepository == null || !rdfRepository.isEnabled()) {
      return;
    }
    submitAsync(
        "removeGlossaryTermRelation",
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

  // Bounded fire-and-forget submission: a request thread that triggers an RDF
  // write must NOT wait for Fuseki. We submit to AsyncService (virtual-thread
  // pool) but gate first on a soft cap of in-flight writes so that, if Fuseki
  // is unreachable and tasks pile up, we drop with a logged warning instead
  // of spawning unbounded virtual threads. RDF is a derived index — missed
  // writes are reconciled by the weekly RdfIndexApp run.
  //
  // Ordering trade-off (deliberate): pre-PR the EntityRepository hook chain
  // (removeOwners → storeOwners → postUpdate → RdfUpdater.updateEntity) ran
  // synchronously on the request thread and was therefore implicitly
  // sequenced per entity. Submitting through AsyncService loses that
  // sequencing — concurrent operations for the same entity / edge can land
  // in any order. We accept the race because:
  //   1. EntityUpdater diff-applies changes per request, so an add-then-remove
  //      of the same edge within one API call nets to no-op (no hooks fire).
  //   2. Cross-request races resolve at the next weekly recreate-index
  //      (RdfIndexApp with recreateIndex=true wipes and rebuilds from MySQL,
  //      so any temporarily out-of-order RDF state is reconciled within a week).
  //   3. The alternative — per-entity sequencing via a striped lock —
  //      costs memory and adds latency for the common case where there is
  //      no contention.
  // If observed-in-production ordering bugs emerge, this is the place to
  // add a ConcurrentHashMap<UUID, Semaphore>-style per-entity gate.
  private static void submitAsync(String description, Runnable task) {
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
}
