/*
 *  Copyright 2021 Collate
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

package org.openmetadata.service.jdbi3;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.schema.type.EventType.ENTITY_CREATED;
import static org.openmetadata.schema.type.EventType.ENTITY_NO_CHANGE;
import static org.openmetadata.schema.type.EventType.ENTITY_UPDATED;
import static org.openmetadata.service.monitoring.RequestLatencyContext.phase;

import io.micrometer.core.instrument.DistributionSummary;
import io.micrometer.core.instrument.Metrics;
import io.micrometer.core.instrument.Timer;
import jakarta.ws.rs.core.Response.Status;
import jakarta.ws.rs.core.UriInfo;
import java.io.IOException;
import java.io.StringWriter;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Iterator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.Semaphore;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;
import org.apache.commons.csv.CSVFormat;
import org.apache.commons.csv.CSVParser;
import org.apache.commons.csv.CSVPrinter;
import org.apache.commons.csv.CSVRecord;
import org.jdbi.v3.sqlobject.transaction.Transaction;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.ApiStatus;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.EventType;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.api.BulkDeleteStaleRequest;
import org.openmetadata.schema.type.api.BulkOperationResult;
import org.openmetadata.schema.type.api.BulkResponse;
import org.openmetadata.schema.type.csv.CsvImportResult;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.BadRequestException;
import org.openmetadata.service.formatter.util.FormatterUtil;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.FullyQualifiedName;
import org.openmetadata.service.util.RestUtil.PutResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Async/sequential bulk create-update-delete pipeline, CSV bulk-import result shaping, and
 * stale-entity deletion. Extracted from EntityRepository; holds a back-reference (r).
 */
final class BulkImportService<T extends org.openmetadata.schema.EntityInterface> {
  private static final Logger LOG = LoggerFactory.getLogger(BulkImportService.class);
  private final EntityRepository<T> r;

  BulkImportService(EntityRepository<T> r) {
    this.r = r;
  }

  CsvImportResult createLeanCsvImportResult(CsvImportResult fullResult) {
    CsvImportResult leanResult =
        new CsvImportResult()
            .withDryRun(fullResult.getDryRun())
            .withStatus(fullResult.getStatus())
            .withNumberOfRowsProcessed(fullResult.getNumberOfRowsProcessed())
            .withNumberOfRowsPassed(fullResult.getNumberOfRowsPassed())
            .withNumberOfRowsFailed(fullResult.getNumberOfRowsFailed())
            .withAbortReason(fullResult.getAbortReason());

    if (nullOrEmpty(fullResult.getImportResultsCsv())) {
      return leanResult;
    }

    StringWriter stringWriter = new StringWriter();
    try (CSVParser parser =
        CSVParser.parse(
            fullResult.getImportResultsCsv(), CSVFormat.DEFAULT.withFirstRecordAsHeader())) {
      int nameIndex = -1;
      List<String> headerNames = parser.getHeaderNames();
      for (int i = 0; i < headerNames.size(); i++) {
        if (headerNames.get(i).toLowerCase().contains("name")) {
          nameIndex = i;
          break;
        }
      }

      String[] leanHeaders = {"status", "details", "name"};
      try (CSVPrinter printer =
          new CSVPrinter(stringWriter, CSVFormat.DEFAULT.withHeader(leanHeaders))) {
        for (CSVRecord record : parser) {
          String name = (nameIndex != -1 && nameIndex < record.size()) ? record.get(nameIndex) : "";
          printer.printRecord(record.get("status"), record.get("details"), name);
        }
      }
      leanResult.setImportResultsCsv(stringWriter.toString());
    } catch (IOException | IllegalArgumentException e) {
      // If parsing fails, just return the original CSV to avoid losing data
      LOG.warn("Failed to create lean CSV for change description, returning full CSV", e);
      leanResult.setImportResultsCsv(fullResult.getImportResultsCsv());
    }
    return leanResult;
  }

  static final ConcurrentHashMap<String, CompletableFuture<BulkOperationResult>> BULK_JOBS =
      new ConcurrentHashMap<>();

  // Cached metrics to avoid Timer.builder overhead on every call
  static final ConcurrentHashMap<String, Timer> ENTITY_LATENCY_TIMERS = new ConcurrentHashMap<>();
  static final ConcurrentHashMap<String, Timer> ENTITY_QUEUE_WAIT_TIMERS =
      new ConcurrentHashMap<>();
  static final ConcurrentHashMap<String, Timer> BULK_OPERATION_TIMERS = new ConcurrentHashMap<>();
  static final ConcurrentHashMap<String, DistributionSummary> BATCH_SIZE_SUMMARIES =
      new ConcurrentHashMap<>();
  static final ConcurrentHashMap<String, DistributionSummary> SUCCESS_RATE_SUMMARIES =
      new ConcurrentHashMap<>();

  static final int MAX_CONCURRENT_BULK_JOBS = 100;
  static final Semaphore BULK_JOB_PERMITS = new Semaphore(MAX_CONCURRENT_BULK_JOBS);

