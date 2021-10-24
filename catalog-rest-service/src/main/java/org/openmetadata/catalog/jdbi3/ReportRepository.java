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

import org.jdbi.v3.sqlobject.transaction.Transaction;
import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.entity.data.Report;
import org.openmetadata.catalog.resources.reports.ReportResource;
import org.openmetadata.catalog.resources.reports.ReportResource.ReportList;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.type.TagLabel;
import org.openmetadata.catalog.util.EntityInterface;
import org.openmetadata.catalog.util.EntityUtil;
import org.openmetadata.catalog.util.EntityUtil.Fields;
import org.openmetadata.catalog.util.JsonUtils;
import org.openmetadata.catalog.util.RestUtil.PutResponse;
import org.openmetadata.catalog.util.ResultList;

import javax.ws.rs.core.Response;
import java.io.IOException;
import java.io.UnsupportedEncodingException;
import java.security.GeneralSecurityException;
import java.util.List;
import java.util.UUID;

public class ReportRepository extends EntityRepository<Report> {
  private static final Fields REPORT_UPDATE_FIELDS = new Fields(ReportResource.FIELD_LIST, "owner,service");
  private final CollectionDAO dao;

  public ReportRepository(CollectionDAO dao) {
    super(Report.class, dao.reportDAO());
    this.dao = dao;
  }

  @Transaction
  public PutResponse<Report> createOrUpdate(Report updatedReport, EntityReference service, EntityReference newOwner)
          throws IOException {
    String fqn = service.getName() + "." + updatedReport.getName();
    Report storedReport = JsonUtils.readValue(dao.reportDAO().findJsonByFqn(fqn), Report.class);
    if (storedReport == null) {
//      return new PutResponse<>(Status.CREATED, createInternal(updatedReport, service, newOwner));
    }
    // Update existing report
    EntityUtil.populateOwner(dao.userDAO(), dao.teamDAO(), newOwner); // Validate new owner
    if (storedReport.getDescription() == null || storedReport.getDescription().isEmpty()) {
      storedReport.withDescription(updatedReport.getDescription());
    }

    dao.reportDAO().update(storedReport.getId(), JsonUtils.pojoToJson(storedReport));

    // Update owner relationship
    setFields(storedReport, REPORT_UPDATE_FIELDS); // First get the ownership information
    updateOwner(storedReport, storedReport.getOwner(), newOwner);

    // Service can't be changed in update since service name is part of FQN and
    // change to a different service will result in a different FQN and creation of a new database under the new service
    storedReport.setService(service);

    return new PutResponse<>(Response.Status.OK, storedReport);
  }

  @Override
  public String getFullyQualifiedName(Report entity) {
    return entity.getFullyQualifiedName();
  }

  @Override
  public Report setFields(Report report, Fields fields) throws IOException {
    report.setOwner(fields.contains("owner") ? getOwner(report) : null);
    report.setService(fields.contains("service") ? getService(report) : null);
    report.setUsageSummary(fields.contains("usageSummary") ? EntityUtil.getLatestUsage(dao.usageDAO(),
            report.getId()) : null);
    return report;
  }

  @Override
  public ResultList<Report> getResultList(List<Report> entities, String beforeCursor, String afterCursor, int total)
          throws GeneralSecurityException, UnsupportedEncodingException {
    return new ReportList(entities);
  }

  @Override
  public void validate(Report report) throws IOException {
    // TODO clean this up
    setService(report, report.getService());
    setOwner(report, report.getOwner());

//    String fqn = service.getName() + "." + report.getName();
//    report.setFullyQualifiedName(fqn);
//    getService(service);
    EntityUtil.populateOwner(dao.userDAO(), dao.teamDAO(), report.getOwner()); // Validate owner
  }

  @Override
  public void store(Report report, boolean update) throws IOException {
    // TODO add right checks
    dao.reportDAO().insert(report);
  }

  @Override
  public void storeRelationships(Report entity) throws IOException {
    // TODO
  }

  private EntityReference getService(Report report) {
    return report == null ? null : getService(EntityUtil.getService(dao.relationshipDAO(), report.getId()));
  }

  private EntityReference getService(EntityReference service) {
    // TODO What are the report services?
    return service;
  }

  public void setService(Report report, EntityReference service) {
    if (service != null && report != null) {
      getService(service); // Populate service details
      dao.relationshipDAO().insert(service.getId().toString(), report.getId().toString(), service.getType(),
              Entity.REPORT, Relationship.CONTAINS.ordinal());
      report.setService(service);
    }
  }

  private EntityReference getOwner(Report report) throws IOException {
    return report == null ? null : EntityUtil.populateOwner(report.getId(), dao.relationshipDAO(), dao.userDAO(),
            dao.teamDAO());
  }

  public void setOwner(Report report, EntityReference owner) {
    EntityUtil.setOwner(dao.relationshipDAO(), report.getId(), Entity.REPORT, owner);
    report.setOwner(owner);
  }

  private void updateOwner(Report report, EntityReference origOwner, EntityReference newOwner) {
    EntityUtil.updateOwner(dao.relationshipDAO(), origOwner, newOwner, report.getId(), Entity.REPORT);
    report.setOwner(newOwner);
  }

  public static class ReportEntityInterface implements EntityInterface<Report> {
    private final Report entity;

    ReportEntityInterface(Report entity) {
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
    public List<TagLabel> getTags() { return null; }

    @Override
    public EntityReference getEntityReference() {
      return new EntityReference().withId(getId()).withName(getFullyQualifiedName()).withDescription(getDescription())
              .withDisplayName(getDisplayName()).withType(Entity.REPORT);
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
    public void setTags(List<TagLabel> tags) { }
  }
}
