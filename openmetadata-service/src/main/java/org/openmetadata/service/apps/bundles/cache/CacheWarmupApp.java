package org.openmetadata.service.apps.bundles.cache;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.service.apps.scheduler.AppScheduler.ON_DEMAND_JOB;
import static org.openmetadata.service.apps.scheduler.OmAppJobListener.APP_CONFIG;
import static org.openmetadata.service.apps.scheduler.OmAppJobListener.APP_RUN_STATS;
import static org.openmetadata.service.apps.scheduler.OmAppJobListener.WEBSOCKET_STATUS_CHANNEL;
import static org.openmetadata.service.socket.WebSocketManager.CACHE_WARMUP_JOB_BROADCAST_CHANNEL;

import com.fasterxml.jackson.core.type.TypeReference;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicLong;
import java.util.concurrent.atomic.AtomicReference;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.app.App;
import org.openmetadata.schema.entity.app.AppRunRecord;
import org.openmetadata.schema.entity.app.FailureContext;
import org.openmetadata.schema.entity.app.SuccessContext;
import org.openmetadata.schema.system.EntityStats;
import org.openmetadata.schema.system.EventPublisherJob;
import org.openmetadata.schema.system.Stats;
import org.openmetadata.schema.system.StepStats;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.apps.AbstractNativeApplication;
import org.openmetadata.service.cache.CacheBundle;
import org.openmetadata.service.cache.CacheProvider;
import org.openmetadata.service.cache.CachedEntityDao;
import org.openmetadata.service.cache.CachedRelationshipDao;
import org.openmetadata.service.cache.CachedTagUsageDao;
import org.openmetadata.service.exception.AppException;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.socket.WebSocketManager;
import org.openmetadata.service.util.RestUtil;
import org.openmetadata.service.workflows.interfaces.Source;
import org.openmetadata.service.workflows.searchIndex.PaginatedEntitiesSource;
import org.quartz.JobExecutionContext;

@Slf4j
public class CacheWarmupApp extends AbstractNativeApplication {

  private static final String ALL = "all";
  private static final String POISON_PILL = "__POISON_PILL__";
  private static final int DEFAULT_BATCH_SIZE = 100;
  private static final int DEFAULT_QUEUE_SIZE = 10000;
  private static final int MAX_PRODUCER_THREADS = 10;
  private static final int MAX_CONSUMER_THREADS = 10;
  private static final int MAX_TOTAL_THREADS = 30;
  private static final String WARMUP_LOCK_KEY = "cache:warmup:lock";
  private static final int LOCK_TTL_SECONDS = 3600; // 1 hour TTL for the lock

  @Getter private EventPublisherJob jobData;
  private ExecutorService producerExecutor;
  private ExecutorService consumerExecutor;
  private ExecutorService jobExecutor;
  private final AtomicReference<Stats> cacheWarmupStats = new AtomicReference<>();
  private final AtomicReference<Integer> batchSize = new AtomicReference<>(DEFAULT_BATCH_SIZE);
  private JobExecutionContext jobExecutionContext;
  private volatile boolean stopped = false;
  private volatile long lastWebSocketUpdate = 0;
  private static final long WEBSOCKET_UPDATE_INTERVAL_MS = 2000;

  private CacheProvider cacheProvider;
  private CachedEntityDao cachedEntityDao;
  private CachedRelationshipDao cachedRelationshipDao;
  private CachedTagUsageDao cachedTagUsageDao;

  private BlockingQueue<WarmupTask> taskQueue;
  private final AtomicBoolean producersDone = new AtomicBoolean(false);
  private final AtomicLong totalEntitiesProcessed = new AtomicLong(0);
  private final AtomicLong totalProcessingTime = new AtomicLong(0);
  private volatile double currentThroughput = 0.0;

  record WarmupTask(
      String entityType, ResultList<? extends EntityInterface> entities, int offset) {}

  public CacheWarmupApp(CollectionDAO collectionDAO, SearchRepository searchRepository) {
    super(collectionDAO, searchRepository);
  }

