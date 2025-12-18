package org.openmetadata.service.apps.bundles.rdf;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.service.apps.scheduler.AppScheduler.ON_DEMAND_JOB;
import static org.openmetadata.service.apps.scheduler.OmAppJobListener.APP_CONFIG;
import static org.openmetadata.service.apps.scheduler.OmAppJobListener.APP_RUN_STATS;
import static org.openmetadata.service.apps.scheduler.OmAppJobListener.WEBSOCKET_STATUS_CHANNEL;
import static org.openmetadata.service.socket.WebSocketManager.RDF_INDEX_JOB_BROADCAST_CHANNEL;

import jakarta.ws.rs.core.Response;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicReference;
import java.util.stream.Collectors;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.app.App;
import org.openmetadata.schema.entity.app.AppRunRecord;
import org.openmetadata.schema.entity.app.FailureContext;
import org.openmetadata.schema.entity.app.SuccessContext;
import org.openmetadata.schema.system.EntityStats;
import org.openmetadata.schema.system.EventPublisherJob;
import org.openmetadata.schema.system.IndexingError;
import org.openmetadata.schema.system.Stats;
import org.openmetadata.schema.system.StepStats;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.LineageDetails;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.apps.AbstractNativeApplication;
import org.openmetadata.service.exception.AppException;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.CollectionDAO.EntityRelationshipObject;
import org.openmetadata.service.jdbi3.EntityDAO;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.rdf.RdfRepository;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.socket.WebSocketManager;
import org.openmetadata.service.util.RestUtil;
import org.quartz.JobExecutionContext;

@Slf4j
public class RdfIndexApp extends AbstractNativeApplication {
  private static final String ALL = "all";
  private static final String POISON_PILL = "__POISON_PILL__";
  private static final int DEFAULT_BATCH_SIZE = 100;
  private static final int DEFAULT_QUEUE_SIZE = 5000;
  private static final int MAX_PRODUCER_THREADS = 10;
  private static final int MAX_CONSUMER_THREADS = 5;
  private static final long WEBSOCKET_UPDATE_INTERVAL_MS = 2000;

  private static final List<Integer> ALL_RELATIONSHIPS =
      java.util.Arrays.stream(Relationship.values())
          .map(Relationship::ordinal)
          .collect(Collectors.toList());

  private final RdfRepository rdfRepository;
  private volatile boolean stopped = false;
  private volatile long lastWebSocketUpdate = 0;

  @Getter private EventPublisherJob jobData;
  private ExecutorService producerExecutor;
  private ExecutorService consumerExecutor;
  private ExecutorService jobExecutor;
  private JobExecutionContext jobExecutionContext;
  private final AtomicReference<Stats> rdfIndexStats = new AtomicReference<>();
  private final AtomicBoolean producersDone = new AtomicBoolean(false);
  private BlockingQueue<IndexingTask> taskQueue;

  record IndexingTask(
      String entityType, List<? extends EntityInterface> entities, int offset, int retryCount) {
    IndexingTask(String entityType, List<? extends EntityInterface> entities, int offset) {
      this(entityType, entities, offset, 0);
    }

    boolean isPoisonPill() {
      return POISON_PILL.equals(entityType);
    }
  }