  CompletableFuture<BulkOperationResult> submitAsyncBulkOperation(
      UriInfo uriInfo,
      List<T> entities,
      String userName,
      Map<String, T> existingByFqn,
      boolean overrideMetadata,
      List<BulkResponse> authFailedResponses,
      int totalRequests) {

    // Acquire a permit before scheduling — Semaphore is thread-safe and avoids TOCTOU races
    if (!BULK_JOB_PERMITS.tryAcquire()) {
      throw new jakarta.ws.rs.WebApplicationException(
          "Too many concurrent bulk jobs (max " + MAX_CONCURRENT_BULK_JOBS + "). Retry later.",
          jakarta.ws.rs.core.Response.Status.TOO_MANY_REQUESTS);
    }

    String jobId = UUID.randomUUID().toString();
    LOG.info(
        "Submitting async bulk operation with jobId: {} for {} entities", jobId, entities.size());

    CompletableFuture<BulkOperationResult> job;
    try {
      job =
          CompletableFuture.supplyAsync(
              () -> {
                try {
                  return bulkCreateOrUpdateEntitiesSequential(
                      uriInfo, entities, userName, existingByFqn, overrideMetadata);
                } catch (Exception e) {
                  LOG.error("Async bulk operation failed for jobId: {}", jobId, e);
                  BulkOperationResult errorResult = new BulkOperationResult();
                  errorResult.setStatus(ApiStatus.FAILURE);
                  errorResult.setNumberOfRowsFailed(entities.size());
                  errorResult.setNumberOfRowsPassed(0);
                  return errorResult;
                }
              },
              BulkExecutor.getInstance().getExecutor());
    } catch (Exception e) {
      BULK_JOB_PERMITS.release();
      throw e;
    }

    // Merge auth failures into the final result so polling clients see the complete picture
    CompletableFuture<BulkOperationResult> mergedJob =
        job.thenApply(
            result -> {
              if (!authFailedResponses.isEmpty()) {
                result.setNumberOfRowsFailed(
                    result.getNumberOfRowsFailed() + authFailedResponses.size());
                result.setNumberOfRowsProcessed(totalRequests);
                if (result.getFailedRequest() == null) {
                  result.setFailedRequest(new ArrayList<>(authFailedResponses));
                } else {
                  result.getFailedRequest().addAll(authFailedResponses);
                }
                if (result.getNumberOfRowsPassed() > 0) {
                  result.setStatus(ApiStatus.PARTIAL_SUCCESS);
                } else {
                  result.setStatus(ApiStatus.FAILURE);
                }
              }
              return result;
            });

    BULK_JOBS.put(jobId, mergedJob);

    mergedJob.whenComplete(
        (result, throwable) -> {
          BULK_JOB_PERMITS.release();
          CompletableFuture.delayedExecutor(5, TimeUnit.MINUTES)
              .execute(() -> BULK_JOBS.remove(jobId));
        });

    return mergedJob;
  }

  /**
   * Fields used to hydrate inherited relationships for changed entities during bulk updates.
   *
   * <p>Use PUT-update fields as baseline and explicitly include inheritable fields so repositories
   * with inheritance beyond owners/domains (for example retentionPeriod or reviewers) keep behavior
   * intact without loading every allowed field.
   */
  Fields getBulkUpdateInheritanceFields() {
    Set<String> bulkFields = new HashSet<>(r.putFields.getFieldList());
    String inheritableFields = r.getInheritableFields();
    if (!nullOrEmpty(inheritableFields)) {
      for (String field : inheritableFields.split(",")) {
        String normalized = field.trim();
        if (!normalized.isEmpty() && r.allowedFields.contains(normalized)) {
          bulkFields.add(normalized);
        }
      }
    }
    return new Fields(r.allowedFields, bulkFields);
  }

  /**
   * Returns true when a connector-supplied entity is provably unchanged from what is stored, so
   * the bulk update path can skip field hydration and per-field diffing. Requires a non-empty
   * sourceHash on both the incoming entity and the stored original that match, an existing
   * non-deleted original, and that the FQN appears only once in the batch (duplicate FQNs need
   * the full updater path so each occurrence diffs against a fresh snapshot).
   */
  boolean isSourceHashUnchanged(
      T entity, Map<String, T> hydratedOriginalByFqn, Map<String, Integer> updateFrequencyByFqn) {
    String fqn = entity.getFullyQualifiedName();
    if (nullOrEmpty(fqn) || updateFrequencyByFqn.getOrDefault(fqn, 0) > 1) {
      return false;
    }
    String incomingHash = entity.getSourceHash();
    if (nullOrEmpty(incomingHash)) {
      return false;
    }
    T original = hydratedOriginalByFqn.get(fqn);
    if (original == null || Boolean.TRUE.equals(original.getDeleted())) {
      return false;
    }
    return incomingHash.equals(original.getSourceHash());
  }

