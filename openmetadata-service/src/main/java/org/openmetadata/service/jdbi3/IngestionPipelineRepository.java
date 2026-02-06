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

import static org.openmetadata.schema.type.EventType.ENTITY_FIELDS_CHANGED;
import static org.openmetadata.schema.type.EventType.ENTITY_UPDATED;
import static org.openmetadata.service.Entity.INGESTION_PIPELINE;

import com.google.gson.Gson;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.core.UriInfo;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.sqlobject.transaction.Transaction;
import org.json.JSONObject;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.ServiceEntityInterface;
import org.openmetadata.schema.api.configuration.LogStorageConfiguration;
import org.openmetadata.schema.entity.applications.configuration.ApplicationConfig;
import org.openmetadata.schema.entity.services.ingestionPipelines.AirflowConfig;
import org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineServiceClientResponse;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineStatus;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineType;
import org.openmetadata.schema.metadataIngestion.ApplicationPipeline;
import org.openmetadata.schema.metadataIngestion.LogLevels;
import org.openmetadata.schema.services.connections.metadata.OpenMetadataConnection;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.FieldChange;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.type.change.ChangeSource;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.sdk.PipelineServiceClientInterface;
import org.openmetadata.sdk.exception.PipelineServiceClientException;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.events.lifecycle.EntityLifecycleEventDispatcher;
import org.openmetadata.service.logstorage.LogStorageInterface;
import org.openmetadata.service.resources.services.ingestionpipelines.IngestionPipelineResource;
import org.openmetadata.service.secrets.SecretsManager;
import org.openmetadata.service.secrets.SecretsManagerFactory;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.EntityUtil.RelationIncludes;
import org.openmetadata.service.util.FullyQualifiedName;
import org.openmetadata.service.util.RestUtil;

@Slf4j
@Repository(name = "IngestionPipelineRepository")
public class IngestionPipelineRepository extends EntityRepository<IngestionPipeline> {

  private static final String UPDATE_FIELDS =
      "sourceConfig,airflowConfig,loggerLevel,enabled,deployed,processingEngine";
  private static final String PATCH_FIELDS =
      "sourceConfig,airflowConfig,loggerLevel,enabled,deployed,processingEngine";

  private static final String PIPELINE_STATUS_JSON_SCHEMA = "ingestionPipelineStatus";
  private static final String PIPELINE_STATUS_EXTENSION = "ingestionPipeline.pipelineStatus";
  private static final String RUN_ID_EXTENSION_KEY = "runId";
  @Setter private PipelineServiceClientInterface pipelineServiceClient;
  @Setter @Getter private LogStorageInterface logStorage;
  @Setter @Getter private LogStorageConfiguration logStorageConfiguration;

  // HTTP/2 metrics tracking
  private static long http2RequestCount = 0;
  private static long http1RequestCount = 0;
  private static long activeStreams = 0;

  @Getter private final OpenMetadataApplicationConfig openMetadataApplicationConfig;

  public IngestionPipelineRepository(OpenMetadataApplicationConfig config) {
    super(
        IngestionPipelineResource.COLLECTION_PATH,
        Entity.INGESTION_PIPELINE,
        IngestionPipeline.class,
        Entity.getCollectionDAO().ingestionPipelineDAO(),
        PATCH_FIELDS,
        UPDATE_FIELDS);
    this.supportsSearch = true;
    this.openMetadataApplicationConfig = config;
  }

  @Override
  public void setFullyQualifiedName(IngestionPipeline ingestionPipeline) {
    if (ingestionPipeline.getService() == null) {
      // Service might not be set when listing with minimal fields
      EntityReference service = getContainer(ingestionPipeline.getId());
      ingestionPipeline.withService(service);
    }
    ingestionPipeline.setFullyQualifiedName(
        FullyQualifiedName.add(
            ingestionPipeline.getService().getFullyQualifiedName(), ingestionPipeline.getName()));
  }

  @Override
  public void setFields(
      IngestionPipeline ingestionPipeline, Fields fields, RelationIncludes relationIncludes) {
    if (ingestionPipeline.getService() == null) {
      ingestionPipeline.withService(getContainer(ingestionPipeline.getId()));
    }
    ingestionPipeline.setPipelineStatuses(
        fields.contains("pipelineStatuses")
            ? getLatestPipelineStatus(ingestionPipeline)
            : ingestionPipeline.getPipelineStatuses());

    if (ingestionPipeline.getSourceConfig() != null
        && ingestionPipeline.getSourceConfig().getConfig() != null) {
      JSONObject sourceConfigJson =
          new JSONObject(JsonUtils.pojoToJson(ingestionPipeline.getSourceConfig().getConfig()));
      Optional.ofNullable(sourceConfigJson.optJSONObject("appConfig"))
          .map(appConfig -> appConfig.optString("type", null))
          .ifPresent(ingestionPipeline::setApplicationType);
    }
  }

  @Override
  public void setFieldsInBulk(Fields fields, List<IngestionPipeline> entities) {
    if (entities == null || entities.isEmpty()) {
      return;
    }
    // Bulk fetch and set default fields (service) for all pipelines first
    fetchAndSetDefaultFields(entities, fields);

    // Then call parent's implementation which handles standard fields
    super.setFieldsInBulk(fields, entities);
  }

