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
import java.net.URI;
import java.util.UUID;
import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.entity.services.DashboardService;
import org.openmetadata.catalog.resources.services.dashboard.DashboardServiceResource;
import org.openmetadata.catalog.type.ChangeDescription;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.type.Schedule;
import org.openmetadata.catalog.util.EntityInterface;
import org.openmetadata.catalog.util.EntityUtil;
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
    entity.setOwner(fields.contains(FIELD_OWNER) ? getOwner(entity) : null);
    return entity;
  }

  @Override
  public EntityInterface<DashboardService> getEntityInterface(DashboardService entity) {
    return new DashboardServiceEntityInterface(entity);
  }

  @Override
  public void prepare(DashboardService entity) throws IOException {
    // Check if owner is valid and set the relationship
    entity.setOwner(Entity.getEntityReference(entity.getOwner()));
    EntityUtil.validateIngestionSchedule(entity.getIngestionSchedule());
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
    setOwner(entity, entity.getOwner());
  }

  @Override
  public EntityUpdater getUpdater(DashboardService original, DashboardService updated, Operation operation) {
    return new DashboardServiceUpdater(original, updated, operation);
  }

  public static class DashboardServiceEntityInterface extends EntityInterface<DashboardService> {
    public DashboardServiceEntityInterface(DashboardService entity) {
      super(Entity.DASHBOARD_SERVICE, entity);
    }

    @Override
    public UUID getId() {
      return entity.getId();
    }

    @Override
    public String getDescription() {
      return entity.getDescription();
    }

    @Override
    public String getDisplayName() {
      return entity.getDisplayName();
    }

    @Override
    public String getName() {
      return entity.getName();
    }

    @Override
    public Boolean isDeleted() {
      return entity.getDeleted();
    }

    @Override
    public EntityReference getOwner() {
      return entity.getOwner();
    }

    @Override
    public String getFullyQualifiedName() {
      return entity.getName();
    }

    @Override
    public Double getVersion() {
      return entity.getVersion();
    }

    @Override
    public String getUpdatedBy() {
      return entity.getUpdatedBy();
    }

    @Override
    public long getUpdatedAt() {
      return entity.getUpdatedAt();
    }

    @Override
    public URI getHref() {
      return entity.getHref();
    }

    @Override
    public ChangeDescription getChangeDescription() {
      return entity.getChangeDescription();
    }

    @Override
    public DashboardService getEntity() {
      return entity;
    }

    @Override
    public void setId(UUID id) {
      entity.setId(id);
    }

    @Override
    public void setDescription(String description) {
      entity.setDescription(description);
    }

    @Override
    public void setDisplayName(String displayName) {
      entity.setDisplayName(displayName);
    }

    @Override
    public void setName(String name) {
      entity.setName(name);
    }

    @Override
    public void setUpdateDetails(String updatedBy, long updatedAt) {
      entity.setUpdatedBy(updatedBy);
      entity.setUpdatedAt(updatedAt);
    }

    @Override
    public void setChangeDescription(Double newVersion, ChangeDescription changeDescription) {
      entity.setVersion(newVersion);
      entity.setChangeDescription(changeDescription);
    }

    @Override
    public void setOwner(EntityReference owner) {
      entity.setOwner(owner);
    }

    @Override
    public void setDeleted(boolean flag) {
      entity.setDeleted(flag);
    }

    @Override
    public DashboardService withHref(URI href) {
      return entity.withHref(href);
    }
  }

  public class DashboardServiceUpdater extends EntityUpdater {
    public DashboardServiceUpdater(DashboardService original, DashboardService updated, Operation operation) {
      super(original, updated, operation);
    }

    @Override
    public void entitySpecificUpdate() throws IOException {
      updateDashboardUrl();
      updateIngestionSchedule();
      recordChange("userName", original.getEntity().getUsername(), updated.getEntity().getUsername());
      // TODO change recorded for password
      //      recordChange("password", original.getEntity().getPassword(), updated.getEntity().getPassword());
    }

    private void updateDashboardUrl() throws JsonProcessingException {
      recordChange("dashboardUrl", original.getEntity().getDashboardUrl(), updated.getEntity().getDashboardUrl());
    }

    private void updateIngestionSchedule() throws JsonProcessingException {
      Schedule origSchedule = original.getEntity().getIngestionSchedule();
      Schedule updatedSchedule = updated.getEntity().getIngestionSchedule();
      recordChange("ingestionSchedule", origSchedule, updatedSchedule, true);
    }
  }
}
