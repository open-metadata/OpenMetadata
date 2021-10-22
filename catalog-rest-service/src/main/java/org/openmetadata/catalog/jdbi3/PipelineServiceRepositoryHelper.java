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
import org.openmetadata.catalog.entity.services.PipelineService;
import org.openmetadata.catalog.exception.EntityNotFoundException;
import org.openmetadata.catalog.resources.services.pipeline.PipelineServiceResource.PipelineServiceList;
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


public class PipelineServiceRepositoryHelper extends EntityRepository<PipelineService> {
  public PipelineServiceRepositoryHelper(PipelineServiceRepository3 repo3) {
    super(PipelineService.class, repo3.pipelineServiceDAO());
    this.repo3 = repo3;
  }

  private final PipelineServiceRepository3 repo3;

  @Transaction
  public List<PipelineService> list(String name) throws IOException {
    return JsonUtils.readObjects(repo3.pipelineServiceDAO().list(name), PipelineService.class);
  }

  @Transaction
  public PipelineService get(String id) throws IOException {
    return repo3.pipelineServiceDAO().findEntityById(id);
  }

  @Transaction
  public PipelineService getByName(String name) throws IOException {
    return repo3.pipelineServiceDAO().findEntityByName(name);
  }

  @Transaction
  public PipelineService create(PipelineService pipelineService) throws JsonProcessingException {
    // Validate fields
    Utils.validateIngestionSchedule(pipelineService.getIngestionSchedule());
    repo3.pipelineServiceDAO().insert(JsonUtils.pojoToJson(pipelineService));
    return pipelineService;
  }

  @Transaction
  public PipelineService update(String id, String description, URI url,
                                 Schedule ingestionSchedule)
          throws IOException {
    Utils.validateIngestionSchedule(ingestionSchedule);
    PipelineService pipelineService = repo3.pipelineServiceDAO().findEntityById(id);
    // Update fields
    pipelineService.withDescription(description).withIngestionSchedule(ingestionSchedule)
            .withPipelineUrl(url);
    repo3.pipelineServiceDAO().update(id, JsonUtils.pojoToJson(pipelineService));
    return pipelineService;
  }

  @Transaction
  public void delete(String id) {
    if (repo3.pipelineServiceDAO().delete(id) <= 0) {
      throw EntityNotFoundException.byMessage(entityNotFound(Entity.PIPELINE_SERVICE, id));
    }
    repo3.relationshipDAO().deleteAll(id);
  }

  @Override
  public String getFullyQualifiedName(PipelineService entity) {
    return entity.getName();
  }

  @Override
  public PipelineService setFields(PipelineService entity, Fields fields) throws IOException, ParseException {
    return entity;
  }

  @Override
  public ResultList<PipelineService> getResultList(List<PipelineService> entities, String beforeCursor,
                                                   String afterCursor, int total)
          throws GeneralSecurityException, UnsupportedEncodingException {
    return new PipelineServiceList(entities);
  }
}