  private void fetchAndSetDefaultFields(List<IngestionPipeline> pipelines, Fields fields) {
    if (pipelines == null || pipelines.isEmpty()) {
      return;
    }

    // Batch fetch service references for all pipelines
    Map<UUID, EntityReference> serviceRefs = batchFetchServices(pipelines);

    // Set service field for all pipelines
    for (IngestionPipeline pipeline : pipelines) {
      EntityReference serviceRef = serviceRefs.get(pipeline.getId());
      pipeline.setPipelineStatuses(
          fields.contains("pipelineStatuses")
              ? getLatestPipelineStatus(pipeline)
              : pipeline.getPipelineStatuses());
      if (serviceRef != null) {
        pipeline.withService(serviceRef);
      } else {
        // Service is guaranteed to exist, so fetch it individually if batch fetch missed it
        LOG.warn(
            "Service not found in batch fetch for pipeline: {} (id: {}). Fetching individually.",
            pipeline.getName(),
            pipeline.getId());
        EntityReference service = getContainer(pipeline.getId());
        if (service != null) {
          pipeline.withService(service);
        } else {
          LOG.error(
              "No service found for ingestion pipeline: {} (id: {})",
              pipeline.getName(),
              pipeline.getId());
        }
      }
    }
  }

  private Map<UUID, EntityReference> batchFetchServices(List<IngestionPipeline> pipelines) {
    Map<UUID, EntityReference> serviceMap = new HashMap<>();
    if (pipelines == null || pipelines.isEmpty()) {
      return serviceMap;
    }

    // Single batch query to get all services for all pipelines
    List<CollectionDAO.EntityRelationshipObject> records =
        daoCollection
            .relationshipDAO()
            .findFromBatch(entityListToStrings(pipelines), Relationship.CONTAINS.ordinal());

    for (CollectionDAO.EntityRelationshipObject record : records) {
      UUID pipelineId = UUID.fromString(record.getToId());
      String fromEntity = record.getFromEntity();
      // Service entities can be of different types (database_service, dashboard_service, etc.)
      // All service entity types end with "_service"
      if (fromEntity.endsWith("_service")) {
        EntityReference serviceRef =
            Entity.getEntityReferenceById(
                fromEntity, UUID.fromString(record.getFromId()), Include.NON_DELETED);
        serviceMap.put(pipelineId, serviceRef);
      }
    }

    return serviceMap;
  }

  @Override
  public void clearFields(IngestionPipeline ingestionPipeline, Fields fields) {
    /* Nothing to do */
  }

  @Override
  public void prepare(IngestionPipeline ingestionPipeline, boolean update) {
    EntityReference entityReference =
        Entity.getEntityReference(ingestionPipeline.getService(), Include.NON_DELETED);
    ingestionPipeline.setService(entityReference);
  }

  protected boolean requiresRedeployment(IngestionPipeline original, IngestionPipeline updated) {
    if (hasScheduleChanged(original, updated)) {
      LOG.debug("Pipeline '{}' requires redeployment: schedule changed", updated.getName());
      return true;
    }

    if (!Objects.equals(original.getEnabled(), updated.getEnabled())) {
      LOG.debug(
          "Pipeline '{}' requires redeployment: enabled changed from {} to {}",
          updated.getName(),
          original.getEnabled(),
          updated.getEnabled());
      return true;
    }

    if (hasSourceConfigChanged(original, updated)) {
      LOG.debug("Pipeline '{}' requires redeployment: sourceConfig changed", updated.getName());
      return true;
    }

    if (!Objects.equals(original.getLoggerLevel(), updated.getLoggerLevel())) {
      LOG.debug(
          "Pipeline '{}' requires redeployment: loggerLevel changed from {} to {}",
          updated.getName(),
          original.getLoggerLevel(),
          updated.getLoggerLevel());
      return true;
    }

    return false;
  }

  boolean hasScheduleChanged(IngestionPipeline original, IngestionPipeline updated) {
    String originalSchedule =
        original.getAirflowConfig() != null
            ? original.getAirflowConfig().getScheduleInterval()
            : null;
    String updatedSchedule =
        updated.getAirflowConfig() != null
            ? updated.getAirflowConfig().getScheduleInterval()
            : null;
    return !Objects.equals(originalSchedule, updatedSchedule);
  }

  boolean hasSourceConfigChanged(IngestionPipeline original, IngestionPipeline updated) {
    if (original.getSourceConfig() == null && updated.getSourceConfig() == null) {
      return false;
    }
    if (original.getSourceConfig() == null || updated.getSourceConfig() == null) {
      return true;
    }
    String originalJson = JsonUtils.pojoToJson(original.getSourceConfig());
    String updatedJson = JsonUtils.pojoToJson(updated.getSourceConfig());
    return !originalJson.equals(updatedJson);
  }

