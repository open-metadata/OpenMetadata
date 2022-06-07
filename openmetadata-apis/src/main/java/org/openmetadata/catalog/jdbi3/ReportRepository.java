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

import java.io.IOException;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.entity.data.Report;
import org.openmetadata.catalog.resources.reports.ReportResource;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.type.Relationship;
import org.openmetadata.catalog.util.EntityUtil;
import org.openmetadata.catalog.util.EntityUtil.Fields;

@Slf4j
public class ReportRepository extends EntityRepository<Report> {
  private static final String REPORT_UPDATE_FIELDS = "owner";

  public ReportRepository(CollectionDAO dao) {
    super(ReportResource.COLLECTION_PATH, Entity.REPORT, Report.class, dao.reportDAO(), dao, "", REPORT_UPDATE_FIELDS);
  }

  @Override
  public Report setFields(Report report, Fields fields) throws IOException {
    report.setService(getService(report)); // service is a default field
    report.setOwner(fields.contains(FIELD_OWNER) ? getOwner(report) : null);
    report.setUsageSummary(
        fields.contains("usageSummary") ? EntityUtil.getLatestUsage(daoCollection.usageDAO(), report.getId()) : null);
    return report;
  }

  @Override
  public void prepare(Report report) throws IOException {
    // TODO report does not have service yet
    setFullyQualifiedName(report);
    report.setOwner(Entity.getEntityReference(report.getOwner()));
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
    storeOwner(report, report.getOwner());
    applyTags(report);
  }

  private EntityReference getService(Report report) {
    // TODO What are the report services?
    return null;
  }
}
