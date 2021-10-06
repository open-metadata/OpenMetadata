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

import org.openmetadata.catalog.entity.data.Chart;
import org.openmetadata.catalog.entity.services.DashboardService;
import org.openmetadata.catalog.exception.CatalogExceptionMessage;
import org.openmetadata.catalog.exception.EntityNotFoundException;
import org.openmetadata.catalog.jdbi3.TeamRepository.TeamDAO;
import org.openmetadata.catalog.jdbi3.UserRepository.UserDAO;
import org.openmetadata.catalog.resources.dashboards.DashboardResource;
import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.entity.data.Dashboard;
import org.openmetadata.catalog.jdbi3.UsageRepository.UsageDAO;
import org.openmetadata.catalog.jdbi3.ChartRepository.ChartDAO;
import org.openmetadata.catalog.jdbi3.DashboardServiceRepository.DashboardServiceDAO;
import org.openmetadata.catalog.resources.dashboards.DashboardResource.DashboardList;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.type.TagLabel;
import org.openmetadata.catalog.util.EntityUtil;
import org.openmetadata.catalog.util.EntityUtil.Fields;
import org.openmetadata.catalog.util.JsonUtils;
import org.openmetadata.catalog.util.RestUtil.PutResponse;
import org.openmetadata.common.utils.CipherText;
import org.skife.jdbi.v2.sqlobject.Bind;
import org.skife.jdbi.v2.sqlobject.CreateSqlObject;
import org.skife.jdbi.v2.sqlobject.SqlQuery;
import org.skife.jdbi.v2.sqlobject.SqlUpdate;
import org.skife.jdbi.v2.sqlobject.Transaction;

import javax.json.JsonPatch;
import javax.ws.rs.core.Response;
import javax.ws.rs.core.Response.Status;
import java.io.IOException;
import java.security.GeneralSecurityException;
import java.util.ArrayList;
import java.util.List;

import static org.openmetadata.catalog.exception.CatalogExceptionMessage.entityNotFound;

public abstract class DashboardRepository {
  private static final Fields DASHBOARD_UPDATE_FIELDS = new Fields(DashboardResource.FIELD_LIST,
          "owner,service,tags,charts");
  private static final Fields DASHBOARD_PATCH_FIELDS = new Fields(DashboardResource.FIELD_LIST,
          "owner,service,tags,charts");

  public static String getFQN(EntityReference service, Dashboard dashboard) {
    return (service.getName() + "." + dashboard.getName());
  }

  @CreateSqlObject
  abstract DashboardDAO dashboardDAO();

  @CreateSqlObject
  abstract ChartDAO chartDAO();

  @CreateSqlObject
  abstract DashboardServiceDAO dashboardServiceDAO();

  @CreateSqlObject
  abstract EntityRelationshipDAO relationshipDAO();

  @CreateSqlObject
  abstract UserDAO userDAO();

  @CreateSqlObject
  abstract TeamDAO teamDAO();

  @CreateSqlObject
  abstract UsageDAO usageDAO();

  @CreateSqlObject
  abstract TagRepository.TagDAO tagDAO();


  @Transaction
  public DashboardList listAfter(Fields fields, String serviceName, int limitParam, String after) throws IOException,
          GeneralSecurityException {
    // forward scrolling, if after == null then first page is being asked being asked
    List<String> jsons = dashboardDAO().listAfter(serviceName, limitParam + 1, after == null ? "" :
            CipherText.instance().decrypt(after));

    List<Dashboard> dashboards = new ArrayList<>();
    for (String json : jsons) {
      dashboards.add(setFields(JsonUtils.readValue(json, Dashboard.class), fields));
    }
    int total = dashboardDAO().listCount(serviceName);

    String beforeCursor, afterCursor = null;
    beforeCursor = after == null ? null : dashboards.get(0).getFullyQualifiedName();
    if (dashboards.size() > limitParam) { // If extra result exists, then next page exists - return after cursor
      dashboards.remove(limitParam);
      afterCursor = dashboards.get(limitParam - 1).getFullyQualifiedName();
    }
    return new DashboardList(dashboards, beforeCursor, afterCursor, total);
  }

  @Transaction
  public DashboardList listBefore(Fields fields, String serviceName, int limitParam, String before)
          throws IOException, GeneralSecurityException {
    // Reverse scrolling - Get one extra result used for computing before cursor
    List<String> jsons = dashboardDAO().listBefore(serviceName, limitParam + 1, CipherText.instance().decrypt(before));
    List<Dashboard> dashboards = new ArrayList<>();
    for (String json : jsons) {
      dashboards.add(setFields(JsonUtils.readValue(json, Dashboard.class), fields));
    }
    int total = dashboardDAO().listCount(serviceName);

    String beforeCursor = null, afterCursor;
    if (dashboards.size() > limitParam) { // If extra result exists, then previous page exists - return before cursor
      dashboards.remove(0);
      beforeCursor = dashboards.get(0).getFullyQualifiedName();
    }
    afterCursor = dashboards.get(dashboards.size() - 1).getFullyQualifiedName();
    return new DashboardList(dashboards, beforeCursor, afterCursor, total);
  }

