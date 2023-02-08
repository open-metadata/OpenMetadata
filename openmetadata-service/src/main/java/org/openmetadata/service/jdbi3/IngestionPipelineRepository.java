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

import com.fasterxml.jackson.core.JsonProcessingException;
import java.io.IOException;
import java.util.List;
import java.util.UUID;
import javax.ws.rs.core.Response;
import javax.ws.rs.core.UriInfo;
import org.jdbi.v3.sqlobject.transaction.Transaction;
import org.json.JSONObject;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.services.ingestionPipelines.AirflowConfig;
import org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineStatus;
import org.openmetadata.schema.metadataIngestion.LogLevels;
import org.openmetadata.schema.services.connections.metadata.OpenMetadataConnection;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EventType;
import org.openmetadata.schema.type.FieldChange;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.sdk.PipelineServiceClient;
import org.openmetadata.service.Entity;
import org.openmetadata.service.resources.services.ingestionpipelines.IngestionPipelineResource;
import org.openmetadata.service.secrets.SecretsManager;
import org.openmetadata.service.secrets.SecretsManagerFactory;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.FullyQualifiedName;
import org.openmetadata.service.util.JsonUtils;
import org.openmetadata.service.util.RestUtil;
import org.openmetadata.service.util.ResultList;

public class IngestionPipelineRepository extends EntityRepository<IngestionPipeline> {
  private static final String UPDATE_FIELDS = "owner,sourceConfig,airflowConfig,loggerLevel,enabled,deployed";
  private static final String PATCH_FIELDS = "owner,sourceConfig,airflowConfig,loggerLevel,enabled,deployed";

  private static final String PIPELINE_STATUS_JSON_SCHEMA = "pipelineStatus";
  private static PipelineServiceClient pipelineServiceClient;

  public IngestionPipelineRepository(CollectionDAO dao) {
    super(
        IngestionPipelineResource.COLLECTION_PATH,
        Entity.INGESTION_PIPELINE,
        IngestionPipeline.class,
        dao.ingestionPipelineDAO(),
        dao,
        PATCH_FIELDS,
        UPDATE_FIELDS);
  }

  @Override
  public void setFullyQualifiedName(IngestionPipeline ingestionPipeline) {
    ingestionPipeline.setFullyQualifiedName(
        FullyQualifiedName.add(ingestionPipeline.getService().getName(), ingestionPipeline.getName()));
  }

  @Override
  public IngestionPipeline setFields(IngestionPipeline ingestionPipeline, Fields fields) throws IOException {
    return ingestionPipeline.withService(getContainer(ingestionPipeline.getId()));
  }

  @Override
  public void prepare(IngestionPipeline ingestionPipeline) throws IOException {
    EntityReference entityReference = Entity.getEntityReference(ingestionPipeline.getService(), Include.NON_DELETED);
    ingestionPipeline.setService(entityReference);
  }

  @Override
  public void storeEntity(IngestionPipeline ingestionPipeline, boolean update) throws IOException {
    // Relationships and fields such as href are derived and not stored as part of json
    EntityReference owner = ingestionPipeline.getOwner();
    EntityReference service = ingestionPipeline.getService();

    SecretsManager secretsManager = SecretsManagerFactory.getSecretsManager();
    if (secretsManager != null) {
      ingestionPipeline = secretsManager.encryptOrDecryptIngestionPipeline(ingestionPipeline, true);
    }

    // Don't store owner. Build it on the fly based on relationships
    ingestionPipeline.withOwner(null).withService(null).withHref(null);

    store(ingestionPipeline, update);

    // Restore the relationships
    ingestionPipeline.withOwner(owner).withService(service);
  }

  @Override
  public void storeRelationships(IngestionPipeline ingestionPipeline) {
    EntityReference service = ingestionPipeline.getService();
    addRelationship(
        service.getId(),
        ingestionPipeline.getId(),
        service.getType(),
        Entity.INGESTION_PIPELINE,
        Relationship.CONTAINS);
    storeOwner(ingestionPipeline, ingestionPipeline.getOwner());
    applyTags(ingestionPipeline);
  }