  void bulkUpdateEntities(
      UriInfo uriInfo,
      List<T> updateEntities,
      Map<String, T> existingByFqn,
      String userName,
      boolean overrideMetadata,
      List<BulkResponse> successRequests,
      List<BulkResponse> failedRequests,
      List<Long> entityLatenciesNanos) {

    if (updateEntities.isEmpty()) return;

    long batchStartTime = System.nanoTime();

    // Batch load fields once per unique FQN. Duplicate rows in the same bulk request
    // should reuse a hydrated original snapshot.
    Map<String, T> hydratedOriginalByFqn = new LinkedHashMap<>();
    Map<String, Integer> updateFrequencyByFqn = new HashMap<>();
    for (T entity : updateEntities) {
      String fqn = entity.getFullyQualifiedName();
      if (nullOrEmpty(fqn)) {
        continue;
      }
      updateFrequencyByFqn.merge(fqn, 1, Integer::sum);
      T original = existingByFqn.get(fqn);
      if (original != null) {
        hydratedOriginalByFqn.putIfAbsent(fqn, original);
      }
    }

    // sourceHash fast-path: skip entities whose connector-supplied sourceHash matches the
    // stored value. This avoids field hydration and per-field diffing for unchanged entities.
    // A skipped entity is reported as a no-change success - identical to the outcome of a full
    // diff that finds nothing changed - so callers see no behavioral difference. Disabled when
    // overrideMetadata is set: the caller explicitly wants stored metadata overwritten now, so a
    // matching sourceHash must not short-circuit that.
    List<T> entitiesToProcess = new ArrayList<>();
    for (T entity : updateEntities) {
      if (!overrideMetadata
          && isSourceHashUnchanged(entity, hydratedOriginalByFqn, updateFrequencyByFqn)) {
        successRequests.add(
            new BulkResponse()
                .withRequest(entity.getFullyQualifiedName())
                .withStatus(Status.OK.getStatusCode()));
        entityLatenciesNanos.add(0L);
        recordEntityMetrics(r.entityType, 0L, 0, true);
      } else {
        entitiesToProcess.add(entity);
      }
    }
    if (entitiesToProcess.isEmpty()) return;

    // Hydrate only the originals of entities that still need a full diff.
    Map<String, T> originalsToHydrateByFqn = new LinkedHashMap<>();
    for (T entity : entitiesToProcess) {
      T original = hydratedOriginalByFqn.get(entity.getFullyQualifiedName());
      if (original != null) {
        originalsToHydrateByFqn.putIfAbsent(entity.getFullyQualifiedName(), original);
      }
    }
    List<T> originalsForHydration = new ArrayList<>(originalsToHydrateByFqn.values());
    try {
      r.setFieldsInBulk(r.putFields, originalsForHydration);
    } catch (Exception e) {
      LOG.error("setFieldsInBulk failed, marking all updates as failed", e);
      for (T entity : entitiesToProcess) {
        failedRequests.add(
            new BulkResponse()
                .withRequest(entity.getFullyQualifiedName())
                .withStatus(Status.BAD_REQUEST.getStatusCode())
                .withMessage("Batch field loading failed: " + e.getMessage()));
      }
      return;
    }

    // Per-entity updater (relationships + change description)
    List<EntityRepository<T>.EntityUpdater> updaters = new ArrayList<>();

    try (var ignored = phase("entityUpdaters")) {
      for (T entity : entitiesToProcess) {
        try {
          String fqn = entity.getFullyQualifiedName();
          T hydratedOriginal = hydratedOriginalByFqn.get(fqn);
          if (hydratedOriginal == null) {
            failedRequests.add(
                new BulkResponse()
                    .withRequest(fqn)
                    .withStatus(Status.BAD_REQUEST.getStatusCode())
                    .withMessage("Entity does not exist"));
            continue;
          }
          T original =
              updateFrequencyByFqn.getOrDefault(fqn, 0) > 1
                  ? JsonUtils.deepCopy(hydratedOriginal, r.entityClass)
                  : hydratedOriginal;
          entity.setUpdatedBy(userName);
          entity.setUpdatedAt(System.currentTimeMillis());

          if (Boolean.TRUE.equals(original.getDeleted())) {
            r.restoreEntity(entity.getUpdatedBy(), original.getId());
          }

          EntityRepository<T>.EntityUpdater updater =
              r.getUpdater(original, entity, EntityRepository.Operation.PUT, null);
          updater.setOverrideMetadata(overrideMetadata);
          updater.updateWithDeferredStore();
          updaters.add(updater);
        } catch (Exception e) {
          failedRequests.add(
              new BulkResponse()
                  .withRequest(entity.getFullyQualifiedName())
                  .withStatus(Status.BAD_REQUEST.getStatusCode())
                  .withMessage(e.getMessage()));
        }
      }
    }

    if (updaters.isEmpty()) return;
    List<EntityRepository<T>.EntityUpdater> changedUpdaters =
        updaters.stream()
            .filter(updater -> updater.isVersionChanged() || updater.isEntityChanged())
            .toList();
    Fields bulkInheritanceFields = getBulkUpdateInheritanceFields();

    // Batch DB writes
    try {
      try (var ignored = phase("batchDbWrites")) {
        // Batch version history inserts
        List<UUID> historyIds = new ArrayList<>();
        List<String> historyExtensions = new ArrayList<>();
        List<String> historyJsons = new ArrayList<>();
        for (EntityRepository<T>.EntityUpdater updater : changedUpdaters) {
          if (updater.isVersionChanged()) {
            historyIds.add(updater.getOriginal().getId());
            historyExtensions.add(
                EntityUtil.getVersionExtension(r.entityType, updater.getOriginal().getVersion()));
            historyJsons.add(JsonUtils.pojoToJson(updater.getOriginal()));
          }
        }
        if (!historyIds.isEmpty()) {
          r.daoCollection
              .entityExtensionDAO()
              .insertMany(historyIds, historyExtensions, r.entityType, historyJsons);
        }

        // Batch entity row updates
        List<T> entitiesToStore = new ArrayList<>();
        for (EntityRepository<T>.EntityUpdater updater : changedUpdaters) {
          entitiesToStore.add(updater.getUpdated());
        }
        if (!entitiesToStore.isEmpty()) {
          r.updateMany(entitiesToStore);
        }
      }

      List<T> changedEntities =
          changedUpdaters.stream().map(EntityRepository<T>.EntityUpdater::getUpdated).toList();
      if (!changedEntities.isEmpty()) {
        try (var ignored = phase("setInheritedFields")) {
          // Only changed entities need inheritance hydration for downstream side effects.
          r.setInheritedFields(changedEntities, bulkInheritanceFields);
        }
        try (var ignored = phase("invalidateCacheBulk")) {
          r.invalidateMany(changedEntities);
        }
        try (var ignored = phase("postUpdateEvents")) {
          List<String> changeEventJsons = new ArrayList<>();
          for (var updater : changedUpdaters) {
            r.postUpdate(updater.getOriginal(), updater.getUpdated());
            updater.runDeferredReactOperations();
            var changeType = updater.incrementalFieldsChanged() ? ENTITY_UPDATED : ENTITY_NO_CHANGE;
            buildChangeEventJsonForBulkOperation(updater.getUpdated(), changeType, userName)
                .ifPresent(changeEventJsons::add);
          }
          insertChangeEventsBatch(changeEventJsons);
        }
      }

      // Per-entity success + metrics (includes no-change updates).
      long batchDuration = System.nanoTime() - batchStartTime;
      long perEntityDuration = batchDuration / updaters.size();
      for (var updater : updaters) {
        entityLatenciesNanos.add(perEntityDuration);
        recordEntityMetrics(r.entityType, perEntityDuration, 0, true);
        successRequests.add(
            new BulkResponse()
                .withRequest(updater.getUpdated().getFullyQualifiedName())
                .withStatus(Status.OK.getStatusCode()));
      }
    } catch (Exception batchError) {
      LOG.warn("Batch update store failed, falling back to per-entity updates", batchError);
      List<EntityRepository<T>.EntityUpdater> succeededUpdaters = new ArrayList<>();
      for (var updater : updaters) {
        try {
          if (updater.isVersionChanged() || updater.isEntityChanged()) {
            updater.storeUpdate();
            r.invalidate(updater.getUpdated());
          }
          succeededUpdaters.add(updater);
        } catch (Exception e) {
          failedRequests.add(
              new BulkResponse()
                  .withRequest(updater.getUpdated().getFullyQualifiedName())
                  .withStatus(Status.BAD_REQUEST.getStatusCode())
                  .withMessage(e.getMessage()));
        }
      }
      if (!succeededUpdaters.isEmpty()) {
        List<T> fallbackChanged =
            succeededUpdaters.stream()
                .filter(updater -> updater.isVersionChanged() || updater.isEntityChanged())
                .map(EntityRepository<T>.EntityUpdater::getUpdated)
                .toList();
        if (!fallbackChanged.isEmpty()) {
          try (var ignored = phase("invalidateCacheBulk")) {
            r.invalidateMany(fallbackChanged);
          }
          r.setInheritedFields(fallbackChanged, bulkInheritanceFields);
        }

        List<String> changeEventJsons = new ArrayList<>();
        for (var updater : succeededUpdaters) {
          if (updater.isVersionChanged() || updater.isEntityChanged()) {
            r.postUpdate(updater.getOriginal(), updater.getUpdated());
            updater.runDeferredReactOperations();
            var changeType = updater.incrementalFieldsChanged() ? ENTITY_UPDATED : ENTITY_NO_CHANGE;
            buildChangeEventJsonForBulkOperation(updater.getUpdated(), changeType, userName)
                .ifPresent(changeEventJsons::add);
          }
          successRequests.add(
              new BulkResponse()
                  .withRequest(updater.getUpdated().getFullyQualifiedName())
                  .withStatus(Status.OK.getStatusCode()));
        }
        insertChangeEventsBatch(changeEventJsons);
      }
    }
  }

