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
import org.openmetadata.catalog.entity.data.Metrics;
import org.openmetadata.catalog.resources.metrics.MetricsResource;
import org.openmetadata.catalog.resources.metrics.MetricsResource.MetricsList;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.type.TagLabel;
import org.openmetadata.catalog.util.EntityInterface;
import org.openmetadata.catalog.util.EntityUpdater;
import org.openmetadata.catalog.util.EntityUtil;
import org.openmetadata.catalog.util.EntityUtil.Fields;
import org.openmetadata.catalog.util.JsonUtils;
import org.openmetadata.catalog.util.RestUtil.PutResponse;
import org.openmetadata.catalog.util.ResultList;

import javax.ws.rs.core.Response.Status;
import java.io.IOException;
import java.io.UnsupportedEncodingException;
import java.security.GeneralSecurityException;
import java.util.List;
import java.util.UUID;

public class MetricsRepository extends EntityRepository<Metrics> {
  private static final Fields METRICS_UPDATE_FIELDS = new Fields(MetricsResource.FIELD_LIST, "owner,service");
  private final CollectionDAO dao;

  public MetricsRepository(CollectionDAO dao) {
    super(Metrics.class, dao.metricsDAO());
    this.dao = dao;
  }

  public static String getFQN(Metrics metrics) {
    return (metrics.getService().getName() + "." + metrics.getName());
  }

  public Metrics create(Metrics metrics) throws IOException {
    validateRelationships(metrics);
    return createInternal(metrics);
  }

  @Transaction
  public PutResponse<Metrics> createOrUpdate(Metrics updated) throws IOException {
    validateRelationships(updated);
    Metrics stored = JsonUtils.readValue(dao.metricsDAO().findJsonByFqn(updated.getFullyQualifiedName()),
            Metrics.class);
    if (stored == null) {  // Metrics does not exist. Create a new one
      return new PutResponse<>(Status.CREATED, createInternal(updated));
    }
    setFields(stored, METRICS_UPDATE_FIELDS);
    updated.setId(stored.getId());
    MetricsUpdater metricsUpdater = new MetricsUpdater(stored, updated, false);
    metricsUpdater.updateAll();
    metricsUpdater.store();
    return new PutResponse<>(Status.OK, updated);
  }

  @Override
  public String getFullyQualifiedName(Metrics entity) {
    return entity.getFullyQualifiedName();
  }

  @Override
  public Metrics setFields(Metrics metrics, Fields fields) throws IOException {
    metrics.setOwner(fields.contains("owner") ? getOwner(metrics) : null);
    metrics.setService(fields.contains("service") ? getService(metrics) : null);
    metrics.setUsageSummary(fields.contains("usageSummary") ? EntityUtil.getLatestUsage(dao.usageDAO(),
            metrics.getId()) : null);
    return metrics;
  }

  @Override
  public ResultList<Metrics> getResultList(List<Metrics> entities, String beforeCursor, String afterCursor,
                                           int total) throws GeneralSecurityException, UnsupportedEncodingException {
    return new MetricsList(entities);
  }

  private Metrics createInternal(Metrics metrics) throws IOException {
    storeMetrics(metrics, false);
    addRelationships(metrics);
    return metrics;
  }

  private void validateRelationships(Metrics metrics) throws IOException {
    metrics.setFullyQualifiedName(getFQN(metrics));
    EntityUtil.populateOwner(dao.userDAO(), dao.teamDAO(), metrics.getOwner()); // Validate owner
    metrics.setService(getService(metrics.getService()));
    metrics.setTags(EntityUtil.addDerivedTags(dao.tagDAO(), metrics.getTags()));
  }

  private void addRelationships(Metrics metrics) throws IOException {
    dao.relationshipDAO().insert(metrics.getService().getId().toString(), metrics.getId().toString(),
            metrics.getService().getType(), Entity.METRICS, Relationship.CONTAINS.ordinal());
    setOwner(metrics, metrics.getOwner());
    applyTags(metrics);
  }

  private void storeMetrics(Metrics metrics, boolean update) throws JsonProcessingException {
    // Relationships and fields such as href are derived and not stored as part of json
    EntityReference owner = metrics.getOwner();
    List<TagLabel> tags = metrics.getTags();
    EntityReference service = metrics.getService();

    // Don't store owner, database, href and tags as JSON. Build it on the fly based on relationships
    metrics.withOwner(null).withService(null).withHref(null).withTags(null);

    if (update) {
      dao.metricsDAO().update(metrics.getId().toString(), JsonUtils.pojoToJson(metrics));
    } else {
      dao.metricsDAO().insert(JsonUtils.pojoToJson(metrics));
    }

    // Restore the relationships
    metrics.withOwner(owner).withService(service).withTags(tags);
  }

  private EntityReference getService(Metrics metrics) throws IOException { // Get service by metrics Id
    EntityReference ref = EntityUtil.getService(dao.relationshipDAO(), metrics.getId(), Entity.DASHBOARD_SERVICE);
    return getService(ref);
  }

  private EntityReference getService(EntityReference service) throws IOException { // Get service by service Id
    String id = service.getId().toString();
    if (service.getType().equalsIgnoreCase(Entity.DASHBOARD_SERVICE)) {
      return dao.dbServiceDAO().findEntityReferenceById(id);
    } else {
      throw new IllegalArgumentException(String.format("Invalid service type %s for the database", service.getType()));
    }
  }

  private EntityReference getOwner(Metrics metrics) throws IOException {
    return metrics == null ? null : EntityUtil.populateOwner(metrics.getId(), dao.relationshipDAO(), dao.userDAO(),
            dao.teamDAO());
  }

  public void setOwner(Metrics metrics, EntityReference owner) {
    EntityUtil.setOwner(dao.relationshipDAO(), metrics.getId(), Entity.METRICS, owner);
    metrics.setOwner(owner);
  }

  private void applyTags(Metrics metrics) throws IOException {
    // Add chart level tags by adding tag to chart relationship
    EntityUtil.applyTags(dao.tagDAO(), metrics.getTags(), metrics.getFullyQualifiedName());
    metrics.setTags(getTags(metrics.getFullyQualifiedName())); // Update tag to handle additional derived tags
  }

  private List<TagLabel> getTags(String fqn) {
    return dao.tagDAO().getTags(fqn);
  }

  static class MetricsEntityInterface implements EntityInterface<Metrics> {
    private final Metrics entity;

    MetricsEntityInterface(Metrics entity) {
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
    public String getFullyQualifiedName() { return entity.getFullyQualifiedName(); }

    @Override
    public List<TagLabel> getTags() { return entity.getTags(); }

    @Override
    public EntityReference getEntityReference() {
      return new EntityReference().withId(getId()).withName(getFullyQualifiedName()).withDescription(getDescription())
              .withDisplayName(getDisplayName()).withType(Entity.METRICS);
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
  public class MetricsUpdater extends EntityUpdater {
    final Metrics orig;
    final Metrics updated;

    public MetricsUpdater(Metrics orig, Metrics updated, boolean patchOperation) {
      super(new MetricsEntityInterface(orig), new MetricsEntityInterface(updated), patchOperation,
              dao.relationshipDAO(),
              dao.tagDAO());
      this.orig = orig;
      this.updated = updated;
    }

    public void updateAll() throws IOException {
      super.updateAll();
    }

    public void store() throws IOException {
      updated.setVersion(getNewVersion(orig.getVersion()));
      storeMetrics(updated, true);
    }
  }
}
