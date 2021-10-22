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
import org.openmetadata.catalog.entity.data.Chart;
import org.openmetadata.catalog.entity.services.DashboardService;
import org.openmetadata.catalog.exception.EntityNotFoundException;
import org.openmetadata.catalog.resources.charts.ChartResource;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.type.TagLabel;
import org.openmetadata.catalog.util.EntityInterface;
import org.openmetadata.catalog.util.EntityUpdater3;
import org.openmetadata.catalog.util.EntityUtil;
import org.openmetadata.catalog.util.EntityUtil.Fields;
import org.openmetadata.catalog.util.JsonUtils;
import org.openmetadata.catalog.util.RestUtil.PutResponse;
import org.openmetadata.catalog.util.ResultList;

import javax.json.JsonPatch;
import javax.ws.rs.core.Response.Status;
import java.io.IOException;
import java.io.UnsupportedEncodingException;
import java.security.GeneralSecurityException;
import java.text.ParseException;
import java.util.Date;
import java.util.List;
import java.util.Objects;
import java.util.UUID;

import static org.openmetadata.catalog.exception.CatalogExceptionMessage.entityNotFound;

public class ChartRepositoryHelper implements EntityRepository<Chart>{
  private static final Fields CHART_UPDATE_FIELDS = new Fields(ChartResource.FIELD_LIST, "owner");
  private static final Fields CHART_PATCH_FIELDS = new Fields(ChartResource.FIELD_LIST, "owner,service,tags");

  public ChartRepositoryHelper(ChartRepository3 chartRepo) { this.repo3 = chartRepo; }

  private final ChartRepository3 repo3;

  public static String getFQN(Chart chart) {
    return (chart.getService().getName() + "." + chart.getName());
  }

  @Transaction
  public ResultList<Chart> listAfter(Fields fields, String serviceName, int limitParam, String after) throws IOException,
          GeneralSecurityException, ParseException {
    return EntityUtil.listAfter(this, Chart.class, fields, serviceName, limitParam, after);
  }

  @Transaction
  public ResultList<Chart> listBefore(Fields fields, String serviceName, int limitParam, String before) throws IOException,
          GeneralSecurityException, ParseException {
    return EntityUtil.listBefore(this, Chart.class, fields, serviceName, limitParam, before);
  }

  @Transaction
  public Chart get(String id, Fields fields) throws IOException {
    return setFields(validateChart(id), fields);
  }

  @Transaction
  public Chart getByName(String fqn, Fields fields) throws IOException {
    Chart chart = repo3.chartDAO().findEntityByName(fqn);
    return setFields(chart, fields);
  }

  @Transaction
  public Chart create(Chart chart) throws IOException {
    validateRelationships(chart);
    return createInternal(chart);
  }

  @Transaction
  public void delete(String id) {
    if (repo3.relationshipDAO().findToCount(id, Relationship.CONTAINS.ordinal(), Entity.CHART) > 0) {
      throw new IllegalArgumentException("Chart is not empty");
    }
    if (repo3.chartDAO().delete(id) <= 0) {
      throw EntityNotFoundException.byMessage(entityNotFound(Entity.CHART, id));
    }
    repo3.relationshipDAO().deleteAll(id);
  }

  @Transaction
  public PutResponse<Chart> createOrUpdate(Chart updated) throws IOException {
    validateRelationships(updated);
    Chart stored = JsonUtils.readValue(repo3.chartDAO().findJsonByFqn(updated.getFullyQualifiedName()), Chart.class);
    if (stored == null) {  // Chart does not exist. Create a new one
      return new PutResponse<>(Status.CREATED, createInternal(updated));
    }
    setFields(stored, CHART_UPDATE_FIELDS);
    updated.setId(stored.getId());
    ChartUpdater chartUpdater = new ChartUpdater(stored, updated, false);
    chartUpdater.updateAll();
    chartUpdater.store();
    return new PutResponse<>(Status.OK, updated);
  }

