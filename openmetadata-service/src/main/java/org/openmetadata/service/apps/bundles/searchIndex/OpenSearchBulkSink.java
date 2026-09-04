package org.openmetadata.service.apps.bundles.searchIndex;

import static org.openmetadata.service.apps.bundles.searchIndex.BulkSink.RELATIONSHIP_REVISIONS_CONTEXT_KEY;
import static org.openmetadata.service.apps.bundles.searchIndex.BulkSink.SCRIPTED_PARTIAL_UPDATES_CONTEXT_KEY;
import static org.openmetadata.service.apps.bundles.searchIndex.BulkSinkSupport.BULK_OPERATION_METADATA_OVERHEAD;
import static org.openmetadata.service.workflows.searchIndex.ReindexingUtil.ENTITY_TYPE_KEY;
import static org.openmetadata.service.workflows.searchIndex.ReindexingUtil.RECREATE_CONTEXT;
import static org.openmetadata.service.workflows.searchIndex.ReindexingUtil.TARGET_INDEX_KEY;
import static org.openmetadata.service.workflows.searchIndex.ReindexingUtil.isStaleReferenceMessage;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.charset.StandardCharsets;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicLong;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.EntityTimeSeriesInterface;
import org.openmetadata.schema.system.IndexingError;
import org.openmetadata.schema.system.StepStats;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.search.IndexMapping;
import org.openmetadata.service.Entity;
import org.openmetadata.service.apps.bundles.searchIndex.stats.StageStatsTracker;
import org.openmetadata.service.apps.bundles.searchIndex.stats.StatsResult;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.exception.SearchIndexException;
import org.openmetadata.service.search.ReindexContext;
import org.openmetadata.service.search.SearchIndexUtils;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.search.indexes.DocBuildContext;
import org.openmetadata.service.search.opensearch.OpenSearchClient;
import org.openmetadata.service.search.opensearch.OsUtils;
import org.openmetadata.service.search.vector.OpenSearchVectorService;
import org.openmetadata.service.search.vector.VectorDocBuilder;
import org.openmetadata.service.search.vector.utils.AvailableEntityTypes;
import os.org.opensearch.client.json.JsonData;
import os.org.opensearch.client.json.jackson.JacksonJsonpMapper;
import os.org.opensearch.client.opensearch._types.BuiltinScriptLanguage;
import os.org.opensearch.client.opensearch._types.Refresh;
import os.org.opensearch.client.opensearch._types.Script;
import os.org.opensearch.client.opensearch.core.bulk.BulkOperation;

/**
 * OpenSearch implementation using new Java API client with custom bulk handler
 */
@Slf4j
public class OpenSearchBulkSink implements BulkSink {
  private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();
  // Package-private: OpenSearchCustomBulkProcessor serialises operations with the same mapper.
  static final JacksonJsonpMapper JACKSON_JSONP_MAPPER = new JacksonJsonpMapper(OBJECT_MAPPER);
  private static final int DEFAULT_DOC_BUILD_POOL_SIZE =
      Math.min(50, Runtime.getRuntime().availableProcessors() * 4);

  /**
   * Bounded work queue for the shared doc-build pool. An unbounded queue let a fast partition
   * reader pile doc-build tasks faster than they drain; pairing a bounded queue with {@link
   * ThreadPoolExecutor.CallerRunsPolicy} turns overflow into backpressure (the submitting thread
   * runs the task inline) instead of unbounded heap growth. Mirrors the bounded-queue + backpressure
   * pattern already used by EventPubSub and OrderedLaneExecutor in this codebase.
   */
  private static final int DOC_BUILD_QUEUE_CAPACITY = 2_000;

  private static final ThreadPoolExecutor DOC_BUILD_EXECUTOR =
      createDocBuildExecutor(DEFAULT_DOC_BUILD_POOL_SIZE);

  private static ThreadPoolExecutor createDocBuildExecutor(int poolSize) {
    ThreadPoolExecutor pool =
        new ThreadPoolExecutor(
            poolSize,
            poolSize,
            60L,
            TimeUnit.SECONDS,
            new LinkedBlockingQueue<>(DOC_BUILD_QUEUE_CAPACITY),
            Thread.ofVirtual().name("reindex-os-doc-build-", 0).factory(),
            new ThreadPoolExecutor.CallerRunsPolicy());
    pool.allowCoreThreadTimeOut(true);
    return pool;
  }

  public static synchronized void setDocBuildPoolSize(int size) {
    int newSize = Math.max(1, Math.min(50, size));
    resizePool(DOC_BUILD_EXECUTOR, newSize);
    ColumnIndexPipeline.setBuildPoolSize(newSize);
    LOG.info("OpenSearch doc-build and column-build pools resized to {} threads", newSize);
  }