  protected void deployPipelineBeforeUpdate(IngestionPipeline ingestionPipeline) {
    IngestionPipeline decrypted = buildIngestionPipelineDecrypted(ingestionPipeline);

    OpenMetadataConnection openMetadataServerConnection =
        new org.openmetadata.service.util.OpenMetadataConnectionBuilder(
                openMetadataApplicationConfig, decrypted)
            .build();
    SecretsManager secretsManager = SecretsManagerFactory.getSecretsManager();
    decrypted.setOpenMetadataServerConnection(
        secretsManager.encryptOpenMetadataConnection(openMetadataServerConnection, false));

    ServiceEntityInterface service =
        Entity.getEntity(decrypted.getService(), "", Include.NON_DELETED);

    if (isS3LogStorageEnabled() && getLogStorageConfiguration().getEnabled()) {
      decrypted.setEnableStreamableLogs(true);
    }

    PipelineServiceClientResponse deployResponse = deployIngestionPipeline(decrypted, service);

    if (deployResponse.getCode() != 200) {
      String errorContext = extractErrorContext(deployResponse.getReason());
      throw new PipelineServiceClientException(
          String.format("Deployment failed: %s. Changes not saved.", errorContext));
    }

    LOG.info(
        "Pipeline '{}' deployed successfully to {} with response: {}",
        decrypted.getName(),
        deployResponse.getPlatform(),
        deployResponse.getReason());
  }

  String extractErrorContext(String message) {
    if (message == null || message.isEmpty()) {
      return "runner unavailable";
    }

    if (message.contains("WebSocket is inactive") || message.contains("WebSocket")) {
      return "runner not connected";
    }

    if (message.contains("Connection refused")) {
      return "connection refused";
    }

    if (message.contains("timeout") || message.contains("timed out")) {
      return "connection timeout";
    }

    if (message.contains("Failed to delete CRON")) {
      return "cannot update workflow";
    }

    if (message.length() > 50) {
      return "deployment error";
    }

    return message;
  }

  @Transaction
  public IngestionPipeline deletePipelineStatus(UUID ingestionPipelineId) {
    // Validate the request content
    IngestionPipeline ingestionPipeline = find(ingestionPipelineId, Include.NON_DELETED);
    daoCollection
        .entityExtensionTimeSeriesDao()
        .delete(ingestionPipeline.getFullyQualifiedName(), PIPELINE_STATUS_EXTENSION);
    setFieldsInternal(ingestionPipeline, Fields.EMPTY_FIELDS);
    return ingestionPipeline;
  }

  @Override
  public void storeEntity(IngestionPipeline ingestionPipeline, boolean update) {
    // Relationships and fields such as service are derived and not stored as part of json
    EntityReference service = ingestionPipeline.getService();
    OpenMetadataConnection openmetadataConnection =
        ingestionPipeline.getOpenMetadataServerConnection();

    SecretsManager secretsManager = SecretsManagerFactory.getSecretsManager();

    if (secretsManager != null) {
      secretsManager.encryptIngestionPipeline(ingestionPipeline);
      // We store the OM sensitive values in SM separately
      openmetadataConnection =
          secretsManager.encryptOpenMetadataConnection(openmetadataConnection, true);
    }

    EntityReference processingEngine = ingestionPipeline.getProcessingEngine();

    ingestionPipeline
        .withService(null)
        .withOpenMetadataServerConnection(null)
        .withProcessingEngine(null);
    store(ingestionPipeline, update);
    ingestionPipeline
        .withService(service)
        .withOpenMetadataServerConnection(openmetadataConnection)
        .withProcessingEngine(processingEngine);
  }

  @Override
  public void storeEntities(List<IngestionPipeline> entities) {
    List<IngestionPipeline> entitiesToStore = new ArrayList<>();
    Gson gson = new Gson();
    SecretsManager secretsManager = SecretsManagerFactory.getSecretsManager();

    for (IngestionPipeline ingestionPipeline : entities) {
      EntityReference service = ingestionPipeline.getService();
      OpenMetadataConnection openmetadataConnection =
          ingestionPipeline.getOpenMetadataServerConnection();

      if (secretsManager != null) {
        secretsManager.encryptIngestionPipeline(ingestionPipeline);
        openmetadataConnection =
            secretsManager.encryptOpenMetadataConnection(openmetadataConnection, true);
      }

      EntityReference processingEngine = ingestionPipeline.getProcessingEngine();

      ingestionPipeline
          .withService(null)
          .withOpenMetadataServerConnection(null)
          .withProcessingEngine(null);

      String jsonCopy = gson.toJson(ingestionPipeline);
      entitiesToStore.add(gson.fromJson(jsonCopy, IngestionPipeline.class));

      ingestionPipeline
          .withService(service)
          .withOpenMetadataServerConnection(openmetadataConnection)
          .withProcessingEngine(processingEngine);
    }

    storeMany(entitiesToStore);
  }

  @Override
  protected void clearEntitySpecificRelationshipsForMany(List<IngestionPipeline> entities) {
    if (entities.isEmpty()) return;
    List<UUID> ids = entities.stream().map(IngestionPipeline::getId).toList();
    deleteToMany(ids, entityType, Relationship.CONTAINS, null);
    deleteFromMany(ids, entityType, Relationship.USES, null);
  }

