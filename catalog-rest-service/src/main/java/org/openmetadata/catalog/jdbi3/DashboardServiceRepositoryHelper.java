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
import org.jdbi.v3.sqlobject.transaction.Transaction;
import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.entity.services.DashboardService;
import org.openmetadata.catalog.exception.EntityNotFoundException;
import org.openmetadata.catalog.type.Schedule;
import org.openmetadata.catalog.util.EntityUtil.Fields;
import org.openmetadata.catalog.util.JsonUtils;
import org.openmetadata.catalog.util.ResultList;
import org.openmetadata.catalog.util.Utils;

import java.io.IOException;
import java.io.UnsupportedEncodingException;
import java.net.URI;
import java.security.GeneralSecurityException;
import java.text.ParseException;
import java.util.List;

import static org.openmetadata.catalog.exception.CatalogExceptionMessage.entityNotFound;


public class DashboardServiceRepositoryHelper extends EntityRepository<DashboardService> {
  private final DashboardServiceRepository3 repo3;

  public DashboardServiceRepositoryHelper(DashboardServiceRepository3 repo3) {
    super(repo3.dashboardServiceDAO());
    this.repo3 = repo3;
  }

  @Transaction
  public List<DashboardService> list(String name) throws IOException {
    return JsonUtils.readObjects(repo3.dashboardServiceDAO().list(name), DashboardService.class);
  }

  @Transaction
  public DashboardService get(String id) throws IOException {
    return repo3.dashboardServiceDAO().findEntityById(id);
  }

  @Transaction
  public DashboardService getByName(String name) throws IOException {
    return repo3.dashboardServiceDAO().findEntityByName(name);
  }

  @Transaction
  public DashboardService create(DashboardService dashboardService) throws JsonProcessingException {
    // Validate fields
    Utils.validateIngestionSchedule(dashboardService.getIngestionSchedule());
    repo3.dashboardServiceDAO().insert(JsonUtils.pojoToJson(dashboardService));
    return dashboardService;
  }

  public DashboardService update(String id, String description, URI dashboardUrl, String username, String password,
                                 Schedule ingestionSchedule)
          throws IOException {
    Utils.validateIngestionSchedule(ingestionSchedule);
    DashboardService dashboardService = repo3.dashboardServiceDAO().findEntityById(id);
    // Update fields
    dashboardService.withDescription(description).withDashboardUrl(dashboardUrl).withUsername(username)
            .withPassword(password).withIngestionSchedule(ingestionSchedule);
    repo3.dashboardServiceDAO().update(id, JsonUtils.pojoToJson(dashboardService));
    return dashboardService;
  }

  @Transaction
  public void delete(String id) {
    if (repo3.dashboardServiceDAO().delete(id) <= 0) {
      throw EntityNotFoundException.byMessage(entityNotFound(Entity.CHART, id));
    }
    repo3.relationshipDAO().deleteAll(id);
  }

  @Override
  public String getFullyQualifiedName(DashboardService entity) {
    // TODO clean this up
    return null;
  }

  @Override
  public DashboardService setFields(DashboardService entity, Fields fields) throws IOException, ParseException {
    return null;
  }

  @Override
  public ResultList<DashboardService> getResultList(List<DashboardService> entities, String beforeCursor, String afterCursor, int total) throws GeneralSecurityException, UnsupportedEncodingException {
    return null;
  }
}