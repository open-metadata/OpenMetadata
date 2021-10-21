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
import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.entity.data.Metrics;
import org.openmetadata.catalog.jdbi3.TagRepository.TagDAO;
import org.openmetadata.catalog.jdbi3.TeamRepository.TeamDAO;
import org.openmetadata.catalog.resources.metrics.MetricsResource;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.type.TagLabel;
import org.openmetadata.catalog.util.EntityInterface;
import org.openmetadata.catalog.util.EntityUpdater;
import org.openmetadata.catalog.util.EntityUtil;
import org.openmetadata.catalog.util.EntityUtil.Fields;
import org.openmetadata.catalog.util.JsonUtils;
import org.openmetadata.catalog.util.RestUtil.PutResponse;
import org.skife.jdbi.v2.sqlobject.Bind;
import org.skife.jdbi.v2.sqlobject.CreateSqlObject;
import org.skife.jdbi.v2.sqlobject.SqlQuery;
import org.skife.jdbi.v2.sqlobject.SqlUpdate;
import org.skife.jdbi.v2.sqlobject.Transaction;

import javax.ws.rs.core.Response.Status;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

public abstract class MetricsRepository {
  private static final Fields METRICS_UPDATE_FIELDS = new Fields(MetricsResource.FIELD_LIST, "owner,service");

  public static String getFQN(Metrics metrics) {
    return (metrics.getService().getName() + "." + metrics.getName());
  }

  @CreateSqlObject
  abstract MetricsDAO metricsDAO();

  @CreateSqlObject
  abstract EntityRelationshipDAO relationshipDAO();

  @CreateSqlObject
  abstract UserDAO userDAO();

  @CreateSqlObject
  abstract TeamDAO teamDAO();

  @CreateSqlObject
  abstract TagDAO tagDAO();

  @CreateSqlObject
  abstract UsageDAO usageDAO();

  public Metrics create(Metrics metrics) throws IOException {
    validateRelationships(metrics);
    return createInternal(metrics);
  }

  @Transaction
  public PutResponse<Metrics> createOrUpdate(Metrics updated) throws IOException {
    validateRelationships(updated);
    Metrics stored = JsonUtils.readValue(metricsDAO().findByFQN(updated.getFullyQualifiedName()), Metrics.class);
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

  @Transaction
  public Metrics get(String id, Fields fields) throws IOException {
    return setFields(EntityUtil.validate(id, metricsDAO().findById(id), Metrics.class), fields);
  }

  @Transaction
  public List<Metrics> list(Fields fields) throws IOException {
    List<String> jsonList = metricsDAO().list();
    List<Metrics> metricsList = new ArrayList<>();
    for (String json : jsonList) {
      metricsList.add(setFields(JsonUtils.readValue(json, Metrics.class), fields));
    }
    return metricsList;
  }

  private Metrics setFields(Metrics metrics, Fields fields) throws IOException {
    metrics.setOwner(fields.contains("owner") ? getOwner(metrics) : null);
    metrics.setService(fields.contains("service") ? getService(metrics) : null);
    metrics.setUsageSummary(fields.contains("usageSummary") ? EntityUtil.getLatestUsage(usageDAO(), metrics.getId())
            : null);
    return metrics;
  }

  private Metrics createInternal(Metrics metrics) throws IOException {
    storeMetrics(metrics, false);
    addRelationships(metrics);
    return metrics;
  }

  private void validateRelationships(Metrics metrics) throws IOException {
    metrics.setFullyQualifiedName(getFQN(metrics));
    EntityUtil.populateOwner(userDAO(), teamDAO(), metrics.getOwner()); // Validate owner
    getService(metrics.getService());
    metrics.setTags(EntityUtil.addDerivedTags(tagDAO(), metrics.getTags()));
  }

  private void addRelationships(Metrics metrics) throws IOException {
    setService(metrics, metrics.getService());
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
      metricsDAO().update(metrics.getId().toString(), JsonUtils.pojoToJson(metrics));
    } else {
      metricsDAO().insert(JsonUtils.pojoToJson(metrics));
    }

    // Restore the relationships
    metrics.withOwner(owner).withService(service).withTags(tags);
  }

