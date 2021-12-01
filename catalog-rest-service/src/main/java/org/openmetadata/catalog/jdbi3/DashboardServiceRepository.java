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

import com.fasterxml.jackson.core.JsonProcessingException;
import org.jdbi.v3.sqlobject.transaction.Transaction;
import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.entity.services.DashboardService;
import org.openmetadata.catalog.exception.EntityNotFoundException;
import org.openmetadata.catalog.resources.services.dashboard.DashboardServiceResource;
import org.openmetadata.catalog.type.ChangeDescription;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.type.Schedule;
import org.openmetadata.catalog.type.TagLabel;
import org.openmetadata.catalog.util.EntityInterface;
import org.openmetadata.catalog.util.EntityUtil;
import org.openmetadata.catalog.util.EntityUtil.Fields;
import org.openmetadata.catalog.util.JsonUtils;

import javax.ws.rs.core.UriInfo;
import java.io.IOException;
import java.net.URI;
import java.text.ParseException;
import java.util.Date;
import java.util.List;
import java.util.UUID;

import static org.openmetadata.catalog.exception.CatalogExceptionMessage.entityNotFound;


public class DashboardServiceRepository extends EntityRepository<DashboardService> {
  private final CollectionDAO dao;

  public DashboardServiceRepository(CollectionDAO dao) {
    super(DashboardServiceResource.COLLECTION_PATH, Entity.DASHBOARD_SERVICE, DashboardService.class,
            dao.dashboardServiceDAO(), dao, Fields.EMPTY_FIELDS, Fields.EMPTY_FIELDS);
    this.dao = dao;
  }

  public DashboardService update(UriInfo uriInfo, UUID id, String description, URI dashboardUrl, String username,
                                 String password, Schedule ingestionSchedule)
          throws IOException {
    EntityUtil.validateIngestionSchedule(ingestionSchedule);
    DashboardService dashboardService = dao.dashboardServiceDAO().findEntityById(id);
    // Update fields
    dashboardService.withDescription(description).withDashboardUrl(dashboardUrl).withUsername(username)
            .withPassword(password).withIngestionSchedule(ingestionSchedule);
    dao.dashboardServiceDAO().update(id, JsonUtils.pojoToJson(dashboardService));
    return withHref(uriInfo, dashboardService);
  }

  @Transaction
  public void delete(UUID id) {
    if (dao.dashboardServiceDAO().delete(id) <= 0) {
      throw EntityNotFoundException.byMessage(entityNotFound(Entity.CHART, id));
    }
    dao.relationshipDAO().deleteAll(id.toString());
  }

  @Override
  public DashboardService setFields(DashboardService entity, Fields fields) throws IOException, ParseException {
    return entity;
  }

  @Override
  public void restorePatchAttributes(DashboardService original, DashboardService updated) throws IOException,
          ParseException {
  }

  @Override
  public EntityInterface<DashboardService> getEntityInterface(DashboardService entity) {
    return new DashboardServiceEntityInterface(entity);
  }

  @Override
  public void prepare(DashboardService entity) throws IOException {
    EntityUtil.validateIngestionSchedule(entity.getIngestionSchedule());
  }

  @Override
  public void storeEntity(DashboardService service, boolean update) throws IOException {
    if (update) {
      dao.dashboardServiceDAO().update(service.getId(), JsonUtils.pojoToJson(service));
    } else {
      dao.dashboardServiceDAO().insert(service);
    }
  }

  @Override
  public void storeRelationships(DashboardService entity) throws IOException {
  }

  @Override
  public EntityUpdater getUpdater(DashboardService original, DashboardService updated, boolean patchOperation)
          throws IOException {
    return new DashboardServiceUpdater(original, updated, patchOperation);
  }

  public static class DashboardServiceEntityInterface implements EntityInterface<DashboardService> {
    private final DashboardService entity;

    public DashboardServiceEntityInterface(DashboardService entity) {
      this.entity = entity;
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
    public EntityReference getOwner() { return null; }

    @Override
    public String getFullyQualifiedName() { return entity.getName(); }

    @Override
    public List<TagLabel> getTags() { return null; }

    @Override
    public Double getVersion() { return entity.getVersion(); }

    @Override
    public String getUpdatedBy() { return entity.getUpdatedBy(); }

    @Override
    public Date getUpdatedAt() { return entity.getUpdatedAt(); }

    @Override
    public URI getHref() { return entity.getHref(); }

    @Override
    public List<EntityReference> getFollowers() {
      throw new UnsupportedOperationException("Dashboard service does not support followers");
    }

    @Override
    public ChangeDescription getChangeDescription() { return entity.getChangeDescription(); }

    @Override
    public EntityReference getEntityReference() {
      return new EntityReference().withId(getId()).withName(getFullyQualifiedName()).withDescription(getDescription())
              .withDisplayName(getDisplayName()).withType(Entity.DASHBOARD_SERVICE);
    }

    @Override
    public DashboardService getEntity() { return entity; }

    @Override
    public void setId(UUID id) { entity.setId(id); }

    @Override
    public void setDescription(String description) {
      entity.setDescription(description);
    }

    @Override
    public void setDisplayName(String displayName) {
      entity.setDisplayName(displayName);
    }

    @Override
    public void setUpdateDetails(String updatedBy, Date updatedAt) {
      entity.setUpdatedBy(updatedBy);
      entity.setUpdatedAt(updatedAt);
    }

    @Override
    public void setChangeDescription(Double newVersion, ChangeDescription changeDescription) {
      entity.setVersion(newVersion);
      entity.setChangeDescription(changeDescription);
    }

    @Override
    public void setOwner(EntityReference owner) { }

    @Override
    public DashboardService withHref(URI href) { return entity.withHref(href); }

    @Override
    public void setTags(List<TagLabel> tags) { }
  }

  public class DashboardServiceUpdater extends EntityUpdater {
    public DashboardServiceUpdater(DashboardService original, DashboardService updated, boolean patchOperation) {
      super(original, updated, patchOperation);
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