  BulkOperationResult bulkCreateOrUpdateEntitiesSequential(
      UriInfo uriInfo,
      List<T> entities,
      String userName,
      Map<String, T> existingByFqn,
      boolean overrideMetadata) {

    BulkOperationResult result = new BulkOperationResult();
    result.setStatus(ApiStatus.SUCCESS);

    List<BulkResponse> successRequests = new ArrayList<>();
    List<BulkResponse> failedRequests = new ArrayList<>();

    long bulkStartTime = System.nanoTime();
    List<Long> entityLatenciesNanos = new ArrayList<>();

    // Separate into creates and updates using the pre-fetched map
    // For duplicate FQNs within the batch, first occurrence goes to creates,
    // subsequent occurrences go to updates (processed after creates)
    List<T> newEntities = new ArrayList<>();
    List<T> updateEntities = new ArrayList<>();
    Set<String> seenNewFqns = new HashSet<>();
    for (T entity : entities) {
      String fqn = entity.getFullyQualifiedName();
      if (existingByFqn.containsKey(fqn)) {
        updateEntities.add(entity);
      } else if (seenNewFqns.contains(fqn)) {
        updateEntities.add(entity);
      } else {
        seenNewFqns.add(fqn);
        newEntities.add(entity);
      }
    }

    // Batch create new entities
    if (!newEntities.isEmpty()) {
      long batchStartTime = System.nanoTime();
      try {
        r.createManyEntities(newEntities);
        long batchDuration = System.nanoTime() - batchStartTime;
        long perEntityDuration = batchDuration / newEntities.size();
        List<String> createdChangeEventJsons = new ArrayList<>();
        for (T entity : newEntities) {
          entityLatenciesNanos.add(perEntityDuration);
          recordEntityMetrics(r.entityType, perEntityDuration, 0, true);
          successRequests.add(
              new BulkResponse()
                  .withRequest(entity.getFullyQualifiedName())
                  .withStatus(Status.OK.getStatusCode()));
          buildChangeEventJsonForBulkOperation(entity, ENTITY_CREATED, userName)
              .ifPresent(createdChangeEventJsons::add);
        }
        insertChangeEventsBatch(createdChangeEventJsons);
      } catch (Exception batchError) {
        LOG.warn("Batch create failed, falling back to per-entity creates", batchError);
        for (T entity : newEntities) {
          long entityStartTime = System.nanoTime();
          try {
            PutResponse<T> putResponse = r.createOrUpdate(uriInfo, entity, userName);
            long entityDuration = System.nanoTime() - entityStartTime;
            entityLatenciesNanos.add(entityDuration);
            recordEntityMetrics(r.entityType, entityDuration, 0, true);
            successRequests.add(
                new BulkResponse()
                    .withRequest(entity.getFullyQualifiedName())
                    .withStatus(Status.OK.getStatusCode()));
            createChangeEventForBulkOperation(
                putResponse.getEntity(), putResponse.getChangeType(), userName);
          } catch (Exception e) {
            long entityDuration = System.nanoTime() - entityStartTime;
            entityLatenciesNanos.add(entityDuration);
            if (isDuplicateKeyException(e)) {
              LOG.debug(
                  "Entity already exists (duplicate key), treating as success: {}",
                  entity.getFullyQualifiedName());
              recordEntityMetrics(r.entityType, entityDuration, 0, true);
              successRequests.add(
                  new BulkResponse()
                      .withRequest(entity.getFullyQualifiedName())
                      .withStatus(Status.OK.getStatusCode()));
            } else {
              recordEntityMetrics(r.entityType, entityDuration, 0, false);
              failedRequests.add(
                  new BulkResponse()
                      .withRequest(entity.getFullyQualifiedName())
                      .withStatus(Status.BAD_REQUEST.getStatusCode())
                      .withMessage(e.getMessage()));
            }
          }
        }
      }
    }

    // For duplicate FQNs within the batch, refresh existingByFqn with newly created entities
    if (!updateEntities.isEmpty()) {
      List<String> updateFqns =
          updateEntities.stream()
              .map(T::getFullyQualifiedName)
              .filter(fqn -> !existingByFqn.containsKey(fqn))
              .distinct()
              .collect(Collectors.toList());
      if (!updateFqns.isEmpty()) {
        List<T> newlyCreated = r.dao.findEntityByNames(updateFqns, Include.ALL);
        for (T created : newlyCreated) {
          existingByFqn.put(created.getFullyQualifiedName(), created);
        }
      }

      // Filter out entities whose original doesn't exist (e.g., duplicate FQN whose
      // first occurrence failed to create). These can't be updated — report as failed.
      Iterator<T> it = updateEntities.iterator();
      while (it.hasNext()) {
        T entity = it.next();
        if (!existingByFqn.containsKey(entity.getFullyQualifiedName())) {
          it.remove();
          failedRequests.add(
              new BulkResponse()
                  .withRequest(entity.getFullyQualifiedName())
                  .withStatus(Status.BAD_REQUEST.getStatusCode())
                  .withMessage("Entity does not exist and could not be created"));
        }
      }
    }

    // Batch update existing entities
    bulkUpdateEntities(
        uriInfo,
        updateEntities,
        existingByFqn,
        userName,
        overrideMetadata,
        successRequests,
        failedRequests,
        entityLatenciesNanos);

    long totalDurationNanos = System.nanoTime() - bulkStartTime;

    result.setNumberOfRowsProcessed(entities.size());
    result.setNumberOfRowsPassed(successRequests.size());
    result.setNumberOfRowsFailed(failedRequests.size());
    result.setSuccessRequest(successRequests);
    result.setFailedRequest(failedRequests);

    if (!failedRequests.isEmpty()) {
      result.setStatus(successRequests.isEmpty() ? ApiStatus.FAILURE : ApiStatus.PARTIAL_SUCCESS);
    }

    // Calculate metrics
    long avgEntityLatencyMs = 0;
    long maxEntityLatencyMs = 0;
    if (!entityLatenciesNanos.isEmpty()) {
      avgEntityLatencyMs =
          entityLatenciesNanos.stream().mapToLong(Long::longValue).sum()
              / entityLatenciesNanos.size()
              / 1_000_000;
      maxEntityLatencyMs =
          entityLatenciesNanos.stream().mapToLong(Long::longValue).max().orElse(0) / 1_000_000;
    }

    recordBulkMetrics(
        r.entityType,
        entities.size(),
        successRequests.size(),
        totalDurationNanos,
        avgEntityLatencyMs,
        maxEntityLatencyMs);

    LOG.info(
        "Bulk operation completed: {} succeeded, {} failed out of {} total, took {}ms",
        successRequests.size(),
        failedRequests.size(),
        entities.size(),
        totalDurationNanos / 1_000_000);

    return result;
  }

