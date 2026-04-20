package org.openmetadata.service.apps.bundles.searchIndex;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.service.workflows.searchIndex.ReindexingUtil.isDataInsightIndex;

import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.Phaser;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicReference;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.system.IndexingError;
import org.openmetadata.schema.system.Stats;
import org.openmetadata.schema.system.StepStats;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.jdbi3.EntityTimeSeriesRepository;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.search.EntityReindexContext;
import org.openmetadata.service.search.RecreateIndexHandler;
import org.openmetadata.service.search.ReindexContext;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.util.FullyQualifiedName;
import org.openmetadata.service.workflows.searchIndex.ReindexingUtil;
import org.slf4j.MDC;

/**
 * Quartz-decoupled indexing pipeline that orchestrates: entity discovery -> reader -> queue -> sink.
 * This class can be used by SearchIndexExecutor, CLI tools, REST APIs, or unit tests.
 */
@Slf4j
public class IndexingPipeline implements AutoCloseable {

  private static final String POISON_PILL = "__POISON_PILL__";
  private static final int DEFAULT_QUEUE_SIZE = 20000;
  private static final int MAX_CONSUMER_THREADS =
      Math.min(20, Runtime.getRuntime().availableProcessors() * 2);
  private static final int MAX_JOB_THREADS =
      Math.min(30, Runtime.getRuntime().availableProcessors() * 4);
  private static final String ENTITY_TYPE_KEY = "entityType";
  private static final String RECREATE_INDEX = "recreateIndex";

  private final SearchRepository searchRepository;
  private final CompositeProgressListener listeners;
  private final AtomicBoolean stopped = new AtomicBoolean(false);
  @Getter private final AtomicReference<Stats> stats = new AtomicReference<>();

  private BulkSink searchIndexSink;
  private RecreateIndexHandler recreateIndexHandler;
  private ReindexContext recreateContext;
  private EntityReader entityReader;
  private ExecutorService consumerExecutor;
  private ExecutorService producerExecutor;
  private ExecutorService jobExecutor;
  private BlockingQueue<IndexingTask<?>> taskQueue;
  private final Set<String> promotedEntities = java.util.concurrent.ConcurrentHashMap.newKeySet();

  record IndexingTask<T>(String entityType, ResultList<T> entities, int offset) {}

  public IndexingPipeline(SearchRepository searchRepository) {
    this.searchRepository = searchRepository;
    this.listeners = new CompositeProgressListener();
  }

  public IndexingPipeline addListener(ReindexingProgressListener listener) {
    listeners.addListener(listener);
    return this;
  }

  public ExecutionResult execute(
      ReindexingConfiguration config,
      ReindexingJobContext context,
      Set<String> entities,
      BulkSink sink,
      RecreateIndexHandler handler,
      ReindexContext recreateCtx) {
    this.searchIndexSink = sink;
    this.recreateIndexHandler = handler;
    this.recreateContext = recreateCtx;
    long startTime = System.currentTimeMillis();

    stats.set(initializeStats(config, entities));
    listeners.onJobStarted(context);

    try {
      runPipeline(config, entities);
      closeSink();
      finalizeReindex();
      return buildResult(startTime);
    } catch (Exception e) {
      LOG.error("Pipeline execution failed", e);
      listeners.onJobFailed(stats.get(), e);
      return ExecutionResult.fromStats(stats.get(), ExecutionResult.Status.FAILED, startTime);
    }
  }