  @Override
  public void storeRelationships(IngestionPipeline ingestionPipeline) {
    addServiceRelationship(ingestionPipeline, ingestionPipeline.getService());
    if (ingestionPipeline.getIngestionRunner() != null) {
      addRelationship(
          ingestionPipeline.getId(),
          ingestionPipeline.getIngestionRunner().getId(),
          entityType,
          ingestionPipeline.getIngestionRunner().getType(),
          Relationship.USES);
    }

    if (ingestionPipeline.getProcessingEngine() != null) {
      addRelationship(
          ingestionPipeline.getId(),
          ingestionPipeline.getProcessingEngine().getId(),
          entityType,
          ingestionPipeline.getProcessingEngine().getType(),
          Relationship.USES);
    }
  }

  @Override
  public EntityRepository<IngestionPipeline>.EntityUpdater getUpdater(
      IngestionPipeline original,
      IngestionPipeline updated,
      Operation operation,
      ChangeSource changeSource) {
    return new IngestionPipelineUpdater(original, updated, operation);
  }

  @Override
  protected void postDelete(IngestionPipeline entity, boolean hardDelete) {
    super.postDelete(entity, hardDelete);
    // Delete deployed pipeline in the Pipeline Service Client
    pipelineServiceClient.deletePipeline(entity);
    // Clean pipeline status
    daoCollection
        .entityExtensionTimeSeriesDao()
        .delete(entity.getFullyQualifiedName(), PIPELINE_STATUS_EXTENSION);
  }

  @Override
  public EntityInterface getParentEntity(IngestionPipeline entity, String fields) {
    if (entity.getService() == null) {
      // Try to load the service if it's not set
      LOG.warn(
          "Service not set for ingestion pipeline: {} (id: {}). Loading it now.",
          entity.getName(),
          entity.getId());
      EntityReference service = getContainer(entity.getId());
      if (service != null) {
        entity.withService(service);
        return Entity.getEntity(service, fields, Include.ALL);
      } else {
        LOG.error(
            "No service found for ingestion pipeline: {} (id: {})",
            entity.getName(),
            entity.getId());
        return null;
      }
    }
    return Entity.getEntity(entity.getService(), fields, Include.ALL);
  }

  protected ChangeEvent getChangeEvent(
      EntityInterface updated, ChangeDescription change, String entityType, Double prevVersion) {
    return new ChangeEvent()
        .withId(UUID.randomUUID())
        .withEntity(updated)
        .withChangeDescription(change)
        .withEventType(ENTITY_UPDATED)
        .withEntityType(entityType)
        .withEntityId(updated.getId())
        .withEntityFullyQualifiedName(updated.getFullyQualifiedName())
        .withUserName(updated.getUpdatedBy())
        .withTimestamp(System.currentTimeMillis())
        .withCurrentVersion(updated.getVersion())
        .withPreviousVersion(prevVersion);
  }

  private ChangeDescription addPipelineStatusChangeDescription(
      Double version, Object newValue, Object oldValue) {
    FieldChange fieldChange =
        new FieldChange().withName("pipelineStatus").withNewValue(newValue).withOldValue(oldValue);
    ChangeDescription change = new ChangeDescription().withPreviousVersion(version);
    change.getFieldsUpdated().add(fieldChange);
    return change;
  }

  public RestUtil.PutResponse<?> addPipelineStatus(
      UriInfo uriInfo, String fqn, PipelineStatus pipelineStatus) {
    // Validate the request content
    IngestionPipeline ingestionPipeline = getByName(uriInfo, fqn, getFields("service"));
    PipelineStatus storedPipelineStatus =
        JsonUtils.readValue(
            daoCollection
                .entityExtensionTimeSeriesDao()
                .getLatestExtensionByKey(
                    RUN_ID_EXTENSION_KEY,
                    pipelineStatus.getRunId(),
                    ingestionPipeline.getFullyQualifiedName(),
                    PIPELINE_STATUS_EXTENSION),
            PipelineStatus.class);
    if (storedPipelineStatus != null) {
      daoCollection
          .entityExtensionTimeSeriesDao()
          .updateExtensionByKey(
              RUN_ID_EXTENSION_KEY,
              pipelineStatus.getRunId(),
              ingestionPipeline.getFullyQualifiedName(),
              PIPELINE_STATUS_EXTENSION,
              JsonUtils.pojoToJson(pipelineStatus));
    } else {
      daoCollection
          .entityExtensionTimeSeriesDao()
          .insert(
              ingestionPipeline.getFullyQualifiedName(),
              PIPELINE_STATUS_EXTENSION,
              PIPELINE_STATUS_JSON_SCHEMA,
              JsonUtils.pojoToJson(pipelineStatus));
    }
    ChangeDescription change =
        addPipelineStatusChangeDescription(
            ingestionPipeline.getVersion(), pipelineStatus, storedPipelineStatus);
    ingestionPipeline.setPipelineStatuses(pipelineStatus);
    ingestionPipeline.setChangeDescription(change);

    // Ensure entity reference is set before firing lifecycle event
    setFullyQualifiedName(ingestionPipeline);

    // Update ES Indexes
    searchRepository.updateEntityIndex(ingestionPipeline);

    // Fire lifecycle event for handlers (e.g., TestSuitePipelineStatusHandler)
    EntityLifecycleEventDispatcher.getInstance().onEntityUpdated(ingestionPipeline, change, null);

    ChangeEvent changeEvent =
        getChangeEvent(
            withHref(uriInfo, ingestionPipeline),
            change,
            entityType,
            ingestionPipeline.getVersion());

    return new RestUtil.PutResponse<>(Response.Status.CREATED, changeEvent, ENTITY_FIELDS_CHANGED);
  }

