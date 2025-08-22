package org.openmetadata.service.apps.bundles.rdf;

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
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.TimeUnit;
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
import org.openmetadata.schema.system.IndexingError;
import org.openmetadata.schema.system.Stats;
import org.openmetadata.schema.system.StepStats;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.apps.AbstractNativeApplication;
import org.openmetadata.service.exception.AppException;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.EntityDAO;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.rdf.RdfRepository;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.socket.WebSocketManager;
import org.openmetadata.service.util.RestUtil;
import org.openmetadata.service.util.ResultList;
import org.quartz.JobExecutionContext;

@Slf4j
public class RdfIndexApp extends AbstractNativeApplication {
  private static final String ALL = "all";
  private static final int DEFAULT_BATCH_SIZE = 100;

  private final RdfRepository rdfRepository;
  private volatile boolean stopped = false;

  @Getter private EventPublisherJob jobData;
  private ExecutorService executorService;
  private JobExecutionContext jobExecutionContext;
  private final AtomicReference<Stats> rdfIndexStats = new AtomicReference<>();

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
      if (executorService != null) {
        shutdownExecutor(executorService, "RDF Index Executor", 30, TimeUnit.SECONDS);
      }
    }
  }

  private void initializeJob(JobExecutionContext jobExecutionContext) {
    LOG.debug("Executing RDF Indexing Job with JobData: {}", jobData);
    updateJobStatus(EventPublisherJob.Status.RUNNING);

    LOG.debug("Initializing job statistics.");
    rdfIndexStats.set(initializeTotalRecords(jobData.getEntities()));
    jobData.setStats(rdfIndexStats.get());

    sendUpdates(jobExecutionContext, true);
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
    // Reduce thread count to avoid overwhelming Fuseki with concurrent updates
    int numThreads = Math.min(jobData.getEntities().size(), 5);
    try {
      executorService =
          org.openmetadata.service.util.ExecutorManager.getInstance()
              .getVirtualThreadExecutor("rdf-index-app", numThreads);
    } catch (Exception e) {
      LOG.warn("ExecutorManager not available, falling back to default executor", e);
      throw new RuntimeException("Failed to initialize RDF index executor", e);
    }
    CountDownLatch latch = new CountDownLatch(jobData.getEntities().size());

    for (String entityType : jobData.getEntities()) {
      executorService.submit(
          () -> {
            try {
              processEntityType(entityType);
            } catch (Exception e) {
              LOG.error("Error processing entity type {}", entityType, e);
              updateEntityStats(
                  entityType,
                  new StepStats()
                      .withSuccessRecords(0)
                      .withFailedRecords(getTotalEntityRecords(entityType)));
            } finally {
              latch.countDown();
            }
          });
    }

    latch.await();
  }

  private void processEntityType(String entityType) {
    LOG.info("Processing entity type: {}", entityType);

    EntityRepository<?> repository = Entity.getEntityRepository(entityType);
    String cursor = RestUtil.encodeCursor("0");
    int batchSize = jobData.getBatchSize() != null ? jobData.getBatchSize() : DEFAULT_BATCH_SIZE;

    while (!stopped && cursor != null) {
      try {
        EntityDAO<?> entityDAO = repository.getDao();
        // First fetch the list with minimal fields
        ResultList<? extends EntityInterface> entities =
            repository.listWithOffset(
                entityDAO::listAfter,
                entityDAO::listCount,
                new ListFilter(Include.ALL),
                batchSize,
                cursor,
                true,
                repository.getFields("id"),
                null);

        if (entities.getData().isEmpty()) {
          break;
        }

        // Process each entity with full details
        processBatchWithFullDetails(entityType, entities.getData(), repository);
        cursor = entities.getPaging().getAfter();

        // Update progress
        StepStats currentStats =
            new StepStats().withSuccessRecords(entities.getData().size()).withFailedRecords(0);
        updateEntityStats(entityType, currentStats);
        sendUpdates(jobExecutionContext, false);

      } catch (Exception e) {
        LOG.error("Error processing batch for entity type {} at cursor {}", entityType, cursor, e);
        StepStats failedStats = new StepStats().withSuccessRecords(0).withFailedRecords(batchSize);
        updateEntityStats(entityType, failedStats);
        break; // Stop processing this entity type on error
      }
    }
  }

  private void processBatchWithFullDetails(
      String entityType, List<? extends EntityInterface> entities, EntityRepository<?> repository) {
    for (EntityInterface entity : entities) {
      if (stopped) {
        break;
      }

      try {
        // Fetch the complete entity with all relationships
        EntityInterface fullEntity =
            repository.get(null, entity.getId(), repository.getFields("*"));

        // Store entity in RDF
        rdfRepository.createOrUpdate(fullEntity);

        // Process all relationships from the repository
        processAllRelationships(entityType, fullEntity, repository);

      } catch (Exception e) {
        LOG.error("Failed to index entity {} to RDF", entity.getId(), e);
      }
    }
  }

  private void processAllRelationships(
      String entityType, EntityInterface entity, EntityRepository<?> repository) {
    try {
      List<org.openmetadata.schema.type.EntityRelationship> allRelationships = new ArrayList<>();

      // Process relationships where this entity is the "to" side (incoming relationships)
      for (Relationship relationshipType : Relationship.values()) {
        try {
          List<CollectionDAO.EntityRelationshipRecord> fromRecords =
              repository.findFromRecords(entity.getId(), entityType, relationshipType, null);

          for (var record : fromRecords) {
            try {
              EntityReference fromRef =
                  Entity.getEntityReferenceById(record.getType(), record.getId(), Include.ALL);
              EntityReference toRef = entity.getEntityReference();

              org.openmetadata.schema.type.EntityRelationship relationship =
                  new org.openmetadata.schema.type.EntityRelationship()
                      .withFromEntity(fromRef.getType())
                      .withFromId(fromRef.getId())
                      .withToEntity(toRef.getType())
                      .withToId(toRef.getId())
                      .withRelation(relationshipType.ordinal())
                      .withRelationshipType(relationshipType);

              allRelationships.add(relationship);
            } catch (Exception e) {
              LOG.debug(
                  "Failed to process incoming relationship {} for entity {}",
                  relationshipType,
                  entity.getId(),
                  e);
            }
          }
        } catch (Exception e) {
          // Some relationship types may not apply to all entities
          LOG.debug(
              "Skipping relationship type {} for entity type {}", relationshipType, entityType);
        }
      }

      // Process relationships where this entity is the "from" side (outgoing relationships)
      for (Relationship relationshipType : Relationship.values()) {
        try {
          List<CollectionDAO.EntityRelationshipRecord> toRecords =
              repository.findToRecords(entity.getId(), entityType, relationshipType, null);

          for (var record : toRecords) {
            try {
              EntityReference fromRef = entity.getEntityReference();
              EntityReference toRef =
                  Entity.getEntityReferenceById(record.getType(), record.getId(), Include.ALL);

              org.openmetadata.schema.type.EntityRelationship relationship =
                  new org.openmetadata.schema.type.EntityRelationship()
                      .withFromEntity(fromRef.getType())
                      .withFromId(fromRef.getId())
                      .withToEntity(toRef.getType())
                      .withToId(toRef.getId())
                      .withRelation(relationshipType.ordinal())
                      .withRelationshipType(relationshipType);

              allRelationships.add(relationship);
            } catch (Exception e) {
              LOG.debug(
                  "Failed to process outgoing relationship {} for entity {}",
                  relationshipType,
                  entity.getId(),
                  e);
            }
          }
        } catch (Exception e) {
          // Some relationship types may not apply to all entities
          LOG.debug(
              "Skipping relationship type {} for entity type {}", relationshipType, entityType);
        }
      }

      // Bulk add all relationships for this entity
      if (!allRelationships.isEmpty()) {
        rdfRepository.bulkAddRelationships(allRelationships);
        LOG.debug(
            "Bulk added {} relationships for entity {}", allRelationships.size(), entity.getId());
      }

    } catch (Exception e) {
      LOG.error("Failed to get relationships for entity {}", entity.getId(), e);
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

    // Update job stats
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

    if (jobData != null) {
      jobData.setStatus(EventPublisherJob.Status.STOP_IN_PROGRESS);
    }

    if (executorService != null) {
      executorService.shutdownNow();
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