  @Transaction
  public Dashboard getByName(String fqn, Fields fields) throws IOException {
    Dashboard dashboard = EntityUtil.validate(fqn, dashboardDAO().findByFQN(fqn), Dashboard.class);
    return setFields(dashboard, fields);
  }

  @Transaction
  public Dashboard create(Dashboard dashboard, EntityReference service, EntityReference owner) throws IOException {
    getService(service); // Validate service
    return createInternal(dashboard, service, owner);
  }

  @Transaction
  public PutResponse<Dashboard> createOrUpdate(Dashboard updatedDashboard, EntityReference service,
                                               EntityReference newOwner) throws IOException {
    getService(service); // Validate service
    String fqn = getFQN(service, updatedDashboard);
    Dashboard storedDashboard = JsonUtils.readValue(dashboardDAO().findByFQN(fqn), Dashboard.class);
    if (storedDashboard == null) {
      return new PutResponse<>(Status.CREATED, createInternal(updatedDashboard, service, newOwner));
    }
    // Update existing dashboard
    EntityUtil.populateOwner(userDAO(), teamDAO(), newOwner); // Validate new owner
    if (storedDashboard.getDescription() == null || storedDashboard.getDescription().isEmpty()) {
      storedDashboard.withDescription(updatedDashboard.getDescription());
    }
    //update the display name from source
    if (updatedDashboard.getDisplayName() != null && !updatedDashboard.getDisplayName().isEmpty()) {
      storedDashboard.withDisplayName(updatedDashboard.getDisplayName());
    }

    dashboardDAO().update(storedDashboard.getId().toString(), JsonUtils.pojoToJson(storedDashboard));

    // Update owner relationship
    setFields(storedDashboard, DASHBOARD_UPDATE_FIELDS); // First get the ownership information
    updateOwner(storedDashboard, storedDashboard.getOwner(), newOwner);

    // Service can't be changed in update since service name is part of FQN and
    // change to a different service will result in a different FQN and creation of a new database under the new service
    storedDashboard.setService(service);
    storedDashboard.setCharts(updatedDashboard.getCharts());
    updateChartRelationships(storedDashboard);

    return new PutResponse<>(Response.Status.OK, storedDashboard);
  }

  @Transaction
  public Dashboard patch(String id, JsonPatch patch) throws IOException {
    Dashboard original = setFields(validateDashboard(id), DASHBOARD_PATCH_FIELDS);
    Dashboard updated = JsonUtils.applyPatch(original, patch, Dashboard.class);
    patch(original, updated);
    return updated;
  }

  @Transaction
  public Status addFollower(String dashboardId, String userId) throws IOException {
    EntityUtil.validate(dashboardId, dashboardDAO().findById(dashboardId), Dashboard.class);
    return EntityUtil.addFollower(relationshipDAO(), userDAO(), dashboardId, Entity.DASHBOARD, userId, Entity.USER) ?
            Status.CREATED : Status.OK;
  }

  @Transaction
  public void deleteFollower(String dashboardId, String userId) {
    EntityUtil.validateUser(userDAO(), userId);
    EntityUtil.removeFollower(relationshipDAO(), dashboardId, userId);
  }

  @Transaction
  public void delete(String id) {
    if (relationshipDAO().findToCount(id, Relationship.CONTAINS.ordinal(), Entity.DASHBOARD) > 0) {
      throw new IllegalArgumentException("Dashboard is not empty");
    }
    if (dashboardDAO().delete(id) <= 0) {
      throw EntityNotFoundException.byMessage(entityNotFound(Entity.DASHBOARD, id));
    }
    relationshipDAO().deleteAll(id);
  }

  @Transaction
  public EntityReference getOwnerReference(Dashboard dashboard) throws IOException {
    return EntityUtil.populateOwner(userDAO(), teamDAO(), dashboard.getOwner());
  }

  public static List<EntityReference> toEntityReference(List<Chart> charts) {
    List<EntityReference> refList = new ArrayList<>();
    for (Chart chart: charts) {
      refList.add(EntityUtil.getEntityReference(chart));
    }
    return refList;
  }

  public Dashboard get(String id, Fields fields) throws IOException {
    return setFields(EntityUtil.validate(id, dashboardDAO().findById(id), Dashboard.class), fields);
  }