  public RdfIndexApp(CollectionDAO collectionDAO, SearchRepository searchRepository) {
    super(collectionDAO, searchRepository);
    this.rdfRepository = RdfRepository.getInstance();
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
    producersDone.set(false);

    if (jobData == null) {
      String appConfigJson =
          (String) jobExecutionContext.getJobDetail().getJobDataMap().get(APP_CONFIG);
      if (appConfigJson != null) {
        jobData = JsonUtils.readValue(appConfigJson, EventPublisherJob.class);
      } else if (getApp() != null && getApp().getAppConfiguration() != null) {
        jobData = JsonUtils.convertValue(getApp().getAppConfiguration(), EventPublisherJob.class);
      } else {
        LOG.error("Unable to initialize jobData from JobDataMap or App configuration");
        throw new IllegalStateException("JobData is not initialized");
      }
    }

    if (!rdfRepository.isEnabled()) {
      LOG.error("RDF Repository is not enabled. Please enable RDF in configuration.");
      updateJobStatus(EventPublisherJob.Status.FAILED);
      jobData.setFailure(
          new IndexingError()
              .withErrorSource(IndexingError.ErrorSource.JOB)
              .withMessage("RDF Repository is not enabled"));
      sendUpdates(jobExecutionContext, true);
      return;
    }

    String jobName = jobExecutionContext.getJobDetail().getKey().getName();
    if (jobName.equals(ON_DEMAND_JOB)) {
      Map<String, Object> jsonAppConfig = JsonUtils.convertValue(jobData, Map.class);
      getApp().setAppConfiguration(jsonAppConfig);
    }

    try {
      boolean containsAll = jobData.getEntities().contains(ALL);
      if (containsAll) {
        jobData.setEntities(getAll());
      }

      LOG.info(
          "RDF Index Job Started for Entities: {}, RecreateIndex: {}",
          jobData.getEntities(),
          jobData.getRecreateIndex());

      initializeJob(jobExecutionContext);

      if (Boolean.TRUE.equals(jobData.getRecreateIndex())) {
        LOG.info("Clearing existing RDF data");
        clearRdfData();
      }

      updateJobStatus(EventPublisherJob.Status.RUNNING);
      reIndexFromStartToEnd();

      if (stopped) {
        updateJobStatus(EventPublisherJob.Status.STOPPED);
      } else {
        updateJobStatus(EventPublisherJob.Status.COMPLETED);
      }

      LOG.info("RDF Index Job Completed for Entities: {}", jobData.getEntities());
    } catch (Exception ex) {
      if (stopped) {
        LOG.info("RDF Index Job Stopped for Entities: {}", jobData.getEntities());
        jobData.setStatus(EventPublisherJob.Status.STOPPED);
      } else {
        handleJobFailure(ex);
      }
    } finally {
      sendUpdates(jobExecutionContext, true);
      cleanupExecutors();
    }
  }

  private void initializeJob(JobExecutionContext jobExecutionContext) {
    LOG.debug("Executing RDF Indexing Job with JobData: {}", jobData);
    updateJobStatus(EventPublisherJob.Status.RUNNING);

    LOG.debug("Initializing job statistics.");
    rdfIndexStats.set(initializeTotalRecords(jobData.getEntities()));
    jobData.setStats(rdfIndexStats.get());

    int queueSize = jobData.getQueueSize() != null ? jobData.getQueueSize() : DEFAULT_QUEUE_SIZE;
    int effectiveQueueSize = calculateMemoryAwareQueueSize(queueSize);
    taskQueue = new LinkedBlockingQueue<>(effectiveQueueSize);
    LOG.info("Initialized task queue with size: {}", effectiveQueueSize);

    sendUpdates(jobExecutionContext, true);
  }

  private int calculateMemoryAwareQueueSize(int requestedSize) {
    Runtime runtime = Runtime.getRuntime();
    long maxMemory = runtime.maxMemory();
    long estimatedEntitySize = 10 * 1024L;
    int batchSize = jobData.getBatchSize() != null ? jobData.getBatchSize() : DEFAULT_BATCH_SIZE;
    long maxQueueMemory = (long) (maxMemory * 0.15);
    int memoryBasedLimit = (int) (maxQueueMemory / (estimatedEntitySize * batchSize));
    return Math.min(requestedSize, Math.max(100, memoryBasedLimit));
  }

  private void clearRdfData() {
    try {
      rdfRepository.clearAll();
      LOG.info("Cleared all RDF data");
    } catch (Exception e) {
      LOG.error("Failed to clear RDF data", e);
      throw new RuntimeException("Failed to clear RDF data", e);
    }
  }

