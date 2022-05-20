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

import com.fasterxml.jackson.core.JsonProcessingException;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.entity.services.DashboardService;
import org.openmetadata.catalog.resources.services.dashboard.DashboardServiceResource;
import org.openmetadata.catalog.type.DashboardConnection;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.type.Include;
import org.openmetadata.catalog.type.Relationship;
import org.openmetadata.catalog.util.EntityUtil.Fields;

public class DashboardServiceRepository extends EntityRepository<DashboardService> {
  private static final String UPDATE_FIELDS = "owner";

  public DashboardServiceRepository(CollectionDAO dao) {
    super(
        DashboardServiceResource.COLLECTION_PATH,
        Entity.DASHBOARD_SERVICE,
        DashboardService.class,
        dao.dashboardServiceDAO(),
        dao,
        "",
        UPDATE_FIELDS);
    this.allowEdits = true;
  }

  @Override
  public DashboardService setFields(DashboardService entity, Fields fields) throws IOException {
    entity.setPipelines(fields.contains("pipelines") ? getIngestionPipelines(entity) : null);
    entity.setOwner(fields.contains(FIELD_OWNER) ? getOwner(entity) : null);
    return entity;
  }

  @Override
  public void prepare(DashboardService entity) throws IOException {
    // Check if owner is valid and set the relationship
    setFullyQualifiedName(entity);
    entity.setOwner(Entity.getEntityReference(entity.getOwner()));
  }

  @Override
  public void storeEntity(DashboardService service, boolean update) throws IOException {
    // Relationships and fields such as href are derived and not stored as part of json
    EntityReference owner = service.getOwner();

    // Don't store owner, database, href and tags as JSON. Build it on the fly based on relationships
    service.withOwner(null).withHref(null);

    store(service.getId(), service, update);

    // Restore the relationships
    service.withOwner(owner);
  }

  @Override
  public void storeRelationships(DashboardService entity) {
    // Add owner relationship
    storeOwner(entity, entity.getOwner());
  }

  @Override
  public EntityUpdater getUpdater(DashboardService original, DashboardService updated, Operation operation) {
    return new DashboardServiceUpdater(original, updated, operation);
  }

  private List<EntityReference> getIngestionPipelines(DashboardService service) throws IOException {
    List<String> ingestionPipelineIds =
        findTo(service.getId(), Entity.DASHBOARD_SERVICE, Relationship.CONTAINS, Entity.INGESTION_PIPELINE);
    List<EntityReference> ingestionPipelines = new ArrayList<>();
    for (String ingestionPipelineId : ingestionPipelineIds) {
      ingestionPipelines.add(
          daoCollection
              .ingestionPipelineDAO()
              .findEntityReferenceById(UUID.fromString(ingestionPipelineId), Include.ALL));
    }
    return ingestionPipelines;
  }

  public class DashboardServiceUpdater extends EntityUpdater {
    public DashboardServiceUpdater(DashboardService original, DashboardService updated, Operation operation) {
      super(original, updated, operation);
    }

    @Override
    public void entitySpecificUpdate() throws IOException {
      updateConnection();
    }

    private void updateConnection() throws JsonProcessingException {
      DashboardConnection origConn = original.getConnection();
      DashboardConnection updatedConn = updated.getConnection();
      recordChange("connection", origConn, updatedConn, true);
    }
  }
}
