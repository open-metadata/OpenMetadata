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

package org.openmetadata.catalog.jdbi3;

import static org.openmetadata.catalog.Entity.FIELD_OWNER;
import static org.openmetadata.catalog.util.EntityUtil.objectMatch;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.api.services.CreatePipelineService;
import org.openmetadata.catalog.entity.services.PipelineService;
import org.openmetadata.catalog.exception.CatalogExceptionMessage;
import org.openmetadata.catalog.exception.InvalidServiceConnectionException;
import org.openmetadata.catalog.fernet.Fernet;
import org.openmetadata.catalog.resources.services.pipeline.PipelineServiceResource;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.type.Include;
import org.openmetadata.catalog.type.PipelineConnection;
import org.openmetadata.catalog.type.Relationship;
import org.openmetadata.catalog.util.EntityUtil.Fields;
import org.openmetadata.catalog.util.JsonUtils;

public class PipelineServiceRepository extends EntityRepository<PipelineService> {
  private static final String UPDATE_FIELDS = "owner";
  private final Fernet fernet;

  public PipelineServiceRepository(CollectionDAO dao) {
    super(
        PipelineServiceResource.COLLECTION_PATH,
        Entity.PIPELINE_SERVICE,
        PipelineService.class,
        dao.pipelineServiceDAO(),
        dao,
        "",
        UPDATE_FIELDS);
    this.allowEdits = true;
    fernet = Fernet.getInstance();
  }

  public void rotate() throws IOException {
    if (!fernet.isKeyDefined()) {
      throw new IllegalArgumentException(CatalogExceptionMessage.FERNET_KEY_NULL);
    }
    ListFilter filter = new ListFilter(Include.ALL);
    List<String> jsons = dao.listAfter(filter, Integer.MAX_VALUE, "");
    for (String json : jsons) {
      PipelineService pipelineService = JsonUtils.readValue(json, PipelineService.class);
      PipelineConnection pipelineConnection = pipelineService.getConnection();
      fernet.encryptOrDecryptPipelineConnection(pipelineConnection, pipelineService.getServiceType(), true);
      storeEntity(pipelineService, true);
    }
  }

  @Override
  public PipelineService setFields(PipelineService entity, Fields fields) throws IOException {
    entity.setPipelines(fields.contains("pipelines") ? getIngestionPipelines(entity) : null);
    entity.setOwner(fields.contains(FIELD_OWNER) ? getOwner(entity) : null);
    return entity;
  }

  private List<EntityReference> getIngestionPipelines(PipelineService service) throws IOException {
    List<String> ingestionPipelineIds =
        findTo(service.getId(), Entity.PIPELINE_SERVICE, Relationship.CONTAINS, Entity.INGESTION_PIPELINE);
    List<EntityReference> ingestionPipelines = new ArrayList<>();
    for (String ingestionPipelineId : ingestionPipelineIds) {
      ingestionPipelines.add(
          daoCollection
              .ingestionPipelineDAO()
              .findEntityReferenceById(UUID.fromString(ingestionPipelineId), Include.ALL));
    }
    return ingestionPipelines;
  }

  @Override
  public void prepare(PipelineService entity) throws IOException {
    setFullyQualifiedName(entity);
    // Check if owner is valid and set the relationship
    entity.setOwner(Entity.getEntityReference(entity.getOwner()));
    // Validate pipeline service connection. Make sure we can load the class generated from the JSON Schemas
    validatePipelineConnection(entity.getConnection(), entity.getServiceType());
  }

  @Override
  public void storeEntity(PipelineService service, boolean update) throws IOException {
    // Relationships and fields such as href are derived and not stored as part of json
    EntityReference owner = service.getOwner();

    // Don't store owner, href and tags as JSON. Build it on the fly based on relationships
    service.withOwner(null).withHref(null);

    store(service.getId(), service, update);

    // Restore the relationships
    service.withOwner(owner);
  }

  @Override
  public void storeRelationships(PipelineService entity) {
    // Add owner relationship
    storeOwner(entity, entity.getOwner());
  }

  @Override
  public EntityUpdater getUpdater(PipelineService original, PipelineService updated, Operation operation) {
    return new PipelineServiceUpdater(original, updated, operation);
  }

  private void validatePipelineConnection(
      PipelineConnection pipelineConnection, CreatePipelineService.PipelineServiceType pipelineServiceType) {
    try {
      Object connectionConfig = pipelineConnection.getConfig();
      String clazzName =
          "org.openmetadata.catalog.services.connections.pipeline." + pipelineServiceType.value() + "Connection";
      Class<?> clazz = Class.forName(clazzName);
      JsonUtils.convertValue(connectionConfig, clazz);
    } catch (Exception e) {
      throw InvalidServiceConnectionException.byMessage(
          pipelineServiceType.value(),
          String.format("Failed to construct connection instance of %s", pipelineServiceType.value()));
    }
  }

  public class PipelineServiceUpdater extends EntityUpdater {
    public PipelineServiceUpdater(PipelineService original, PipelineService updated, Operation operation) {
      super(original, updated, operation);
    }

    @Override
    public void entitySpecificUpdate() throws IOException {
      updateConnection();
    }

    private void updateConnection() throws IOException {
      PipelineConnection origConn = original.getConnection();
      PipelineConnection updatedConn = updated.getConnection();
      String origJson = JsonUtils.pojoToJson(origConn);
      String updatedJson = JsonUtils.pojoToJson(updatedConn);
      PipelineConnection decryptedOrigConn = JsonUtils.readValue(origJson, PipelineConnection.class);
      PipelineConnection decryptedUpdatedConn = JsonUtils.readValue(updatedJson, PipelineConnection.class);
      fernet.encryptOrDecryptPipelineConnection(decryptedOrigConn, original.getServiceType(), false);
      fernet.encryptOrDecryptPipelineConnection(decryptedUpdatedConn, updated.getServiceType(), false);
      if (!objectMatch.test(decryptedOrigConn, decryptedUpdatedConn)) {
        recordChange("connection", origConn, updatedConn, true);
      }
    }
  }
}