  private static void resizePool(ThreadPoolExecutor pool, int newSize) {
    if (newSize <= pool.getMaximumPoolSize()) {
      pool.setCorePoolSize(newSize);
      pool.setMaximumPoolSize(newSize);
    } else {
      pool.setMaximumPoolSize(newSize);
      pool.setCorePoolSize(newSize);
    }
  }

  public static synchronized void resetDocBuildPoolSize() {
    setDocBuildPoolSize(DEFAULT_DOC_BUILD_POOL_SIZE);
  }

  /** Callback interface for reporting sink statistics per entity type. */
  public interface SinkStatsCallback {
    void onSuccess(String entityType, int count);

    void onFailure(String entityType, int count);
  }

  private final OpenSearchClient searchClient;
  protected final SearchRepository searchRepository;
  private final long maxPayloadSizeBytes;
  private final OpenSearchCustomBulkProcessor bulkProcessor;
  private final StepStats stats = new StepStats();

  // Track metrics
  private final AtomicLong totalSubmitted = new AtomicLong(0);
  private final AtomicLong totalSuccess = new AtomicLong(0);
  private final AtomicLong totalFailed = new AtomicLong(0);
  private final AtomicLong totalWarnings = new AtomicLong(0);

  // Process stage metrics (document building/transformation)
  private final AtomicLong processSuccess = new AtomicLong(0);
  private final AtomicLong processFailed = new AtomicLong(0);
  private final AtomicLong processWarnings = new AtomicLong(0);

  // Configuration
  private volatile int batchSize;
  private volatile int maxConcurrentRequests;

  // Failure callback
  private volatile FailureCallback failureCallback;

  // Stats callback for per-entity-type reporting
  private volatile SinkStatsCallback statsCallback;

  private final OpenSearchDocEmbedder docEmbedder = new OpenSearchDocEmbedder(OBJECT_MAPPER);

  // Column indexing: separate bulk processor with its own lifecycle, driven by ColumnIndexPipeline
  private final OpenSearchCustomBulkProcessor columnBulkProcessor;
  private final ColumnIndexPipeline columnPipeline;

  public OpenSearchBulkSink(
      SearchRepository searchRepository,
      int batchSize,
      int maxConcurrentRequests,
      long maxPayloadSizeBytes) {

    this.searchRepository = searchRepository;
    this.searchClient = (OpenSearchClient) searchRepository.getSearchClient();
    this.batchSize = batchSize;
    this.maxConcurrentRequests = maxConcurrentRequests;
    this.maxPayloadSizeBytes = maxPayloadSizeBytes;

    // Initialize stats
    stats.withTotalRecords(0).withSuccessRecords(0).withFailedRecords(0);

    // Create bulk processor
    this.bulkProcessor = createBulkProcessor(batchSize, maxConcurrentRequests, maxPayloadSizeBytes);

    BulkCounters columnCounters = BulkCounters.create();
    this.columnBulkProcessor = createColumnBulkProcessor(maxPayloadSizeBytes, columnCounters);
    // indexTableColumns, not columnPipeline::indexColumns: the sink's method stays the seam the
    // column-backpressure regression test overrides.
    this.columnPipeline =
        new ColumnIndexPipeline(
            searchRepository, this::indexTableColumns, this::addColumnDoc, columnCounters);
  }

  private OpenSearchCustomBulkProcessor createBulkProcessor(
      int bulkActions, int concurrentRequests, long maxPayloadSizeBytes) {
    LOG.info(
        "Creating OpenSearchCustomBulkProcessor with batch size {}, {} concurrent requests, max payload {} MB",
        bulkActions,
        concurrentRequests,
        maxPayloadSizeBytes / (1024 * 1024));

    BulkCircuitBreaker circuitBreaker = new BulkCircuitBreaker(5, 30_000, 10_000);
    return new OpenSearchCustomBulkProcessor(
        searchClient,
        bulkActions,
        maxPayloadSizeBytes,
        concurrentRequests,
        1000, // 1 second flush interval
        100, // 100ms initial backoff
        3, // 3 retries
        totalSubmitted,
        totalSuccess,
        totalFailed,
        totalWarnings,
        this::updateStats,
        circuitBreaker);
  }

