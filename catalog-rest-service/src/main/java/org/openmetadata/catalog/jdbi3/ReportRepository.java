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
import org.openmetadata.catalog.entity.data.Report;
import org.openmetadata.catalog.resources.reports.ReportResource;
import org.openmetadata.catalog.resources.reports.ReportResource.ReportList;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.type.TagLabel;
import org.openmetadata.catalog.util.EntityInterface;
import org.openmetadata.catalog.util.EntityUtil;
import org.openmetadata.catalog.util.EntityUtil.Fields;
import org.openmetadata.catalog.util.ResultList;

import java.io.IOException;
import java.io.UnsupportedEncodingException;
import java.security.GeneralSecurityException;
import java.text.ParseException;
import java.util.Date;
import java.util.List;
import java.util.UUID;

public class ReportRepository extends EntityRepository<Report> {
  private static final Fields REPORT_UPDATE_FIELDS = new Fields(ReportResource.FIELD_LIST, "owner,service");
  private final CollectionDAO dao;

  public ReportRepository(CollectionDAO dao) {
    super(Report.class, dao.reportDAO(), dao, Fields.EMPTY_FIELDS, REPORT_UPDATE_FIELDS);
    this.dao = dao;
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
  public void restorePatchAttributes(Report original, Report updated) throws IOException, ParseException {

  }

  @Override
  public ResultList<Report> getResultList(List<Report> entities, String beforeCursor, String afterCursor, int total)
          throws GeneralSecurityException, UnsupportedEncodingException {
    return new ReportList(entities);
  }

  @Override
  public EntityInterface<Report> getEntityInterface(Report entity) {
    return new ReportEntityInterface(entity);
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

  @Override
  public EntityUpdater getUpdater(Report original, Report updated, boolean patchOperation) throws IOException {
    return null;
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
    public Double getVersion() { return entity.getVersion(); }

    @Override
    public EntityReference getEntityReference() {
      return new EntityReference().withId(getId()).withName(getFullyQualifiedName()).withDescription(getDescription())
              .withDisplayName(getDisplayName()).withType(Entity.REPORT);
    }

    @Override
    public Report getEntity() { return entity; }

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
    public void setVersion(Double version) { entity.setVersion(version); }

    @Override
    public void setUpdatedBy(String user) { entity.setUpdatedBy(user); }

    @Override
    public void setUpdatedAt(Date date) { entity.setUpdatedAt(date); }

    @Override
    public void setTags(List<TagLabel> tags) { }
  }
}
