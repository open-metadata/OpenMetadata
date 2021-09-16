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

import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.entity.data.Chart;
import org.openmetadata.catalog.entity.services.DashboardService;
import org.openmetadata.catalog.exception.CatalogExceptionMessage;
import org.openmetadata.catalog.exception.EntityNotFoundException;
import org.openmetadata.catalog.jdbi3.DashboardServiceRepository.DashboardServiceDAO;
import org.openmetadata.catalog.jdbi3.TeamRepository.TeamDAO;
import org.openmetadata.catalog.jdbi3.UserRepository.UserDAO;
import org.openmetadata.catalog.resources.charts.ChartResource;
import org.openmetadata.catalog.resources.charts.ChartResource.ChartList;
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
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import javax.json.JsonPatch;
import javax.ws.rs.core.Response.Status;
import java.io.IOException;
import java.security.GeneralSecurityException;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

import static org.openmetadata.catalog.exception.CatalogExceptionMessage.entityNotFound;

public abstract class ChartRepository {
  private static final Logger LOG = LoggerFactory.getLogger(ChartRepository.class);
  private static final Fields CHART_UPDATE_FIELDS = new Fields(ChartResource.FIELD_LIST, "owner");
  private static final Fields CHART_PATCH_FIELDS = new Fields(ChartResource.FIELD_LIST, "owner,service,tags");

  public static String getFQN(EntityReference service, Chart chart) {
    return (service.getName() + "." + chart.getName());
  }

  @CreateSqlObject
  abstract ChartDAO chartDAO();

  @CreateSqlObject
  abstract EntityRelationshipDAO relationshipDAO();

  @CreateSqlObject
  abstract UserDAO userDAO();

  @CreateSqlObject
  abstract TeamDAO teamDAO();

  @CreateSqlObject
  abstract DashboardServiceDAO dashboardServiceDAO();

  @CreateSqlObject
  abstract TagRepository.TagDAO tagDAO();


  @Transaction
  public ChartList listAfter(Fields fields, String serviceName, int limitParam, String after) throws IOException,
          GeneralSecurityException {
    // forward scrolling, if after == null then first page is being asked being asked
    List<String> jsons = chartDAO().listAfter(serviceName, limitParam + 1, after == null ? "" :
            CipherText.instance().decrypt(after));

    List<Chart> charts = new ArrayList<>();
    for (String json : jsons) {
      charts.add(setFields(JsonUtils.readValue(json, Chart.class), fields));
    }
    int total = chartDAO().listCount(serviceName);

    String beforeCursor, afterCursor = null;
    beforeCursor = after == null ? null : charts.get(0).getFullyQualifiedName();
    if (charts.size() > limitParam) { // If extra result exists, then next page exists - return after cursor
      charts.remove(limitParam);
      afterCursor = charts.get(limitParam - 1).getFullyQualifiedName();
    }
    return new ChartList(charts, beforeCursor, afterCursor, total);
  }

  @Transaction
  public ChartList listBefore(Fields fields, String serviceName, int limitParam, String before) throws IOException,
          GeneralSecurityException {
    // Reverse scrolling - Get one extra result used for computing before cursor
    List<String> jsons = chartDAO().listBefore(serviceName, limitParam + 1, CipherText.instance().decrypt(before));
    List<Chart> charts = new ArrayList<>();
    for (String json : jsons) {
      charts.add(setFields(JsonUtils.readValue(json, Chart.class), fields));
    }
    int total = chartDAO().listCount(serviceName);

    String beforeCursor = null, afterCursor;
    if (charts.size() > limitParam) { // If extra result exists, then previous page exists - return before cursor
      charts.remove(0);
      beforeCursor = charts.get(0).getFullyQualifiedName();
    }
    afterCursor = charts.get(charts.size() - 1).getFullyQualifiedName();
    return new ChartList(charts, beforeCursor, afterCursor, total);
  }

  @Transaction
  public Chart get(String id, Fields fields) throws IOException {
    return setFields(validateChart(id), fields);
  }

  @Transaction
  public Chart getByName(String fqn, Fields fields) throws IOException {
    Chart chart = EntityUtil.validate(fqn, chartDAO().findByFQN(fqn), Chart.class);
    return setFields(chart, fields);
  }

  @Transaction
  public Chart create(Chart chart, EntityReference service, EntityReference owner) throws IOException {
    getService(service); // Validate service
    return createInternal(chart, service, owner);
  }

  @Transaction
  public void delete(String id) {
    if (relationshipDAO().findToCount(id, Relationship.CONTAINS.ordinal(), Entity.CHART) > 0) {
      throw new IllegalArgumentException("Chart is not empty");
    }
    if (chartDAO().delete(id) <= 0) {
      throw EntityNotFoundException.byMessage(entityNotFound(Entity.CHART, id));
    }
    relationshipDAO().deleteAll(id);
  }