  private EntityReference getService(Metrics metrics) {
    return metrics == null ? null : getService(EntityUtil.getService(relationshipDAO(), metrics.getId()));
  }

  private EntityReference getService(EntityReference service) {
    // TODO What are the metrics services?
    return service;
  }

  public void setService(Metrics metrics, EntityReference service) {
    if (service != null && metrics != null) {
      getService(service); // Populate service details
      relationshipDAO().insert(service.getId().toString(), metrics.getId().toString(), service.getType(),
              Entity.METRICS, Relationship.CONTAINS.ordinal());
      metrics.setService(service);
    }
  }

  private EntityReference getOwner(Metrics metrics) throws IOException {
    return metrics == null ? null : EntityUtil.populateOwner(metrics.getId(), relationshipDAO(), userDAO(), teamDAO());
  }

  public void setOwner(Metrics metrics, EntityReference owner) {
    EntityUtil.setOwner(relationshipDAO(), metrics.getId(), Entity.METRICS, owner);
    metrics.setOwner(owner);
  }

  private void applyTags(Metrics metrics) throws IOException {
    // Add chart level tags by adding tag to chart relationship
    EntityUtil.applyTags(tagDAO(), metrics.getTags(), metrics.getFullyQualifiedName());
    metrics.setTags(getTags(metrics.getFullyQualifiedName())); // Update tag to handle additional derived tags
  }

  private List<TagLabel> getTags(String fqn) {
    return tagDAO().getTags(fqn);
  }

  public interface MetricsDAO {
    @SqlUpdate("INSERT INTO metric_entity(json) VALUES (:json)")
    void insert(@Bind("json") String json);

    @SqlUpdate("UPDATE metrics_entity SET  json = :json where id = :id")
    void update(@Bind("id") String id, @Bind("json") String json);

    @SqlQuery("SELECT json FROM metric_entity WHERE id = :id")
    String findById(@Bind("id") String id);

    @SqlQuery("SELECT json FROM metric_entity WHERE fullyQualifiedName = :name")
    String findByFQN(@Bind("name") String name);

    @SqlQuery("SELECT json FROM metric_entity")
    List<String> list();

    @SqlQuery("SELECT EXISTS (SELECT * FROM metric_entity where id = :id)")
    boolean exists(@Bind("id") String id);
  }

  static class MetricsEntityInterface implements EntityInterface {
    private final Metrics metrics;

    MetricsEntityInterface(Metrics Metrics) {
      this.metrics = Metrics;
    }

    @Override
    public UUID getId() {
      return metrics.getId();
    }

    @Override
    public String getDescription() {
      return metrics.getDescription();
    }

    @Override
    public String getDisplayName() {
      return metrics.getDisplayName();
    }

    @Override
    public EntityReference getOwner() {
      return metrics.getOwner();
    }

    @Override
    public String getFullyQualifiedName() {
      return metrics.getFullyQualifiedName();
    }

    @Override
    public List<TagLabel> getTags() {
      return metrics.getTags();
    }

    @Override
    public void setDescription(String description) {
      metrics.setDescription(description);
    }

    @Override
    public void setDisplayName(String displayName) {
      metrics.setDisplayName(displayName);
    }

    @Override
    public void setTags(List<TagLabel> tags) {
      metrics.setTags(tags);
    }
  }

  /**
   * Handles entity updated from PUT and POST operation.
   */
  public class MetricsUpdater extends EntityUpdater {
    final Metrics orig;
    final Metrics updated;

    public MetricsUpdater(Metrics orig, Metrics updated, boolean patchOperation) {
      super(new MetricsEntityInterface(orig), new MetricsEntityInterface(updated), patchOperation, relationshipDAO(),
              tagDAO());
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
