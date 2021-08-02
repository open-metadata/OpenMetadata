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
import org.openmetadata.catalog.jdbi3.UsageRepository.UsageDAO;
import org.openmetadata.catalog.jdbi3.UserRepository.UserDAO;
import org.openmetadata.catalog.resources.metrics.MetricsResource;
import org.openmetadata.catalog.util.JsonUtils;
import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.entity.data.Metrics;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.util.EntityUtil;
import org.openmetadata.catalog.util.EntityUtil.Fields;
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

public abstract class MetricsRepository {
  private static final Fields METRICS_UPDATE_FIELDS = new Fields(MetricsResource.FIELD_LIST, "owner,service");

  @CreateSqlObject
  abstract MetricsDAO metricsDAO();

  @CreateSqlObject
  abstract EntityRelationshipDAO relationshipDAO();

  @CreateSqlObject
  abstract UserDAO userDAO();

  @CreateSqlObject
  abstract TeamDAO teamDAO();

  @CreateSqlObject
  abstract UsageDAO usageDAO();

  public Metrics create(Metrics metrics, EntityReference service, EntityReference owner) throws IOException {
    getService(service); // Validate service
    return createInternal(metrics, service, owner);
  }

  @Transaction
  public PutResponse<Metrics> createOrUpdate(Metrics updatedMetrics, EntityReference service,
                                             EntityReference newOwner) throws IOException {
    String fqn = service.getName() + "." + updatedMetrics.getName();
    Metrics storedMetrics = JsonUtils.readValue(metricsDAO().findByFQN(fqn), Metrics.class);
    if (storedMetrics == null) {
      return new PutResponse<>(Status.CREATED, createInternal(updatedMetrics, service, newOwner));
    }
    // Update existing metrics
    EntityUtil.populateOwner(userDAO(), teamDAO(), newOwner); // Validate new owner
    if (storedMetrics.getDescription() == null || storedMetrics.getDescription().isEmpty()) {
      storedMetrics.withDescription(updatedMetrics.getDescription());
    }
    metricsDAO().update(storedMetrics.getId().toString(), JsonUtils.pojoToJson(storedMetrics));

    // Update owner relationship
    setFields(storedMetrics, METRICS_UPDATE_FIELDS); // First get the ownership information
    updateOwner(storedMetrics, storedMetrics.getOwner(), newOwner);

    // Service can't be changed in update since service name is part of FQN and
    // change to a different service will result in a different FQN and creation of a new database under the new service
    storedMetrics.setService(service);

    return new PutResponse<>(Response.Status.OK, storedMetrics);
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

  private Metrics createInternal(Metrics metrics, EntityReference service, EntityReference owner) throws IOException {
    String fqn = service.getName() + "." + metrics.getName();
    metrics.setFullyQualifiedName(fqn);

    EntityUtil.populateOwner(userDAO(), teamDAO(), owner); // Validate owner

    metricsDAO().insert(JsonUtils.pojoToJson(metrics));
    setService(metrics, service);
    setOwner(metrics, owner);
    return metrics;
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

  private void updateOwner(Metrics metrics, EntityReference origOwner, EntityReference newOwner) {
    EntityUtil.updateOwner(relationshipDAO(), origOwner, newOwner, metrics.getId(), Entity.METRICS);
    metrics.setOwner(newOwner);
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
}