  private void runPipeline(ReindexingConfiguration config, Set<String> entities)
      throws InterruptedException {
    int numConsumers =
        config.consumerThreads() > 0 ? Math.min(config.consumerThreads(), MAX_CONSUMER_THREADS) : 2;
    int queueSize = config.queueSize() > 0 ? config.queueSize() : DEFAULT_QUEUE_SIZE;
    int batchSize = config.batchSize();

    taskQueue = new LinkedBlockingQueue<>(queueSize);
    String jobIdTag = MDC.get("reindexJobId");
    String threadPrefix = "reindex-" + (jobIdTag != null ? jobIdTag + "-" : "");
    consumerExecutor =
        Executors.newFixedThreadPool(
            numConsumers,
            Thread.ofPlatform().name(threadPrefix + "pipeline-consumer-", 0).factory());
    producerExecutor =
        Executors.newFixedThreadPool(
            config.producerThreads() > 0 ? config.producerThreads() : 2,
            Thread.ofPlatform().name(threadPrefix + "pipeline-producer-", 0).factory());
    jobExecutor =
        Executors.newFixedThreadPool(
            Math.min(entities.size(), MAX_JOB_THREADS),
            Thread.ofPlatform().name(threadPrefix + "pipeline-job-", 0).factory());

    entityReader = new EntityReader(producerExecutor, stopped);

    CountDownLatch consumerLatch = new CountDownLatch(numConsumers);
    Map<String, String> mdc = MDC.getCopyOfContextMap();
    for (int i = 0; i < numConsumers; i++) {
      final int id = i;
      consumerExecutor.submit(
          () -> {
            if (mdc != null) MDC.setContextMap(mdc);
            try {
              runConsumer(id, consumerLatch);
            } finally {
              MDC.clear();
            }
          });
    }

    try {
      readAllEntities(config, entities, batchSize);
      signalConsumersToStop(numConsumers);
      consumerLatch.await();
    } catch (InterruptedException e) {
      stopped.set(true);
      Thread.currentThread().interrupt();
      throw e;
    } finally {
      shutdownExecutors();
    }
  }

  private void readAllEntities(ReindexingConfiguration config, Set<String> entities, int batchSize)
      throws InterruptedException {
    List<String> ordered = EntityPriority.sortByPriority(entities);
    Phaser producerPhaser = new Phaser(entities.size());
    Map<String, String> mdc = MDC.getCopyOfContextMap();

    for (String entityType : ordered) {
      jobExecutor.submit(
          () -> {
            if (mdc != null) MDC.setContextMap(mdc);
            try {
              int totalRecords = getTotalEntityRecords(entityType);
              listeners.onEntityTypeStarted(entityType, totalRecords);

              int effectiveBatchSize =
                  EntityBatchSizeEstimator.estimateBatchSize(entityType, batchSize);
              Long filterStartTs = null;
              Long filterEndTs = null;
              long startTs = config.getTimeSeriesStartTs(entityType);
              if (startTs > 0) {
                filterStartTs = startTs;
                filterEndTs = System.currentTimeMillis();
              }
              entityReader.readEntity(
                  entityType,
                  totalRecords,
                  effectiveBatchSize,
                  producerPhaser,
                  (type, batch, offset) -> {
                    if (!stopped.get()) {
                      taskQueue.put(new IndexingTask<>(type, batch, offset));
                    }
                  },
                  filterStartTs,
                  filterEndTs);
            } catch (Exception e) {
              LOG.error("Error reading entity type {}", entityType, e);
            } finally {
              producerPhaser.arriveAndDeregister();
              MDC.clear();
            }
          });
    }

    int phase = 0;
    while (!producerPhaser.isTerminated()) {
      if (stopped.get() || Thread.currentThread().isInterrupted()) {
        break;
      }
      try {
        producerPhaser.awaitAdvanceInterruptibly(phase, 1, TimeUnit.SECONDS);
        break;
      } catch (TimeoutException e) {
        // Continue
      }
    }
  }

  @SuppressWarnings("unchecked")
  private void runConsumer(int consumerId, CountDownLatch consumerLatch) {
    try {
      while (!stopped.get()) {
        IndexingTask<?> task = taskQueue.poll(200, TimeUnit.MILLISECONDS);
        if (task == null) continue;
        if (POISON_PILL.equals(task.entityType())) break;

        String entityType = task.entityType();
        ResultList<?> entities = task.entities();
        Map<String, Object> contextData = createContextData(entityType);

        int readerSuccess = listOrEmpty(entities.getData()).size();
        int readerFailed = listOrEmpty(entities.getErrors()).size();
        int readerWarnings = entities.getWarningsCount() != null ? entities.getWarningsCount() : 0;
        updateReaderStats(readerSuccess, readerFailed, readerWarnings);

        try {
          if (!EntityReader.TIME_SERIES_ENTITIES.contains(entityType)) {
            searchIndexSink.write(entities.getData(), contextData);
          } else {
            searchIndexSink.write(entities.getData(), contextData);
          }

          StepStats entityStats = new StepStats();
          entityStats.setSuccessRecords(readerSuccess);
          entityStats.setFailedRecords(readerFailed);
          updateEntityAndJobStats(entityType, entityStats);

          if (Entity.TABLE.equals(entityType)) {
            updateColumnStatsFromSink();
          }

          listeners.onProgressUpdate(stats.get(), null);
        } catch (Exception e) {
          LOG.error("Sink error for {}", entityType, e);
          IndexingError error =
              new IndexingError()
                  .withErrorSource(IndexingError.ErrorSource.SINK)
                  .withMessage(e.getMessage());
          listeners.onError(entityType, error, stats.get());
        }
      }
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
    } finally {
      consumerLatch.countDown();
    }
  }