  Optional<BulkOperationResult> getBulkJobStatus(String jobId) {
    CompletableFuture<BulkOperationResult> job = BULK_JOBS.get(jobId);
    if (job == null) {
      return Optional.empty();
    }

    if (job.isDone() && !job.isCompletedExceptionally()) {
      try {
        return Optional.of(job.get());
      } catch (ExecutionException | InterruptedException e) {
        LOG.error("Error retrieving job status for jobId: {}", jobId, e);
        java.lang.Thread.currentThread().interrupt();
        return Optional.empty();
      }
    }

    BulkOperationResult inProgress = new BulkOperationResult();
    inProgress.setStatus(ApiStatus.RUNNING);
    return Optional.of(inProgress);
  }

  @Transaction
  PutResponse<T> createOrUpdateWithOriginal(
      UriInfo uriInfo, T updated, T original, String updatedBy) {
    if (r.lockManager != null) {
      r.lockManager.checkModificationAllowed(updated);
    }
    if (original == null) {
      return new PutResponse<>(
          Status.CREATED, r.withHref(uriInfo, r.createNewEntity(updated)), ENTITY_CREATED);
    }
    return r.update(uriInfo, original, updated, updatedBy, null);
  }

  void createChangeEventForBulkOperation(T entity, EventType eventType, String userName) {
    Optional<String> changeEventJson =
        buildChangeEventJsonForBulkOperation(entity, eventType, userName);
    if (changeEventJson.isEmpty()) {
      return;
    }
    try {
      Entity.getCollectionDAO().changeEventDAO().insert(changeEventJson.get());
    } catch (Exception e) {
      LOG.error("Failed to create change event for bulk operation", e);
    }
  }