  @Override
  public void init(App app) {
    super.init(app);
    jobData = JsonUtils.convertValue(app.getAppConfiguration(), EventPublisherJob.class);
  }

  @Override
  public void execute(JobExecutionContext jobExecutionContext) {
    this.jobExecutionContext = jobExecutionContext;
    stopped = false;

    try {
      initializeCacheComponents();
      initializeJobData(jobExecutionContext);
      runCacheWarmup(jobExecutionContext);
    } catch (Exception ex) {
      handleExecutionException(ex);
    } finally {
      finalizeJobExecution(jobExecutionContext);
    }
  }

  private void initializeCacheComponents() {
    cacheProvider = CacheBundle.getCacheProvider();
    cachedEntityDao = CacheBundle.getCachedEntityDao();
    cachedRelationshipDao = CacheBundle.getCachedRelationshipDao();
    cachedTagUsageDao = CacheBundle.getCachedTagUsageDao();

    if (cacheProvider == null || !cacheProvider.available()) {
      throw new AppException("Cache provider not available for warmup");
    }
  }

  private void initializeJobData(JobExecutionContext jobExecutionContext) {
    if (jobData == null) {
      jobData = loadJobData(jobExecutionContext);
    }

    String jobName = jobExecutionContext.getJobDetail().getKey().getName();
    if (jobName.equals(ON_DEMAND_JOB)) {
      Map<String, Object> jsonAppConfig =
          JsonUtils.convertValue(jobData, new TypeReference<Map<String, Object>>() {});
      getApp().setAppConfiguration(jsonAppConfig);
    }
  }

  private EventPublisherJob loadJobData(JobExecutionContext jobExecutionContext) {
    String appConfigJson =
        (String) jobExecutionContext.getJobDetail().getJobDataMap().get(APP_CONFIG);
    if (appConfigJson != null) {
      return JsonUtils.readValue(appConfigJson, EventPublisherJob.class);
    }

    if (getApp() != null && getApp().getAppConfiguration() != null) {
      return JsonUtils.convertValue(getApp().getAppConfiguration(), EventPublisherJob.class);
    }

    throw new AppException("JobData is not initialized");
  }

  private void runCacheWarmup(JobExecutionContext jobExecutionContext) throws Exception {
    setupEntities();
    LOG.info("Cache Warmup Job Started for Entities: {}", jobData.getEntities());

    // Try to acquire distributed lock for cache warmup
    if (!acquireWarmupLock()) {
      LOG.info("Another cache warmup job is already running on a different server. Skipping.");
      jobData.setStatus(EventPublisherJob.Status.STOPPED);
      return;
    }

    try {
      initializeJob(jobExecutionContext);
      updateJobStatus(EventPublisherJob.Status.RUNNING);
      performCacheWarmup();
      updateFinalJobStatus();
      handleJobCompletion();
      // Send final status update to persist the completed state
      sendUpdates(jobExecutionContext, true);
    } finally {
      releaseWarmupLock();
    }
  }

  private void setupEntities() {
    boolean containsAll = jobData.getEntities().contains(ALL);
    if (containsAll) {
      jobData.setEntities(getAll());
    }
  }

  private void initializeJob(JobExecutionContext jobExecutionContext) {
    cleanUpStaleJobsFromRuns();

    LOG.debug("Executing Cache Warmup Job with JobData: {}", jobData);
    updateJobStatus(EventPublisherJob.Status.RUNNING);

    cacheWarmupStats.set(initializeTotalRecords(jobData.getEntities()));
    jobData.setStats(cacheWarmupStats.get());

    if (jobData.getBatchSize() == null) {
      jobData.setBatchSize(DEFAULT_BATCH_SIZE);
    }
    batchSize.set(jobData.getBatchSize());

    sendUpdates(jobExecutionContext, true);
  }

  private void cleanUpStaleJobsFromRuns() {
    try {
      App app = getApp();
      if (app != null && app.getId() != null) {
        collectionDAO.appExtensionTimeSeriesDao().markStaleEntriesStopped(app.getId().toString());
        LOG.debug("Cleaned up stale cache warmup jobs.");
      }
    } catch (Exception ex) {
      LOG.error("Failed in marking stale entries as stopped.", ex);
    }
  }