  private OpenSearchCustomBulkProcessor createColumnBulkProcessor(
      long maxPayloadSizeBytes, BulkCounters counters) {
    BulkCircuitBreaker circuitBreaker = new BulkCircuitBreaker(5, 30_000, 10_000);
    return new OpenSearchCustomBulkProcessor(
        searchClient,
        500, // larger batch for small column docs
        maxPayloadSizeBytes,
        2, // fewer concurrent requests
        1000,
        100,
        3,
        counters.submitted(),
        counters.success(),
        counters.failed(),
        counters.warnings(),
        () -> {},
        circuitBreaker);
  }

  /** The one OpenSearch-specific step of {@link ColumnIndexPipeline}. */
  private void addColumnDoc(String indexName, String docId, String json, long estimatedSizeBytes) {
    BulkOperation operation =
        BulkOperation.of(
            op ->
                op.index(idx -> idx.index(indexName).id(docId).document(OsUtils.toJsonData(json))));
    columnBulkProcessor.add(operation, docId, Entity.TABLE_COLUMN, null, estimatedSizeBytes);
  }

  @Override
  @SuppressWarnings("unchecked")
  public void write(List<?> entities, Map<String, Object> contextData) throws Exception {
    if (entities == null || entities.isEmpty()) {
      return;
    }

    String entityType = (String) contextData.get(ENTITY_TYPE_KEY);
    if (entityType == null) {
      throw new IllegalArgumentException("Entity type is required in context data");
    }

    // Extract StageStatsTracker from context for stats recording
    StageStatsTracker tracker = extractTracker(contextData);
    boolean scriptedPartialUpdates =
        Boolean.TRUE.equals(contextData.get(SCRIPTED_PARTIAL_UPDATES_CONTEXT_KEY));

    // Check if embeddings are enabled for this specific entity type
    boolean embeddingsEnabled = isVectorEmbeddingEnabledForEntity(entityType);

    IndexMapping indexMapping = searchRepository.getIndexMapping(entityType);
    if (indexMapping == null) {
      LOG.warn(
          "No index mapping found for entityType '{}'. Skipping {} entities without recording stats.",
          entityType,
          entities.size());
      return;
    }

    if (tracker == null) {
      LOG.warn(
          "No StageStatsTracker found in context for entityType '{}'. Stats will not be recorded for {} entities.",
          entityType,
          entities.size());
    }

    String indexName =
        (String)
            contextData.getOrDefault(
                TARGET_INDEX_KEY, indexMapping.getIndexName(searchRepository.getClusterAlias()));

    try {
      // Process timing wraps the batch's parallel doc-build join. Each entity's runAsync builds
      // a search doc (Jackson serialize + tag enrichment) and submits to the bulk processor;
      // the actual OS bulk write is timed separately at the bulk-request site. So this is
      // pure CPU/serialization time per batch, isolated from upstream DB read and downstream
      // OS write.
      long processStartNanos = System.nanoTime();
      // Check if these are time series entities
      if (!entities.isEmpty() && entities.get(0) instanceof EntityTimeSeriesInterface) {
        List<EntityTimeSeriesInterface> tsEntities = (List<EntityTimeSeriesInterface>) entities;
        List<CompletableFuture<Void>> futures =
            tsEntities.stream()
                .map(
                    entity ->
                        CompletableFuture.runAsync(
                            () -> addTimeSeriesEntity(entity, indexName, entityType, tracker),
                            DOC_BUILD_EXECUTOR))
                .toList();
        CompletableFuture.allOf(futures.toArray(CompletableFuture[]::new)).join();
      } else {
        List<EntityInterface> entityInterfaces = (List<EntityInterface>) entities;
        ReindexContext reindexContext =
            contextData.containsKey(RECREATE_CONTEXT)
                ? (ReindexContext) contextData.get(RECREATE_CONTEXT)
                : null;

        // Pre-fetch cached embeddings for entities whose state is unchanged so we can splice them
        // into the staged doc instead of regenerating (avoids expensive embedding-provider calls).
        // The service-layer two-step keeps large vector payloads off the wire for entities that
        // will be re-embedded anyway, and uses the entity's `updatedAt` as a fast-path: when it
        // matches the cached value the fingerprint supplier is never invoked.
        Map<String, JsonNode> existingEmbeddingsById = Collections.emptyMap();
        if (embeddingsEnabled) {
          Map<String, OpenSearchVectorService.EntityFingerprintInput> currentById =
              new HashMap<>(entityInterfaces.size());
          for (EntityInterface e : entityInterfaces) {
            currentById.put(
                e.getId().toString(),
                new OpenSearchVectorService.EntityFingerprintInput(
                    e.getUpdatedAt(), () -> VectorDocBuilder.computeFingerprintForEntity(e)));
          }
          existingEmbeddingsById =
              docEmbedder.fetchExisting(entityInterfaces, currentById, indexName, reindexContext);
        }

        // Per-entity DocBuildContext is prepared by the upstream processor stage (see
        // ReindexingUtil.populateDocBuildContext) and stuffed into contextData. The sink stays
        // transport-only: it just looks up each entity's context by id and hands it to
        // buildSearchIndexDoc, with no awareness of what's inside (lineage today, more later).
        @SuppressWarnings("unchecked")
        Map<UUID, DocBuildContext> docBuildContexts =
            (Map<UUID, DocBuildContext>)
                contextData.getOrDefault(DOC_BUILD_CONTEXT_KEY, Collections.emptyMap());
        Map<UUID, Long> relationshipRevisions =
            (Map<UUID, Long>)
                contextData.getOrDefault(
                    RELATIONSHIP_REVISIONS_CONTEXT_KEY, Collections.emptyMap());

        // Add entities to search index in parallel
        Map<String, JsonNode> finalEmbeddingsById = existingEmbeddingsById;
        List<CompletableFuture<Void>> futures =
            entityInterfaces.stream()
                .map(
                    entity ->
                        CompletableFuture.runAsync(
                            () ->
                                addEntity(
                                    entity,
                                    indexName,
                                    reindexContext,
                                    tracker,
                                    embeddingsEnabled,
                                    finalEmbeddingsById,
                                    docBuildContexts,
                                    scriptedPartialUpdates,
                                    relationshipRevisions),
                            DOC_BUILD_EXECUTOR))
                .toList();
        CompletableFuture.allOf(futures.toArray(CompletableFuture[]::new)).join();

        // Index columns asynchronously when processing table entities. Each submission is gated by
        // a semaphore so a fast reader cannot pin an unbounded number of Table entities in the
        // shared doc-build queue (see submitColumnIndexTask).
        if (Entity.TABLE.equals(entityType)) {
          for (EntityInterface entity : entityInterfaces) {
            submitColumnIndexTask(entity, reindexContext);
          }
        }
      }
      if (tracker != null) {
        tracker.addStageTime(
            StageStatsTracker.Stage.PROCESS, System.nanoTime() - processStartNanos);
      }
    } catch (Exception e) {
      LOG.error("Failed to write {} entities of type {}", entities.size(), entityType, e);

      // Create an IndexingError for compatibility
      IndexingError error =
          new IndexingError()
              .withErrorSource(IndexingError.ErrorSource.SINK)
              .withSubmittedCount(entities.size())
              .withSuccessCount(0)
              .withFailedCount(entities.size())
              .withMessage(e.getMessage());

      throw new SearchIndexException(error);
    }
  }