  Optional<String> buildChangeEventJsonForBulkOperation(
      T entity, EventType eventType, String userName) {
    try {
      if (eventType.equals(ENTITY_NO_CHANGE)) {
        return Optional.empty();
      }

      ChangeEvent changeEvent =
          FormatterUtil.createChangeEventForEntity(userName, eventType, entity);

      if (changeEvent.getEntity() != null) {
        Object entityObject = changeEvent.getEntity();
        changeEvent = copyChangeEvent(changeEvent);
        changeEvent.setEntity(JsonUtils.pojoToMaskedJson(entityObject));
      }

      LOG.debug(
          "Recording change event for bulk operation {}:{}:{}:{}",
          changeEvent.getTimestamp(),
          changeEvent.getEntityId(),
          changeEvent.getEventType(),
          changeEvent.getEntityType());

      return Optional.of(JsonUtils.pojoToJson(changeEvent));
    } catch (Exception e) {
      LOG.error("Failed to create change event for bulk operation", e);
      return Optional.empty();
    }
  }

  void insertChangeEventsBatch(List<String> changeEvents) {
    if (changeEvents == null || changeEvents.isEmpty()) {
      return;
    }
    try {
      Entity.getCollectionDAO().changeEventDAO().insertBatch(changeEvents);
    } catch (Exception batchError) {
      LOG.error("Failed to insert change events batch", batchError);
    }
  }

  static ChangeEvent copyChangeEvent(ChangeEvent changeEvent) {
    return new ChangeEvent()
        .withId(changeEvent.getId())
        .withEventType(changeEvent.getEventType())
        .withEntityId(changeEvent.getEntityId())
        .withEntityType(changeEvent.getEntityType())
        .withUserName(changeEvent.getUserName())
        .withImpersonatedBy(changeEvent.getImpersonatedBy())
        .withTimestamp(changeEvent.getTimestamp())
        .withChangeDescription(changeEvent.getChangeDescription())
        .withCurrentVersion(changeEvent.getCurrentVersion())
        .withPreviousVersion(changeEvent.getPreviousVersion())
        .withEntityFullyQualifiedName(changeEvent.getEntityFullyQualifiedName());
  }

  BulkOperationResult bulkCreateOrUpdateEntities(
      UriInfo uriInfo, List<T> entities, String userName, Map<String, T> existingByFqn) {
    return bulkCreateOrUpdateEntities(uriInfo, entities, userName, existingByFqn, false);
  }

  BulkOperationResult bulkCreateOrUpdateEntities(
      UriInfo uriInfo,
      List<T> entities,
      String userName,
      Map<String, T> existingByFqn,
      boolean overrideMetadata) {
    return bulkCreateOrUpdateEntitiesSequential(
        uriInfo, entities, userName, existingByFqn, overrideMetadata);
  }

  /**
   * Deletes entities of this type within {@code request.scopeFqn} that the ingestion connector did
   * not report in the current run. The connector sends the set of FQNs it saw ({@code
   * request.seenFqns}); any live entity under the scope whose FQN is not in that set is considered
   * stale. By default the deletion is soft; pass {@code hardDelete=true} on the request to
   * hard-delete the stale entities.
   *
   * <p>FQNs are compared by hash so quoting or case differences between the connector-supplied and
   * stored values never cause spurious deletes. An empty scope yields zero deletions - it is never
   * interpreted as "everything is stale". Each delete runs in its own transaction so a single
   * failure does not roll back the rest of the batch.
   */
  BulkOperationResult bulkDeleteStaleEntities(BulkDeleteStaleRequest request, String deletedBy) {
    validateScopeRequest(request.getScopeEntityType(), request.getScopeFqn());
    if (nullOrEmpty(request.getSeenFqns())) {
      // An empty seen-set cannot be distinguished from a connector run that crashed or discovered
      // nothing, so it must never be interpreted as "every entity under the scope is stale" - that
      // would silently delete the whole service/database. Treat it as zero deletions, mirroring the
      // scope-not-found path.
      LOG.warn(
          "deleteStale for scope {} '{}' received an empty seenFqns; treating as zero deletions "
              + "rather than marking the entire scope stale",
          request.getScopeEntityType(),
          request.getScopeFqn());
      return buildStaleDeletionResult(
          Boolean.TRUE.equals(request.getDryRun()), new ArrayList<>(), new ArrayList<>());
    }
    if (!scopeExists(request.getScopeEntityType(), request.getScopeFqn())) {
      LOG.warn(
          "deleteStale scope {} '{}' not found; nothing to delete this run",
          request.getScopeEntityType(),
          request.getScopeFqn());
      return buildStaleDeletionResult(
          Boolean.TRUE.equals(request.getDryRun()), new ArrayList<>(), new ArrayList<>());
    }
    boolean dryRun = Boolean.TRUE.equals(request.getDryRun());
    boolean hardDelete = Boolean.TRUE.equals(request.getHardDelete());
    boolean recursive = !Boolean.FALSE.equals(request.getRecursive());
    List<BulkResponse> successRequests = new ArrayList<>();
    List<BulkResponse> failedRequests = new ArrayList<>();
    Set<String> deletedHashes = new HashSet<>();
    for (EntityDAO.EntityIdFqnPair stale :
        findStaleEntities(request.getScopeFqn(), request.getSeenFqns())) {
      String fqnHash = FullyQualifiedName.buildHash(stale.fqn);
      if (dryRun || isCoveredByDeletedAncestor(fqnHash, deletedHashes)) {
        successRequests.add(staleSuccess(stale.fqn));
        continue;
      }
      try {
        r.deleteInternal(deletedBy, stale.id, recursive, hardDelete);
        deletedHashes.add(fqnHash);
        successRequests.add(staleSuccess(stale.fqn));
      } catch (Exception e) {
        LOG.warn("Failed to delete stale {} '{}': {}", r.entityType, stale.fqn, e.getMessage());
        failedRequests.add(
            new BulkResponse()
                .withRequest(stale.fqn)
                .withStatus(Status.INTERNAL_SERVER_ERROR.getStatusCode())
                .withMessage(e.getMessage()));
      }
    }
    return buildStaleDeletionResult(dryRun, successRequests, failedRequests);
  }