  private void performCacheWarmup() throws InterruptedException {
    long totalEntities = cacheWarmupStats.get().getJobStats().getTotalRecords();

    ThreadConfiguration threadConfig = calculateThreadConfiguration(totalEntities);
    initializeQueueAndExecutors(threadConfig);
    executeWarmup(threadConfig.numConsumers);
  }

  private ThreadConfiguration calculateThreadConfiguration(long totalEntities) {
    int numConsumers =
        jobData.getConsumerThreads() != null
            ? Math.min(jobData.getConsumerThreads(), MAX_CONSUMER_THREADS)
            : 4;
    int numProducers = Math.clamp((int) (totalEntities / 5000), 2, MAX_PRODUCER_THREADS);

    return adjustThreadsForLimit(numProducers, numConsumers);
  }

  private ThreadConfiguration adjustThreadsForLimit(int numProducers, int numConsumers) {
    int totalThreads = numProducers + numConsumers + jobData.getEntities().size();
    if (totalThreads > MAX_TOTAL_THREADS) {
      double ratio = (double) MAX_TOTAL_THREADS / totalThreads;
      numProducers = Math.max(1, (int) (numProducers * ratio));
      numConsumers = Math.max(1, (int) (numConsumers * ratio));
    }
    return new ThreadConfiguration(numProducers, numConsumers);
  }

  private void initializeQueueAndExecutors(ThreadConfiguration threadConfig) {
    int queueSize = jobData.getQueueSize() != null ? jobData.getQueueSize() : DEFAULT_QUEUE_SIZE;

    taskQueue = new LinkedBlockingQueue<>(queueSize);
    producersDone.set(false);

    jobExecutor =
        Executors.newFixedThreadPool(
            jobData.getEntities().size(), Thread.ofPlatform().name("warmup-job-", 0).factory());
    consumerExecutor =
        Executors.newFixedThreadPool(
            threadConfig.numConsumers, Thread.ofPlatform().name("warmup-consumer-", 0).factory());
    producerExecutor =
        Executors.newFixedThreadPool(
            threadConfig.numProducers, Thread.ofPlatform().name("warmup-producer-", 0).factory());
  }

  private void executeWarmup(int numConsumers) throws InterruptedException {
    CountDownLatch consumerLatch = startConsumerThreads(numConsumers);

    try {
      processEntityWarmup();
      signalConsumersToStop(numConsumers);
      waitForConsumersToComplete(consumerLatch);
    } catch (InterruptedException e) {
      stopped = true;
      Thread.currentThread().interrupt();
      throw e;
    } finally {
      cleanupExecutors();
    }
  }

  private CountDownLatch startConsumerThreads(int numConsumers) {
    CountDownLatch consumerLatch = new CountDownLatch(numConsumers);
    for (int i = 0; i < numConsumers; i++) {
      final int consumerId = i;
      consumerExecutor.submit(() -> runConsumer(consumerId, consumerLatch));
    }
    return consumerLatch;
  }

  private void runConsumer(int consumerId, CountDownLatch consumerLatch) {
    LOG.debug("Consumer {} started", consumerId);
    try {
      while (!stopped && (!producersDone.get() || !taskQueue.isEmpty())) {
        try {
          WarmupTask task = taskQueue.poll(100, TimeUnit.MILLISECONDS);
          if (task != null && !POISON_PILL.equals(task.entityType())) {
            processWarmupTask(task);
          }
        } catch (InterruptedException e) {
          Thread.currentThread().interrupt();
          break;
        }
      }
    } finally {
      LOG.debug("Consumer {} finished", consumerId);
      consumerLatch.countDown();
    }
  }