  protected StageStatsTracker extractTracker(Map<String, Object> contextData) {
    if (contextData != null && contextData.containsKey(STATS_TRACKER_CONTEXT_KEY)) {
      Object tracker = contextData.get(STATS_TRACKER_CONTEXT_KEY);
      if (tracker instanceof StageStatsTracker stageTracker) {
        return stageTracker;
      }
    }
    return null;
  }

  private void addEntity(
      EntityInterface entity,
      String indexName,
      ReindexContext reindexContext,
      StageStatsTracker tracker,
      boolean embeddingsEnabled,
      Map<String, JsonNode> existingEmbeddingsById,
      Map<UUID, DocBuildContext> docBuildContexts,
      boolean scriptedPartialUpdates) {
    addEntity(
        entity,
        indexName,
        reindexContext,
        tracker,
        embeddingsEnabled,
        existingEmbeddingsById,
        docBuildContexts,
        scriptedPartialUpdates,
        Collections.emptyMap());
  }

  private void addEntity(
      EntityInterface entity,
      String indexName,
      ReindexContext reindexContext,
      StageStatsTracker tracker,
      boolean embeddingsEnabled,
      Map<String, JsonNode> existingEmbeddingsById,
      Map<UUID, DocBuildContext> docBuildContexts,
      boolean scriptedPartialUpdates,
      Map<UUID, Long> relationshipRevisions) {
    try {
      String entityType = Entity.getEntityTypeFromObject(entity);
      String docId = entity.getId().toString();
      DocBuildContext ctx = docBuildContexts.getOrDefault(entity.getId(), DocBuildContext.empty());
      Map<String, Object> searchIndexDoc =
          new HashMap<>(Entity.buildSearchIndex(entityType, entity).buildSearchIndexDoc(ctx));
      Long relationshipRevision = relationshipRevisions.get(entity.getId());
      SearchRepository.applyRelationshipRevision(entity, searchIndexDoc, relationshipRevision);
      String json = JsonUtils.pojoToJson(searchIndexDoc);

      if (embeddingsEnabled) {
        // Run-scoped chunk routing: the staged chunk generation (when this run created one) is
        // carried in the ReindexContext, so writes target exactly this run's generation — partial
        // recreates and normal runs carry none and write to the live index.
        String stagedChunkTarget =
            reindexContext != null ? reindexContext.getStagedChunkIndex().orElse(null) : null;
        json = docEmbedder.enrich(entity, json, existingEmbeddingsById, tracker, stagedChunkTarget);
      }

      String finalJson = json;
      long rawDocSize = (long) finalJson.getBytes(StandardCharsets.UTF_8).length;
      long estimatedSize = rawDocSize + BULK_OPERATION_METADATA_OVERHEAD;

      if (rawDocSize > 1024 * 1024) {
        LOG.warn(
            "Large indexed doc: entityType={}, docId={}, size={}MB",
            entityType,
            docId,
            rawDocSize / (1024 * 1024));
      }

      if (estimatedSize > maxPayloadSizeBytes) {
        long sizeLimit = maxPayloadSizeBytes - BULK_OPERATION_METADATA_OVERHEAD;
        finalJson = SearchIndexUtils.stripLineageForSize(finalJson, sizeLimit, docId, entityType);
        rawDocSize = finalJson.getBytes(StandardCharsets.UTF_8).length;
        estimatedSize = rawDocSize + BULK_OPERATION_METADATA_OVERHEAD;
      }

      if (scriptedPartialUpdates) {
        SearchRepository.ScriptedPartialUpdate partialUpdate =
            searchRepository.buildBulkScriptedPartialUpdate(entity, relationshipRevision);
        if (relationshipRevision != null && partialUpdate == null) {
          throw new IllegalStateException(
              "Missing fenced relationship update for " + entityType + " " + docId);
        }
        if (partialUpdate != null) {
          addScriptedPartialUpdate(indexName, docId, entityType, partialUpdate, finalJson, tracker);
          processSuccess.incrementAndGet();
          if (tracker != null) {
            tracker.recordProcess(StatsResult.SUCCESS);
          }
          return;
        }
      }

      SearchRepository.ScriptedPartialUpdate relationshipDocumentUpdate =
          searchRepository.buildRelationshipDocumentUpdate(
              entity, JsonUtils.readValue(finalJson, new TypeReference<Map<String, Object>>() {}));
      if (relationshipDocumentUpdate != null) {
        addScriptedPartialUpdate(
            indexName, docId, entityType, relationshipDocumentUpdate, finalJson, tracker);
        processSuccess.incrementAndGet();
        if (tracker != null) {
          tracker.recordProcess(StatsResult.SUCCESS);
        }
        return;
      }

      if (estimatedSize > maxPayloadSizeBytes) {
        LOG.warn(
            "Document {} of type {} is too large for bulk ({} bytes), sending directly",
            docId,
            entityType,
            rawDocSize);
        totalSubmitted.incrementAndGet();
        if (tracker != null) {
          tracker.incrementPendingSink();
        }
        indexDocumentDirectly(indexName, docId, finalJson, entityType, tracker);
        processSuccess.incrementAndGet();
        if (tracker != null) {
          tracker.recordProcess(StatsResult.SUCCESS);
        }
        return;
      }

      final String indexableJson = finalJson;
      BulkOperation operation =
          BulkOperation.of(
              op ->
                  op.index(
                      idx ->
                          idx.index(indexName)
                              .id(docId)
                              .document(OsUtils.toJsonData(indexableJson))));
      if (tracker != null) {
        tracker.incrementPendingSink();
      }
      bulkProcessor.add(operation, docId, entityType, tracker, estimatedSize);
      processSuccess.incrementAndGet();
      if (tracker != null) {
        tracker.recordProcess(StatsResult.SUCCESS);
      }
    } catch (EntityNotFoundException e) {
      recordStaleReferenceWarning(entity, tracker, e);
    } catch (Exception e) {
      if (isStaleReferenceMessage(e.getMessage())) {
        recordStaleReferenceWarning(entity, tracker, e);
        return;
      }
      LOG.error(
          "Encountered Issue while building SearchDoc from Entity Due to : {}", e.getMessage(), e);
      totalFailed.incrementAndGet();
      processFailed.incrementAndGet();
      updateStats();
      if (tracker != null) {
        tracker.recordProcess(StatsResult.FAILED);
      }
      if (failureCallback != null) {
        String entityTypeName = Entity.getEntityTypeFromObject(entity);
        failureCallback.onFailure(
            entityTypeName,
            entity.getId() != null ? entity.getId().toString() : null,
            entity.getFullyQualifiedName(),
            e.getMessage(),
            IndexingFailureRecorder.FailureStage.PROCESS);
      }
    }
  }