  private Dashboard setFields(Dashboard dashboard, Fields fields) throws IOException {
    dashboard.setDisplayName(dashboard.getDisplayName());
    dashboard.setOwner(fields.contains("owner") ? getOwner(dashboard) : null);
    dashboard.setService(fields.contains("service") ? getService(dashboard) : null);
    dashboard.setFollowers(fields.contains("followers") ? getFollowers(dashboard) : null);
    dashboard.setCharts(fields.contains("charts") ? toEntityReference(getCharts(dashboard)) : null);
    dashboard.setTags(fields.contains("tags") ? getTags(dashboard.getFullyQualifiedName()) : null);
    dashboard.setUsageSummary(fields.contains("usageSummary") ? EntityUtil.getLatestUsage(usageDAO(),
            dashboard.getId()) : null);
    return dashboard;
  }

  private List<TagLabel> getTags(String fqn) {
    return tagDAO().getTags(fqn);
  }


  private Dashboard createInternal(Dashboard dashboard, EntityReference service, EntityReference owner)
          throws IOException {
    String fqn = service.getName() + "." + dashboard.getName();
    dashboard.setFullyQualifiedName(fqn);

    EntityUtil.populateOwner(userDAO(), teamDAO(), owner); // Validate owner

    dashboardDAO().insert(JsonUtils.pojoToJson(dashboard));
    setService(dashboard, service);
    addRelationships(dashboard);
    return dashboard;
  }

  private EntityReference getService(Dashboard dashboard) throws IOException {
    return dashboard == null ? null : getService(EntityUtil.getService(relationshipDAO(), dashboard.getId()));
  }

  private EntityReference getService(EntityReference service) throws IOException {
    String id = service.getId().toString();
    if (service.getType().equalsIgnoreCase(Entity.DASHBOARD_SERVICE)) {
      DashboardService serviceInstance = EntityUtil.validate(id, dashboardServiceDAO().findById(id),
              DashboardService.class);
      service.setDescription(serviceInstance.getDescription());
      service.setName(serviceInstance.getName());
    } else {
      throw new IllegalArgumentException(String.format("Invalid service type %s for the dashboard", service.getType()));
    }
    return service;
  }

  public void setService(Dashboard dashboard, EntityReference service) throws IOException {
    if (service != null && dashboard != null) {
      getService(service); // Populate service details
      relationshipDAO().insert(service.getId().toString(), dashboard.getId().toString(), service.getType(),
              Entity.DASHBOARD, Relationship.CONTAINS.ordinal());
      dashboard.setService(service);
    }
  }

  private void patch(Dashboard original, Dashboard updated) throws IOException {
    String dashboardId = original.getId().toString();
    if (!original.getId().equals(updated.getId())) {
      throw new IllegalArgumentException(CatalogExceptionMessage.readOnlyAttribute(Entity.DASHBOARD, "id"));
    }
    if (!original.getName().equals(updated.getName())) {
      throw new IllegalArgumentException(CatalogExceptionMessage.readOnlyAttribute(Entity.DASHBOARD, "name"));
    }
    if (updated.getService() == null || !original.getService().getId().equals(updated.getService().getId())) {
      throw new IllegalArgumentException(CatalogExceptionMessage.readOnlyAttribute(Entity.DASHBOARD,
              "service"));
    }
    // Validate new owner
    EntityReference newOwner = EntityUtil.populateOwner(userDAO(), teamDAO(), updated.getOwner());

    EntityReference newService = updated.getService();
    // Remove previous tags. Merge tags from the update and the existing tags
    EntityUtil.removeTags(tagDAO(), original.getFullyQualifiedName());

    updated.setHref(null);
    updated.setOwner(null);
    updated.setService(null);
    dashboardDAO().update(dashboardId, JsonUtils.pojoToJson(updated));
    updateOwner(updated, original.getOwner(), newOwner);
    updated.setService(newService);
    applyTags(updated);
  }

  private EntityReference getOwner(Dashboard dashboard) throws IOException {
    return dashboard == null ? null : EntityUtil.populateOwner(dashboard.getId(), relationshipDAO(),
            userDAO(), teamDAO());
  }

  public void setOwner(Dashboard dashboard, EntityReference owner) {
    EntityUtil.setOwner(relationshipDAO(), dashboard.getId(), Entity.DASHBOARD, owner);
    dashboard.setOwner(owner);
  }

  private void updateOwner(Dashboard dashboard, EntityReference origOwner, EntityReference newOwner) {
    EntityUtil.updateOwner(relationshipDAO(), origOwner, newOwner, dashboard.getId(), Entity.DASHBOARD);
    dashboard.setOwner(newOwner);
  }

  private void applyTags(Dashboard dashboard) throws IOException {
    // Add dashboard level tags by adding tag to dashboard relationship
    EntityUtil.applyTags(tagDAO(), dashboard.getTags(), dashboard.getFullyQualifiedName());
    dashboard.setTags(getTags(dashboard.getFullyQualifiedName())); // Update tag to handle additional derived tags
  }