  private void processWarmupTask(WarmupTask task) {
    String entityType = task.entityType();
    ResultList<? extends EntityInterface> entities = task.entities();

    long startTime = System.currentTimeMillis();
    int successCount = 0;
    int failedCount = 0;

    for (EntityInterface entity : entities.getData()) {
      try {
        boolean success = warmupEntity(entityType, entity);
        if (success) {
          successCount++;
        }
        // Note: Not counting skipped entities (deleted, invalid) as failures
      } catch (Exception e) {
        LOG.debug("Error warming up entity {} {}: {}", entityType, entity.getId(), e.getMessage());
        failedCount++;
      }
    }

    long processingTime = System.currentTimeMillis() - startTime;
    totalProcessingTime.addAndGet(processingTime);
    totalEntitiesProcessed.addAndGet(successCount);

    StepStats entityStats =
        new StepStats().withSuccessRecords(successCount).withFailedRecords(failedCount);
    updateStats(entityType, entityStats);

    sendUpdates(jobExecutionContext);
  }

  private boolean warmupEntity(String entityType, EntityInterface entity) throws Exception {
    // Skip caching user entities
    if ("user".equals(entityType)) {
      return false; // Not cached, but not an error
    }

    // Validate entity has required fields before caching
    if (entity.getId() == null) {
      LOG.warn("Skipping entity with null ID - Type: {}, Name: {}", entityType, entity.getName());
      return false; // Skip this entity and continue with others
    }

    EntityRepository<?> repository = Entity.getEntityRepository(entityType);

    // Use find method instead of get to avoid UriInfo requirement
    EntityInterface fullEntity = repository.find(entity.getId(), Include.ALL);

    // Validate the full entity before caching
    if (fullEntity == null || fullEntity.getId() == null) {
      LOG.warn(
          "Failed to load full entity - Type: {}, ID: {}, Name: {}. Skipping.",
          entityType,
          entity.getId(),
          entity.getName());
      return false; // Skip this entity and continue with others
    }

    // Cache the entity - this triggers write-through caching
    String entityJson = JsonUtils.pojoToJson(fullEntity);
    cachedEntityDao.putBase(entityType, fullEntity.getId(), entityJson);
    cachedEntityDao.putByName(entityType, fullEntity.getFullyQualifiedName(), entityJson);

    // Cache entity reference
    String refJson = JsonUtils.pojoToJson(fullEntity.getEntityReference());
    cachedEntityDao.putReference(entityType, fullEntity.getId(), refJson);
    cachedEntityDao.putReferenceByName(entityType, fullEntity.getFullyQualifiedName(), refJson);

    // Cache tags if available (stored in entity hash)
    if (fullEntity.getTags() != null && !fullEntity.getTags().isEmpty()) {
      String tagsJson = JsonUtils.pojoToJson(fullEntity.getTags());
      cachedTagUsageDao.putTags(entityType, entity.getId(), tagsJson);
    }

    return true; // Successfully cached the entity
  }

  private void signalConsumersToStop(int numConsumers) {
    producersDone.set(true);
    for (int i = 0; i < numConsumers; i++) {
      taskQueue.offer(new WarmupTask(POISON_PILL, null, -1));
    }
  }

  private void waitForConsumersToComplete(CountDownLatch consumerLatch)
      throws InterruptedException {
    boolean finished = consumerLatch.await(5, TimeUnit.MINUTES);
    if (!finished) {
      LOG.warn("Consumers did not finish within timeout");
    }
  }

  private void processEntityWarmup() throws InterruptedException {
    int latchCount = getTotalLatchCount(jobData.getEntities());
    CountDownLatch producerLatch = new CountDownLatch(latchCount);

    for (String entityType : jobData.getEntities()) {
      jobExecutor.submit(() -> processEntityType(entityType, producerLatch));
    }

    while (!producerLatch.await(1, TimeUnit.SECONDS)) {
      if (stopped || Thread.currentThread().isInterrupted()) {
        LOG.info("Stop signal received during warmup");
        producerExecutor.shutdownNow();
        jobExecutor.shutdownNow();
        return;
      }
    }
  }

  private void processEntityType(String entityType, CountDownLatch producerLatch) {
    try {
      int totalEntityRecords = getTotalEntityRecords(entityType);
      int loadPerThread = calculateNumberOfThreads(totalEntityRecords);

      if (totalEntityRecords > 0) {
        for (int i = 0; i < loadPerThread; i++) {
          int currentOffset = i * batchSize.get();
          producerExecutor.submit(() -> processBatch(entityType, currentOffset, producerLatch));
        }
      }
    } catch (Exception e) {
      LOG.error("Error processing entity type {}", entityType, e);
    }
  }