  private void reIndexFromStartToEnd() throws InterruptedException {
    long totalEntities = rdfIndexStats.get().getJobStats().getTotalRecords();
    int numProducers = Math.clamp((int) (totalEntities / 5000), 2, MAX_PRODUCER_THREADS);
    int numConsumers =
        jobData.getConsumerThreads() != null
            ? Math.min(jobData.getConsumerThreads(), MAX_CONSUMER_THREADS)
            : Math.min(3, MAX_CONSUMER_THREADS);

    LOG.info(
        "Starting RDF indexing with {} producer threads, {} consumer threads",
        numProducers,
        numConsumers);

    jobExecutor =
        Executors.newFixedThreadPool(
            jobData.getEntities().size(), Thread.ofPlatform().name("rdf-job-", 0).factory());
    producerExecutor =
        Executors.newFixedThreadPool(
            numProducers, Thread.ofPlatform().name("rdf-producer-", 0).factory());
    consumerExecutor =
        Executors.newFixedThreadPool(
            numConsumers, Thread.ofPlatform().name("rdf-consumer-", 0).factory());

    CountDownLatch consumerLatch = new CountDownLatch(numConsumers);
    for (int i = 0; i < numConsumers; i++) {
      final int consumerId = i;
      consumerExecutor.submit(() -> runConsumer(consumerId, consumerLatch));
    }

    try {
      processEntityTypes();
      signalConsumersToStop(numConsumers);
      consumerLatch.await();
      LOG.info("All consumers have finished processing tasks");
    } catch (InterruptedException e) {
      LOG.info("Reindexing interrupted - stopping immediately");
      stopped = true;
      Thread.currentThread().interrupt();
      throw e;
    }
  }

  private void runConsumer(int consumerId, CountDownLatch consumerLatch) {
    LOG.info("Consumer {} started", consumerId);
    try {
      while (!stopped && (!producersDone.get() || !taskQueue.isEmpty())) {
        try {
          IndexingTask task = taskQueue.poll(100, TimeUnit.MILLISECONDS);
          if (task != null && !task.isPoisonPill()) {
            processTask(task);
          }
        } catch (InterruptedException e) {
          Thread.currentThread().interrupt();
          break;
        }
      }
    } finally {
      LOG.info("Consumer {} stopped", consumerId);
      consumerLatch.countDown();
    }
  }

  private void processTask(IndexingTask task) {
    String entityType = task.entityType();
    List<? extends EntityInterface> entities = task.entities();

    if (entities == null || entities.isEmpty()) {
      return;
    }

    int successCount = 0;
    int failedCount = 0;

    try {
      for (EntityInterface entity : entities) {
        if (stopped) {
          break;
        }
        try {
          rdfRepository.createOrUpdate(entity);
          successCount++;
        } catch (Exception e) {
          LOG.error("Failed to index entity {} to RDF", entity.getId(), e);
          failedCount++;
        }
      }

      processBatchRelationships(entityType, entities);

      StepStats currentStats =
          new StepStats().withSuccessRecords(successCount).withFailedRecords(failedCount);
      updateEntityStats(entityType, currentStats);
      sendUpdates(jobExecutionContext, false);

    } catch (Exception e) {
      LOG.error("Error processing batch for entity type {}", entityType, e);
      updateEntityStats(
          entityType,
          new StepStats()
              .withSuccessRecords(successCount)
              .withFailedRecords(entities.size() - successCount));
    }
  }

  private void processBatchRelationships(
      String entityType, List<? extends EntityInterface> entities) {
    if (entities.isEmpty()) {
      return;
    }

    List<String> entityIds =
        entities.stream().map(e -> e.getId().toString()).collect(Collectors.toList());

    try {
      List<EntityRelationshipObject> outgoingRelationships =
          collectionDAO
              .relationshipDAO()
              .findToBatchWithRelations(entityIds, entityType, ALL_RELATIONSHIPS);

      List<EntityRelationshipObject> incomingLineage =
          collectionDAO
              .relationshipDAO()
              .findFromBatch(entityIds, Relationship.UPSTREAM.ordinal(), Include.ALL);

      List<org.openmetadata.schema.type.EntityRelationship> allRelationships = new ArrayList<>();

      for (EntityRelationshipObject rel : outgoingRelationships) {
        if (rel.getRelation() == Relationship.UPSTREAM.ordinal() && rel.getJson() != null) {
          processLineageRelationship(rel);
        } else {
          allRelationships.add(convertToEntityRelationship(rel));
        }
      }

      for (EntityRelationshipObject rel : incomingLineage) {
        if (rel.getJson() != null) {
          processLineageRelationship(rel);
        } else {
          allRelationships.add(convertToEntityRelationship(rel));
        }
      }

      if (!allRelationships.isEmpty()) {
        rdfRepository.bulkAddRelationships(allRelationships);
        LOG.debug(
            "Bulk added {} relationships for {} entities",
            allRelationships.size(),
            entities.size());
      }

    } catch (Exception e) {
      LOG.error("Failed to process batch relationships for entity type {}", entityType, e);
    }
  }