  @Override
  public EntityUpdater getUpdater(IngestionPipeline original, IngestionPipeline updated, Operation operation) {
    return new IngestionPipelineUpdater(original, updated, operation);
  }

  @Override
  protected void postDelete(IngestionPipeline entity) {
    pipelineServiceClient.deletePipeline(entity);
  }

  public void setPipelineServiceClient(PipelineServiceClient client) {
    pipelineServiceClient = client;
  }

  private ChangeEvent getChangeEvent(
      EntityInterface updated, ChangeDescription change, String entityType, Double prevVersion) {
    return new ChangeEvent()
        .withEntity(updated)
        .withChangeDescription(change)
        .withEventType(EventType.ENTITY_UPDATED)
        .withEntityType(entityType)
        .withEntityId(updated.getId())
        .withEntityFullyQualifiedName(updated.getFullyQualifiedName())
        .withUserName(updated.getUpdatedBy())
        .withTimestamp(System.currentTimeMillis())
        .withCurrentVersion(updated.getVersion())
        .withPreviousVersion(prevVersion);
  }

  private ChangeDescription addPipelineStatusChangeDescription(Double version, Object newValue, Object oldValue) {
    FieldChange fieldChange =
        new FieldChange().withName("pipelineStatus").withNewValue(newValue).withOldValue(oldValue);
    ChangeDescription change = new ChangeDescription().withPreviousVersion(version);
    change.getFieldsUpdated().add(fieldChange);
    return change;
  }

  @Transaction
  public RestUtil.PutResponse<?> addPipelineStatus(UriInfo uriInfo, String fqn, PipelineStatus pipelineStatus)
      throws IOException {
    // Validate the request content
    IngestionPipeline ingestionPipeline = dao.findEntityByName(fqn);

    PipelineStatus storedPipelineStatus =
        JsonUtils.readValue(
            daoCollection
                .entityExtensionTimeSeriesDao()
                .getLatestExtension(ingestionPipeline.getFullyQualifiedName(), pipelineStatus.getRunId()),
            PipelineStatus.class);
    if (storedPipelineStatus != null) {
      daoCollection
          .entityExtensionTimeSeriesDao()
          .update(
              ingestionPipeline.getFullyQualifiedName(),
              pipelineStatus.getRunId(),
              JsonUtils.pojoToJson(pipelineStatus),
              pipelineStatus.getTimestamp());
    } else {
      daoCollection
          .entityExtensionTimeSeriesDao()
          .insert(
              ingestionPipeline.getFullyQualifiedName(),
              pipelineStatus.getRunId(),
              "pipelineStatus",
              JsonUtils.pojoToJson(pipelineStatus));
    }
    ChangeDescription change =
        addPipelineStatusChangeDescription(ingestionPipeline.getVersion(), pipelineStatus, storedPipelineStatus);
    ChangeEvent changeEvent =
        getChangeEvent(withHref(uriInfo, ingestionPipeline), change, entityType, ingestionPipeline.getVersion());

    return new RestUtil.PutResponse<>(Response.Status.CREATED, changeEvent, RestUtil.ENTITY_FIELDS_CHANGED);
  }

  public ResultList<PipelineStatus> listPipelineStatus(String ingestionPipelineFQN, Long startTs, Long endTs)
      throws IOException {
    IngestionPipeline ingestionPipeline = dao.findEntityByName(ingestionPipelineFQN);
    List<PipelineStatus> pipelineStatusList =
        JsonUtils.readObjects(
            daoCollection
                .entityExtensionTimeSeriesDao()
                .listBetweenTimestampsByFQN(
                    ingestionPipeline.getFullyQualifiedName(), PIPELINE_STATUS_JSON_SCHEMA, startTs, endTs),
            PipelineStatus.class);
    List<PipelineStatus> allPipelineStatusList = pipelineServiceClient.getQueuedPipelineStatus(ingestionPipeline);
    allPipelineStatusList.addAll(pipelineStatusList);
    return new ResultList<>(
        allPipelineStatusList, String.valueOf(startTs), String.valueOf(endTs), allPipelineStatusList.size());
  }

