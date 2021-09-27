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
import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.entity.services.PipelineService;
import org.openmetadata.catalog.exception.EntityNotFoundException;
import org.openmetadata.catalog.type.Schedule;
import org.openmetadata.catalog.util.EntityUtil;
import org.openmetadata.catalog.util.JsonUtils;
import org.openmetadata.catalog.util.Utils;
import org.skife.jdbi.v2.sqlobject.Bind;
import org.skife.jdbi.v2.sqlobject.CreateSqlObject;
import org.skife.jdbi.v2.sqlobject.SqlQuery;
import org.skife.jdbi.v2.sqlobject.SqlUpdate;
import org.skife.jdbi.v2.sqlobject.Transaction;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.net.URI;
import java.util.List;

import static org.openmetadata.catalog.exception.CatalogExceptionMessage.entityNotFound;


public abstract class PipelineServiceRepository {
  private static final Logger LOG = LoggerFactory.getLogger(PipelineServiceRepository.class);

  @CreateSqlObject
  abstract PipelineServiceDAO pipelineServiceDAO();

  @CreateSqlObject
  abstract EntityRelationshipDAO relationshipDAO();

  @Transaction
  public List<PipelineService> list(String name) throws IOException {
    return JsonUtils.readObjects(pipelineServiceDAO().list(name), PipelineService.class);
  }

  @Transaction
  public PipelineService get(String id) throws IOException {
    return EntityUtil.validate(id, pipelineServiceDAO().findById(id), PipelineService.class);
  }

  @Transaction
  public PipelineService getByName(String name) throws IOException {
    return EntityUtil.validate(name, pipelineServiceDAO().findByName(name), PipelineService.class);
  }

  @Transaction
  public PipelineService create(PipelineService pipelineService) throws JsonProcessingException {
    // Validate fields
    Utils.validateIngestionSchedule(pipelineService.getIngestionSchedule());
    pipelineServiceDAO().insert(JsonUtils.pojoToJson(pipelineService));
    return pipelineService;
  }

  @Transaction
  public PipelineService update(String id, String description, URI url,
                                 Schedule ingestionSchedule)
          throws IOException {
    Utils.validateIngestionSchedule(ingestionSchedule);
    PipelineService pipelineService = EntityUtil.validate(id, pipelineServiceDAO().findById(id), PipelineService.class);
    // Update fields
    pipelineService.withDescription(description).withIngestionSchedule(ingestionSchedule)
            .withPipelineUrl(url);
    pipelineServiceDAO().update(id, JsonUtils.pojoToJson(pipelineService));
    return pipelineService;
  }

  @Transaction
  public void delete(String id) {
    if (pipelineServiceDAO().delete(id) <= 0) {
      throw EntityNotFoundException.byMessage(entityNotFound(Entity.PIPELINE_SERVICE, id));
    }
    relationshipDAO().deleteAll(id);
  }



  public interface PipelineServiceDAO {
    @SqlUpdate("INSERT INTO pipeline_service_entity (json) VALUES (:json)")
    void insert(@Bind("json") String json);

    @SqlUpdate("UPDATE pipeline_service_entity SET  json = :json where id = :id")
    void update(@Bind("id") String id, @Bind("json") String json);

    @SqlQuery("SELECT json FROM pipeline_service_entity WHERE id = :id")
    String findById(@Bind("id") String id);

    @SqlQuery("SELECT json FROM pipeline_service_entity WHERE name = :name")
    String findByName(@Bind("name") String name);

    @SqlQuery("SELECT json FROM pipeline_service_entity WHERE (name = :name OR :name is NULL)")
    List<String> list(@Bind("name") String name);

    @SqlUpdate("DELETE FROM pipeline_service_entity WHERE id = :id")
    int delete(@Bind("id") String id);
  }
}