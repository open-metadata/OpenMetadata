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

import static org.openmetadata.service.Entity.FIELD_OWNER;

import com.fasterxml.jackson.core.JsonProcessingException;
import java.io.IOException;
import org.json.JSONObject;
import org.openmetadata.schema.entity.services.ingestionPipelines.AirflowConfig;
import org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.schema.metadataIngestion.DatabaseServiceMetadataPipeline;
import org.openmetadata.schema.metadataIngestion.LogLevels;
import org.openmetadata.schema.services.connections.metadata.OpenMetadataServerConnection;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.service.Entity;
import org.openmetadata.service.resources.services.ingestionpipelines.IngestionPipelineResource;
import org.openmetadata.service.secrets.SecretsManager;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.FullyQualifiedName;
import org.openmetadata.service.util.JsonUtils;
import org.openmetadata.service.util.PipelineServiceClient;

public class IngestionPipelineRepository extends EntityRepository<IngestionPipeline> {
  private static final String UPDATE_FIELDS = "owner,sourceConfig,airflowConfig,loggerLevel,enabled";
  private static final String PATCH_FIELDS = "owner,sourceConfig,airflowConfig,loggerLevel,enabled";
  private static PipelineServiceClient pipelineServiceClient;

  private final SecretsManager secretsManager;

  public IngestionPipelineRepository(CollectionDAO dao, SecretsManager secretsManager) {
    super(
        IngestionPipelineResource.COLLECTION_PATH,
        Entity.INGESTION_PIPELINE,
        IngestionPipeline.class,
        dao.ingestionPipelineDAO(),
        dao,
        PATCH_FIELDS,
        UPDATE_FIELDS);
    this.secretsManager = secretsManager;
  }

  @Override
  public void setFullyQualifiedName(IngestionPipeline ingestionPipeline) {
    ingestionPipeline.setFullyQualifiedName(
        FullyQualifiedName.add(ingestionPipeline.getService().getName(), ingestionPipeline.getName()));
  }

  @Override
  public IngestionPipeline setFields(IngestionPipeline ingestionPipeline, Fields fields) throws IOException {
    ingestionPipeline.setService(getContainer(ingestionPipeline.getId()));
    ingestionPipeline.setOwner(fields.contains(FIELD_OWNER) ? getOwner(ingestionPipeline) : null);
    return ingestionPipeline;
  }

  @Override
  public void prepare(IngestionPipeline ingestionPipeline) throws IOException {
    EntityReference entityReference = Entity.getEntityReference(ingestionPipeline.getService());
    ingestionPipeline.setService(entityReference);
    setFullyQualifiedName(ingestionPipeline);
  }

  @Override
  public void storeEntity(IngestionPipeline ingestionPipeline, boolean update) throws IOException {
    // Relationships and fields such as href are derived and not stored as part of json
    EntityReference owner = ingestionPipeline.getOwner();
    EntityReference service = ingestionPipeline.getService();

    // Don't store owner. Build it on the fly based on relationships
    ingestionPipeline.withOwner(null).withService(null).withHref(null);

    // encrypt config in case of local secret manager
    if (secretsManager.isLocal()) {
      secretsManager.encryptOrDecryptDbtConfigSource(ingestionPipeline, service, true);
      store(ingestionPipeline.getId(), ingestionPipeline, update);
    } else {
      // otherwise, nullify the config since it will be kept outside OM
      DatabaseServiceMetadataPipeline databaseServiceMetadataPipeline =
          JsonUtils.convertValue(
              ingestionPipeline.getSourceConfig().getConfig(), DatabaseServiceMetadataPipeline.class);
      Object dbtConfigSource = databaseServiceMetadataPipeline.getDbtConfigSource();
      databaseServiceMetadataPipeline.setDbtConfigSource(null);
      ingestionPipeline.getSourceConfig().setConfig(databaseServiceMetadataPipeline);
      store(ingestionPipeline.getId(), ingestionPipeline, update);
      // save config in the secret manager after storing the ingestion pipeline
      databaseServiceMetadataPipeline.setDbtConfigSource(dbtConfigSource);
      ingestionPipeline.getSourceConfig().setConfig(databaseServiceMetadataPipeline);
      secretsManager.encryptOrDecryptDbtConfigSource(ingestionPipeline, service, true);
    }

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
    pipelineServiceClient.deletePipeline(entity.getName());
  }

  public void setPipelineServiceClient(PipelineServiceClient client) {
    pipelineServiceClient = client;
  }

  /** Handles entity updated from PUT and POST operation. */
  public class IngestionPipelineUpdater extends EntityUpdater {
    public IngestionPipelineUpdater(IngestionPipeline original, IngestionPipeline updated, Operation operation) {
      super(original, updated, operation);
    }

    @Override
    public void entitySpecificUpdate() throws IOException {
      updateSourceConfig();
      updateAirflowConfig(original.getAirflowConfig(), updated.getAirflowConfig());
      updateOpenMetadataServerConnection(
          original.getOpenMetadataServerConnection(), updated.getOpenMetadataServerConnection());
      updateLogLevel(original.getLoggerLevel(), updated.getLoggerLevel());
      updateEnabled(original.getEnabled(), updated.getEnabled());
    }

    private void updateSourceConfig() throws JsonProcessingException {
      secretsManager.encryptOrDecryptDbtConfigSource(original, false);

      JSONObject origSourceConfig = new JSONObject(JsonUtils.pojoToJson(original.getSourceConfig().getConfig()));
      JSONObject updatedSourceConfig = new JSONObject(JsonUtils.pojoToJson(updated.getSourceConfig().getConfig()));

      original.getSourceConfig().setConfig(null);

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
        OpenMetadataServerConnection origConfig, OpenMetadataServerConnection updatedConfig)
        throws JsonProcessingException {
      if (updatedConfig != null && !origConfig.equals(updatedConfig)) {
        recordChange("openMetadataServerConnection", origConfig, updatedConfig);
      }
    }

    private void updateLogLevel(LogLevels origLevel, LogLevels updatedLevel) throws JsonProcessingException {
      if (updatedLevel != null && !origLevel.equals(updatedLevel)) {
        recordChange("loggerLevel", origLevel, updatedLevel);
      }
    }

    private void updateEnabled(Boolean origEnabled, Boolean updatedEnabled) throws JsonProcessingException {
      if (updatedEnabled != null && !origEnabled.equals(updatedEnabled)) {
        recordChange("enabled", origEnabled, updatedEnabled);
      }
    }
  }
}