  private void addScriptedPartialUpdate(
      String indexName,
      String docId,
      String entityType,
      SearchRepository.ScriptedPartialUpdate partialUpdate,
      String upsertDocument,
      StageStatsTracker tracker) {
    String effectiveUpsertDocument = partialUpdate.scriptedUpsert() ? "{}" : upsertDocument;
    Map<String, Object> scriptParameters = partialUpdate.parametersForIndexing();
    long estimatedSize =
        (long) effectiveUpsertDocument.getBytes(StandardCharsets.UTF_8).length
            + JsonUtils.pojoToJson(scriptParameters).getBytes(StandardCharsets.UTF_8).length
            + partialUpdate.script().getBytes(StandardCharsets.UTF_8).length
            + BULK_OPERATION_METADATA_OVERHEAD;
    Map<String, JsonData> params = new HashMap<>();
    scriptParameters.forEach(
        (key, value) -> {
          if (value != null) {
            params.put(key, JsonData.of(value, JACKSON_JSONP_MAPPER));
          }
        });
    if (estimatedSize > maxPayloadSizeBytes) {
      LOG.warn(
          "Scripted update {} of type {} is too large for bulk ({} bytes), sending directly",
          docId,
          entityType,
          estimatedSize);
      totalSubmitted.incrementAndGet();
      if (tracker != null) {
        tracker.incrementPendingSink();
      }
      updateScriptedDocumentDirectly(
          indexName,
          docId,
          entityType,
          partialUpdate,
          effectiveUpsertDocument,
          params,
          tracker,
          estimatedSize);
      return;
    }
    BulkOperation operation =
        BulkOperation.of(
            op ->
                op.update(
                    update ->
                        update
                            .index(indexName)
                            .id(docId)
                            .retryOnConflict(3)
                            .scriptedUpsert(partialUpdate.scriptedUpsert())
                            .upsert(OsUtils.toJsonData(effectiveUpsertDocument))
                            .script(
                                Script.of(
                                    script ->
                                        script.inline(
                                            inline ->
                                                inline
                                                    .lang(
                                                        language ->
                                                            language.builtin(
                                                                BuiltinScriptLanguage.Painless))
                                                    .source(partialUpdate.script())
                                                    .params(params))))));
    if (tracker != null) {
      tracker.incrementPendingSink();
    }
    bulkProcessor.add(operation, docId, entityType, tracker, estimatedSize);
  }