  /**
   * Rejects a malformed request before any work runs: {@code scopeFqn} and {@code scopeEntityType}
   * must be present and {@code scopeEntityType} must resolve to a registered entity type. These are
   * caller mistakes (typos, swapped fields) and fail with 400. An empty {@code seenFqns} is handled
   * separately in {@link #bulkDeleteStaleEntities} as a safe zero-deletion no-op rather than a 400,
   * since it is a well-formed request whose intent is genuinely ambiguous.
   */
  void validateScopeRequest(String scopeEntityType, String scopeFqn) {
    if (nullOrEmpty(scopeFqn)) {
      throw BadRequestException.of("scopeFqn is required for deleteStale");
    }
    if (nullOrEmpty(scopeEntityType)) {
      throw BadRequestException.of("scopeEntityType is required for deleteStale");
    }
    if (!Entity.hasEntityRepository(resolveScopeEntityType(scopeEntityType))) {
      throw BadRequestException.of(
          String.format("Unsupported scopeEntityType '%s' for deleteStale", scopeEntityType));
    }
  }

  /**
   * Returns whether a live entity with FQN {@code scopeFqn} exists under the resolved scope type. A
   * missing scope is not an error - it means the connector has nothing to reconcile yet (scope not
   * persisted) or the scope was already removed - so the caller treats it as zero deletions.
   */
  boolean scopeExists(String scopeEntityType, String scopeFqn) {
    EntityRepository<? extends EntityInterface> scopeRepository =
        Entity.getEntityRepository(resolveScopeEntityType(scopeEntityType));
    return scopeRepository.findByNameOrNull(scopeFqn, Include.NON_DELETED) != null;
  }

  /**
   * Resolves a generic {@code service} scope to the concrete service type that owns this entity
   * type (for example {@code pipeline} -> {@code pipelineService}), mirroring how {@link
   * org.openmetadata.service.jdbi3.ListFilter} interprets the {@code service} query param.
   * Connectors scope service-level stale deletion with the generic {@code service} key, so without
   * this the request would be rejected as an unknown entity type. Any concrete scope type is
   * returned unchanged.
   */
  String resolveScopeEntityType(String scopeEntityType) {
    return Entity.FIELD_SERVICE.equals(scopeEntityType)
        ? Entity.getServiceType(r.entityType)
        : scopeEntityType;
  }

  /**
   * Returns the live entities under {@code scopeFqn} that are not present in {@code seenFqns},
   * sorted shallowest-FQN-first so a recursive delete of an ancestor is processed before its
   * descendants. Comparison is by FQN hash to be quoting and case insensitive.
   */
  List<EntityDAO.EntityIdFqnPair> findStaleEntities(String scopeFqn, List<String> seenFqns) {
    List<EntityDAO.EntityIdFqnPair> scopeEntities =
        r.dao.listDescendantIdFqnByPrefixNonDeleted(scopeFqn);
    if (scopeEntities.isEmpty()) {
      return List.of();
    }
    Set<String> seenHashes = new HashSet<>();
    for (String seenFqn : listOrEmpty(seenFqns)) {
      try {
        seenHashes.add(FullyQualifiedName.buildHash(seenFqn));
      } catch (Exception e) {
        LOG.warn("Ignoring malformed seen FQN '{}' in stale deletion request", seenFqn);
      }
    }
    return scopeEntities.stream()
        .filter(pair -> !seenHashes.contains(FullyQualifiedName.buildHash(pair.fqn)))
        .sorted(Comparator.comparingInt(pair -> FullyQualifiedName.split(pair.fqn).length))
        .toList();
  }

  boolean isCoveredByDeletedAncestor(String fqnHash, Set<String> deletedHashes) {
    if (deletedHashes.isEmpty()) {
      return false;
    }
    int separator = fqnHash.lastIndexOf('.');
    while (separator > 0) {
      String ancestor = fqnHash.substring(0, separator);
      if (deletedHashes.contains(ancestor)) {
        return true;
      }
      separator = ancestor.lastIndexOf('.');
    }
    return false;
  }

