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
import org.openmetadata.catalog.util.EntityUtil;
import org.openmetadata.catalog.util.EntityUtil.Fields;
import org.openmetadata.catalog.util.JsonUtils;
import org.openmetadata.catalog.util.RestUtil.PutResponse;
import org.openmetadata.catalog.util.ResultList;

import javax.ws.rs.core.Response;
import javax.ws.rs.core.Response.Status;
import java.io.IOException;
import java.io.UnsupportedEncodingException;
import java.security.GeneralSecurityException;
import java.util.ArrayList;
import java.util.List;

public class ReportRepositoryHelper extends EntityRepository<Report>{
  private static final Fields REPORT_UPDATE_FIELDS = new Fields(ReportResource.FIELD_LIST, "owner,service");

  public ReportRepositoryHelper(ReportRepository3 repo3) {
    super(repo3.reportDAO());
    this.repo3 = repo3;
  }

  private final ReportRepository3 repo3;

  @Transaction
  public Report create(Report report, EntityReference service, EntityReference owner) throws IOException {
    getService(service);
    return createInternal(report, service, owner);
  }

  @Transaction
  public PutResponse<Report> createOrUpdate(Report updatedReport, EntityReference service, EntityReference newOwner)
          throws IOException {
    String fqn = service.getName() + "." + updatedReport.getName();
    Report storedReport = JsonUtils.readValue(repo3.reportDAO().findJsonByFqn(fqn), Report.class);
    if (storedReport == null) {
      return new PutResponse<>(Status.CREATED, createInternal(updatedReport, service, newOwner));
    }
    // Update existing report
    EntityUtil.populateOwner(repo3.userDAO(), repo3.teamDAO(), newOwner); // Validate new owner
    if (storedReport.getDescription() == null || storedReport.getDescription().isEmpty()) {
      storedReport.withDescription(updatedReport.getDescription());
    }

    repo3.reportDAO().update(storedReport.getId().toString(), JsonUtils.pojoToJson(storedReport));

    // Update owner relationship
    setFields(storedReport, REPORT_UPDATE_FIELDS); // First get the ownership information
    updateOwner(storedReport, storedReport.getOwner(), newOwner);

    // Service can't be changed in update since service name is part of FQN and
    // change to a different service will result in a different FQN and creation of a new database under the new service
    storedReport.setService(service);

    return new PutResponse<>(Response.Status.OK, storedReport);
  }

  public List<Report> list(Fields fields) throws IOException {
    List<String> jsonList = repo3.reportDAO().list();
    List<Report> reportList = new ArrayList<>();
    for (String json : jsonList) {
      reportList.add(setFields(JsonUtils.readValue(json, Report.class), fields));
    }
    return reportList;
  }

  @Override
  public String getFullyQualifiedName(Report entity) {
    return entity.getFullyQualifiedName();
  }

  @Override
  public Report setFields(Report report, Fields fields) throws IOException {
    report.setOwner(fields.contains("owner") ? getOwner(report) : null);
    report.setService(fields.contains("service") ? getService(report) : null);
    report.setUsageSummary(fields.contains("usageSummary") ? EntityUtil.getLatestUsage(repo3.usageDAO(), report.getId()) :
            null);
    return report;
  }

  @Override
  public ResultList<Report> getResultList(List<Report> entities, String beforeCursor, String afterCursor, int total)
          throws GeneralSecurityException, UnsupportedEncodingException {
    return new ReportList(entities);
  }

  private Report createInternal(Report report, EntityReference service, EntityReference owner) throws IOException {
    String fqn = service.getName() + "." + report.getName();
    report.setFullyQualifiedName(fqn);

    EntityUtil.populateOwner(repo3.userDAO(), repo3.teamDAO(), owner); // Validate owner

    repo3.reportDAO().insert(JsonUtils.pojoToJson(report));
    setService(report, service);
    setOwner(report, owner);
    return report;
  }

  private EntityReference getService(Report report) {
    return report == null ? null : getService(EntityUtil.getService(repo3.relationshipDAO(), report.getId()));
  }

  private EntityReference getService(EntityReference service) {
    // TODO What are the report services?
    return service;
  }

  public void setService(Report report, EntityReference service) {
    if (service != null && report != null) {
      getService(service); // Populate service details
      repo3.relationshipDAO().insert(service.getId().toString(), report.getId().toString(), service.getType(),
              Entity.REPORT, Relationship.CONTAINS.ordinal());
      report.setService(service);
    }
  }

  private EntityReference getOwner(Report report) throws IOException {
    return report == null ? null : EntityUtil.populateOwner(report.getId(), repo3.relationshipDAO(), repo3.userDAO(), repo3.teamDAO());
  }

  public void setOwner(Report report, EntityReference owner) {
    EntityUtil.setOwner(repo3.relationshipDAO(), report.getId(), Entity.REPORT, owner);
    report.setOwner(owner);
  }

  private void updateOwner(Report report, EntityReference origOwner, EntityReference newOwner) {
    EntityUtil.updateOwner(repo3.relationshipDAO(), origOwner, newOwner, report.getId(), Entity.REPORT);
    report.setOwner(newOwner);
  }

}