  public ResultList<PipelineStatus> listPipelineStatus(
      String ingestionPipelineFQN, Long startTs, Long endTs) {
    IngestionPipeline ingestionPipeline =
        getByName(null, ingestionPipelineFQN, getFields("service"));
    List<PipelineStatus> pipelineStatusList =
        JsonUtils.readObjects(
            getResultsFromAndToTimestamps(
                ingestionPipeline.getFullyQualifiedName(),
                PIPELINE_STATUS_EXTENSION,
                startTs,
                endTs),
            PipelineStatus.class);
    List<PipelineStatus> allPipelineStatusList = new ArrayList<>();
    if (pipelineServiceClient != null) {
      allPipelineStatusList = pipelineServiceClient.getQueuedPipelineStatus(ingestionPipeline);
    }
    allPipelineStatusList.addAll(pipelineStatusList);
    return new ResultList<>(
        allPipelineStatusList,
        String.valueOf(startTs),
        String.valueOf(endTs),
        allPipelineStatusList.size());
  }

  /* Get the status of the external application by converting the configuration so that it can be
   * served like an App configuration */
  public ResultList<PipelineStatus> listExternalAppStatus(
      String ingestionPipelineFQN, Long startTs, Long endTs) {
    return listPipelineStatus(ingestionPipelineFQN, startTs, endTs)
        .map(
            pipelineStatus ->
                pipelineStatus.withConfig(
                    Optional.ofNullable(pipelineStatus.getConfig())
                        .map(m -> m.getOrDefault("appConfig", null))
                        .map(JsonUtils::getMap)
                        .orElse(null)));
  }

  public ResultList<PipelineStatus> listExternalAppStatus(
      String ingestionPipelineFQN, String serviceName, Long startTs, Long endTs) {
    return listPipelineStatus(ingestionPipelineFQN, startTs, endTs)
        .filter(
            pipelineStatus -> {
              Map<String, Object> metadata = pipelineStatus.getMetadata();
              if (metadata == null) {
                return false;
              }
              Map<String, Object> workflowMetadata =
                  JsonUtils.readOrConvertValue(metadata.get("workflow"), Map.class);
              String pipelineStatusService = (String) workflowMetadata.get("serviceName");
              return pipelineStatusService != null && pipelineStatusService.equals(serviceName);
            })
        .map(
            pipelineStatus ->
                pipelineStatus.withConfig(
                    Optional.ofNullable(pipelineStatus.getConfig())
                        .map(m -> m.getOrDefault("appConfig", null))
                        .map(JsonUtils::getMap)
                        .orElse(null)));
  }

  public PipelineStatus getLatestPipelineStatus(IngestionPipeline ingestionPipeline) {
    return JsonUtils.readValue(
        getLatestExtensionFromTimeSeries(
            ingestionPipeline.getFullyQualifiedName(), PIPELINE_STATUS_EXTENSION),
        PipelineStatus.class);
  }

  public PipelineStatus getPipelineStatus(String ingestionPipelineFQN, UUID pipelineStatusRunId) {
    IngestionPipeline ingestionPipeline = findByName(ingestionPipelineFQN, Include.NON_DELETED);
    return JsonUtils.readValue(
        daoCollection
            .entityExtensionTimeSeriesDao()
            .getExtensionByKey(
                RUN_ID_EXTENSION_KEY,
                pipelineStatusRunId.toString(),
                ingestionPipeline.getFullyQualifiedName(),
                PIPELINE_STATUS_EXTENSION),
        PipelineStatus.class);
  }

  @Transaction
  public IngestionPipeline deletePipelineStatusByRunId(UUID ingestionPipelineId, UUID runId) {
    IngestionPipeline ingestionPipeline = find(ingestionPipelineId, Include.NON_DELETED);
    daoCollection
        .entityExtensionTimeSeriesDao()
        .deleteExtensionByKey(
            RUN_ID_EXTENSION_KEY,
            runId.toString(),
            ingestionPipeline.getFullyQualifiedName(),
            PIPELINE_STATUS_EXTENSION);
    setFieldsInternal(ingestionPipeline, Fields.EMPTY_FIELDS);
    return ingestionPipeline;
  }

  /**
   * Handles entity updated from PUT and POST operation.
   */
  public class IngestionPipelineUpdater extends EntityUpdater {

    public IngestionPipelineUpdater(
        IngestionPipeline original, IngestionPipeline updated, Operation operation) {
      super(buildIngestionPipelineDecrypted(original), updated, operation);
    }

    @Transaction
    @Override
    public void entitySpecificUpdate(boolean consolidatingChanges) {
      updateProcessingEngine(original, updated);
      updateSourceConfig();
      updateAirflowConfig(original.getAirflowConfig(), updated.getAirflowConfig());
      updateLogLevel(original.getLoggerLevel(), updated.getLoggerLevel());
      updateEnabled(original.getEnabled(), updated.getEnabled());
      updateDeployed(original.getDeployed(), updated.getDeployed());
      updateRaiseOnError(original.getRaiseOnError(), updated.getRaiseOnError());
      updateEnableStreamableLogs(
          original.getEnableStreamableLogs(), updated.getEnableStreamableLogs());

      deployIfRequired(original, updated);
    }

