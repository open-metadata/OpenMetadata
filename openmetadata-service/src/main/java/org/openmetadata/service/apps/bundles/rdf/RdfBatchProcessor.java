/*
 *  Copyright 2024 Collate
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

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.TimeUnit;
import java.util.function.BooleanSupplier;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.type.LineageDetails;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.type.TermRelation;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.CoreRelationshipDAOs.EntityRelationshipObject;
import org.openmetadata.service.rdf.RdfExcludedEntities;
import org.openmetadata.service.rdf.RdfRepository;
import org.openmetadata.service.rdf.RdfRepository.LineageEdgeData;
import org.openmetadata.service.rdf.storage.RdfStorageInterface;

@Slf4j
public class RdfBatchProcessor {
  public static final List<Integer> ALL_RELATIONSHIPS =
      java.util.Arrays.stream(Relationship.values()).map(Relationship::ordinal).toList();

  public static final Set<String> EXCLUDED_RELATIONSHIP_ENTITY_TYPES =
      Set.of(
          "changeEvent",
          Entity.AUDIT_LOG,
          Entity.WEB_ANALYTIC_EVENT,
          "entityUsage",
          "eventSubscription",
          Entity.EVENT_SUBSCRIPTION,
          "vote",
          Entity.CONVERSATION,
          Entity.THREAD);

  public static final Set<Integer> EXCLUDED_RELATIONSHIP_TYPES =
      Set.of(Relationship.VOTED.ordinal(), Relationship.FOLLOWS.ordinal());

  private final CollectionDAO collectionDAO;
  private final RdfRepository rdfRepository;
  private final RdfIndexingRunContext runContext;

  public RdfBatchProcessor(CollectionDAO collectionDAO, RdfRepository rdfRepository) {
    this(collectionDAO, rdfRepository, RdfIndexingRunContext.reconcileDefaults());
  }

  public RdfBatchProcessor(
      CollectionDAO collectionDAO, RdfRepository rdfRepository, RdfIndexingRunContext runContext) {
    this.collectionDAO = collectionDAO;
    this.rdfRepository = rdfRepository;
    this.runContext = runContext != null ? runContext : RdfIndexingRunContext.reconcileDefaults();
  }

  public BatchProcessingResult processEntities(
      String entityType, List<? extends EntityInterface> entities, BooleanSupplier stopRequested) {
    return processEntitiesInternal(entityType, entities, null, stopRequested);
  }

  /**
   * Variant for the indexing sink: entities arrive with their RDF models already built on the
   * translate pool, so the single writer thread spends its time on storage round trips instead of
   * CPU-bound translation. The failure path is byte-identical to {@link #processEntities} — the
   * bisect retranslates its halves, which is acceptable because it only runs when a write failed.
   */
  public BatchProcessingResult processEntitiesPreTranslated(
      String entityType,
      List<? extends EntityInterface> entities,
      List<RdfStorageInterface.EntityWriteRequest> preTranslated,
      BooleanSupplier stopRequested) {
    return processEntitiesInternal(entityType, entities, preTranslated, stopRequested);
  }

  private BatchProcessingResult processEntitiesInternal(
      String entityType,
      List<? extends EntityInterface> entities,
      List<RdfStorageInterface.EntityWriteRequest> preTranslated,
      BooleanSupplier stopRequested) {
    if (entities == null || entities.isEmpty()) {
      return new BatchProcessingResult(0, 0);
    }

    BooleanSupplier effectiveStopRequested = stopRequested != null ? stopRequested : () -> false;
    int successCount = 0;
    int failedCount = 0;
    String lastError = null;
    List<EntityInterface> indexedEntities = new ArrayList<>();

    // An entity whose translation failed has no write request. Count it here so a
    // skipped record surfaces as one failure rather than vanishing from the totals.
    List<? extends EntityInterface> writableEntities = entities;
    if (preTranslated != null && preTranslated.size() != entities.size()) {
      Set<UUID> translatedIds =
          preTranslated.stream()
              .map(RdfStorageInterface.EntityWriteRequest::entityId)
              .collect(Collectors.toSet());
      List<EntityInterface> untranslated =
          entities.stream()
              .filter(entity -> !translatedIds.contains(entity.getId()))
              .collect(Collectors.toList());
      if (!untranslated.isEmpty()) {
        failedCount += untranslated.size();
        lastError = "RDF translation failed for " + untranslated.size() + " entity(ies)";
        recordEntityWriteFailures(entityType, untranslated, lastError);
        writableEntities =
            entities.stream()
                .filter(entity -> translatedIds.contains(entity.getId()))
                .collect(Collectors.toList());
      }
    }

    // Fast path: combined SPARQL UPDATE requests for the batch. Batching
    // collapses per-entity update requests and Fuseki transactions into a
    // smaller number of storage-level chunks.
    //
    // Each storage chunk is atomic at the Fuseki side. A stop signal landing
    // mid-HTTP-call still completes the current chunk and is honored on the
    // next split boundary.
    //
    // If the bulk write fails (one bad model rolls back the whole batch), we
    // BISECT: split the batch in half and retry each half, recursing down to
    // singletons only around the actual bad rows. A poison entity in a batch
    // of 25 costs ~2·log2(25) write calls instead of 25 sequential per-entity
    // attempts — and when the failure is payload-size-related (the storage
    // layer refuses to retry oversized timeouts at the same size), the first
    // halving usually succeeds outright. The cascade is additionally bounded
    // by a wall-clock budget (a small multiple of the per-request timeout):
    // once exhausted, remaining entities are marked failed and the batch
    // moves on — a pathological batch costs minutes, never hours.
    //
    // Bisection stops immediately when the storage layer trips its circuit
    // breaker (connect failures, request timeouts): each further attempt
    // would fail-fast on the same breaker, wasting time and amplifying error
    // noise. Unattempted entities are marked failed and the breaker closes
    // once Fuseki recovers.
    //
    // Caveat: isolation only works when failures are payload-data-dependent
    // (one entity emits a model the writer can't serialise). If the failure
    // is predicate-SHAPE-dependent — e.g. a configured custom predicate URI
    // the SPARQL serializer chokes on — every split fails all the way to the
    // leaves, and the budget is what keeps that bounded.
    // sinkTimeNanos covers the full RDF write path — entity translation +
    // storage round trips + relationship/lineage/glossary writes. This is the
    // stage the run stats never measured; the 164-hour incident showed "<1 ms"
    // averages because all its time lived here, unrecorded.
    long sinkTimeNanos = 0;
    if (!effectiveStopRequested.getAsBoolean()) {
      long writeStartNanos = System.nanoTime();
      BisectResult bisect =
          preTranslated != null
              ? writePreTranslatedWithBisectFallback(
                  entityType,
                  writableEntities,
                  preTranslated,
                  effectiveStopRequested,
                  indexedEntities)
              : writeWithBisect(
                  entityType,
                  entities,
                  effectiveStopRequested,
                  bisectDeadlineNanos(),
                  indexedEntities);
      sinkTimeNanos += System.nanoTime() - writeStartNanos;
      successCount = bisect.successCount();
      failedCount += bisect.failedCount();
      if (bisect.lastError() != null) {
        lastError = bisect.lastError();
      }
    }

    int relationshipFailures = 0;
    String relationshipError = null;
    if (!indexedEntities.isEmpty()) {
      long relationshipStartNanos = System.nanoTime();
      RelationshipProcessingResult relResult =
          processBatchRelationships(entityType, indexedEntities);
      relationshipFailures += relResult.failureCount();
      if (relResult.lastError() != null) {
        relationshipError = relResult.lastError();
      }
      if ("glossaryTerm".equals(entityType)) {
        RelationshipProcessingResult glossResult =
            processGlossaryTermRelations(indexedEntities, effectiveStopRequested);
        relationshipFailures += glossResult.failureCount();
        if (glossResult.lastError() != null) {
          relationshipError = glossResult.lastError();
        }
      }
      sinkTimeNanos += System.nanoTime() - relationshipStartNanos;
    }

    // Relationship failures are tracked separately from entity write failures.
    // failedCount becomes "failedRecords" in the index stats, where a record is
    // an entity row — folding relationship failures (which are per-edge, not
    // per-entity) into it would inflate failedRecords beyond the totalRecords
    // entity count and make stats nonsensical. Surface relationship errors only
    // through lastError when no entity-level failure already provided one.
    if (lastError == null && relationshipError != null) {
      lastError = relationshipError;
    }

    return new BatchProcessingResult(
        successCount,
        failedCount,
        relationshipFailures,
        lastError,
        TimeUnit.NANOSECONDS.toMillis(sinkTimeNanos));
  }

  private long bisectDeadlineNanos() {
    long budgetMs = rdfRepository.batchWriteBudgetMs();
    return budgetMs > 0
        ? System.nanoTime() + TimeUnit.MILLISECONDS.toNanos(budgetMs)
        : Long.MAX_VALUE;
  }

  /**
   * First attempt uses the pre-built models; any failure falls into the standard bisect over the
   * ENTITY list (retranslating halves), so failure semantics, budget, breaker handling and
   * failure-record writing are shared with the non-pre-translated path. The bisect deadline
   * starts here — at flush — so time spent queued in the sink never consumes the write budget.
   */
  private BisectResult writePreTranslatedWithBisectFallback(
      String entityType,
      List<? extends EntityInterface> entities,
      List<RdfStorageInterface.EntityWriteRequest> preTranslated,
      BooleanSupplier stopRequested,
      List<EntityInterface> indexedEntities) {
    BisectResult result;
    if (stopRequested.getAsBoolean()) {
      result = BisectResult.EMPTY;
    } else {
      try {
        rdfRepository.bulkStorePreTranslated(preTranslated, runContext.writeMode());
        indexedEntities.addAll(entities);
        result = BisectResult.success(entities.size());
      } catch (Exception e) {
        result =
            handleBisectFailure(
                entityType, entities, stopRequested, bisectDeadlineNanos(), indexedEntities, e);
      }
    }
    return result;
  }

  private BisectResult writeWithBisect(
      String entityType,
      List<? extends EntityInterface> entities,
      BooleanSupplier stopRequested,
      long deadlineNanos,
      List<EntityInterface> indexedEntities) {
    BisectResult result;
    if (stopRequested.getAsBoolean()) {
      result = BisectResult.EMPTY;
    } else {
      try {
        rdfRepository.bulkCreateOrUpdate(entities, runContext.writeMode());
        indexedEntities.addAll(entities);
        result = BisectResult.success(entities.size());
      } catch (Exception e) {
        result =
            handleBisectFailure(
                entityType, entities, stopRequested, deadlineNanos, indexedEntities, e);
      }
    }
    return result;
  }

  private BisectResult handleBisectFailure(
      String entityType,
      List<? extends EntityInterface> entities,
      BooleanSupplier stopRequested,
      long deadlineNanos,
      List<EntityInterface> indexedEntities,
      Exception cause) {
    BisectResult result;
    if (isCircuitBreakerOpen(cause)) {
      LOG.warn(
          "Bulk write of {} {} entities failed and the RDF circuit breaker is open; "
              + "not bisecting further. Reason: {}",
          entities.size(),
          entityType,
          cause.getMessage());
      recordEntityWriteFailures(entityType, entities, describeFailureMessage(cause));
      result =
          BisectResult.allFailed(
              entities.size(), describeError(entityType + " batch", cause), true);
    } else if (System.nanoTime() >= deadlineNanos) {
      LOG.warn(
          "Write budget exhausted while bisecting {} {} entities; marking the remainder failed. "
              + "Last reason: {}",
          entities.size(),
          entityType,
          cause.getMessage());
      recordEntityWriteFailures(entityType, entities, describeFailureMessage(cause));
      result =
          BisectResult.allFailed(
              entities.size(),
              describeError(entityType + " batch (write budget exhausted)", cause),
              false);
    } else if (entities.size() == 1) {
      EntityInterface entity = entities.getFirst();
      LOG.error("Failed to index entity {} to RDF", entity.getId(), cause);
      recordEntityWriteFailures(entityType, entities, describeFailureMessage(cause));
      result =
          BisectResult.allFailed(1, describeEntityError(entityType, entity.getId(), cause), false);
    } else {
      LOG.warn(
          "Bulk write of {} {} entities failed; bisecting to isolate the bad rows. Reason: {}",
          entities.size(),
          entityType,
          cause.getMessage());
      result = bisectHalves(entityType, entities, stopRequested, deadlineNanos, indexedEntities);
    }
    return result;
  }

  private BisectResult bisectHalves(
      String entityType,
      List<? extends EntityInterface> entities,
      BooleanSupplier stopRequested,
      long deadlineNanos,
      List<EntityInterface> indexedEntities) {
    int mid = entities.size() / 2;
    BisectResult left =
        writeWithBisect(
            entityType, entities.subList(0, mid), stopRequested, deadlineNanos, indexedEntities);
    BisectResult right;
    if (left.circuitOpen()) {
      // The breaker opened while writing the left half; every right-half
      // attempt would fail-fast on the same breaker.
      List<? extends EntityInterface> rightHalf = entities.subList(mid, entities.size());
      recordEntityWriteFailures(entityType, rightHalf, left.lastError());
      right = BisectResult.allFailed(rightHalf.size(), left.lastError(), true);
    } else {
      right =
          writeWithBisect(
              entityType,
              entities.subList(mid, entities.size()),
              stopRequested,
              deadlineNanos,
              indexedEntities);
    }
    return left.merge(right);
  }

  /**
   * Per-source degradation for a failed bulk relationship write. The bulk call is all-or-nothing
   * at the Fuseki side; retrying source-by-source isolates the failing source so every other
   * source's edges (and zero-edge reconciles) still land, and only the failing source's edges are
   * counted as failures — previously one bad chunk marked every edge in the batch failed.
   */
  private RelationshipProcessingResult retryRelationshipsPerSource(
      String entityType,
      List<org.openmetadata.schema.type.EntityRelationship> allRelationships,
      Set<RdfRepository.EntitySourceRef> batchSources) {
    int failures = 0;
    String lastError = null;
    Set<UUID> batchSourceIds = new HashSet<>();
    for (RdfRepository.EntitySourceRef source : batchSources) {
      batchSourceIds.add(source.entityId());
    }
    Map<UUID, List<org.openmetadata.schema.type.EntityRelationship>> edgesBySource =
        new HashMap<>();
    List<org.openmetadata.schema.type.EntityRelationship> outsideBatchEdges = new ArrayList<>();
    for (org.openmetadata.schema.type.EntityRelationship edge : allRelationships) {
      if (edge.getFromId() != null && batchSourceIds.contains(edge.getFromId())) {
        edgesBySource.computeIfAbsent(edge.getFromId(), key -> new ArrayList<>()).add(edge);
      } else {
        outsideBatchEdges.add(edge);
      }
    }
    // Isolating one bad source among many is worth doing; attempting every source after a
    // systemic failure is how a slow backend turns one bad batch into hours of timeouts. The
    // budget counts only FAILED attempts, so successful isolation is never penalised: a batch
    // with a single bad source still gets every other source written.
    long deadlineNanos = bisectDeadlineNanos();
    List<RdfRepository.EntitySourceRef> pending = new ArrayList<>(batchSources);
    int failedAttempts = 0;
    int firstUnattempted = pending.size();
    for (int index = 0; index < pending.size(); index++) {
      if (failedAttempts >= runContext.maxRetries() || System.nanoTime() >= deadlineNanos) {
        firstUnattempted = index;
        break;
      }
      RdfRepository.EntitySourceRef source = pending.get(index);
      List<org.openmetadata.schema.type.EntityRelationship> edges =
          edgesBySource.getOrDefault(source.entityId(), List.of());
      try {
        rdfRepository.bulkAddRelationships(edges, Set.of(source), runContext.writeMode());
      } catch (Exception sourceFailure) {
        failedAttempts++;
        // A zero-edge source whose reconcile failed still counts once: its
        // stale edges were left in place.
        failures += Math.max(1, edges.size());
        lastError =
            describeBulkError(entityType, "relationships:" + source.entityId(), sourceFailure);
        recordRelationshipFailure(entityType, source, sourceFailure);
        if (isCircuitBreakerOpen(sourceFailure)) {
          firstUnattempted = index + 1;
          break;
        }
      }
    }

    boolean abandoned = firstUnattempted < pending.size();
    if (abandoned) {
      failures += countUnattempted(pending, firstUnattempted, edgesBySource);
      LOG.warn(
          "Stopped per-source relationship isolation for {} after {} failed attempt(s); "
              + "{} source(s) not attempted. Raise maxRetries on the RDF index app to isolate "
              + "further. Last reason: {}",
          entityType,
          failedAttempts,
          pending.size() - firstUnattempted,
          lastError);
    }
    if (!abandoned && !outsideBatchEdges.isEmpty()) {
      try {
        rdfRepository.bulkAddRelationships(outsideBatchEdges, Set.of(), runContext.writeMode());
      } catch (Exception outsideFailure) {
        failures += outsideBatchEdges.size();
        lastError = describeBulkError(entityType, "outsideBatchRelationships", outsideFailure);
      }
    }
    return new RelationshipProcessingResult(failures, lastError);
  }

  private static int countUnattempted(
      List<RdfRepository.EntitySourceRef> sources,
      int fromIndex,
      Map<UUID, List<org.openmetadata.schema.type.EntityRelationship>> edgesBySource) {
    int unattempted = 0;
    for (int index = fromIndex; index < sources.size(); index++) {
      List<org.openmetadata.schema.type.EntityRelationship> edges =
          edgesBySource.getOrDefault(sources.get(index).entityId(), List.of());
      unattempted += Math.max(1, edges.size());
    }
    return unattempted;
  }

  private void recordRelationshipFailure(
      String entityType, RdfRepository.EntitySourceRef source, Exception cause) {
    if (runContext.jobId() != null) {
      try {
        collectionDAO
            .rdfIndexFailureDAO()
            .insert(
                UUID.randomUUID().toString(),
                runContext.jobId().toString(),
                serverIdOrUnknown(),
                entityType,
                source.entityId() != null ? source.entityId().toString() : null,
                null,
                CollectionDAO.RdfIndexFailureDAO.STAGE_RELATIONSHIP,
                describeFailureMessage(cause),
                null,
                System.currentTimeMillis());
      } catch (Exception recordingFailure) {
        LOG.warn(
            "Could not persist RDF relationship failure record for {}",
            entityType,
            recordingFailure);
      }
    }
  }

  private static final int MAX_RECORDED_ERROR_MESSAGE_CHARS = 4_096;
  private static final String SERVER_ID_UNKNOWN = "unknown";

  /**
   * Persist an un-deserializable reader drop. No entity id is available — the row never
   * materialized — so the record is evidence for operators rather than retry input.
   */
  public void recordReaderFailure(String entityType, String message) {
    if (runContext.jobId() != null) {
      try {
        collectionDAO
            .rdfIndexFailureDAO()
            .insert(
                UUID.randomUUID().toString(),
                runContext.jobId().toString(),
                serverIdOrUnknown(),
                entityType,
                null,
                null,
                CollectionDAO.RdfIndexFailureDAO.STAGE_READER,
                message,
                null,
                System.currentTimeMillis());
      } catch (Exception recordingFailure) {
        LOG.warn(
            "Could not persist RDF reader failure record for {}", entityType, recordingFailure);
      }
    }
  }

  private String serverIdOrUnknown() {
    return runContext.serverId() != null ? runContext.serverId() : SERVER_ID_UNKNOWN;
  }

  /**
   * Persist failed entity identities so the end-of-run retry pass (and operators) can act on them.
   * No-op on the legacy path (no job identity) and never throws — a failure-recording failure must
   * not fail the write path it is describing.
   */
  private void recordEntityWriteFailures(
      String entityType, List<? extends EntityInterface> entities, String message) {
    if (runContext.jobId() == null || entities == null || entities.isEmpty()) {
      return;
    }
    try {
      long now = System.currentTimeMillis();
      String serverId = serverIdOrUnknown();
      List<CollectionDAO.RdfIndexFailureDAO.RdfIndexFailureRecord> records =
          entities.stream()
              .map(
                  entity ->
                      new CollectionDAO.RdfIndexFailureDAO.RdfIndexFailureRecord(
                          UUID.randomUUID().toString(),
                          runContext.jobId().toString(),
                          serverId,
                          entityType,
                          entity.getId() != null ? entity.getId().toString() : null,
                          entity.getFullyQualifiedName(),
                          CollectionDAO.RdfIndexFailureDAO.STAGE_ENTITY_WRITE,
                          message,
                          null,
                          now))
              .toList();
      collectionDAO.rdfIndexFailureDAO().insertBatch(records);
    } catch (Exception recordingFailure) {
      LOG.warn(
          "Could not persist {} RDF index failure record(s) for {}",
          entities.size(),
          entityType,
          recordingFailure);
    }
  }

  private static String describeFailureMessage(Exception cause) {
    String message =
        cause.getMessage() != null ? cause.getMessage() : cause.getClass().getSimpleName();
    return message.length() > MAX_RECORDED_ERROR_MESSAGE_CHARS
        ? message.substring(0, MAX_RECORDED_ERROR_MESSAGE_CHARS)
        : message;
  }

  record BisectResult(int successCount, int failedCount, String lastError, boolean circuitOpen) {
    static final BisectResult EMPTY = new BisectResult(0, 0, null, false);

    static BisectResult success(int count) {
      return new BisectResult(count, 0, null, false);
    }

    static BisectResult allFailed(int count, String error, boolean circuitOpen) {
      return new BisectResult(0, count, error, circuitOpen);
    }

    BisectResult merge(BisectResult other) {
      return new BisectResult(
          successCount + other.successCount,
          failedCount + other.failedCount,
          other.lastError() != null ? other.lastError() : lastError,
          circuitOpen || other.circuitOpen);
    }
  }

  public record RelationshipProcessingResult(int failureCount, String lastError) {
    static final RelationshipProcessingResult OK = new RelationshipProcessingResult(0, null);
  }

  /**
   * Format a single failure with a context-specific prefix using the root cause's
   * message (or class name when the message is blank). Used by the per-entity,
   * bulk-relationship, and lineage-relationship error paths to keep their output
   * format consistent.
   */
  private static String describeError(String prefix, Throwable error) {
    Throwable rootCause = error;
    while (rootCause.getCause() != null && rootCause.getCause() != rootCause) {
      rootCause = rootCause.getCause();
    }
    String message = rootCause.getMessage();
    if (message == null || message.isBlank()) {
      message = rootCause.getClass().getSimpleName();
    }
    return prefix + ": " + message;
  }

  /**
   * Recognise a "circuit breaker tripped" failure from the RDF storage layer.
   * The storage layer throws {@link
   * org.openmetadata.service.rdf.storage.RdfStorageCircuitOpenException} when
   * a fast-fail trips; that exception may travel through a wrapper layer
   * (e.g. RdfRepository.bulkCreateOrUpdate catches and re-throws as a
   * generic RuntimeException), so we walk the cause chain to find it. The
   * bulk-fallback path uses this to skip the per-entity retry loop — every
   * entity would hit the same breaker and produce N noisy failures instead
   * of one informative one.
   */
  private static boolean isCircuitBreakerOpen(Throwable error) {
    // Use an identity-equality Set for visited-tracking so multi-hop cycles
    // (A.getCause()→B, B.getCause()→A) are detected — the previous
    // single-hop check (next == cause) only caught immediate self-cycles.
    // Cause chains shouldn't loop in well-behaved code, but exceptions
    // wrapped by user-supplied frameworks or AOP layers occasionally do,
    // and crossing the storage/repository wrap boundary makes a defensive
    // check cheap insurance.
    java.util.Set<Throwable> visited =
        java.util.Collections.newSetFromMap(new java.util.IdentityHashMap<>());
    Throwable cause = error;
    while (cause != null && visited.add(cause)) {
      if (cause instanceof org.openmetadata.service.rdf.storage.RdfStorageCircuitOpenException) {
        return true;
      }
      cause = cause.getCause();
    }
    return false;
  }

  private static String describeEntityError(String entityType, UUID entityId, Throwable error) {
    return describeError(entityType + "/" + entityId, error);
  }

  public RelationshipProcessingResult processBatchRelationships(
      String entityType, List<? extends EntityInterface> entities) {
    if (entities == null || entities.isEmpty()) {
      return RelationshipProcessingResult.OK;
    }

    int failures = 0;
    String lastError = null;

    try {
      List<String> entityIds =
          entities.stream().map(entity -> entity.getId().toString()).collect(Collectors.toList());

      List<EntityRelationshipObject> outgoingRelationships =
          collectionDAO
              .relationshipDAO()
              .findToBatchWithRelations(entityIds, entityType, ALL_RELATIONSHIPS);

      List<EntityRelationshipObject> incomingLineage =
          collectionDAO
              .relationshipDAO()
              .findFromBatch(
                  entityIds,
                  Relationship.UPSTREAM.ordinal(),
                  org.openmetadata.schema.type.Include.ALL);

      List<org.openmetadata.schema.type.EntityRelationship> allRelationships = new ArrayList<>();
      List<LineageEdgeData> lineageEdges = new ArrayList<>();

      for (EntityRelationshipObject rel : outgoingRelationships) {
        if (shouldSkipRelationship(rel)) {
          continue;
        }

        if (rel.getRelation() == Relationship.UPSTREAM.ordinal() && rel.getJson() != null) {
          String error = collectLineageRelationship(rel, lineageEdges);
          if (error != null) {
            failures++;
            lastError = error;
          }
        } else {
          if ("glossaryTerm".equals(entityType)
              && rel.getRelation() == Relationship.RELATED_TO.ordinal()
              && "glossaryTerm".equals(rel.getToEntity())) {
            continue;
          }
          allRelationships.add(convertToEntityRelationship(rel));
        }
      }

      for (EntityRelationshipObject rel : incomingLineage) {
        if (shouldSkipRelationship(rel)) {
          continue;
        }
        // Sources included in this run emit the edge from their outgoing pass. This avoids
        // duplicate writes, but a failed source batch leaves the edge absent until a later run
        // successfully processes that source.
        if (runContext.entityTypesInRun().contains(rel.getFromEntity())) {
          continue;
        }

        if (rel.getJson() != null) {
          String error = collectLineageRelationship(rel, lineageEdges);
          if (error != null) {
            failures++;
            lastError = error;
          }
        } else {
          allRelationships.add(convertToEntityRelationship(rel));
        }
      }

      // Reconcile EVERY entity in the batch — not just those with current
      // outgoing relationships. An entity whose last outgoing relationship was
      // removed in MySQL contributes zero RelationshipData entries to
      // allRelationships; we pass it explicitly via batchSources so
      // bulkAddRelationships' per-source DELETE still fires for it.
      //
      // The clear+insert run in a SINGLE SPARQL update inside
      // JenaFusekiStorage.bulkStoreRelationships, so the operation is atomic
      // at the Fuseki side — a transient error can't leave the graph wiped
      // without the replacement edges in place. (Previously the clear ran in
      // a separate call to clearOutgoingEntityRelationships; if the
      // subsequent bulkAdd failed, batch sources lost their relationships
      // until the next weekly recreate-index.)
      Set<RdfRepository.EntitySourceRef> batchSources = new HashSet<>();
      for (EntityInterface entity : entities) {
        batchSources.add(new RdfRepository.EntitySourceRef(entityType, entity.getId()));
      }
      try {
        // Pass batchSources so bulkStoreRelationships only reconciles edges
        // for entities IN this batch. Incoming-lineage rows can carry source
        // IDs that are outside the batch (the `from` of an UPSTREAM edge
        // where this batch's entity is the `to`); reconciling those would
        // wipe the outside-batch entity's unrelated outgoing edges.
        rdfRepository.bulkAddRelationships(allRelationships, batchSources, runContext.writeMode());
      } catch (Exception bulkFailure) {
        LOG.warn(
            "Bulk relationship write of {} edges for {} failed; degrading per-source. Reason: {}",
            allRelationships.size(),
            entityType,
            bulkFailure.getMessage());
        RelationshipProcessingResult perSource =
            retryRelationshipsPerSource(entityType, allRelationships, batchSources);
        failures += perSource.failureCount();
        if (perSource.lastError() != null) {
          lastError = perSource.lastError();
        }
      }

      RelationshipProcessingResult lineageResult = processLineageEdges(entityType, lineageEdges);
      failures += lineageResult.failureCount();
      if (lineageResult.lastError() != null) {
        lastError = lineageResult.lastError();
      }
    } catch (Exception e) {
      LOG.error("Failed to process batch relationships for entity type {}", entityType, e);
      failures++;
      lastError = describeBulkError(entityType, "batchRelationships", e);
    }

    return new RelationshipProcessingResult(failures, lastError);
  }

  private static String describeBulkError(String entityType, String stage, Throwable error) {
    return describeError(entityType + "/" + stage, error);
  }

  public org.openmetadata.schema.type.EntityRelationship convertToEntityRelationship(
      EntityRelationshipObject rel) {
    return new org.openmetadata.schema.type.EntityRelationship()
        .withFromEntity(rel.getFromEntity())
        .withFromId(UUID.fromString(rel.getFromId()))
        .withToEntity(rel.getToEntity())
        .withToId(UUID.fromString(rel.getToId()))
        .withRelation(rel.getRelation())
        .withRelationshipType(Relationship.values()[rel.getRelation()]);
  }

  private boolean shouldSkipRelationship(EntityRelationshipObject rel) {
    return isExcludedRelationshipEndpoint(rel.getToEntity())
        || isExcludedRelationshipEndpoint(rel.getFromEntity())
        || EXCLUDED_RELATIONSHIP_TYPES.contains(rel.getRelation());
  }

  private static boolean isExcludedRelationshipEndpoint(String entityType) {
    return EXCLUDED_RELATIONSHIP_ENTITY_TYPES.contains(entityType)
        || RdfExcludedEntities.isExcluded(entityType);
  }

  private String collectLineageRelationship(
      EntityRelationshipObject rel, List<LineageEdgeData> lineageEdges) {
    UUID fromId;
    UUID toId;
    LineageDetails lineageDetails;
    try {
      fromId = UUID.fromString(rel.getFromId());
      toId = UUID.fromString(rel.getToId());
      lineageDetails = JsonUtils.readValue(rel.getJson(), LineageDetails.class);
    } catch (Exception parseError) {
      LOG.debug("Failed to parse lineage details, falling back to basic relationship", parseError);
      try {
        rdfRepository.addRelationship(convertToEntityRelationship(rel));
        return null;
      } catch (Exception ex) {
        LOG.error(
            "Failed to add basic lineage relationship for {}->{}",
            rel.getFromId(),
            rel.getToId(),
            ex);
        return describeLineageError(rel, ex);
      }
    }

    lineageEdges.add(
        new LineageEdgeData(rel.getFromEntity(), fromId, rel.getToEntity(), toId, lineageDetails));
    return null;
  }

  private RelationshipProcessingResult processLineageEdges(
      String entityType, List<LineageEdgeData> lineageEdges) {
    if (lineageEdges.isEmpty()) {
      return RelationshipProcessingResult.OK;
    }

    try {
      rdfRepository.bulkAddLineage(lineageEdges, runContext.writeMode());
      return RelationshipProcessingResult.OK;
    } catch (Exception e) {
      if (isCircuitBreakerOpen(e)) {
        LOG.warn(
            "Bulk write of {} lineage edges for {} failed and the RDF circuit breaker is open; "
                + "skipping per-edge fallback. Reason: {}",
            lineageEdges.size(),
            entityType,
            e.getMessage());
        return new RelationshipProcessingResult(
            lineageEdges.size(), describeBulkError(entityType, "bulkLineage", e));
      }

      LOG.warn(
          "Bulk write of {} lineage edges for {} failed; falling back to per-edge writes. Reason: {}",
          lineageEdges.size(),
          entityType,
          e.getMessage());
      int failures = 0;
      String lastError = null;
      for (int index = 0; index < lineageEdges.size(); index++) {
        LineageEdgeData edge = lineageEdges.get(index);
        try {
          rdfRepository.bulkAddLineage(List.of(edge), runContext.writeMode());
        } catch (Exception edgeError) {
          failures++;
          lastError = describeLineageError(edge, edgeError);
          LOG.error(
              "Failed to add lineage with details for {}->{}",
              edge.fromId(),
              edge.toId(),
              edgeError);
          if (isCircuitBreakerOpen(edgeError)) {
            int skippedEdges = lineageEdges.size() - index - 1;
            failures += skippedEdges;
            LOG.warn(
                "RDF circuit breaker opened during lineage fallback for {}; skipping {} remaining edges",
                entityType,
                skippedEdges);
            break;
          }
        }
      }
      return new RelationshipProcessingResult(failures, lastError);
    }
  }

  String processLineageRelationship(EntityRelationshipObject rel) {
    List<LineageEdgeData> lineageEdges = new ArrayList<>(1);
    String error = collectLineageRelationship(rel, lineageEdges);
    if (error != null || lineageEdges.isEmpty()) {
      return error;
    }

    LineageEdgeData edge = lineageEdges.get(0);
    try {
      rdfRepository.addLineageWithDetails(
          edge.fromType(), edge.fromId(), edge.toType(), edge.toId(), edge.details());
      return null;
    } catch (Exception e) {
      LOG.error("Failed to add lineage with details for {}->{}", edge.fromId(), edge.toId(), e);
      return describeLineageError(edge, e);
    }
  }

  private static String describeLineageError(EntityRelationshipObject rel, Throwable error) {
    return describeError("lineage " + rel.getFromId() + "->" + rel.getToId(), error);
  }

  private static String describeLineageError(LineageEdgeData edge, Throwable error) {
    return describeError("lineage " + edge.fromId() + "->" + edge.toId(), error);
  }

  RelationshipProcessingResult processGlossaryTermRelations(
      List<? extends EntityInterface> entities, BooleanSupplier stopRequested) {
    List<RdfRepository.GlossaryTermRelationData> relations = new ArrayList<>();

    for (EntityInterface entity : entities) {
      if (stopRequested.getAsBoolean()) {
        break;
      }

      if (!(entity instanceof GlossaryTerm glossaryTerm)) {
        continue;
      }

      List<TermRelation> relatedTerms = glossaryTerm.getRelatedTerms();
      if (relatedTerms == null || relatedTerms.isEmpty()) {
        continue;
      }

      UUID fromTermId = glossaryTerm.getId();
      for (TermRelation termRelation : relatedTerms) {
        if (termRelation.getTerm() == null || termRelation.getTerm().getId() == null) {
          continue;
        }

        String relationType =
            termRelation.getRelationType() != null ? termRelation.getRelationType() : "relatedTo";
        relations.add(
            new RdfRepository.GlossaryTermRelationData(
                fromTermId, termRelation.getTerm().getId(), relationType));
      }
    }

    if (relations.isEmpty()) {
      return RelationshipProcessingResult.OK;
    }

    try {
      rdfRepository.bulkAddGlossaryTermRelations(relations);
      return RelationshipProcessingResult.OK;
    } catch (Exception e) {
      LOG.error("Failed to bulk add {} glossary term relations", relations.size(), e);
      return new RelationshipProcessingResult(
          relations.size(), describeBulkError("glossaryTerm", "glossaryRelations", e));
    }
  }

  /**
   * Outcome of processing a batch of entities.
   *
   * @param successCount entity-level write successes
   * @param failedCount entity-level write failures (counts toward failedRecords stats)
   * @param relationshipFailureCount per-edge relationship/lineage failures, kept
   *     separate so they don't inflate the entity-level failedRecords stat
   * @param lastError most recent failure message (entity or relationship)
   */
  public record BatchProcessingResult(
      int successCount,
      int failedCount,
      int relationshipFailureCount,
      String lastError,
      long sinkTimeMs,
      long processTimeMs) {
    public BatchProcessingResult(int successCount, int failedCount) {
      this(successCount, failedCount, 0, null, 0L, 0L);
    }

    public BatchProcessingResult(
        int successCount,
        int failedCount,
        int relationshipFailureCount,
        String lastError,
        long sinkTimeMs) {
      this(successCount, failedCount, relationshipFailureCount, lastError, sinkTimeMs, 0L);
    }

    /** Translation is measured by the sink, which owns the translate pool. */
    public BatchProcessingResult withProcessTimeMs(long translateMs) {
      return new BatchProcessingResult(
          successCount, failedCount, relationshipFailureCount, lastError, sinkTimeMs, translateMs);
    }

    public BatchProcessingResult(int successCount, int failedCount, String lastError) {
      this(successCount, failedCount, 0, lastError, 0L);
    }

    public BatchProcessingResult(
        int successCount, int failedCount, int relationshipFailureCount, String lastError) {
      this(successCount, failedCount, relationshipFailureCount, lastError, 0L);
    }

    public boolean hasAnyFailure() {
      return failedCount > 0 || relationshipFailureCount > 0;
    }
  }
}