  private Map<String, Object> createContextData(String entityType) {
    Map<String, Object> contextData = new HashMap<>();
    contextData.put(ENTITY_TYPE_KEY, entityType);
    contextData.put(RECREATE_INDEX, recreateContext != null);
    if (recreateContext != null) {
      contextData.put(ReindexingUtil.RECREATE_CONTEXT, recreateContext);
      recreateContext
          .getStagedIndex(entityType)
          .ifPresent(index -> contextData.put(ReindexingUtil.TARGET_INDEX_KEY, index));
    }
    return contextData;
  }

  private void signalConsumersToStop(int numConsumers) throws InterruptedException {
    for (int i = 0; i < numConsumers; i++) {
      taskQueue.put(new IndexingTask<>(POISON_PILL, null, -1));
    }
  }

  private void closeSink() {
    if (searchIndexSink != null) {
      int pendingVectorTasks = searchIndexSink.getPendingVectorTaskCount();
      if (pendingVectorTasks > 0) {
        LOG.info("Waiting for {} pending vector embedding tasks", pendingVectorTasks);
        VectorCompletionResult vcResult = searchIndexSink.awaitVectorCompletionWithDetails(300);
        LOG.info(
            "Vector completion: completed={}, pending={}, waited={}ms",
            vcResult.completed(),
            vcResult.pendingTaskCount(),
            vcResult.waitedMillis());
      }
      searchIndexSink.close();
      syncSinkStats();
    }
  }

  private void finalizeReindex() {
    if (recreateIndexHandler == null || recreateContext == null) return;

    try {
      recreateContext
          .getEntities()
          .forEach(
              entityType -> {
                if (promotedEntities.contains(entityType)) return;
                try {
                  EntityReindexContext ctx = buildEntityReindexContext(entityType);
                  recreateIndexHandler.finalizeReindex(ctx, !stopped.get());
                } catch (Exception ex) {
                  LOG.error("Failed to finalize reindex for {}", entityType, ex);
                }
              });
    } finally {
      recreateContext = null;
      promotedEntities.clear();
    }
  }

  private EntityReindexContext buildEntityReindexContext(String entityType) {
    return EntityReindexContext.builder()
        .entityType(entityType)
        .originalIndex(recreateContext.getOriginalIndex(entityType).orElse(null))
        .canonicalIndex(recreateContext.getCanonicalIndex(entityType).orElse(null))
        .activeIndex(recreateContext.getOriginalIndex(entityType).orElse(null))
        .stagedIndex(recreateContext.getStagedIndex(entityType).orElse(null))
        .canonicalAliases(recreateContext.getCanonicalAlias(entityType).orElse(null))
        .existingAliases(recreateContext.getExistingAliases(entityType))
        .parentAliases(
            new HashSet<>(
                org.openmetadata.common.utils.CommonUtil.listOrEmpty(
                    recreateContext.getParentAliases(entityType))))
        .build();
  }

  private ExecutionResult buildResult(long startTime) {
    syncSinkStats();
    updateColumnStatsFromSink();
    Stats currentStats = stats.get();
    if (currentStats != null) {
      StatsReconciler.reconcile(currentStats);
    }

    ExecutionResult.Status status;
    if (stopped.get()) {
      status = ExecutionResult.Status.STOPPED;
      listeners.onJobStopped(currentStats);
    } else if (hasFailures()) {
      status = ExecutionResult.Status.COMPLETED_WITH_ERRORS;
      listeners.onJobCompletedWithErrors(currentStats, System.currentTimeMillis() - startTime);
    } else {
      status = ExecutionResult.Status.COMPLETED;
      listeners.onJobCompleted(currentStats, System.currentTimeMillis() - startTime);
    }

    return ExecutionResult.fromStats(currentStats, status, startTime);
  }

  private boolean hasFailures() {
    Stats s = stats.get();
    if (s == null || s.getJobStats() == null) return false;
    StepStats js = s.getJobStats();
    long failed = js.getFailedRecords() != null ? js.getFailedRecords() : 0;
    long success = js.getSuccessRecords() != null ? js.getSuccessRecords() : 0;
    long total = js.getTotalRecords() != null ? js.getTotalRecords() : 0;
    return failed > 0 || (total > 0 && success < total);
  }