  BulkResponse staleSuccess(String fqn) {
    return new BulkResponse().withRequest(fqn).withStatus(Status.OK.getStatusCode());
  }

  BulkOperationResult buildStaleDeletionResult(
      boolean dryRun, List<BulkResponse> successRequests, List<BulkResponse> failedRequests) {
    BulkOperationResult result = new BulkOperationResult();
    result.setDryRun(dryRun);
    result.setStatus(failedRequests.isEmpty() ? ApiStatus.SUCCESS : ApiStatus.PARTIAL_SUCCESS);
    result.setNumberOfRowsProcessed(successRequests.size() + failedRequests.size());
    result.setNumberOfRowsPassed(successRequests.size());
    result.setNumberOfRowsFailed(failedRequests.size());
    result.setSuccessRequest(successRequests);
    result.setFailedRequest(failedRequests);
    return result;
  }

  static boolean isDuplicateKeyException(Exception e) {
    Throwable cause = e.getCause();
    if (cause instanceof SQLException sqlEx) {
      // MySQL: error code 1062 = ER_DUP_ENTRY
      // PostgreSQL: SQL state "23505" = unique_violation
      return sqlEx.getErrorCode() == 1062 || "23505".equals(sqlEx.getSQLState());
    }
    return false;
  }

  void recordEntityMetrics(
      String entityType, long durationNanos, long queueWaitNanos, boolean success) {
    // Per-entity processing time (cached, no histogram to reduce Prometheus cardinality)
    // This fires for EVERY entity in a bulk operation, so we use simple timers.
    // The bulk.operation.latency metric has histograms for percentile analysis.
    String latencyKey = entityType + "|" + success;
    Timer latencyTimer =
        ENTITY_LATENCY_TIMERS.computeIfAbsent(
            latencyKey,
            k ->
                Timer.builder("bulk.entity.latency")
                    .tag("entity", entityType)
                    .tag("success", String.valueOf(success))
                    .register(Metrics.globalRegistry));
    latencyTimer.record(durationNanos, TimeUnit.NANOSECONDS);

    // Queue wait time (cached, simple timer)
    Timer queueTimer =
        ENTITY_QUEUE_WAIT_TIMERS.computeIfAbsent(
            entityType,
            k ->
                Timer.builder("bulk.entity.queue_wait")
                    .tag("entity", entityType)
                    .register(Metrics.globalRegistry));
    queueTimer.record(queueWaitNanos, TimeUnit.NANOSECONDS);
  }

  void recordBulkMetrics(
      String entityType,
      int totalEntities,
      int successCount,
      long durationNanos,
      long avgEntityMs,
      long maxEntityMs) {
    // Total bulk operation time (cached)
    Timer operationTimer =
        BULK_OPERATION_TIMERS.computeIfAbsent(
            entityType,
            k ->
                Timer.builder("bulk.operation.latency")
                    .tag("entity", entityType)
                    .publishPercentileHistogram(true)
                    .register(Metrics.globalRegistry));
    operationTimer.record(durationNanos, TimeUnit.NANOSECONDS);

    // Batch size distribution (cached)
    DistributionSummary batchSizeSummary =
        BATCH_SIZE_SUMMARIES.computeIfAbsent(
            entityType,
            k ->
                DistributionSummary.builder("bulk.operation.batch_size")
                    .tag("entity", entityType)
                    .register(Metrics.globalRegistry));
    batchSizeSummary.record(totalEntities);

    // Success rate as distribution (cached, avoids gauge memory leak)
    if (totalEntities > 0) {
      DistributionSummary successRateSummary =
          SUCCESS_RATE_SUMMARIES.computeIfAbsent(
              entityType,
              k ->
                  DistributionSummary.builder("bulk.operation.success_rate")
                      .tag("entity", entityType)
                      .register(Metrics.globalRegistry));
      successRateSummary.record(successCount * 100.0 / totalEntities);
    }

    // Record success and failure counts for alerting (Micrometer caches counters internally)
    Metrics.counter("bulk.operation.entities.success", "entity", entityType)
        .increment(successCount);
    Metrics.counter("bulk.operation.entities.failed", "entity", entityType)
        .increment(totalEntities - successCount);
  }

  void handleBulkOperationError(T entity, Exception e, List<BulkResponse> failedRequests) {
    String fqn = entity.getFullyQualifiedName();
    int statusCode;
    String message;

    // Categorize errors properly
    if (e instanceof jakarta.ws.rs.WebApplicationException wae) {
      statusCode = wae.getResponse().getStatus();
      message = e.getMessage();
      LOG.warn("Entity {} failed with status {}: {}", fqn, statusCode, message);
    } else if (e instanceof java.sql.SQLException) {
      statusCode = Status.INTERNAL_SERVER_ERROR.getStatusCode();
      message = "Database error: " + e.getMessage();
      LOG.error("Database error processing entity {}", fqn, e);
    } else if (e instanceof IllegalArgumentException || e instanceof IllegalStateException) {
      statusCode = Status.BAD_REQUEST.getStatusCode();
      message = e.getMessage();
      LOG.warn("Validation error for entity {}: {}", fqn, message);
    } else {
      statusCode = Status.INTERNAL_SERVER_ERROR.getStatusCode();
      message = "Unexpected error: " + e.getMessage();
      LOG.error("Unexpected error processing entity {}", fqn, e);
    }

    failedRequests.add(
        new BulkResponse().withRequest(fqn).withStatus(statusCode).withMessage(message));
  }
}
