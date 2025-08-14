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

import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.core.UriInfo;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.sqlobject.transaction.Transaction;
import org.json.JSONObject;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.ServiceEntityInterface;
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
import org.openmetadata.sdk.PipelineServiceClientInterface;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.resources.services.ingestionpipelines.IngestionPipelineResource;
import org.openmetadata.service.secrets.SecretsManager;
import org.openmetadata.service.secrets.SecretsManagerFactory;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.FullyQualifiedName;
import org.openmetadata.service.util.RestUtil;
import org.openmetadata.service.util.ResultList;

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
  public void setFields(IngestionPipeline ingestionPipeline, Fields fields) {
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

    ingestionPipeline.withService(null).withOpenMetadataServerConnection(null);
    store(ingestionPipeline, update);
    ingestionPipeline.withService(service).withOpenMetadataServerConnection(openmetadataConnection);
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
  protected void postDelete(IngestionPipeline entity) {
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

    // Update ES Indexes
    searchRepository.updateEntityIndex(ingestionPipeline);

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
      updateSourceConfig();
      updateAirflowConfig(original.getAirflowConfig(), updated.getAirflowConfig());
      updateLogLevel(original.getLoggerLevel(), updated.getLoggerLevel());
      updateEnabled(original.getEnabled(), updated.getEnabled());
      updateDeployed(original.getDeployed(), updated.getDeployed());
      updateProcessingEngine(original.getProcessingEngine(), updated.getProcessingEngine());
      updateRaiseOnError(original.getRaiseOnError(), updated.getRaiseOnError());
    }

    private void updateProcessingEngine(
        EntityReference originalProcessingEngine, EntityReference updatedProcessingEngine) {
      if (!originalProcessingEngine.equals(updatedProcessingEngine)) {
        recordChange("processingEngine", originalProcessingEngine, updatedProcessingEngine);
      }
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
      if (!origAirflowConfig.equals(updatedAirflowConfig)) {
        recordChange("airflowConfig", origAirflowConfig, updatedAirflowConfig);
      }
    }

    private void updateLogLevel(LogLevels origLevel, LogLevels updatedLevel) {
      if (updatedLevel != null && !origLevel.equals(updatedLevel)) {
        recordChange("loggerLevel", origLevel, updatedLevel);
      }
    }

    private void updateDeployed(Boolean origDeployed, Boolean updatedDeployed) {
      if (updatedDeployed != null && !origDeployed.equals(updatedDeployed)) {
        recordChange("deployed", origDeployed, updatedDeployed);
      }
    }

    private void updateRaiseOnError(Boolean origRaiseOnError, Boolean updatedRaiseOnError) {
      if (updatedRaiseOnError != null && !origRaiseOnError.equals(updatedRaiseOnError)) {
        recordChange("raiseOnError", origRaiseOnError, updatedRaiseOnError);
      }
    }

    private void updateEnabled(Boolean origEnabled, Boolean updatedEnabled) {
      if (updatedEnabled != null && !origEnabled.equals(updatedEnabled)) {
        recordChange("enabled", origEnabled, updatedEnabled);
      }
    }
  }

  private static IngestionPipeline buildIngestionPipelineDecrypted(IngestionPipeline original) {
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

  public PipelineServiceClientResponse deployIngestionPipeline(
      IngestionPipeline ingestionPipeline, ServiceEntityInterface service) {
    return pipelineServiceClient.deployPipeline(ingestionPipeline, service);
  }
}