  private void processBatch(String entityType, int currentOffset, CountDownLatch producerLatch) {
    try {
      if (stopped) {
        return;
      }

      // Request essential fields to ensure entities are properly deserialized with IDs
      Source<?> source =
          new PaginatedEntitiesSource(
              entityType,
              batchSize.get(),
              List.of("id", "name", "fullyQualifiedName", "version", "updatedAt", "updatedBy"));
      // Properly encode the offset as a cursor like SearchIndexApp does
      Object resultList =
          source.readWithCursor(RestUtil.encodeCursor(String.valueOf(currentOffset)));

      if (resultList != null) {
        @SuppressWarnings("unchecked")
        ResultList<? extends EntityInterface> entities =
            (ResultList<? extends EntityInterface>) resultList;

        if (!nullOrEmpty(entities.getData()) && !stopped) {
          WarmupTask task = new WarmupTask(entityType, entities, currentOffset);
          taskQueue.put(task);
        }
      }
    } catch (Exception e) {
      if (!stopped) {
        LOG.error("Error processing batch for entity type {}", entityType, e);
      }
    } finally {
      producerLatch.countDown();
    }
  }

  private void cleanupExecutors() {
    shutdownExecutor(consumerExecutor, "ConsumerExecutor", 30, TimeUnit.SECONDS);
    shutdownExecutor(jobExecutor, "JobExecutor", 20, TimeUnit.SECONDS);
    shutdownExecutor(producerExecutor, "ProducerExecutor", 1, TimeUnit.MINUTES);
  }

  private void shutdownExecutor(
      ExecutorService executor, String name, long timeout, TimeUnit unit) {
    if (executor != null && !executor.isShutdown()) {
      executor.shutdown();
      try {
        if (!executor.awaitTermination(timeout, unit)) {
          executor.shutdownNow();
          LOG.warn("{} did not terminate within timeout.", name);
        } else {
          LOG.info("{} terminated successfully.", name);
        }
      } catch (InterruptedException e) {
        LOG.error("Interrupted while waiting for {} to terminate.", name, e);
        executor.shutdownNow();
        Thread.currentThread().interrupt();
      }
    }
  }

  private void handleExecutionException(Exception ex) {
    LOG.error("Cache Warmup Job Failed", ex);
    if (jobData != null) {
      jobData.setStatus(EventPublisherJob.Status.FAILED);
    }
  }

  private void finalizeJobExecution(JobExecutionContext jobExecutionContext) {
    sendUpdates(jobExecutionContext, true);
  }

  private void updateFinalJobStatus() {
    if (stopped) {
      updateJobStatus(EventPublisherJob.Status.STOPPED);
    } else if (hasIncompleteProcessing()) {
      updateJobStatus(EventPublisherJob.Status.ACTIVE_ERROR);
    } else {
      updateJobStatus(EventPublisherJob.Status.COMPLETED);
    }
  }

  private boolean hasIncompleteProcessing() {
    if (jobData == null || jobData.getStats() == null || jobData.getStats().getJobStats() == null) {
      return false;
    }

    StepStats jobStats = jobData.getStats().getJobStats();
    long failed = jobStats.getFailedRecords() != null ? jobStats.getFailedRecords() : 0;
    long processed = jobStats.getSuccessRecords() != null ? jobStats.getSuccessRecords() : 0;
    long total = jobStats.getTotalRecords() != null ? jobStats.getTotalRecords() : 0;

    return failed > 0 || (total > 0 && processed < total);
  }

  private void handleJobCompletion() {
    if (jobData != null && jobData.getStats() != null) {
      StepStats jobStats = jobData.getStats().getJobStats();
      LOG.info(
          "Cache Warmup Job Completed - Total: {}, Success: {}, Failed: {}",
          jobStats.getTotalRecords(),
          jobStats.getSuccessRecords(),
          jobStats.getFailedRecords());

      if (currentThroughput > 0) {
        LOG.info("Average throughput: {:.1f} entities/sec", currentThroughput);
      }
    }
  }