  public PipelineStatus getLatestPipelineStatus(IngestionPipeline ingestionPipeline) throws IOException {
    return JsonUtils.readValue(
        daoCollection
            .entityExtensionTimeSeriesDao()
            .getLatestExtensionByFQN(ingestionPipeline.getFullyQualifiedName(), PIPELINE_STATUS_JSON_SCHEMA),
        PipelineStatus.class);
  }

  public PipelineStatus getPipelineStatus(String ingestionPipelineFQN, UUID pipelineStatusRunId) throws IOException {
    IngestionPipeline ingestionPipeline = dao.findEntityByName(ingestionPipelineFQN);
    return JsonUtils.readValue(
        daoCollection
            .entityExtensionTimeSeriesDao()
            .getExtension(ingestionPipeline.getFullyQualifiedName(), pipelineStatusRunId.toString()),
        PipelineStatus.class);
  }

  /** Handles entity updated from PUT and POST operation. */
  public class IngestionPipelineUpdater extends EntityUpdater {
    public IngestionPipelineUpdater(IngestionPipeline original, IngestionPipeline updated, Operation operation) {
      super(buildIngestionPipelineDecrypted(original), updated, operation);
    }

    @Override
    public void entitySpecificUpdate() throws IOException {
      updateSourceConfig();
      updateAirflowConfig(original.getAirflowConfig(), updated.getAirflowConfig());
      updateOpenMetadataServerConnection(
          original.getOpenMetadataServerConnection(), updated.getOpenMetadataServerConnection());
      updateLogLevel(original.getLoggerLevel(), updated.getLoggerLevel());
      updateEnabled(original.getEnabled(), updated.getEnabled());
      updateDeployed(original.getDeployed(), updated.getDeployed());
    }

    private void updateSourceConfig() throws JsonProcessingException {

      JSONObject origSourceConfig = new JSONObject(JsonUtils.pojoToJson(original.getSourceConfig().getConfig()));
      JSONObject updatedSourceConfig = new JSONObject(JsonUtils.pojoToJson(updated.getSourceConfig().getConfig()));

      if (!origSourceConfig.similar(updatedSourceConfig)) {
        recordChange("sourceConfig", "old-encrypted-value", "new-encrypted-value", true);
      }
    }

    private void updateAirflowConfig(AirflowConfig origAirflowConfig, AirflowConfig updatedAirflowConfig)
        throws JsonProcessingException {
      if (!origAirflowConfig.equals(updatedAirflowConfig)) {
        recordChange("airflowConfig", origAirflowConfig, updatedAirflowConfig);
      }
    }

    private void updateOpenMetadataServerConnection(
        OpenMetadataConnection origConfig, OpenMetadataConnection updatedConfig) throws JsonProcessingException {

      JSONObject origConfigJson = new JSONObject(JsonUtils.pojoToJson(origConfig));
      JSONObject updatedConfigJson = new JSONObject(JsonUtils.pojoToJson(updatedConfig));

      if (!origConfigJson.similar(updatedConfigJson)) {
        recordChange("openMetadataServerConnection", origConfig, updatedConfig);
      }
    }

    private void updateLogLevel(LogLevels origLevel, LogLevels updatedLevel) throws JsonProcessingException {
      if (updatedLevel != null && !origLevel.equals(updatedLevel)) {
        recordChange("loggerLevel", origLevel, updatedLevel);
      }
    }

    private void updateDeployed(Boolean origDeployed, Boolean updatedDeployed) throws JsonProcessingException {
      if (updatedDeployed != null && !origDeployed.equals(updatedDeployed)) {
        recordChange("deployed", origDeployed, updatedDeployed);
      }
    }

    private void updateEnabled(Boolean origEnabled, Boolean updatedEnabled) throws JsonProcessingException {
      if (updatedEnabled != null && !origEnabled.equals(updatedEnabled)) {
        recordChange("enabled", origEnabled, updatedEnabled);
      }
    }
  }

  private static IngestionPipeline buildIngestionPipelineDecrypted(IngestionPipeline original) {
    IngestionPipeline decrypted = JsonUtils.convertValue(JsonUtils.getMap(original), IngestionPipeline.class);
    decrypted = SecretsManagerFactory.getSecretsManager().encryptOrDecryptIngestionPipeline(decrypted, false);
    return decrypted;
  }
}