  private Stats initializeStats(ReindexingConfiguration config, Set<String> entities) {
    Stats s = new Stats();
    s.setEntityStats(new org.openmetadata.schema.system.EntityStats());
    s.setJobStats(new StepStats());
    s.setReaderStats(new StepStats());
    s.setSinkStats(new StepStats());

    int total = 0;
    for (String entityType : entities) {
      int entityTotal = getEntityTotal(entityType, config);
      total += entityTotal;
      StepStats es = new StepStats();
      es.setTotalRecords(entityTotal);
      es.setSuccessRecords(0);
      es.setFailedRecords(0);
      s.getEntityStats().getAdditionalProperties().put(entityType, es);
    }

    if (entities.contains(Entity.TABLE) && !entities.contains(Entity.TABLE_COLUMN)) {
      StepStats columnStats = new StepStats();
      columnStats.setTotalRecords(0);
      columnStats.setSuccessRecords(0);
      columnStats.setFailedRecords(0);
      s.getEntityStats().getAdditionalProperties().put(Entity.TABLE_COLUMN, columnStats);
    }

    s.getJobStats().setTotalRecords(total);
    s.getJobStats().setSuccessRecords(0);
    s.getJobStats().setFailedRecords(0);
    s.getReaderStats().setTotalRecords(total);
    s.getReaderStats().setSuccessRecords(0);
    s.getReaderStats().setFailedRecords(0);
    s.getReaderStats().setWarningRecords(0);
    s.getSinkStats().setTotalRecords(0);
    s.getSinkStats().setSuccessRecords(0);
    s.getSinkStats().setFailedRecords(0);

    s.setProcessStats(new StepStats());
    s.getProcessStats().setTotalRecords(0);
    s.getProcessStats().setSuccessRecords(0);
    s.getProcessStats().setFailedRecords(0);
    return s;
  }

  private int getEntityTotal(String entityType, ReindexingConfiguration config) {
    try {
      if (!EntityReader.TIME_SERIES_ENTITIES.contains(entityType)) {
        EntityRepository<?> repository = Entity.getEntityRepository(entityType);
        return repository
            .getDao()
            .listCount(new ListFilter(org.openmetadata.schema.type.Include.ALL));
      }

      EntityTimeSeriesRepository<?> repository;
      ListFilter listFilter = new ListFilter(null);
      if (isDataInsightIndex(entityType)) {
        listFilter.addQueryParam("entityFQNHash", FullyQualifiedName.buildHash(entityType));
        repository = Entity.getEntityTimeSeriesRepository(Entity.ENTITY_REPORT_DATA);
      } else {
        repository = Entity.getEntityTimeSeriesRepository(entityType);
      }

      long startTs = config != null ? config.getTimeSeriesStartTs(entityType) : -1;
      if (startTs > 0) {
        long endTs = System.currentTimeMillis();
        return repository.getTimeSeriesDao().listCount(listFilter, startTs, endTs, false);
      }
      return repository.getTimeSeriesDao().listCount(listFilter);
    } catch (Exception e) {
      LOG.debug("Error getting total records for '{}'", entityType, e);
      return 0;
    }
  }

  private int getTotalEntityRecords(String entityType) {
    StepStats es =
        stats.get() != null
                && stats.get().getEntityStats() != null
                && stats.get().getEntityStats().getAdditionalProperties() != null
            ? stats.get().getEntityStats().getAdditionalProperties().get(entityType)
            : null;
    if (es != null && es.getTotalRecords() != null) {
      return es.getTotalRecords();
    }
    return 0;
  }

  private synchronized void updateReaderStats(int success, int failed, int warnings) {
    Stats s = stats.get();
    if (s == null) return;
    StepStats rs = s.getReaderStats();
    if (rs == null) {
      rs = new StepStats();
      s.setReaderStats(rs);
    }
    rs.setSuccessRecords((rs.getSuccessRecords() != null ? rs.getSuccessRecords() : 0) + success);
    rs.setFailedRecords((rs.getFailedRecords() != null ? rs.getFailedRecords() : 0) + failed);
    rs.setWarningRecords((rs.getWarningRecords() != null ? rs.getWarningRecords() : 0) + warnings);
  }