  private void updateJobStatus(EventPublisherJob.Status newStatus) {
    if (jobData != null) {
      jobData.setStatus(newStatus);
    }
  }

  @Override
  public void stop() {
    LOG.info("Cache warmup job is being stopped.");
    stopped = true;

    if (jobData != null) {
      jobData.setStatus(EventPublisherJob.Status.STOPPED);
    }

    if (producerExecutor != null) {
      producerExecutor.shutdownNow();
    }
    if (consumerExecutor != null) {
      consumerExecutor.shutdownNow();
    }
    if (jobExecutor != null) {
      jobExecutor.shutdownNow();
    }

    if (taskQueue != null) {
      taskQueue.clear();
    }

    // Release the distributed lock when stopping
    releaseWarmupLock();

    LOG.info("Cache warmup job stopped successfully.");
  }

  @Override
  protected void validateConfig(Map<String, Object> appConfig) {
    try {
      JsonUtils.convertValue(appConfig, EventPublisherJob.class);
    } catch (IllegalArgumentException e) {
      throw AppException.byMessage(
          jakarta.ws.rs.core.Response.Status.BAD_REQUEST,
          "Invalid App Configuration: " + e.getMessage());
    }
  }

  public void updateRecordToDbAndNotify(JobExecutionContext jobExecutionContext) {
    try {
      // Check if scheduler is available (null in test contexts)
      if (jobExecutionContext == null || jobExecutionContext.getScheduler() == null) {
        LOG.debug("Scheduler not available, skipping DB update");
        return;
      }

      // Try to get the job record - this will fail in test environments without listener
      AppRunRecord appRecord = null;
      try {
        appRecord = getJobRecord(jobExecutionContext);
      } catch (Exception e) {
        // In test environments, the listener may not be available - this is expected
        LOG.debug(
            "Unable to get job record - likely running in test environment: {}", e.getMessage());
        return;
      }

      if (appRecord != null) {
        appRecord.setStatus(AppRunRecord.Status.fromValue(jobData.getStatus().value()));
        if (jobData.getFailure() != null) {
          appRecord.setFailureContext(
              new FailureContext().withAdditionalProperty("failure", jobData.getFailure()));
        }
        if (jobData.getStats() != null) {
          SuccessContext successContext =
              new SuccessContext().withAdditionalProperty("stats", jobData.getStats());

          // Add detailed progress metrics
          if (jobData.getStats().getJobStats() != null) {
            StepStats jobStats = jobData.getStats().getJobStats();
            long total = jobStats.getTotalRecords() != null ? jobStats.getTotalRecords() : 0;
            long processed =
                jobStats.getSuccessRecords() != null ? jobStats.getSuccessRecords() : 0;
            long failed = jobStats.getFailedRecords() != null ? jobStats.getFailedRecords() : 0;

            if (total > 0) {
              double progressPercentage = (processed + failed) * 100.0 / total;
              successContext.withAdditionalProperty("progressPercentage", progressPercentage);
            }

            if (currentThroughput > 0) {
              successContext.withAdditionalProperty(
                  "throughput", String.format("%.1f entities/sec", currentThroughput));
            }

            successContext.withAdditionalProperty("entitiesProcessed", processed + failed);
            successContext.withAdditionalProperty("totalEntities", total);
          }

          appRecord.setSuccessContext(successContext);
        }

        // Use the parent class method to properly update and persist the record
        pushAppStatusUpdates(jobExecutionContext, appRecord, true);

        // Also broadcast via WebSocket for real-time updates
        if (WebSocketManager.getInstance() != null) {
          String messageJson = JsonUtils.pojoToJson(appRecord);
          WebSocketManager.getInstance()
              .broadCastMessageToAll(CACHE_WARMUP_JOB_BROADCAST_CHANNEL, messageJson);
        }
      }
    } catch (Exception e) {
      // Only log at debug level for expected test environment issues
      if (e.getMessage() != null && e.getMessage().contains("listener\" is null")) {
        LOG.debug("Running in test environment without OmAppJobListener: {}", e.getMessage());
      } else {
        LOG.warn("Failed to update record to DB and notify: {}", e.getMessage());
      }
    }
  }