  private List<EntityReference> getFollowers(Dashboard dashboard) throws IOException {
    return dashboard == null ? null : EntityUtil.getFollowers(dashboard.getId(), relationshipDAO(), userDAO());
  }

  private List<Chart> getCharts(Dashboard dashboard) throws IOException {
    if (dashboard == null) {
      return null;
    }
    String dashboardId = dashboard.getId().toString();
    List<String> chartIds = relationshipDAO().findTo(dashboardId, Relationship.CONTAINS.ordinal(), Entity.CHART);
    List<Chart> charts = new ArrayList<>();
    for (String chartId : chartIds) {
      String json = chartDAO().findById(chartId);
      Chart chart = JsonUtils.readValue(json, Chart.class);
      charts.add(chart);
    }
    return charts;
  }

  private void addRelationships(Dashboard dashboard) throws IOException {
    // Add relationship from dashboard to chart
    String dashboardId = dashboard.getId().toString();
    if (dashboard.getCharts() != null) {
      for (EntityReference chart : dashboard.getCharts()) {
        relationshipDAO().insert(dashboardId, chart.getId().toString(), Entity.DASHBOARD, Entity.CHART,
                Relationship.CONTAINS.ordinal());
      }
    }
    // Add owner relationship
    EntityUtil.setOwner(relationshipDAO(), dashboard.getId(), Entity.DASHBOARD, dashboard.getOwner());

    // Add tag to dashboard relationship
    applyTags(dashboard);
  }

  private void updateChartRelationships(Dashboard dashboard) throws IOException  {
    String dashboardId = dashboard.getId().toString();

    // Add relationship from dashboard to chart
    if (dashboard.getCharts() != null) {
      // Remove any existing charts associated with this dashboard
      List<Chart> existingCharts = getCharts(dashboard);
      if (existingCharts != null) {
        for (Chart chart: existingCharts) {
          relationshipDAO().delete(dashboardId, chart.getId().toString(), Relationship.CONTAINS.ordinal());
        }
      }

      for (EntityReference chart : dashboard.getCharts()) {
        relationshipDAO().insert(dashboardId, chart.getId().toString(), Entity.DASHBOARD, Entity.CHART,
                Relationship.CONTAINS.ordinal());
      }
    }
  }

  private Dashboard validateDashboard(String id) throws IOException {
    return EntityUtil.validate(id, dashboardDAO().findById(id), Dashboard.class);
  }

  public interface DashboardDAO {
    @SqlUpdate("INSERT INTO dashboard_entity(json) VALUES (:json)")
    void insert(@Bind("json") String json);

    @SqlUpdate("UPDATE dashboard_entity SET  json = :json where id = :id")
    void update(@Bind("id") String id, @Bind("json") String json);

    @SqlQuery("SELECT json FROM dashboard_entity WHERE id = :id")
    String findById(@Bind("id") String id);

    @SqlQuery("SELECT json FROM dashboard_entity WHERE fullyQualifiedName = :name")
    String findByFQN(@Bind("name") String name);

    @SqlQuery("SELECT count(*) FROM dashboard_entity WHERE " +
            "(fullyQualifiedName LIKE CONCAT(:fqnPrefix, '.%') OR :fqnPrefix IS NULL)")
    int listCount(@Bind("fqnPrefix") String fqnPrefix);

    @SqlQuery(
            "SELECT json FROM (" +
                    "SELECT fullyQualifiedName, json FROM dashboard_entity WHERE " +
                    "(fullyQualifiedName LIKE CONCAT(:fqnPrefix, '.%') OR :fqnPrefix IS NULL) AND " +// Filter by
                    // service name
                    "fullyQualifiedName < :before " + // Pagination by dashboard fullyQualifiedName
                    "ORDER BY fullyQualifiedName DESC " + // Pagination ordering by chart fullyQualifiedName
                    "LIMIT :limit" +
                    ") last_rows_subquery ORDER BY fullyQualifiedName")
    List<String> listBefore(@Bind("fqnPrefix") String fqnPrefix, @Bind("limit") int limit,
                            @Bind("before") String before);

    @SqlQuery("SELECT json FROM dashboard_entity WHERE " +
            "(fullyQualifiedName LIKE CONCAT(:fqnPrefix, '.%') OR :fqnPrefix IS NULL) AND " +
            "fullyQualifiedName > :after " +
            "ORDER BY fullyQualifiedName " +
            "LIMIT :limit")
    List<String> listAfter(@Bind("fqnPrefix") String fqnPrefix, @Bind("limit") int limit,
                           @Bind("after") String after);

    @SqlUpdate("DELETE FROM dashboard_entity WHERE id = :id")
    int delete(@Bind("id") String id);
  }
}