  @Transaction
  public Chart patch(String id, String user, JsonPatch patch) throws IOException {
    Chart original = setFields(validateChart(id), CHART_PATCH_FIELDS);
    Chart updated = JsonUtils.applyPatch(original, patch, Chart.class);
    updated.withUpdatedBy(user).withUpdatedAt(new Date());
    patch(original, updated);
    return updated;
  }

  public Chart createInternal(Chart chart) throws IOException {
    storeChart(chart, false);
    addRelationships(chart);
    return chart;
  }

  private void validateRelationships(Chart chart) throws IOException {
    EntityReference dashboardService = getService(chart.getService());
    chart.setService(dashboardService);
    chart.setFullyQualifiedName(getFQN(chart));
    EntityUtil.populateOwner(repo3.userDAO(), repo3.teamDAO(), chart.getOwner()); // Validate owner
    getService(chart.getService());
    chart.setTags(EntityUtil.addDerivedTags(repo3.tagDAO(), chart.getTags()));
  }

  private void addRelationships(Chart chart) throws IOException {
    setService(chart, chart.getService());
    setOwner(chart, chart.getOwner());
    applyTags(chart);
  }

  private void storeChart(Chart chart, boolean update) throws JsonProcessingException {
    // Relationships and fields such as href are derived and not stored as part of json
    EntityReference owner = chart.getOwner();
    List<TagLabel> tags = chart.getTags();
    EntityReference service = chart.getService();

    // Don't store owner, database, href and tags as JSON. Build it on the fly based on relationships
    chart.withOwner(null).withService(null).withHref(null).withTags(null);

    if (update) {
      repo3.chartDAO().update(chart.getId().toString(), JsonUtils.pojoToJson(chart));
    } else {
      repo3.chartDAO().insert(JsonUtils.pojoToJson(chart));
    }

    // Restore the relationships
    chart.withOwner(owner).withService(service).withTags(tags);
  }


  private void applyTags(Chart chart) throws IOException {
    // Add chart level tags by adding tag to chart relationship
    EntityUtil.applyTags(repo3.tagDAO(), chart.getTags(), chart.getFullyQualifiedName());
    chart.setTags(getTags(chart.getFullyQualifiedName())); // Update tag to handle additional derived tags
  }

  private void patch(Chart original, Chart updated) throws IOException {
    // Patch can't make changes to following fields. Ignore the changes
    updated.withFullyQualifiedName(original.getFullyQualifiedName()).withName(original.getName())
            .withService(original.getService()).withId(original.getId());
    validateRelationships(updated);
    ChartUpdater chartUpdater = new ChartUpdater(original, updated, true);
    chartUpdater.updateAll();
    chartUpdater.store();
  }

  public EntityReference getOwner(Chart chart) throws IOException {
    return chart != null ? EntityUtil.populateOwner(chart.getId(), repo3.relationshipDAO(), repo3.userDAO(), repo3.teamDAO()) : null;
  }

  private void setOwner(Chart chart, EntityReference owner) {
    EntityUtil.setOwner(repo3.relationshipDAO(), chart.getId(), Entity.CHART, owner);
    // TODO not required
    chart.setOwner(owner);
  }

  private Chart validateChart(String id) throws IOException {
    return repo3.chartDAO().findEntityById(id);
  }

  @Override
  public List<String> listAfter(String fqnPrefix, int limitParam, String after) {
    return null;
  }

  @Override
  public List<String> listBefore(String fqnPrefix, int limitParam, String before) {
    return null;
  }

  @Override
  public int listCount(String fqnPrefix) {
    return 0;
  }

  @Override
  public String getFullyQualifiedName(Chart entity) {
    return null;
  }

  @Override
  public Chart setFields(Chart chart, Fields fields) throws IOException {
    chart.setOwner(fields.contains("owner") ? getOwner(chart) : null);
    chart.setService(fields.contains("service") ? getService(chart) : null);
    chart.setFollowers(fields.contains("followers") ? getFollowers(chart) : null);
    chart.setTags(fields.contains("tags") ? getTags(chart.getFullyQualifiedName()) : null);
    return chart;
  }