  private void sendUpdates(JobExecutionContext jobExecutionContext) {
    sendUpdates(jobExecutionContext, false);
  }

  private void sendUpdates(JobExecutionContext jobExecutionContext, boolean forceUpdate) {
    try {
      long currentTime = System.currentTimeMillis();
      if (!forceUpdate && (currentTime - lastWebSocketUpdate < WEBSOCKET_UPDATE_INTERVAL_MS)) {
        return;
      }

      lastWebSocketUpdate = currentTime;
      updateThroughputMetrics();

      jobExecutionContext.getJobDetail().getJobDataMap().put(APP_RUN_STATS, jobData.getStats());
      jobExecutionContext
          .getJobDetail()
          .getJobDataMap()
          .put(WEBSOCKET_STATUS_CHANNEL, CACHE_WARMUP_JOB_BROADCAST_CHANNEL);
      updateRecordToDbAndNotify(jobExecutionContext);
    } catch (Exception ex) {
      LOG.error("Failed to send updated stats with WebSocket", ex);
    }
  }

  private void updateThroughputMetrics() {
    long processedEntities = totalEntitiesProcessed.get();
    long processingTime = totalProcessingTime.get();
    if (processingTime > 0) {
      currentThroughput = (processedEntities * 1000.0) / processingTime;
    }
  }

  private Stats initializeTotalRecords(Set<String> entities) {
    Stats stats = new Stats();
    stats.setEntityStats(new EntityStats());

    int total = 0;
    for (String entityType : entities) {
      int entityTotal = getEntityTotal(entityType);
      total += entityTotal;

      StepStats entityStats = new StepStats();
      entityStats.setTotalRecords(entityTotal);
      entityStats.setSuccessRecords(0);
      entityStats.setFailedRecords(0);

      stats.getEntityStats().getAdditionalProperties().put(entityType, entityStats);
    }

    StepStats jobStats = new StepStats();
    jobStats.setTotalRecords(total);
    stats.setJobStats(jobStats);

    return stats;
  }

  private int getEntityTotal(String entityType) {
    try {
      EntityRepository<?> repository = Entity.getEntityRepository(entityType);
      return repository.getDao().listTotalCount();
    } catch (Exception e) {
      LOG.debug("Error while getting total entities for '{}'", entityType, e);
      return 0;
    }
  }

  private Set<String> getAll() {
    return new HashSet<>(Entity.getEntityList());
  }

  private int getTotalLatchCount(Set<String> entities) {
    return entities.stream()
        .mapToInt(
            entityType -> {
              int totalRecords = getTotalEntityRecords(entityType);
              return calculateNumberOfThreads(totalRecords);
            })
        .sum();
  }

  private int getTotalEntityRecords(String entityType) {
    if (cacheWarmupStats.get() == null || cacheWarmupStats.get().getEntityStats() == null) {
      return 0;
    }

    StepStats statsObj =
        cacheWarmupStats.get().getEntityStats().getAdditionalProperties().get(entityType);
    if (statsObj != null) {
      return statsObj.getTotalRecords() != null ? statsObj.getTotalRecords() : 0;
    }
    return 0;
  }

  private int calculateNumberOfThreads(int totalEntityRecords) {
    int mod = totalEntityRecords % batchSize.get();
    if (mod == 0) {
      return totalEntityRecords / batchSize.get();
    } else {
      return (totalEntityRecords / batchSize.get()) + 1;
    }
  }

  synchronized void updateStats(String entityType, StepStats currentEntityStats) {
    Stats stats = cacheWarmupStats.get();
    if (stats == null) {
      return;
    }

    updateEntityStats(stats, entityType, currentEntityStats);
    updateJobStats(stats);
    cacheWarmupStats.set(stats);
    jobData.setStats(stats);
  }