  private void updateScriptedDocumentDirectly(
      String indexName,
      String docId,
      String entityType,
      SearchRepository.ScriptedPartialUpdate partialUpdate,
      String upsertDocument,
      Map<String, JsonData> params,
      StageStatsTracker tracker,
      long estimatedSize) {
    try {
      Map<String, Object> upsert =
          JsonUtils.readValue(upsertDocument, new TypeReference<Map<String, Object>>() {});
      searchClient
          .getNewClient()
          .update(
              update ->
                  update
                      .index(indexName)
                      .id(docId)
                      .refresh(Refresh.False)
                      .retryOnConflict(3)
                      .scriptedUpsert(partialUpdate.scriptedUpsert())
                      .upsert(upsert)
                      .script(
                          script ->
                              script.inline(
                                  inline ->
                                      inline
                                          .lang(
                                              language ->
                                                  language.builtin(BuiltinScriptLanguage.Painless))
                                          .source(partialUpdate.script())
                                          .params(params))),
              Map.class);
      totalSuccess.incrementAndGet();
      updateStats();
      if (tracker != null) {
        tracker.recordSink(StatsResult.SUCCESS);
      }
    } catch (Exception e) {
      LOG.error(
          "Direct scripted update failed for document {} of type {}: {}",
          docId,
          entityType,
          e.getMessage(),
          e);
      totalFailed.incrementAndGet();
      updateStats();
      if (tracker != null) {
        tracker.recordSink(StatsResult.FAILED);
      }
      if (failureCallback != null) {
        failureCallback.onFailure(
            entityType,
            docId,
            null,
            String.format(
                "Scripted update too large for bulk (%d bytes); direct update failed: %s",
                estimatedSize, e.getMessage()),
            IndexingFailureRecorder.FailureStage.SINK);
      }
    }
  }