    private void deployIfRequired(IngestionPipeline original, IngestionPipeline updated) {
      if (!requiresRedeployment(original, updated)) {
        return;
      }

      if (!Boolean.TRUE.equals(original.getDeployed())) {
        LOG.debug(
            "Pipeline '{}' requires redeployment but was never deployed. Skipping automatic redeployment.",
            updated.getName());
        return;
      }

      if (pipelineServiceClient == null) {
        LOG.warn(
            "Pipeline '{}' requires redeployment but pipeline service client is not configured. Skipping deployment.",
            updated.getName());
        return;
      }

      LOG.info(
          "Pipeline '{}' requires redeployment due to configuration changes. Deploying before DB update.",
          updated.getName());

      try {
        deployPipelineBeforeUpdate(updated);
        LOG.info(
            "Successfully deployed pipeline '{}'. Proceeding with DB update.", updated.getName());
      } catch (PipelineServiceClientException e) {
        LOG.error(
            "Failed to deploy pipeline '{}' before update. Aborting DB update to maintain consistency.",
            updated.getName(),
            e);
        throw e;
      } catch (Exception e) {
        LOG.error(
            "Unexpected error deploying pipeline '{}' before update. Aborting DB update.",
            updated.getName(),
            e);
        throw new PipelineServiceClientException("Deployment failed. Changes not saved.");
      }
    }

    protected void updateProcessingEngine(IngestionPipeline original, IngestionPipeline updated) {
      String entityType =
          original.getProcessingEngine() != null
              ? original.getProcessingEngine().getType()
              : updated.getProcessingEngine() != null
                  ? updated.getProcessingEngine().getType()
                  : null;
      if (entityType == null) {
        return;
      }
      updateToRelationship(
          "processingEngine",
          INGESTION_PIPELINE,
          original.getId(),
          Relationship.USES,
          entityType,
          original.getProcessingEngine(),
          updated.getProcessingEngine(),
          false);
    }

    private void updateSourceConfig() {
      JSONObject origSourceConfig =
          new JSONObject(JsonUtils.pojoToJson(original.getSourceConfig().getConfig()));
      JSONObject updatedSourceConfig =
          new JSONObject(JsonUtils.pojoToJson(updated.getSourceConfig().getConfig()));

      if (!origSourceConfig.similar(updatedSourceConfig)) {
        recordChange("sourceConfig", "old-encrypted-value", "new-encrypted-value", true);
      }
    }

    private void updateAirflowConfig(
        AirflowConfig origAirflowConfig, AirflowConfig updatedAirflowConfig) {
      if (!Objects.equals(origAirflowConfig, updatedAirflowConfig)) {
        recordChange("airflowConfig", origAirflowConfig, updatedAirflowConfig);
      }
    }

    private void updateLogLevel(LogLevels origLevel, LogLevels updatedLevel) {
      if (updatedLevel != null && !Objects.equals(origLevel, updatedLevel)) {
        recordChange("loggerLevel", origLevel, updatedLevel);
      }
    }

    private void updateEnableStreamableLogs(
        Boolean origEnableStreamableLogs, Boolean updatedEnableStreamableLogs) {
      if (updatedEnableStreamableLogs != null
          && !Objects.equals(origEnableStreamableLogs, updatedEnableStreamableLogs)) {
        recordChange("enableStreamableLogs", origEnableStreamableLogs, updatedEnableStreamableLogs);
      }
    }

    private void updateDeployed(Boolean origDeployed, Boolean updatedDeployed) {
      if (updatedDeployed != null && !Objects.equals(origDeployed, updatedDeployed)) {
        recordChange("deployed", origDeployed, updatedDeployed);
      }
    }

    private void updateRaiseOnError(Boolean origRaiseOnError, Boolean updatedRaiseOnError) {
      if (updatedRaiseOnError != null && !Objects.equals(origRaiseOnError, updatedRaiseOnError)) {
        recordChange("raiseOnError", origRaiseOnError, updatedRaiseOnError);
      }
    }

    private void updateEnabled(Boolean origEnabled, Boolean updatedEnabled) {
      if (updatedEnabled != null && !Objects.equals(origEnabled, updatedEnabled)) {
        recordChange("enabled", origEnabled, updatedEnabled);
      }
    }
  }

  protected static IngestionPipeline buildIngestionPipelineDecrypted(IngestionPipeline original) {
    IngestionPipeline decrypted =
        JsonUtils.convertValue(JsonUtils.getMap(original), IngestionPipeline.class);
    SecretsManagerFactory.getSecretsManager().decryptIngestionPipeline(decrypted);
    return decrypted;
  }

  public static void validateProfileSample(IngestionPipeline ingestionPipeline) {

    JSONObject sourceConfigJson =
        new JSONObject(JsonUtils.pojoToJson(ingestionPipeline.getSourceConfig().getConfig()));
    String profileSampleType = sourceConfigJson.optString("profileSampleType");
    double profileSample = sourceConfigJson.optDouble("profileSample");

    EntityUtil.validateProfileSample(profileSampleType, profileSample);
  }

