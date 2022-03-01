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

import static org.openmetadata.catalog.Entity.FIELD_OWNER;
import static org.openmetadata.catalog.Entity.helper;

import java.io.IOException;
import java.net.URI;
import java.text.ParseException;
import java.util.List;
import java.util.UUID;
import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.entity.data.Report;
import org.openmetadata.catalog.resources.reports.ReportResource;
import org.openmetadata.catalog.type.ChangeDescription;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.type.Relationship;
import org.openmetadata.catalog.type.TagLabel;
import org.openmetadata.catalog.util.EntityInterface;
import org.openmetadata.catalog.util.EntityUtil;
import org.openmetadata.catalog.util.EntityUtil.Fields;

public class ReportRepository extends EntityRepository<Report> {
  private static final Fields REPORT_UPDATE_FIELDS = new Fields(ReportResource.ALLOWED_FIELDS, "owner");

  public ReportRepository(CollectionDAO dao) {
    super(
        ReportResource.COLLECTION_PATH,
        Entity.REPORT,
        Report.class,
        dao.reportDAO(),
        dao,
        Fields.EMPTY_FIELDS,
        REPORT_UPDATE_FIELDS,
        true,
        true,
        true);
  }

  @Override
  public Report setFields(Report report, Fields fields) throws IOException, ParseException {
    report.setService(getService(report)); // service is a default field
    report.setOwner(fields.contains(FIELD_OWNER) ? getOwner(report) : null);
    report.setUsageSummary(
        fields.contains("usageSummary") ? EntityUtil.getLatestUsage(daoCollection.usageDAO(), report.getId()) : null);
    return report;
  }

  @Override
  public EntityInterface<Report> getEntityInterface(Report entity) {
    return new ReportEntityInterface(entity);
  }

  @Override
  public void prepare(Report report) throws IOException, ParseException {
    report.setService(helper(helper(report).findEntity("service")).toEntityReference());
    report.setOwner(helper(report).validateOwnerOrNull());
  }

  @Override
  public void storeEntity(Report report, boolean update) throws IOException {
    report.setHref(null);
    store(report.getId(), report, update);
  }

  @Override
  public void storeRelationships(Report report) {
    EntityReference service = report.getService();
    addRelationship(service.getId(), report.getId(), service.getType(), Entity.CHART, Relationship.CONTAINS);
    setOwner(report, report.getOwner());
    applyTags(report);
  }

  private EntityReference getService(Report report) throws IOException, ParseException {
    // TODO What are the report services?
    return helper(report).getContainer();
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
    public String getName() {
      return entity.getName();
    }

    @Override
    public Boolean isDeleted() {
      return entity.getDeleted();
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
    public List<TagLabel> getTags() {
      return null;
    }

    @Override
    public Double getVersion() {
      return entity.getVersion();
    }

    @Override
    public String getUpdatedBy() {
      return entity.getUpdatedBy();
    }

    @Override
    public long getUpdatedAt() {
      return entity.getUpdatedAt();
    }

    @Override
    public URI getHref() {
      return entity.getHref();
    }

    @Override
    public ChangeDescription getChangeDescription() {
      return entity.getChangeDescription();
    }

    @Override
    public EntityReference getEntityReference() {
      return new EntityReference()
          .withId(getId())
          .withName(getFullyQualifiedName())
          .withDescription(getDescription())
          .withDisplayName(getDisplayName())
          .withType(Entity.REPORT);
    }

    @Override
    public Report getEntity() {
      return entity;
    }

    @Override
    public EntityReference getContainer() {
      return entity.getService();
    }

    @Override
    public void setId(UUID id) {
      entity.setId(id);
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
    public void setName(String name) {
      entity.setName(name);
    }

    @Override
    public void setUpdateDetails(String updatedBy, long updatedAt) {
      entity.setUpdatedBy(updatedBy);
      entity.setUpdatedAt(updatedAt);
    }

    @Override
    public void setChangeDescription(Double newVersion, ChangeDescription changeDescription) {
      entity.setVersion(newVersion);
      entity.setChangeDescription(changeDescription);
    }

    @Override
    public void setOwner(EntityReference owner) {
      entity.setOwner(owner);
    }

    @Override
    public void setDeleted(boolean flag) {
      entity.setDeleted(flag);
    }

    @Override
    public Report withHref(URI href) {
      return entity.withHref(href);
    }

    @Override
    public void setTags(List<TagLabel> tags) {}
  }
}
