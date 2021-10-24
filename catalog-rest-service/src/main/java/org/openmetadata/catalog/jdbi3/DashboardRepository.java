/*
 *  Licensed to the Apache Software Foundation (ASF) under one or more
 *  contributor license agreements. See the NOTICE file distributed with
 *  this work for additional information regarding copyright ownership.
 *  The ASF licenses this file to You under the Apache License, Version 2.0
 *  (the "License"); you may not use this file except in compliance with
 *  the License. You may obtain a copy of the License at
 *
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
import org.openmetadata.catalog.entity.data.Dashboard;
import org.openmetadata.catalog.exception.EntityNotFoundException;
import org.openmetadata.catalog.resources.dashboards.DashboardResource;
import org.openmetadata.catalog.resources.dashboards.DashboardResource.DashboardList;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.type.TagLabel;
import org.openmetadata.catalog.util.EntityInterface;
import org.openmetadata.catalog.util.EntityUpdater;
import org.openmetadata.catalog.util.EntityUtil;
import org.openmetadata.catalog.util.EntityUtil.Fields;
import org.openmetadata.catalog.util.JsonUtils;
import org.openmetadata.catalog.util.RestUtil.PutResponse;
import org.openmetadata.catalog.util.ResultList;

import javax.json.JsonPatch;
import javax.ws.rs.core.Response;
import javax.ws.rs.core.Response.Status;
import java.io.IOException;
import java.io.UnsupportedEncodingException;
import java.security.GeneralSecurityException;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.UUID;

import static org.openmetadata.catalog.exception.CatalogExceptionMessage.entityNotFound;

public class DashboardRepository extends EntityRepository<Dashboard> {
  private static final Fields DASHBOARD_UPDATE_FIELDS = new Fields(DashboardResource.FIELD_LIST,
          "owner,service,tags,charts");
  private static final Fields DASHBOARD_PATCH_FIELDS = new Fields(DashboardResource.FIELD_LIST,
          "owner,service,tags,charts");
  private final CollectionDAO dao;

  public DashboardRepository(CollectionDAO dao) {
    super(Dashboard.class, dao.dashboardDAO());
    this.dao = dao;
  }

  public static String getFQN(Dashboard dashboard) {
    return (dashboard.getService().getName() + "." + dashboard.getName());
  }

  @Override
  public String getFullyQualifiedName(Dashboard entity) {
    return entity.getFullyQualifiedName();
  }

  @Override
  public ResultList<Dashboard> getResultList(List<Dashboard> entities, String beforeCursor, String afterCursor,
                                             int total) throws GeneralSecurityException, UnsupportedEncodingException {
    return new DashboardList(entities, beforeCursor, afterCursor, total);
  }

  @Transaction
  public PutResponse<Dashboard> createOrUpdate(Dashboard updated) throws IOException {
    validate(updated);
    Dashboard stored = JsonUtils.readValue(dao.dashboardDAO().findJsonByFqn(updated.getFullyQualifiedName()),
            Dashboard.class);
    if (stored == null) {
//      return new PutResponse<>(Status.CREATED, createInternal(updated));
    }
    setFields(stored, DASHBOARD_UPDATE_FIELDS);
    updated.setId(stored.getId());

    DashboardUpdater dashboardUpdater = new DashboardUpdater(stored, updated, false);
    dashboardUpdater.updateAll();
    dashboardUpdater.store();
    return new PutResponse<>(Response.Status.OK, updated);
  }

  @Transaction
  public Dashboard patch(UUID id, String user, JsonPatch patch) throws IOException {
    Dashboard original = setFields(validateDashboard(id), DASHBOARD_PATCH_FIELDS);
    Dashboard updated = JsonUtils.applyPatch(original, patch, Dashboard.class);
    updated.withUpdatedBy(user).withUpdatedAt(new Date());
    patch(original, updated);
    return updated;
  }

  @Transaction
  public Status addFollower(UUID dashboardId, UUID userId) throws IOException {
    dao.dashboardDAO().findEntityById(dashboardId);
    return EntityUtil.addFollower(dao.relationshipDAO(), dao.userDAO(), dashboardId, Entity.DASHBOARD, userId,
            Entity.USER) ?
            Status.CREATED : Status.OK;
  }

  @Transaction
  public void deleteFollower(UUID dashboardId, UUID userId) {
    EntityUtil.validateUser(dao.userDAO(), userId);
    EntityUtil.removeFollower(dao.relationshipDAO(), dashboardId, userId);
  }

  @Transaction
  public void delete(UUID id) {
    if (dao.relationshipDAO().findToCount(id.toString(), Relationship.CONTAINS.ordinal(), Entity.DASHBOARD) > 0) {
      throw new IllegalArgumentException("Dashboard is not empty");
    }
    if (dao.dashboardDAO().delete(id) <= 0) {
      throw EntityNotFoundException.byMessage(entityNotFound(Entity.DASHBOARD, id));
    }
    dao.relationshipDAO().deleteAll(id.toString());
  }

  @Transaction
  public EntityReference getOwnerReference(Dashboard dashboard) throws IOException {
    return EntityUtil.populateOwner(dao.userDAO(), dao.teamDAO(), dashboard.getOwner());
  }

  @Override
  public Dashboard setFields(Dashboard dashboard, Fields fields) throws IOException {
    dashboard.setDisplayName(dashboard.getDisplayName());
    dashboard.setOwner(fields.contains("owner") ? getOwner(dashboard) : null);
    dashboard.setService(fields.contains("service") ? getService(dashboard) : null);
    dashboard.setFollowers(fields.contains("followers") ? getFollowers(dashboard) : null);
    dashboard.setCharts(fields.contains("charts") ? getCharts(dashboard) : null);
    dashboard.setTags(fields.contains("tags") ? getTags(dashboard.getFullyQualifiedName()) : null);
    dashboard.setUsageSummary(fields.contains("usageSummary") ? EntityUtil.getLatestUsage(dao.usageDAO(),
            dashboard.getId()) : null);
    return dashboard;
  }

  private List<TagLabel> getTags(String fqn) {
    return dao.tagDAO().getTags(fqn);
  }


  private EntityReference getService(Dashboard dashboard) throws IOException {
    EntityReference ref = EntityUtil.getService(dao.relationshipDAO(), dashboard.getId(), Entity.DASHBOARD_SERVICE);
    return getService(ref);
  }

  private EntityReference getService(EntityReference service) throws IOException {
    if (service.getType().equalsIgnoreCase(Entity.DASHBOARD_SERVICE)) {
      return dao.dashboardServiceDAO().findEntityReferenceById(service.getId());
    } else {
      throw new IllegalArgumentException(String.format("Invalid service type %s for the dashboard", service.getType()));
    }
  }

  public void setService(Dashboard dashboard, EntityReference service) throws IOException {
    if (service != null && dashboard != null) {
      // TODO remove this
      dao.relationshipDAO().insert(service.getId().toString(), dashboard.getId().toString(), service.getType(),
              Entity.DASHBOARD, Relationship.CONTAINS.ordinal());
      dashboard.setService(service);
    }
  }

  private void patch(Dashboard original, Dashboard updated) throws IOException {
    // Patch can't make changes to following fields. Ignore the changes
    updated.withId(original.getId()).withFullyQualifiedName(original.getFullyQualifiedName())
            .withName(original.getName()).withService(original.getService()).withId(original.getId());
    validate(updated);
    DashboardUpdater DashboardUpdater = new DashboardUpdater(original, updated, true);
    DashboardUpdater.updateAll();
    DashboardUpdater.store();
  }

  @Override
  public void validate(Dashboard dashboard) throws IOException {
    dashboard.setService(getService(dashboard.getService()));
    dashboard.setFullyQualifiedName(getFQN(dashboard));
    EntityUtil.populateOwner(dao.userDAO(), dao.teamDAO(), dashboard.getOwner()); // Validate owner
    dashboard.setTags(EntityUtil.addDerivedTags(dao.tagDAO(), dashboard.getTags()));
  }

  @Override
  public void store(Dashboard dashboard, boolean update) throws JsonProcessingException {
    // Relationships and fields such as href are derived and not stored as part of json
    EntityReference owner = dashboard.getOwner();
    List<TagLabel> tags = dashboard.getTags();

    // Don't store owner, database, href and tags as JSON. Build it on the fly based on relationships
    dashboard.withOwner(null).withHref(null).withTags(null);

    if (update) {
      dao.dashboardDAO().update(dashboard.getId(), JsonUtils.pojoToJson(dashboard));
    } else {
      dao.dashboardDAO().insert(dashboard);
    }

    // Restore the relationships
    dashboard.withOwner(owner).withTags(tags);
  }

  @Override
  public void storeRelationships(Dashboard dashboard) throws IOException {
    setService(dashboard, dashboard.getService());

    // Add relationship from dashboard to chart
    String dashboardId = dashboard.getId().toString();
    if (dashboard.getCharts() != null) {
      for (EntityReference chart : dashboard.getCharts()) {
        dao.relationshipDAO().insert(dashboardId, chart.getId().toString(), Entity.DASHBOARD, Entity.CHART,
                Relationship.CONTAINS.ordinal());
      }
    }
    // Add owner relationship
    EntityUtil.setOwner(dao.relationshipDAO(), dashboard.getId(), Entity.DASHBOARD, dashboard.getOwner());

    // Add tag to dashboard relationship
    applyTags(dashboard);
  }

  private EntityReference getOwner(Dashboard dashboard) throws IOException {
    return dashboard == null ? null : EntityUtil.populateOwner(dashboard.getId(), dao.relationshipDAO(),
            dao.userDAO(), dao.teamDAO());
  }

  public void setOwner(Dashboard dashboard, EntityReference owner) {
    EntityUtil.setOwner(dao.relationshipDAO(), dashboard.getId(), Entity.DASHBOARD, owner);
    dashboard.setOwner(owner);
  }

  private void applyTags(Dashboard dashboard) throws IOException {
    // Add dashboard level tags by adding tag to dashboard relationship
    EntityUtil.applyTags(dao.tagDAO(), dashboard.getTags(), dashboard.getFullyQualifiedName());
    dashboard.setTags(getTags(dashboard.getFullyQualifiedName())); // Update tag to handle additional derived tags
  }

  private List<EntityReference> getFollowers(Dashboard dashboard) throws IOException {
    return dashboard == null ? null : EntityUtil.getFollowers(dashboard.getId(), dao.relationshipDAO(),
            dao.userDAO());
  }

  private List<EntityReference> getCharts(Dashboard dashboard) throws IOException {
    if (dashboard == null) {
      return null;
    }
    String dashboardId = dashboard.getId().toString();
    List<String> chartIds = dao.relationshipDAO().findTo(dashboardId, Relationship.CONTAINS.ordinal(), Entity.CHART);
    List<EntityReference> charts = new ArrayList<>();
    for (String chartId : chartIds) {
      charts.add(dao.chartDAO().findEntityReferenceById(UUID.fromString(chartId)));
    }
    return charts.isEmpty() ? null : charts;
  }


  private Dashboard validateDashboard(UUID id) throws IOException {
    return dao.dashboardDAO().findEntityById(id);
  }



  public static class DashboardEntityInterface implements EntityInterface<Dashboard> {
    private final Dashboard entity;

    public DashboardEntityInterface(Dashboard entity) {
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
    public EntityReference getOwner() {
      return entity.getOwner();
    }

    @Override
    public String getFullyQualifiedName() {
      return entity.getFullyQualifiedName();
    }

    @Override
    public List<TagLabel> getTags() {
      return entity.getTags();
    }

    @Override
    public EntityReference getEntityReference() {
      return new EntityReference().withId(getId()).withName(getFullyQualifiedName()).withDescription(getDescription())
              .withDisplayName(getDisplayName()).withType(Entity.DASHBOARD);
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
    public void setTags(List<TagLabel> tags) {
      entity.setTags(tags);
    }
  }

  /**
   * Handles entity updated from PUT and POST operation.
   */
  public class DashboardUpdater extends EntityUpdater {
    final Dashboard orig;
    final Dashboard updated;

    public DashboardUpdater(Dashboard orig, Dashboard updated, boolean patchOperation) {
      super(new DashboardEntityInterface(orig), new DashboardEntityInterface(updated), patchOperation,
              dao.relationshipDAO(),
              dao.tagDAO());
      this.orig = orig;
      this.updated = updated;
    }

    public void updateAll() throws IOException {
      super.updateAll();
      updateCharts();
    }

    private void updateCharts() {
      String dashboardId = updated.getId().toString();

      // Remove all charts associated with this dashboard
      dao.relationshipDAO().deleteFrom(dashboardId, Relationship.CONTAINS.ordinal(), "chart");

      // Add relationship from dashboard to chart
      if (updated.getCharts() != null) {
        for (EntityReference chart : updated.getCharts()) {
          dao.relationshipDAO().insert(dashboardId, chart.getId().toString(), Entity.DASHBOARD, Entity.CHART,
                  Relationship.CONTAINS.ordinal());
        }
      }
      List<UUID> origChartIds = EntityUtil.getIDList(orig.getCharts());
      List<UUID> updatedChartIds = EntityUtil.getIDList(updated.getCharts());
      update("charts", origChartIds, updatedChartIds);
    }

    public void store() throws IOException {
      updated.setVersion(getNewVersion(orig.getVersion()));
      DashboardRepository.this.store(updated, true);
    }
  }
}
