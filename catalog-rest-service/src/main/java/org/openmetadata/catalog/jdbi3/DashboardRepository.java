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

import org.openmetadata.catalog.jdbi3.TeamRepository.TeamDAO;
import org.openmetadata.catalog.jdbi3.UserRepository.UserDAO;
import org.openmetadata.catalog.resources.dashboards.DashboardResource;
import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.entity.data.Dashboard;
import org.openmetadata.catalog.jdbi3.UsageRepository.UsageDAO;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.util.EntityUtil;
import org.openmetadata.catalog.util.EntityUtil.Fields;
import org.openmetadata.catalog.util.JsonUtils;
import org.openmetadata.catalog.util.RestUtil.PutResponse;
import org.skife.jdbi.v2.sqlobject.Bind;
import org.skife.jdbi.v2.sqlobject.CreateSqlObject;
import org.skife.jdbi.v2.sqlobject.SqlQuery;
import org.skife.jdbi.v2.sqlobject.SqlUpdate;
import org.skife.jdbi.v2.sqlobject.Transaction;

import javax.ws.rs.core.Response;
import javax.ws.rs.core.Response.Status;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;

public abstract class DashboardRepository {
  private static final Fields METRICS_UPDATE_FIELDS = new Fields(DashboardResource.FIELD_LIST,
          "owner,service");

  @CreateSqlObject
  abstract DashboardDAO dashboardDAO();

  @CreateSqlObject
  abstract EntityRelationshipDAO relationshipDAO();

  @CreateSqlObject
  abstract UserDAO userDAO();

  @CreateSqlObject
  abstract TeamDAO teamDAO();

  @CreateSqlObject
  abstract UsageDAO usageDAO();


  @Transaction
  public Dashboard create(Dashboard dashboard, EntityReference service, EntityReference owner) throws IOException {
    getService(service); // Validate service
    return createInternal(dashboard, service, owner);
  }

  @Transaction
  public PutResponse<Dashboard> createOrUpdate(Dashboard updatedDashboard, EntityReference service,
                                               EntityReference newOwner) throws IOException {
    String fqn = service.getName() + "." + updatedDashboard.getName();
    Dashboard storedDashboard = JsonUtils.readValue(dashboardDAO().findByFQN(fqn), Dashboard.class);
    if (storedDashboard == null) {
      return new PutResponse<>(Status.CREATED, createInternal(updatedDashboard, service, newOwner));
    }
    // Update existing dashboard
    EntityUtil.populateOwner(userDAO(), teamDAO(), newOwner); // Validate new owner
    if (storedDashboard.getDescription() == null || storedDashboard.getDescription().isEmpty()) {
      storedDashboard.withDescription(updatedDashboard.getDescription());
    }
    dashboardDAO().update(storedDashboard.getId().toString(), JsonUtils.pojoToJson(storedDashboard));

    // Update owner relationship
    setFields(storedDashboard, METRICS_UPDATE_FIELDS); // First get the ownership information
    updateOwner(storedDashboard, storedDashboard.getOwner(), newOwner);

    // Service can't be changed in update since service name is part of FQN and
    // change to a different service will result in a different FQN and creation of a new database under the new service
    storedDashboard.setService(service);

    return new PutResponse<>(Response.Status.OK, storedDashboard);
  }

  public Dashboard get(String id, Fields fields) throws IOException {
    return setFields(EntityUtil.validate(id, dashboardDAO().findById(id), Dashboard.class), fields);
  }

  public List<Dashboard> list(Fields fields) throws IOException {
    List<String> jsonList = dashboardDAO().list();
    List<Dashboard> dashboardList = new ArrayList<>();
    for (String json : jsonList) {
      dashboardList.add(setFields(JsonUtils.readValue(json, Dashboard.class), fields));
    }
    return dashboardList;
  }

  private Dashboard setFields(Dashboard dashboard, Fields fields) throws IOException {
    dashboard.setOwner(fields.contains("owner") ? getOwner(dashboard) : null);
    dashboard.setService(fields.contains("service") ? getService(dashboard) : null);
    dashboard.setUsageSummary(fields.contains("usageSummary") ? EntityUtil.getLatestUsage(usageDAO(),
            dashboard.getId()) : null);
    return dashboard;
  }

  private Dashboard createInternal(Dashboard dashboard, EntityReference service, EntityReference owner)
          throws IOException {
    String fqn = service.getName() + "." + dashboard.getName();
    dashboard.setFullyQualifiedName(fqn);

    EntityUtil.populateOwner(userDAO(), teamDAO(), owner); // Validate owner

    dashboardDAO().insert(JsonUtils.pojoToJson(dashboard));
    setService(dashboard, service);
    setOwner(dashboard, owner);
    return dashboard;
  }

  private EntityReference getService(Dashboard dashboard) {
    return dashboard == null ? null : getService(EntityUtil.getService(relationshipDAO(), dashboard.getId()));
  }

  private EntityReference getService(EntityReference service) {
    // TODO What are the dashboard services?
    return service;
  }

  public void setService(Dashboard dashboard, EntityReference service) {
    if (service != null && dashboard != null) {
      getService(service); // Populate service details
      relationshipDAO().insert(service.getId().toString(), dashboard.getId().toString(), service.getType(),
              Entity.DASHBOARD, Relationship.CONTAINS.ordinal());
      dashboard.setService(service);
    }
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

  public interface DashboardDAO {
    @SqlUpdate("INSERT INTO dashboard_entity(json) VALUES (:json)")
    void insert(@Bind("json") String json);

    @SqlUpdate("UPDATE dashboard_entity SET  json = :json where id = :id")
    void update(@Bind("id") String id, @Bind("json") String json);

    @SqlQuery("SELECT json FROM dashboard_entity WHERE id = :id")
    String findById(@Bind("id") String id);

    @SqlQuery("SELECT json FROM dashboard_entity WHERE fullyQualifiedName = :name")
    String findByFQN(@Bind("name") String name);

    @SqlQuery("SELECT json FROM dashboard_entity")
    List<String> list();
  }
}