  private void processLineageRelationship(EntityRelationshipObject rel) {
    try {
      UUID fromId = UUID.fromString(rel.getFromId());
      UUID toId = UUID.fromString(rel.getToId());
      LineageDetails lineageDetails = JsonUtils.readValue(rel.getJson(), LineageDetails.class);
      rdfRepository.addLineageWithDetails(
          rel.getFromEntity(), fromId, rel.getToEntity(), toId, lineageDetails);
      LOG.debug(
          "Added lineage with details from {}/{} to {}/{}",
          rel.getFromEntity(),
          fromId,
          rel.getToEntity(),
          toId);
    } catch (Exception e) {
      LOG.debug("Failed to parse lineage details, falling back to basic relationship", e);
      try {
        rdfRepository.addRelationship(convertToEntityRelationship(rel));
      } catch (Exception ex) {
        LOG.debug("Failed to add basic lineage relationship", ex);
      }
    }
  }

  private org.openmetadata.schema.type.EntityRelationship convertToEntityRelationship(
      EntityRelationshipObject rel) {
    return new org.openmetadata.schema.type.EntityRelationship()
        .withFromEntity(rel.getFromEntity())
        .withFromId(UUID.fromString(rel.getFromId()))
        .withToEntity(rel.getToEntity())
        .withToId(UUID.fromString(rel.getToId()))
        .withRelation(rel.getRelation())
        .withRelationshipType(Relationship.values()[rel.getRelation()]);
  }

  private void processEntityTypes() throws InterruptedException {
    int batchSize = jobData.getBatchSize() != null ? jobData.getBatchSize() : DEFAULT_BATCH_SIZE;
    int totalBatches = calculateTotalBatches(jobData.getEntities(), batchSize);
    CountDownLatch producerLatch = new CountDownLatch(totalBatches);

    for (String entityType : jobData.getEntities()) {
      jobExecutor.submit(() -> processEntityType(entityType, batchSize, producerLatch));
    }

    while (!producerLatch.await(1, TimeUnit.SECONDS)) {
      if (stopped || Thread.currentThread().isInterrupted()) {
        LOG.info("Stop signal or interrupt received during reindexing - exiting");
        if (producerExecutor != null) {
          producerExecutor.shutdownNow();
        }
        if (jobExecutor != null) {
          jobExecutor.shutdownNow();
        }
        return;
      }
    }
    producersDone.set(true);
  }

  private int calculateTotalBatches(Set<String> entities, int batchSize) {
    int total = 0;
    for (String entityType : entities) {
      int entityTotal = getTotalEntityRecords(entityType);
      total += (entityTotal + batchSize - 1) / batchSize;
    }
    return total;
  }

  private void processEntityType(String entityType, int batchSize, CountDownLatch producerLatch) {
    LOG.info("Processing entity type: {}", entityType);

    try {
      EntityRepository<?> repository = Entity.getEntityRepository(entityType);
      int totalRecords = getTotalEntityRecords(entityType);
      int numBatches = (totalRecords + batchSize - 1) / batchSize;

      for (int batch = 0; batch < numBatches; batch++) {
        if (stopped) {
          for (int i = batch; i < numBatches; i++) {
            producerLatch.countDown();
          }
          break;
        }

        int offset = batch * batchSize;
        final int currentBatch = batch;
        producerExecutor.submit(
            () -> {
              try {
                processBatch(entityType, repository, offset, batchSize);
              } finally {
                producerLatch.countDown();
              }
            });
      }
    } catch (Exception e) {
      LOG.error("Error processing entity type {}", entityType, e);
      updateEntityStats(
          entityType,
          new StepStats()
              .withSuccessRecords(0)
              .withFailedRecords(getTotalEntityRecords(entityType)));
    }
  }

