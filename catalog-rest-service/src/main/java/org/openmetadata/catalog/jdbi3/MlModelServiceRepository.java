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

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.api.services.CreateMlModelService;
import org.openmetadata.catalog.entity.services.MlModelService;
import org.openmetadata.catalog.exception.InvalidServiceConnectionException;
import org.openmetadata.catalog.resources.services.mlmodel.MlModelServiceResource;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.type.Include;
import org.openmetadata.catalog.type.MlModelConnection;
import org.openmetadata.catalog.type.Relationship;
import org.openmetadata.catalog.util.EntityUtil.Fields;
import org.openmetadata.catalog.util.JsonUtils;

public class MlModelServiceRepository extends EntityRepository<MlModelService> {
  private static final String UPDATE_FIELDS = "owner,connection";

  public MlModelServiceRepository(CollectionDAO dao) {
    super(
        MlModelServiceResource.COLLECTION_PATH,
        Entity.MLMODEL_SERVICE,
        MlModelService.class,
        dao.mlModelServiceDAO(),
        dao,
        "",
        UPDATE_FIELDS);
    this.allowEdits = true;
  }

  @Override
  public MlModelService setFields(MlModelService entity, Fields fields) throws IOException {
    entity.setPipelines(fields.contains("pipelines") ? getIngestionPipelines(entity) : null);
    entity.setOwner(fields.contains(FIELD_OWNER) ? getOwner(entity) : null);
    return entity;
  }

  private List<EntityReference> getIngestionPipelines(MlModelService service) throws IOException {
    List<String> ingestionMlModelIds =
        findTo(service.getId(), Entity.PIPELINE_SERVICE, Relationship.CONTAINS, Entity.INGESTION_PIPELINE);
    List<EntityReference> ingestionMlModels = new ArrayList<>();
    for (String ingestionMlModelId : ingestionMlModelIds) {
      ingestionMlModels.add(
          daoCollection
              .ingestionPipelineDAO()
              .findEntityReferenceById(UUID.fromString(ingestionMlModelId), Include.ALL));
    }
    return ingestionMlModels;
  }

  @Override
  public void prepare(MlModelService entity) throws IOException {
    setFullyQualifiedName(entity);
    // Check if owner is valid and set the relationship
    entity.setOwner(Entity.getEntityReference(entity.getOwner()));
    // Validate mlModel service connection. Make sure we can load the class generated from the JSON Schemas
    validateMlModelConnection(entity.getConnection(), entity.getServiceType());
  }

  @Override
  public void storeEntity(MlModelService service, boolean update) throws IOException {
    // Relationships and fields such as href are derived and not stored as part of json
    EntityReference owner = service.getOwner();

    // Don't store owner, href and tags as JSON. Build it on the fly based on relationships
    service.withOwner(null).withHref(null);

    store(service.getId(), service, update);

    // Restore the relationships
    service.withOwner(owner);
  }

  @Override
  public void storeRelationships(MlModelService entity) {
    // Add owner relationship
    storeOwner(entity, entity.getOwner());
  }

  @Override
  public EntityUpdater getUpdater(MlModelService original, MlModelService updated, Operation operation) {
    return new MlModelServiceUpdater(original, updated, operation);
  }

  private void validateMlModelConnection(
      MlModelConnection mlModelConnection, CreateMlModelService.MlModelServiceType mlModelServiceType) {
    try {
      Object connectionConfig = mlModelConnection.getConfig();
      String clazzName =
          "org.openmetadata.catalog.services.connections.mlModel." + mlModelServiceType.value() + "Connection";
      Class<?> clazz = Class.forName(clazzName);
      JsonUtils.convertValue(connectionConfig, clazz);
    } catch (Exception e) {
      throw InvalidServiceConnectionException.byMessage(
          mlModelServiceType.value(),
          String.format("Failed to construct connection instance of %s", mlModelServiceType.value()));
    }
  }

  public class MlModelServiceUpdater extends EntityUpdater {
    public MlModelServiceUpdater(MlModelService original, MlModelService updated, Operation operation) {
      super(original, updated, operation);
    }

    @Override
    public void entitySpecificUpdate() throws IOException {
      recordChange("connection", original.getConnection(), updated.getConnection(), true);
    }
  }
}
