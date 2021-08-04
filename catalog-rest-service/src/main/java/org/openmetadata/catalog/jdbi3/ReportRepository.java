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

import org.openmetadata.catalog.resources.reports.ReportResource;
import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.entity.data.Report;
import org.openmetadata.catalog.jdbi3.TeamRepository.TeamDAO;
import org.openmetadata.catalog.jdbi3.UsageRepository.UsageDAO;
import org.openmetadata.catalog.jdbi3.UserRepository.UserDAO;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.util.EntityUtil;
import org.openmetadata.catalog.util.EntityUtil.Fields;
import org.openmetadata.catalog.util.JsonUtils;
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

public abstract class ReportRepository {
  private static final Fields REPORT_UPDATE_FIELDS = new Fields(ReportResource.FIELD_LIST, "owner,service");

  @CreateSqlObject
  abstract ReportDAO reportDAO();

  @CreateSqlObject
  abstract EntityRelationshipDAO relationshipDAO();

  @CreateSqlObject
  abstract UserDAO userDAO();

  @CreateSqlObject
  abstract TeamDAO teamDAO();

  @CreateSqlObject
  abstract UsageDAO usageDAO();

  @Transaction
  public Report create(Report report, EntityReference service, EntityReference owner) throws IOException {
    getService(service);
    return createInternal(report, service, owner);
  }

  @Transaction
  public PutResponse<Report> createOrUpdate(Report updatedReport, EntityReference service, EntityReference newOwner)
          throws IOException {
    String fqn = service.getName() + "." + updatedReport.getName();
    Report storedReport = JsonUtils.readValue(reportDAO().findByFQN(fqn), Report.class);
    if (storedReport == null) {
      return new PutResponse<>(Status.CREATED, createInternal(updatedReport, service, newOwner));
    }
    // Update existing report
    EntityUtil.populateOwner(userDAO(), teamDAO(), newOwner); // Validate new owner
    if (storedReport.getDescription() == null || storedReport.getDescription().isEmpty()) {
      storedReport.withDescription(updatedReport.getDescription());
    }

    reportDAO().update(storedReport.getId().toString(), JsonUtils.pojoToJson(storedReport));

    // Update owner relationship
    setFields(storedReport, REPORT_UPDATE_FIELDS); // First get the ownership information
    updateOwner(storedReport, storedReport.getOwner(), newOwner);

    // Service can't be changed in update since service name is part of FQN and
    // change to a different service will result in a different FQN and creation of a new database under the new service
    storedReport.setService(service);

    return new PutResponse<>(Response.Status.OK, storedReport);
  }

  public Report get(String id, Fields fields) throws IOException {
    return setFields(EntityUtil.validate(id, reportDAO().findById(id), Report.class), fields);
  }

  public List<Report> list(Fields fields) throws IOException {
    List<String> jsonList = reportDAO().list();
    List<Report> reportList = new ArrayList<>();
    for (String json : jsonList) {
      reportList.add(setFields(JsonUtils.readValue(json, Report.class), fields));
    }
    return reportList;
  }

  private Report setFields(Report report, Fields fields) throws IOException {
    report.setOwner(fields.contains("owner") ? getOwner(report) : null);
    report.setService(fields.contains("service") ? getService(report) : null);
    report.setUsageSummary(fields.contains("usageSummary") ? EntityUtil.getLatestUsage(usageDAO(), report.getId()) :
            null);
    return report;
  }

  private Report createInternal(Report report, EntityReference service, EntityReference owner) throws IOException {
    String fqn = service.getName() + "." + report.getName();
    report.setFullyQualifiedName(fqn);

    EntityUtil.populateOwner(userDAO(), teamDAO(), owner); // Validate owner

    reportDAO().insert(JsonUtils.pojoToJson(report));
    setService(report, service);
    setOwner(report, owner);
    return report;
  }

  private EntityReference getService(Report report) {
    return report == null ? null : getService(EntityUtil.getService(relationshipDAO(), report.getId()));
  }

  private EntityReference getService(EntityReference service) {
    // TODO What are the report services?
    return service;
  }

  public void setService(Report report, EntityReference service) {
    if (service != null && report != null) {
      getService(service); // Populate service details
      relationshipDAO().insert(service.getId().toString(), report.getId().toString(), service.getType(),
              Entity.REPORT, Relationship.CONTAINS.ordinal());
      report.setService(service);
    }
  }

  private EntityReference getOwner(Report report) throws IOException {
    return report == null ? null : EntityUtil.populateOwner(report.getId(), relationshipDAO(), userDAO(), teamDAO());
  }

  public void setOwner(Report report, EntityReference owner) {
    EntityUtil.setOwner(relationshipDAO(), report.getId(), Entity.REPORT, owner);
    report.setOwner(owner);
  }

  private void updateOwner(Report report, EntityReference origOwner, EntityReference newOwner) {
    EntityUtil.updateOwner(relationshipDAO(), origOwner, newOwner, report.getId(), Entity.REPORT);
    report.setOwner(newOwner);
  }

  public interface ReportDAO {
    @SqlUpdate("INSERT INTO report_entity(json) VALUES (:json)")
    void insert(@Bind("json") String json);

    @SqlUpdate("UPDATE report_entity SET  json = :json where id = :id")
    void update(@Bind("id") String id, @Bind("json") String json);

    @SqlQuery("SELECT json FROM report_entity WHERE id = :id")
    String findById(@Bind("name") String id);

    @SqlQuery("SELECT json FROM report_entity WHERE fullyQualifiedName = :name")
    String findByFQN(@Bind("name") String name);

    @SqlQuery("SELECT json FROM report_entity")
    List<String> list();

    @SqlQuery("SELECT EXISTS (SELECT * FROM report_entity where id = :id)")
    boolean exists(@Bind("id") String id);
  }
}
