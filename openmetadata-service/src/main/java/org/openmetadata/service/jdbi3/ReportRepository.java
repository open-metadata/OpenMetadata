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
package org.openmetadata.service.jdbi3;

import java.util.Set;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.data.Report;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.Entity;
import org.openmetadata.service.entity.EntityModuleDependencies;
import org.openmetadata.service.entity.EntityModuleFactory;
import org.openmetadata.service.entity.policy.EntityPolicy;
import org.openmetadata.service.entity.policy.EntityPolicyContext;
import org.openmetadata.service.resources.reports.ReportResource;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.EntityUtil.RelationIncludes;

@Slf4j
@Repository()
public class ReportRepository implements EntityPolicy<Report> {

  public ReportRepository() {
    this.entityContext =
        new EntityPolicyContext<>(
            new EntityPolicyContext.Schema<>(
                ReportResource.COLLECTION_PATH,
                Entity.REPORT,
                Report.class,
                Entity.getCollectionDAO().reportDAO()),
            new EntityPolicyContext.WriteFields("", "", Set.of()),
            EntityModuleDependencies.standard());
    EntityModuleFactory.initialize(this, true);
  }

  @Override
  public void setFields(Report report, Fields fields, RelationIncludes relationIncludes) {
    // service is a default field
    report.setService(getService(report));
    if (report.getUsageSummary() == null) {
      report.withUsageSummary(
          fields.contains("usageSummary")
              ? EntityUtil.getLatestUsage(
                  context().dependencies().daos().usageDAO(), report.getId())
              : report.getUsageSummary());
    }
  }

  @Override
  public void clearFields(Report report, Fields fields) {
    report.withUsageSummary(fields.contains("usageSummary") ? report.getUsageSummary() : null);
  }

  @Override
  public void prepare(Report report, boolean update) {
    // TODO report does not have service yet
  }

  @Override
  public void storeEntity(Report report, boolean update) {
    persistence().store(report, update);
  }

  @Override
  public void storeRelationships(Report report) {
    addServiceRelationship(report, report.getService());
  }

  private EntityReference getService(Report report) {
    return null;
  }

  private final EntityPolicyContext<Report> entityContext;

  @Override
  public final EntityPolicyContext<Report> context() {
    return entityContext;
  }
}