  @Transaction
  public PutResponse<Chart> createOrUpdate(Chart updatedChart, EntityReference service, EntityReference newOwner)
          throws IOException {
    getService(service); // Validate service

    String fqn = getFQN(service, updatedChart);
    Chart storedDB = JsonUtils.readValue(chartDAO().findByFQN(fqn), Chart.class);
    if (storedDB == null) {  // Chart does not exist. Create a new one
      return new PutResponse<>(Status.CREATED, createInternal(updatedChart, service, newOwner));
    }
    // Update the existing chart
    EntityUtil.populateOwner(userDAO(), teamDAO(), newOwner); // Validate new owner
    if (storedDB.getDescription() == null || storedDB.getDescription().isEmpty()) {
      storedDB.withDescription(updatedChart.getDescription());
    }

    //update the display name from source
    if (updatedChart.getDisplayName() != null && !updatedChart.getDisplayName().isEmpty()) {
      storedDB.withDisplayName(updatedChart.getDisplayName());
    }
    chartDAO().update(storedDB.getId().toString(), JsonUtils.pojoToJson(storedDB));

    // Update owner relationship
    setFields(storedDB, CHART_UPDATE_FIELDS); // First get the ownership information
    updateOwner(storedDB, storedDB.getOwner(), newOwner);

    // Service can't be changed in update since service name is part of FQN and
    // change to a different service will result in a different FQN and creation of a new chart under the new service
    storedDB.setService(service);
    applyTags(updatedChart);

    return new PutResponse<>(Status.OK, storedDB);
  }

  @Transaction
  public Chart patch(String id, JsonPatch patch) throws IOException {
    Chart original = setFields(validateChart(id), CHART_PATCH_FIELDS);
    Chart updated = JsonUtils.applyPatch(original, patch, Chart.class);
    patch(original, updated);
    return updated;
  }

  public Chart createInternal(Chart chart, EntityReference service, EntityReference owner) throws IOException {
    chart.setFullyQualifiedName(getFQN(service, chart));
    EntityUtil.populateOwner(userDAO(), teamDAO(), owner); // Validate owner

    // Query 1 - insert chart into chart_entity table
    chartDAO().insert(JsonUtils.pojoToJson(chart));
    setService(chart, service);
    setOwner(chart, owner);
    applyTags(chart);
    return chart;
  }

  private void applyTags(Chart chart) throws IOException {
    // Add chart level tags by adding tag to chart relationship
    EntityUtil.applyTags(tagDAO(), chart.getTags(), chart.getFullyQualifiedName());
    chart.setTags(getTags(chart.getFullyQualifiedName())); // Update tag to handle additional derived tags
  }

  private void patch(Chart original, Chart updated) throws IOException {
    String chartId = original.getId().toString();
    if (!original.getId().equals(updated.getId())) {
      throw new IllegalArgumentException(CatalogExceptionMessage.readOnlyAttribute(Entity.CHART, "id"));
    }
    if (!original.getName().equals(updated.getName())) {
      throw new IllegalArgumentException(CatalogExceptionMessage.readOnlyAttribute(Entity.CHART, "name"));
    }
    if (updated.getService() == null || !original.getService().getId().equals(updated.getService().getId())) {
      throw new IllegalArgumentException(CatalogExceptionMessage.readOnlyAttribute(Entity.CHART, "service"));
    }
    // Validate new owner
    EntityReference newOwner = EntityUtil.populateOwner(userDAO(), teamDAO(), updated.getOwner());

    EntityReference newService = updated.getService();
    // Remove previous tags. Merge tags from the update and the existing tags
    EntityUtil.removeTags(tagDAO(), original.getFullyQualifiedName());
    updated.setHref(null);
    updated.setOwner(null);
    updated.setService(null);
    chartDAO().update(chartId, JsonUtils.pojoToJson(updated));
    updateOwner(updated, original.getOwner(), newOwner);
    updated.setService(newService);
    applyTags(updated);
  }

  public EntityReference getOwner(Chart chart) throws IOException {
    if (chart == null) {
      return null;
    }
    return EntityUtil.populateOwner(chart.getId(), relationshipDAO(), userDAO(), teamDAO());
  }

  private void setOwner(Chart chart, EntityReference owner) {
    EntityUtil.setOwner(relationshipDAO(), chart.getId(), Entity.CHART, owner);
    chart.setOwner(owner);
  }

  private void updateOwner(Chart chart, EntityReference origOwner, EntityReference newOwner) {
    EntityUtil.updateOwner(relationshipDAO(), origOwner, newOwner, chart.getId(), Entity.CHART);
    chart.setOwner(newOwner);
  }

  private Chart validateChart(String id) throws IOException {
    return EntityUtil.validate(id, chartDAO().findById(id), Chart.class);
  }