  private void recordStaleReferenceWarning(
      EntityInterface entity, StageStatsTracker tracker, Exception e) {
    recordStaleReferenceWarning(
        Entity.getEntityTypeFromObject(entity),
        entity.getId(),
        entity.getFullyQualifiedName(),
        tracker,
        e);
  }

  private void recordStaleReferenceWarning(
      String entityType, UUID entityId, String entityFqn, StageStatsTracker tracker, Exception e) {
    LOG.warn(
        "Skipping stale reference while building search doc for {} {}: {}",
        entityType,
        entityFqn != null ? entityFqn : entityId,
        e.getMessage());
    totalWarnings.incrementAndGet();
    processWarnings.incrementAndGet();
    updateStats();
    if (tracker != null) {
      tracker.recordProcess(StatsResult.WARNING);
    }
  }

  private void indexDocumentDirectly(
      String indexName, String docId, String json, String entityType, StageStatsTracker tracker) {
    try {
      searchClient
          .getNewClient()
          .index(idx -> idx.index(indexName).id(docId).document(OsUtils.toJsonData(json)));
      totalSuccess.incrementAndGet();
      updateStats();
      if (tracker != null) {
        tracker.recordSink(StatsResult.SUCCESS);
      }
    } catch (Exception e) {
      boolean staleReference = isStaleReferenceMessage(e.getMessage());
      LOG.error(
          "Direct index failed for document {} of type {}: {}",
          docId,
          entityType,
          e.getMessage(),
          e);
      if (staleReference) {
        totalWarnings.incrementAndGet();
      } else {
        totalFailed.incrementAndGet();
      }
      updateStats();
      if (tracker != null) {
        tracker.recordSink(staleReference ? StatsResult.WARNING : StatsResult.FAILED);
      }
      if (!staleReference && failureCallback != null) {
        failureCallback.onFailure(
            entityType,
            docId,
            null,
            String.format(
                "Document too large for bulk (%d bytes); direct index failed: %s",
                json.getBytes(StandardCharsets.UTF_8).length, e.getMessage()),
            IndexingFailureRecorder.FailureStage.SINK);
      }
    }
  }

  private void addTimeSeriesEntity(
      EntityTimeSeriesInterface entity,
      String indexName,
      String entityType,
      StageStatsTracker tracker) {
    try {
      Object searchIndexDoc = Entity.buildSearchIndex(entityType, entity).buildSearchIndexDoc();
      String json = JsonUtils.pojoToJson(searchIndexDoc);
      String docId = entity.getId().toString();
      long estimatedSize =
          (long) json.getBytes(StandardCharsets.UTF_8).length + BULK_OPERATION_METADATA_OVERHEAD;

      BulkOperation operation =
          BulkOperation.of(
              op ->
                  op.index(
                      idx -> idx.index(indexName).id(docId).document(OsUtils.toJsonData(json))));

      if (tracker != null) {
        tracker.incrementPendingSink();
      }
      bulkProcessor.add(operation, docId, entityType, tracker, estimatedSize);
      processSuccess.incrementAndGet();
      if (tracker != null) {
        tracker.recordProcess(StatsResult.SUCCESS);
      }
    } catch (EntityNotFoundException e) {
      recordStaleReferenceWarning(entityType, entity.getId(), null, tracker, e);
    } catch (Exception e) {
      if (isStaleReferenceMessage(e.getMessage())) {
        recordStaleReferenceWarning(entityType, entity.getId(), null, tracker, e);
        return;
      }
      LOG.error(
          "Encountered Issue while building SearchDoc from Entity Due to : {}", e.getMessage(), e);
      totalFailed.incrementAndGet();
      processFailed.incrementAndGet();
      updateStats();
      if (tracker != null) {
        tracker.recordProcess(StatsResult.FAILED);
      }
      if (failureCallback != null) {
        failureCallback.onFailure(
            entityType,
            entity.getId() != null ? entity.getId().toString() : null,
            null,
            e.getMessage(),
            IndexingFailureRecorder.FailureStage.PROCESS);
      }
    }
  }

  /** Bounded submission of a table's column work; see {@link ColumnIndexPipeline#submit}. */
  private void submitColumnIndexTask(EntityInterface entity, ReindexContext reindexContext) {
    columnPipeline.submit(entity, reindexContext);
  }

  // Visible for testing: overridden by the column-backpressure regression test to control task
  // timing without standing up a real cluster.
  protected void indexTableColumns(EntityInterface entity, ReindexContext reindexContext) {
    columnPipeline.indexColumns(entity, reindexContext);
  }

  /** Get stats for column indexing from the dedicated column bulk processor */
  public StepStats getColumnStats() {
    return columnPipeline.stats();
  }