  /**
   * Get either the pipelineType or the application Type.
   */
  public static String getPipelineWorkflowType(IngestionPipeline ingestionPipeline) {
    if (PipelineType.APPLICATION.equals(ingestionPipeline.getPipelineType())) {
      ApplicationPipeline applicationPipeline =
          JsonUtils.convertValue(
              ingestionPipeline.getSourceConfig().getConfig(), ApplicationPipeline.class);
      ApplicationConfig appConfig =
          JsonUtils.convertValue(applicationPipeline.getAppConfig(), ApplicationConfig.class);
      return (String) appConfig.getAdditionalProperties().get("type");
    } else {
      return ingestionPipeline.getPipelineType().value();
    }
  }

  // Log Storage Methods

  /**
   * Check if log storage is enabled and properly configured
   */
  public boolean isLogStorageEnabled() {
    return logStorage != null && logStorageConfiguration != null;
  }

  /**
   * Check if we're using S3 log storage (for multi-server scenarios)
   */
  public boolean isS3LogStorageEnabled() {
    return isLogStorageEnabled()
        && logStorageConfiguration.getType() == LogStorageConfiguration.Type.S_3
        && logStorageConfiguration.getBucketName() != null
        && !logStorageConfiguration.getBucketName().isEmpty();
  }

  public void appendLogs(String pipelineFQN, UUID runId, String logContent) {
    try {
      if (isLogStorageEnabled()) {
        logStorage.appendLogs(pipelineFQN, runId, logContent);
      } else {
        throw new IllegalStateException("Log storage is not configured");
      }
    } catch (Exception e) {
      LOG.error("Failed to append logs for pipeline: {}, runId: {}", pipelineFQN, runId, e);
      throw new RuntimeException("Failed to append logs", e);
    }
  }

  public void closeStream(String pipelineFQN, UUID runId) {
    try {
      if (isLogStorageEnabled()) {
        logStorage.closeStream(pipelineFQN, runId);
      } else {
        throw new IllegalStateException("Log storage is not configured");
      }
    } catch (Exception e) {
      LOG.error("Failed to close stream for pipeline: {}, runId: {}", pipelineFQN, runId, e);
      throw new RuntimeException("Failed to close stream", e);
    }
  }

  public Map<String, Object> getLogs(
      String pipelineFQN, UUID runId, String afterCursor, int limit) {
    try {
      if (isS3LogStorageEnabled()) {
        // S3 storage - read directly from S3 (works across servers)
        return logStorage.getLogs(pipelineFQN, runId, afterCursor, limit);
      } else if (isLogStorageEnabled()) {
        // Default storage - use existing pipeline service client
        return logStorage.getLogs(pipelineFQN, runId, afterCursor, limit);
      } else {
        // No log storage configured - fall back to traditional Airflow/Argo logs
        return getLogsFromPipelineService(pipelineFQN, afterCursor);
      }
    } catch (Exception e) {
      LOG.error("Failed to get logs for pipeline: {}, runId: {}", pipelineFQN, runId, e);
      throw new RuntimeException("Failed to get logs", e);
    }
  }

  private Map<String, Object> getLogsFromPipelineService(String pipelineFQN, String afterCursor) {
    // Fall back to traditional pipeline service logs (Airflow/Argo)
    IngestionPipeline pipeline =
        Entity.getEntityByName(Entity.INGESTION_PIPELINE, pipelineFQN, "", Include.ALL);
    Map<String, String> logs = pipelineServiceClient.getLastIngestionLogs(pipeline, afterCursor);

    Map<String, Object> result = new HashMap<>();
    result.put("logs", logs.getOrDefault("logs", ""));
    result.put("after", logs.get("after"));
    result.put("total", logs.getOrDefault("total", "0"));
    return result;
  }

  public List<UUID> listRuns(String pipelineFQN, int limit) {
    try {
      if (logStorage != null) {
        return logStorage.listRuns(pipelineFQN, limit);
      } else {
        List<UUID> runIds = new ArrayList<>();
        List<PipelineStatus> statuses = getQueuedPipelineStatus(pipelineFQN, limit);
        for (PipelineStatus status : statuses) {
          if (status.getRunId() != null) {
            try {
              runIds.add(UUID.fromString(status.getRunId()));
            } catch (IllegalArgumentException e) {
              // Skip invalid UUIDs
            }
          }
        }
        return runIds;
      }
    } catch (Exception e) {
      LOG.error("Failed to list runs for pipeline: {}", pipelineFQN, e);
      throw new RuntimeException("Failed to list runs", e);
    }
  }

  public synchronized void recordHttp2Request() {
    http2RequestCount++;
    activeStreams++;
  }

  public synchronized void recordHttp1Request() {
    http1RequestCount++;
  }

  public synchronized void recordStreamClosed() {
    if (activeStreams > 0) {
      activeStreams--;
    }
  }

  public Map<String, Long> getHttp2Metrics() {
    Map<String, Long> metrics = new HashMap<>();
    metrics.put("http2_requests", http2RequestCount);
    metrics.put("http1_requests", http1RequestCount);
    metrics.put("active_streams", activeStreams);
    long total = http2RequestCount + http1RequestCount;
    if (total > 0) {
      metrics.put("http2_percentage", (http2RequestCount * 100) / total);
    }
    return metrics;
  }