  private Chart setFields(Chart chart, Fields fields) throws IOException {
    chart.setOwner(fields.contains("owner") ? getOwner(chart) : null);
    chart.setService(fields.contains("service") ? getService(chart) : null);
    chart.setFollowers(fields.contains("followers") ? getFollowers(chart) : null);
    chart.setTags(fields.contains("tags") ? getTags(chart.getFullyQualifiedName()) : null);
    return chart;
  }

  private List<EntityReference> getFollowers(Chart chart) throws IOException {
    return chart == null ? null : EntityUtil.getFollowers(chart.getId(), relationshipDAO(), userDAO());
  }

  private List<TagLabel> getTags(String fqn) {
    return tagDAO().getTags(fqn);
  }

  private EntityReference getService(Chart chart) throws IOException {
    return chart == null ? null : getService(Objects.requireNonNull(EntityUtil.getService(relationshipDAO(),
            chart.getId(), Entity.DASHBOARD_SERVICE)));
  }

  private EntityReference getService(EntityReference service) throws IOException {
    String id = service.getId().toString();
    if (service.getType().equalsIgnoreCase(Entity.DASHBOARD_SERVICE)) {
      DashboardService serviceInstance = EntityUtil.validate(id, dashboardServiceDAO().findById(id),
              DashboardService.class);
      service.setDescription(serviceInstance.getDescription());
      service.setName(serviceInstance.getName());
    } else {
      throw new IllegalArgumentException(String.format("Invalid service type %s for the chart", service.getType()));
    }
    return service;
  }

  public void setService(Chart chart, EntityReference service) throws IOException {
    if (service != null && chart != null) {
      getService(service); // Populate service details
      relationshipDAO().insert(service.getId().toString(), chart.getId().toString(), service.getType(),
              Entity.CHART, Relationship.CONTAINS.ordinal());
      chart.setService(service);
    }
  }

  @Transaction
  public Status addFollower(String chartId, String userId) throws IOException {
    EntityUtil.validate(chartId, chartDAO().findById(chartId), Chart.class);
    return EntityUtil.addFollower(relationshipDAO(), userDAO(), chartId, Entity.CHART, userId, Entity.USER) ?
            Status.CREATED : Status.OK;
  }

  @Transaction
  public void deleteFollower(String chartId, String userId) {
    EntityUtil.validateUser(userDAO(), userId);
    EntityUtil.removeFollower(relationshipDAO(), chartId, userId);
  }

  public interface ChartDAO {
    @SqlUpdate("INSERT INTO chart_entity (json) VALUES (:json)")
    void insert(@Bind("json") String json);

    @SqlUpdate("UPDATE chart_entity SET  json = :json where id = :id")
    void update(@Bind("id") String id, @Bind("json") String json);

    @SqlQuery("SELECT json FROM chart_entity WHERE fullyQualifiedName = :name")
    String findByFQN(@Bind("name") String name);

    @SqlQuery("SELECT json FROM chart_entity WHERE id = :id")
    String findById(@Bind("id") String id);

    @SqlQuery("SELECT count(*) FROM chart_entity WHERE " +
            "(fullyQualifiedName LIKE CONCAT(:fqnPrefix, '.%') OR :fqnPrefix IS NULL)")
    int listCount(@Bind("fqnPrefix") String fqnPrefix);

    @SqlQuery(
            "SELECT json FROM (" +
                    "SELECT fullyQualifiedName, json FROM chart_entity WHERE " +
                    "(fullyQualifiedName LIKE CONCAT(:fqnPrefix, '.%') OR :fqnPrefix IS NULL) AND " +// Filter by
                    // service name
                    "fullyQualifiedName < :before " + // Pagination by chart fullyQualifiedName
                    "ORDER BY fullyQualifiedName DESC " + // Pagination ordering by chart fullyQualifiedName
                    "LIMIT :limit" +
                    ") last_rows_subquery ORDER BY fullyQualifiedName")
    List<String> listBefore(@Bind("fqnPrefix") String fqnPrefix, @Bind("limit") int limit,
                            @Bind("before") String before);

    @SqlQuery("SELECT json FROM chart_entity WHERE " +
            "(fullyQualifiedName LIKE CONCAT(:fqnPrefix, '.%') OR :fqnPrefix IS NULL) AND " +
            "fullyQualifiedName > :after " +
            "ORDER BY fullyQualifiedName " +
            "LIMIT :limit")
    List<String> listAfter(@Bind("fqnPrefix") String fqnPrefix, @Bind("limit") int limit,
                           @Bind("after") String after);

    @SqlQuery("SELECT EXISTS (SELECT * FROM chart_entity WHERE id = :id)")
    boolean exists(@Bind("id") String id);

    @SqlUpdate("DELETE FROM chart_entity WHERE id = :id")
    int delete(@Bind("id") String id);
  }
}