  private void updateStats() {
    stats.setTotalRecords((int) totalSubmitted.get());
    stats.setSuccessRecords((int) totalSuccess.get());
    stats.setFailedRecords((int) totalFailed.get());
    stats.setWarningRecords((int) totalWarnings.get());
  }

  @Override
  public void updateStats(int currentSuccess, int currentFailed) {
    // Stats are updated automatically by the bulk processor
    // This method is here for interface compatibility
  }

  @Override
  public StepStats getStats() {
    // Read straight off the atomic counters so the stats are real-time.
    return BulkCounters.statsOf(totalSuccess.get(), totalFailed.get(), totalWarnings.get());
  }

  @Override
  public void close() {
    try {
      bulkProcessor.flush();

      // Wait for in-flight column doc-build tasks before flushing the column processor
      columnPipeline.drainPending(30);
      columnBulkProcessor.flush();

      boolean terminated = bulkProcessor.awaitClose(60, TimeUnit.SECONDS);
      if (!terminated) {
        LOG.warn("Bulk processor did not terminate within timeout");
      }

      boolean columnTerminated = columnBulkProcessor.awaitClose(30, TimeUnit.SECONDS);
      if (!columnTerminated) {
        LOG.warn("Column bulk processor did not terminate within timeout");
      }

      updateStats();

      LOG.info(
          "Sink closed - final stats: submitted={}, success={}, failed={}, columns: success={}, failed={}",
          totalSubmitted.get(),
          totalSuccess.get(),
          totalFailed.get(),
          columnPipeline.successCount(),
          columnPipeline.failedCount());

    } catch (InterruptedException e) {
      LOG.warn("Interrupted while closing bulk processor", e);
      Thread.currentThread().interrupt();
    }
  }

  @Override
  public boolean flushAndAwait(int timeoutSeconds) {
    try {
      long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(timeoutSeconds);
      boolean completed = bulkProcessor.flushAndWait(timeoutSeconds, TimeUnit.SECONDS);

      long remainingNanos = deadline - System.nanoTime();
      long remainingSecs = Math.max(1, TimeUnit.NANOSECONDS.toSeconds(remainingNanos));
      columnPipeline.drainPending(remainingSecs);

      remainingNanos = deadline - System.nanoTime();
      remainingSecs = Math.max(1, TimeUnit.NANOSECONDS.toSeconds(remainingNanos));
      boolean columnCompleted = columnBulkProcessor.flushAndWait(remainingSecs, TimeUnit.SECONDS);

      if (completed) {
        LOG.debug(
            "Flush complete - stats: submitted={}, success={}, failed={}",
            totalSubmitted.get(),
            totalSuccess.get(),
            totalFailed.get());
      }
      return completed && columnCompleted;
    } catch (InterruptedException e) {
      LOG.warn("Interrupted while waiting for flush to complete", e);
      Thread.currentThread().interrupt();
      return false;
    }
  }

  public int getBatchSize() {
    return batchSize;
  }

  public int getConcurrentRequests() {
    return maxConcurrentRequests;
  }

  @Override
  public void setFailureCallback(FailureCallback callback) {
    this.failureCallback = callback;
    if (bulkProcessor != null) {
      bulkProcessor.setFailureCallback(callback);
    }
    if (columnBulkProcessor != null) {
      columnBulkProcessor.setFailureCallback(callback);
    }
  }

  public void setStatsCallback(SinkStatsCallback callback) {
    this.statsCallback = callback;
    if (bulkProcessor != null) {
      bulkProcessor.setStatsCallback(callback);
    }
  }

  public void updateBatchSize(int newBatchSize) {
    this.batchSize = newBatchSize;
    LOG.info("Batch size updated to: {}", newBatchSize);
  }

  public void updateConcurrentRequests(int concurrentRequests) {
    this.maxConcurrentRequests = concurrentRequests;
    LOG.info("Concurrent requests updated to: {}", concurrentRequests);
  }

  boolean isVectorEmbeddingEnabledForEntity(String entityType) {
    return searchRepository.isVectorEmbeddingEnabled()
        && OpenSearchVectorService.getInstance() != null
        && AvailableEntityTypes.isVectorIndexable(entityType)
        && searchRepository.getIndexMapping(entityType) != null;
  }

  @Override
  public int getActiveBulkRequestCount() {
    return bulkProcessor.activeBulkRequestCount();
  }

  @Override
  public StepStats getVectorStats() {
    return docEmbedder.stats();
  }

  @Override
  public StepStats getProcessStats() {
    return BulkCounters.statsOf(processSuccess.get(), processFailed.get(), processWarnings.get());
  }
}
