/*
 *  Copyright 2021 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
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
import org.openmetadata.catalog.type.ChangeDescription;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.type.TagLabel;
import org.openmetadata.catalog.util.EntityInterface;
import org.openmetadata.catalog.util.EntityUtil;
import org.openmetadata.catalog.util.EntityUtil.Fields;

import java.io.IOException;
import java.net.URI;
import java.util.Date;
import java.util.List;
import java.util.UUID;

public class ReportRepository extends EntityRepository<Report> {
  private static final Fields REPORT_UPDATE_FIELDS = new Fields(ReportResource.FIELD_LIST, "owner");
  private final CollectionDAO dao;

  public ReportRepository(CollectionDAO dao) {
    super(ReportResource.COLLECTION_PATH, Entity.REPORT, Report.class, dao.reportDAO(), dao, Fields.EMPTY_FIELDS,
            REPORT_UPDATE_FIELDS);
    this.dao = dao;
  }

  @Override
  public Report setFields(Report report, Fields fields) throws IOException {
    report.setService(getService(report)); // service is a default field
    report.setOwner(fields.contains("owner") ? getOwner(report) : null);
    report.setUsageSummary(fields.contains("usageSummary") ? EntityUtil.getLatestUsage(dao.usageDAO(),
            report.getId()) : null);
    return report;
  }

  @Override
  public void restorePatchAttributes(Report original, Report updated) {

  }

  @Override
  public EntityInterface<Report> getEntityInterface(Report entity) {
    return new ReportEntityInterface(entity);
  }

  @Override
  public void prepare(Report report) throws IOException {
    setService(report, report.getService());
    setOwner(report, report.getOwner());
    EntityUtil.populateOwner(dao.userDAO(), dao.teamDAO(), report.getOwner()); // Validate owner
  }

  @Override
  public void storeEntity(Report report, boolean update) throws IOException {
    // TODO add right checks
    dao.reportDAO().insert(report);
  }

  @Override
  public void storeRelationships(Report entity) {
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
    public String getUpdatedBy() { return entity.getUpdatedBy(); }

    @Override
    public Date getUpdatedAt() { return entity.getUpdatedAt(); }

    @Override
    public URI getHref() { return entity.getHref(); }

    @Override
    public List<EntityReference> getFollowers() {
      throw new UnsupportedOperationException("Report does not support followers");
    }

    @Override
    public ChangeDescription getChangeDescription() { return entity.getChangeDescription(); }

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
    public void setUpdateDetails(String updatedBy, Date updatedAt) {
      entity.setUpdatedBy(updatedBy);
      entity.setUpdatedAt(updatedAt);
    }

    @Override
    public void setChangeDescription(Double newVersion, ChangeDescription changeDescription) {
      entity.setVersion(newVersion);
      entity.setChangeDescription(changeDescription);
    }

    @Override
    public void setOwner(EntityReference owner) { entity.setOwner(owner); }

    @Override
    public Report withHref(URI href) { return entity.withHref(href); }

    @Override
    public void setTags(List<TagLabel> tags) { }
  }
}