  @Override
  public ResultList<Chart> getResultList(List<Chart> entities, String beforeCursor, String afterCursor, int total) throws GeneralSecurityException, UnsupportedEncodingException {
    return new ResultList<>(entities, beforeCursor, afterCursor, total);
  }

  private List<EntityReference> getFollowers(Chart chart) throws IOException {
    return chart == null ? null : EntityUtil.getFollowers(chart.getId(), repo3.relationshipDAO(), repo3.userDAO());
  }

  private List<TagLabel> getTags(String fqn) {
    return repo3.tagDAO().getTags(fqn);
  }

  private EntityReference getService(Chart chart) throws IOException {
    return chart == null ? null : getService(Objects.requireNonNull(EntityUtil.getService(repo3.relationshipDAO(),
            chart.getId(), Entity.DASHBOARD_SERVICE)));
  }

  private EntityReference getService(EntityReference service) throws IOException {
    String id = service.getId().toString();
    if (service.getType().equalsIgnoreCase(Entity.DASHBOARD_SERVICE)) {
      DashboardService serviceInstance = repo3.dashboardServiceDAO().findEntityById(id);
      service.setDescription(serviceInstance.getDescription());
      service.setName(serviceInstance.getName());
    } else {
      throw new IllegalArgumentException(String.format("Invalid service type %s for the chart", service.getType()));
    }
    return service;
  }

  public void setService(Chart chart, EntityReference service) throws IOException {
    if (service != null && chart != null) {
      // TODO remove this
      getService(service); // Populate service details
      repo3.relationshipDAO().insert(service.getId().toString(), chart.getId().toString(), service.getType(),
              Entity.CHART, Relationship.CONTAINS.ordinal());
      chart.setService(service);
    }
  }

  @Transaction
  public Status addFollower(String chartId, String userId) throws IOException {
    repo3.chartDAO().findEntityById(chartId);
    return EntityUtil.addFollower(repo3.relationshipDAO(), repo3.userDAO(), chartId, Entity.CHART, userId, Entity.USER) ?
            Status.CREATED : Status.OK;
  }

  @Transaction
  public void deleteFollower(String chartId, String userId) {
    EntityUtil.validateUser(repo3.userDAO(), userId);
    EntityUtil.removeFollower(repo3.relationshipDAO(), chartId, userId);
  }

  static class ChartEntityInterface implements EntityInterface {
    private final Chart chart;

    ChartEntityInterface(Chart Chart) {
      this.chart = Chart;
    }

    @Override
    public UUID getId() {
      return chart.getId();
    }

    @Override
    public String getDescription() {
      return chart.getDescription();
    }

    @Override
    public String getDisplayName() {
      return chart.getDisplayName();
    }

    @Override
    public EntityReference getOwner() {
      return chart.getOwner();
    }

    @Override
    public String getFullyQualifiedName() {
      return chart.getFullyQualifiedName();
    }

    @Override
    public List<TagLabel> getTags() {
      return chart.getTags();
    }

    @Override
    public void setDescription(String description) {
      chart.setDescription(description);
    }

    @Override
    public void setDisplayName(String displayName) {
      chart.setDisplayName(displayName);
    }

    @Override
    public void setTags(List<TagLabel> tags) {
      chart.setTags(tags);
    }
  }

  /**
   * Handles entity updated from PUT and POST operation.
   */
  public class ChartUpdater extends EntityUpdater3 {
    final Chart orig;
    final Chart updated;

    public ChartUpdater(Chart orig, Chart updated, boolean patchOperation) {
      super(new ChartEntityInterface(orig), new ChartEntityInterface(updated), patchOperation, repo3.relationshipDAO(),
              repo3.tagDAO());
      this.orig = orig;
      this.updated = updated;
    }

    public void updateAll() throws IOException {
      super.updateAll();
    }

    public void store() throws IOException {
      updated.setVersion(getNewVersion(orig.getVersion()));
      storeChart(updated, true);
    }
  }
}