  public Response streamLogs(String pipelineFQN, UUID runId) {
    try {
      if (isS3LogStorageEnabled()) {
        // S3 storage enabled - handle multi-server read scenario
        // For S3, we need to poll from S3 directly since logs might be on another server
        org.openmetadata.service.logstorage.S3LogStorage s3Storage =
            (org.openmetadata.service.logstorage.S3LogStorage) logStorage;

        return Response.ok()
            .type("text/event-stream")
            .entity(
                new jakarta.ws.rs.core.StreamingOutput() {
                  @Override
                  public void write(java.io.OutputStream output) throws java.io.IOException {
                    try {
                      // Send SSE headers
                      output.write("retry: 1000\n\n".getBytes());
                      output.flush();

                      // Create listener for live logs
                      org.openmetadata.service.logstorage.S3LogStorage.LogStreamListener listener =
                          logLine -> {
                            try {
                              String event =
                                  String.format("data: %s\n\n", logLine.replace("\n", "\ndata: "));
                              output.write(event.getBytes(java.nio.charset.StandardCharsets.UTF_8));
                              output.flush();
                            } catch (java.io.IOException e) {
                              LOG.debug("Client disconnected for {}/{}", pipelineFQN, runId);
                              throw new RuntimeException(e);
                            }
                          };

                      // Send recent logs first (from memory cache)
                      java.util.List<String> recentLogs =
                          s3Storage.getRecentLogs(pipelineFQN, runId, 100);
                      for (String line : recentLogs) {
                        output.write(
                            String.format("data: %s\n\n", line)
                                .getBytes(java.nio.charset.StandardCharsets.UTF_8));
                      }
                      output.flush();

                      // Then stream from S3 for complete history
                      java.io.InputStream logStream =
                          logStorage.getLogInputStream(pipelineFQN, runId);
                      try (java.io.BufferedReader reader =
                          new java.io.BufferedReader(
                              new java.io.InputStreamReader(
                                  logStream, java.nio.charset.StandardCharsets.UTF_8))) {
                        String line;
                        int skipLines = recentLogs.size(); // Skip lines we already sent
                        while ((line = reader.readLine()) != null) {
                          if (skipLines > 0) {
                            skipLines--;
                            continue;
                          }
                          output.write(
                              ("data: " + line + "\n\n")
                                  .getBytes(java.nio.charset.StandardCharsets.UTF_8));
                          output.flush();
                        }
                      }

                      // Register listener for new logs
                      s3Storage.registerLogListener(pipelineFQN, runId, listener);

                      try {
                        // Keep connection alive with periodic heartbeats
                        while (!Thread.currentThread().isInterrupted()) {
                          Thread.sleep(30000); // 30 second heartbeat
                          output.write(": heartbeat\n\n".getBytes());
                          output.flush();
                        }
                      } catch (InterruptedException e) {
                        Thread.currentThread().interrupt();
                      } finally {
                        // Cleanup listener
                        s3Storage.unregisterLogListener(pipelineFQN, runId, listener);
                      }
                    } catch (Exception e) {
                      LOG.error("Error streaming logs", e);
                    }
                  }
                })
            .build();
      } else if (isLogStorageEnabled()) {
        // Default storage - fallback to traditional logs
        return getTraditionalLogs(pipelineFQN, runId);
      } else {
        // No log storage configured
        return Response.status(Response.Status.NOT_FOUND)
            .entity("Log storage is not configured")
            .build();
      }
    } catch (Exception e) {
      LOG.error("Failed to stream logs for pipeline: {}, runId: {}", pipelineFQN, runId, e);
      return Response.serverError().entity(e.getMessage()).build();
    }
  }

  private Response getTraditionalLogs(String pipelineFQN, UUID runId) {
    // Fallback to traditional pipeline service logs
    try {
      IngestionPipeline pipeline =
          Entity.getEntityByName(Entity.INGESTION_PIPELINE, pipelineFQN, "", Include.ALL);
      Map<String, String> logs = pipelineServiceClient.getLastIngestionLogs(pipeline, null);
      return Response.ok(logs).build();
    } catch (Exception e) {
      return Response.serverError().entity(e.getMessage()).build();
    }
  }

  private List<PipelineStatus> getQueuedPipelineStatus(String pipelineFQN, int limit) {
    try {
      IngestionPipeline pipeline = findByName(pipelineFQN, Include.NON_DELETED);
      List<PipelineStatus> statuses = pipelineServiceClient.getQueuedPipelineStatus(pipeline);
      return statuses.size() > limit ? statuses.subList(0, limit) : statuses;
    } catch (Exception e) {
      return new ArrayList<>();
    }
  }

  public PipelineServiceClientResponse deployIngestionPipeline(
      IngestionPipeline ingestionPipeline, ServiceEntityInterface service) {
    return pipelineServiceClient.deployPipeline(ingestionPipeline, service);
  }

  public boolean isIngestionRunnerStreamableLogsEnabled(EntityReference ingestionRunner) {
    return false; // Default implementation
  }
}