  private synchronized void updateEntityAndJobStats(String entityType, StepStats entityDelta) {
    Stats s = stats.get();
    if (s == null || s.getEntityStats() == null) return;

    StepStats es = s.getEntityStats().getAdditionalProperties().get(entityType);
    if (es != null) {
      es.setSuccessRecords(es.getSuccessRecords() + entityDelta.getSuccessRecords());
      es.setFailedRecords(es.getFailedRecords() + entityDelta.getFailedRecords());
    }

    StepStats js = s.getJobStats();
    if (js != null) {
      int totalSuccess =
          s.getEntityStats().getAdditionalProperties().entrySet().stream()
              .filter(e -> !Entity.TABLE_COLUMN.equals(e.getKey()))
              .mapToInt(e -> e.getValue().getSuccessRecords())
              .sum();
      int totalFailed =
          s.getEntityStats().getAdditionalProperties().entrySet().stream()
              .filter(e -> !Entity.TABLE_COLUMN.equals(e.getKey()))
              .mapToInt(e -> e.getValue().getFailedRecords())
              .sum();
      js.setSuccessRecords(totalSuccess);
      js.setFailedRecords(totalFailed);
    }
  }

  private synchronized void syncSinkStats() {
    if (searchIndexSink == null) return;
    Stats s = stats.get();
    if (s == null) return;

    StepStats bulkStats = searchIndexSink.getStats();
    if (bulkStats == null) return;

    StepStats sinkStats = s.getSinkStats();
    if (sinkStats == null) {
      sinkStats = new StepStats();
      s.setSinkStats(sinkStats);
    }
    sinkStats.setTotalRecords(
        bulkStats.getTotalRecords() != null ? bulkStats.getTotalRecords() : 0);
    sinkStats.setSuccessRecords(
        bulkStats.getSuccessRecords() != null ? bulkStats.getSuccessRecords() : 0);
    sinkStats.setFailedRecords(
        bulkStats.getFailedRecords() != null ? bulkStats.getFailedRecords() : 0);

    StepStats vectorStats = searchIndexSink.getVectorStats();
    if (vectorStats != null
        && vectorStats.getTotalRecords() != null
        && vectorStats.getTotalRecords() > 0) {
      s.setVectorStats(vectorStats);
    }

    StepStats processStats = searchIndexSink.getProcessStats();
    if (processStats != null) {
      s.setProcessStats(processStats);
    }
  }

  private void updateColumnStatsFromSink() {
    if (searchIndexSink == null) return;
    Stats s = stats.get();
    if (s == null || s.getEntityStats() == null) return;

    StepStats columnStats = searchIndexSink.getColumnStats();
    if (columnStats != null && columnStats.getTotalRecords() > 0) {
      StepStats existing = s.getEntityStats().getAdditionalProperties().get(Entity.TABLE_COLUMN);
      if (existing != null) {
        existing.setTotalRecords(columnStats.getTotalRecords());
        existing.setSuccessRecords(columnStats.getSuccessRecords());
        existing.setFailedRecords(columnStats.getFailedRecords());
      }
    }
  }

  private void shutdownExecutors() {
    shutdownExecutor(producerExecutor, "producer");
    shutdownExecutor(jobExecutor, "job");
    shutdownExecutor(consumerExecutor, "consumer");
  }

  private void shutdownExecutor(ExecutorService executor, String name) {
    if (executor != null && !executor.isShutdown()) {
      executor.shutdown();
      try {
        if (!executor.awaitTermination(30, TimeUnit.SECONDS)) {
          executor.shutdownNow();
          LOG.warn("{} executor did not terminate in time", name);
        }
      } catch (InterruptedException e) {
        executor.shutdownNow();
        Thread.currentThread().interrupt();
      }
    }
  }

  public void stop() {
    stopped.set(true);
    if (entityReader != null) entityReader.stop();

    if (searchIndexSink != null) {
      LOG.info(
          "Stopping pipeline: flushing sink ({} active bulk requests)",
          searchIndexSink.getActiveBulkRequestCount());
      searchIndexSink.flushAndAwait(10);
    }

    int dropped = taskQueue != null ? taskQueue.size() : 0;
    if (dropped > 0) {
      LOG.warn("Dropping {} queued tasks during shutdown", dropped);
    }

    if (taskQueue != null) {
      taskQueue.clear();
      for (int i = 0; i < MAX_CONSUMER_THREADS; i++) {
        taskQueue.offer(new IndexingTask<>(POISON_PILL, null, -1));
      }
    }
    shutdownExecutors();
  }

  @Override
  public void close() {
    stop();
  }
}