  private void processBatch(
      String entityType, EntityRepository<?> repository, int offset, int batchSize) {
    if (stopped) {
      return;
    }

    try {
      EntityDAO<?> entityDAO = repository.getDao();
      String cursor = RestUtil.encodeCursor(String.valueOf(offset));

      ResultList<? extends EntityInterface> result =
          repository.listWithOffset(
              entityDAO::listAfter,
              entityDAO::listCount,
              new ListFilter(Include.ALL),
              batchSize,
              cursor,
              true,
              Entity.getFields(entityType, List.of("*")),
              null);

      if (!listOrEmpty(result.getData()).isEmpty() && !stopped) {
        IndexingTask task = new IndexingTask(entityType, result.getData(), offset);
        try {
          taskQueue.put(task);
        } catch (InterruptedException e) {
          Thread.currentThread().interrupt();
          LOG.warn("Interrupted while queueing task for entityType: {}", entityType);
        }
      }

    } catch (Exception e) {
      LOG.error("Error processing batch for entity type {} at offset {}", entityType, offset, e);
      updateEntityStats(
          entityType, new StepStats().withSuccessRecords(0).withFailedRecords(batchSize));
    }
  }

  private void signalConsumersToStop(int numConsumers) {
    producersDone.set(true);
    for (int i = 0; i < numConsumers; i++) {
      boolean offered = taskQueue.offer(new IndexingTask(POISON_PILL, null, -1));
      if (!offered) {
        LOG.debug("Could not add poison pill to queue - queue may be full");
      }
    }
  }

  private Stats initializeTotalRecords(Set<String> entities) {
    Stats stats = new Stats();
    stats.setEntityStats(new EntityStats());

    int total = 0;
    for (String entityType : entities) {
      int entityTotal = getTotalEntityRecords(entityType);
      total += entityTotal;

      StepStats entityStats = new StepStats();
      entityStats.setTotalRecords(entityTotal);
      entityStats.setSuccessRecords(0);
      entityStats.setFailedRecords(0);

      stats.getEntityStats().getAdditionalProperties().put(entityType, entityStats);
      LOG.debug("Set Total Records for entityType '{}': {}", entityType, entityTotal);
    }

    StepStats jobStats = new StepStats();
    jobStats.setTotalRecords(total);
    jobStats.setSuccessRecords(0);
    jobStats.setFailedRecords(0);
    stats.setJobStats(jobStats);

    return stats;
  }

  private int getTotalEntityRecords(String entityType) {
    try {
      EntityRepository<?> repository = Entity.getEntityRepository(entityType);
      return repository.getDao().listTotalCount();
    } catch (Exception e) {
      LOG.error("Error getting total count for entity type {}", entityType, e);
      return 0;
    }
  }

  private synchronized void updateEntityStats(String entityType, StepStats currentEntityStats) {
    Stats stats = rdfIndexStats.get();
    if (stats == null) {
      return;
    }

    StepStats entityStats =
        (StepStats) stats.getEntityStats().getAdditionalProperties().get(entityType);
    if (entityStats != null) {
      entityStats.withSuccessRecords(
          entityStats.getSuccessRecords() + currentEntityStats.getSuccessRecords());
      entityStats.withFailedRecords(
          entityStats.getFailedRecords() + currentEntityStats.getFailedRecords());
    }

    StepStats jobStats = stats.getJobStats();
    int totalSuccess =
        stats.getEntityStats().getAdditionalProperties().values().stream()
            .mapToInt(s -> ((StepStats) s).getSuccessRecords())
            .sum();
    int totalFailed =
        stats.getEntityStats().getAdditionalProperties().values().stream()
            .mapToInt(s -> ((StepStats) s).getFailedRecords())
            .sum();

    jobStats.withSuccessRecords(totalSuccess).withFailedRecords(totalFailed);

    rdfIndexStats.set(stats);
    jobData.setStats(stats);
  }

  private void updateJobStatus(EventPublisherJob.Status newStatus) {
    EventPublisherJob.Status currentStatus = jobData.getStatus();

    if (stopped
        && newStatus != EventPublisherJob.Status.STOP_IN_PROGRESS
        && newStatus != EventPublisherJob.Status.STOPPED) {
      LOG.info("Skipping status update to {} because stop has been initiated", newStatus);
      return;
    }

    LOG.info("Updating job status from {} to {}", currentStatus, newStatus);
    jobData.setStatus(newStatus);
  }