  private void updateEntityStats(Stats stats, String entityType, StepStats currentEntityStats) {
    StepStats entityStats = stats.getEntityStats().getAdditionalProperties().get(entityType);
    if (entityStats != null) {
      entityStats.withSuccessRecords(
          entityStats.getSuccessRecords() + currentEntityStats.getSuccessRecords());
      entityStats.withFailedRecords(
          entityStats.getFailedRecords() + currentEntityStats.getFailedRecords());
    }
  }

  private void updateJobStats(Stats stats) {
    StepStats jobStats = stats.getJobStats();

    int totalSuccess =
        stats.getEntityStats().getAdditionalProperties().values().stream()
            .mapToInt(StepStats::getSuccessRecords)
            .sum();

    int totalFailed =
        stats.getEntityStats().getAdditionalProperties().values().stream()
            .mapToInt(StepStats::getFailedRecords)
            .sum();

    jobStats.withSuccessRecords(totalSuccess).withFailedRecords(totalFailed);
  }

  private static class ThreadConfiguration {
    final int numProducers;
    final int numConsumers;

    ThreadConfiguration(int numProducers, int numConsumers) {
      this.numProducers = numProducers;
      this.numConsumers = numConsumers;
    }
  }

  /**
   * Tries to acquire a distributed lock using Redis to ensure only one instance
   * of the cache warmup job runs across all OpenMetadata servers.
   */
  private boolean acquireWarmupLock() {
    if (cacheProvider == null) {
      LOG.warn("Cache provider not available, cannot acquire distributed lock");
      return false;
    }

    try {
      String lockValue = generateLockValue();
      // Use Redis SET NX (set if not exists) with expiration for distributed locking
      boolean acquired =
          cacheProvider.setIfAbsent(
              WARMUP_LOCK_KEY, lockValue, java.time.Duration.ofSeconds(LOCK_TTL_SECONDS));

      if (acquired) {
        LOG.info("Successfully acquired cache warmup lock with value: {}", lockValue);
        // Store lock value for verification during release
        jobExecutionContext.getJobDetail().getJobDataMap().put("lockValue", lockValue);
        return true;
      } else {
        // Check if existing lock is expired (stale)
        java.util.Optional<String> existingLock = cacheProvider.get(WARMUP_LOCK_KEY);
        if (existingLock.isPresent()) {
          LOG.info("Cache warmup is already running with lock: {}", existingLock.get());
        }
        return false;
      }
    } catch (Exception e) {
      LOG.error("Failed to acquire warmup lock", e);
      return false;
    }
  }

  /**
   * Releases the distributed lock after cache warmup completes.
   */
  private void releaseWarmupLock() {
    if (cacheProvider == null) {
      return;
    }

    try {
      String expectedLockValue =
          (String) jobExecutionContext.getJobDetail().getJobDataMap().get("lockValue");

      if (expectedLockValue != null) {
        // Only release if we own the lock (compare-and-delete pattern)
        java.util.Optional<String> currentLock = cacheProvider.get(WARMUP_LOCK_KEY);
        if (currentLock.isPresent() && currentLock.get().equals(expectedLockValue)) {
          cacheProvider.del(WARMUP_LOCK_KEY);
          LOG.info("Released cache warmup lock: {}", expectedLockValue);
        } else {
          LOG.warn(
              "Lock value mismatch, not releasing lock. Expected: {}, Current: {}",
              expectedLockValue,
              currentLock.orElse("none"));
        }
      }
    } catch (Exception e) {
      LOG.error("Failed to release warmup lock", e);
    }
  }

  /**
   * Generates a unique lock value containing server instance information.
   */
  private String generateLockValue() {
    try {
      String hostname = java.net.InetAddress.getLocalHost().getHostName();
      String timestamp = String.valueOf(System.currentTimeMillis());
      String threadId = String.valueOf(Thread.currentThread().getId());
      return String.format("%s:%s:%s", hostname, timestamp, threadId);
    } catch (Exception e) {
      // Fallback to a random UUID if hostname cannot be determined
      return java.util.UUID.randomUUID().toString();
    }
  }
}