  private void sendUpdates(JobExecutionContext jobExecutionContext, boolean forceUpdate) {
    try {
      long currentTime = System.currentTimeMillis();
      if (!forceUpdate && (currentTime - lastWebSocketUpdate < WEBSOCKET_UPDATE_INTERVAL_MS)) {
        return;
      }
      lastWebSocketUpdate = currentTime;

      jobExecutionContext.getJobDetail().getJobDataMap().put(APP_RUN_STATS, jobData.getStats());
      jobExecutionContext
          .getJobDetail()
          .getJobDataMap()
          .put(WEBSOCKET_STATUS_CHANNEL, RDF_INDEX_JOB_BROADCAST_CHANNEL);
      updateRecordToDbAndNotify(jobExecutionContext);
    } catch (Exception ex) {
      LOG.error("Failed to send updated stats with WebSocket", ex);
    }
  }

  public void updateRecordToDbAndNotify(JobExecutionContext jobExecutionContext) {
    AppRunRecord appRecord = getJobRecord(jobExecutionContext);

    appRecord.setStatus(AppRunRecord.Status.fromValue(jobData.getStatus().value()));
    if (jobData.getFailure() != null) {
      appRecord.setFailureContext(
          new FailureContext().withAdditionalProperty("failure", jobData.getFailure()));
    }
    if (jobData.getStats() != null) {
      appRecord.setSuccessContext(
          new SuccessContext().withAdditionalProperty("stats", jobData.getStats()));
    }

    if (WebSocketManager.getInstance() != null) {
      String messageJson = JsonUtils.pojoToJson(appRecord);
      WebSocketManager.getInstance()
          .broadCastMessageToAll(RDF_INDEX_JOB_BROADCAST_CHANNEL, messageJson);
    }
  }

  private void handleJobFailure(Exception ex) {
    IndexingError indexingError =
        new IndexingError()
            .withErrorSource(IndexingError.ErrorSource.JOB)
            .withMessage(String.format("RDF Indexing Job Failed: %s", ex.getMessage()));
    LOG.error("RDF Indexing Job Failed", ex);

    jobData.setStatus(EventPublisherJob.Status.FAILED);
    jobData.setFailure(indexingError);
  }

  private void cleanupExecutors() {
    shutdownExecutor(consumerExecutor, "RDF Consumer Executor", 30, TimeUnit.SECONDS);
    shutdownExecutor(producerExecutor, "RDF Producer Executor", 30, TimeUnit.SECONDS);
    shutdownExecutor(jobExecutor, "RDF Job Executor", 20, TimeUnit.SECONDS);
  }

  private void shutdownExecutor(
      ExecutorService executor, String name, long timeout, TimeUnit unit) {
    if (executor != null && !executor.isShutdown()) {
      executor.shutdown();
      try {
        if (!executor.awaitTermination(timeout, unit)) {
          executor.shutdownNow();
          LOG.warn("{} did not terminate within the specified timeout.", name);
        }
      } catch (InterruptedException e) {
        LOG.error("Interrupted while waiting for {} to terminate.", name, e);
        executor.shutdownNow();
        Thread.currentThread().interrupt();
      }
    }
  }

  @Override
  public void stop() {
    LOG.info("RDF indexing job is being stopped.");
    stopped = true;
    producersDone.set(true);

    if (jobData != null) {
      jobData.setStatus(EventPublisherJob.Status.STOP_IN_PROGRESS);
    }

    if (taskQueue != null) {
      taskQueue.clear();
      for (int i = 0; i < MAX_CONSUMER_THREADS; i++) {
        taskQueue.offer(new IndexingTask(POISON_PILL, null, -1));
      }
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

    LOG.info("RDF indexing job stopped successfully.");
  }

  @Override
  protected void validateConfig(Map<String, Object> appConfig) {
    try {
      JsonUtils.convertValue(appConfig, EventPublisherJob.class);
    } catch (IllegalArgumentException e) {
      throw AppException.byMessage(
          Response.Status.BAD_REQUEST, "Invalid App Configuration: " + e.getMessage());
    }
  }

  private Set<String> getAll() {
    return new HashSet<>(Entity.getEntityList());
  }
}
