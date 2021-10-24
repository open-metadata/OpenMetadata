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
import org.openmetadata.catalog.entity.services.PipelineService;
import org.openmetadata.catalog.exception.EntityNotFoundException;
import org.openmetadata.catalog.type.ChangeDescription;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.type.Schedule;
import org.openmetadata.catalog.type.TagLabel;
import org.openmetadata.catalog.util.EntityInterface;
import org.openmetadata.catalog.util.EntityUtil.Fields;
import org.openmetadata.catalog.util.JsonUtils;
import org.openmetadata.catalog.util.Utils;

import java.io.IOException;
import java.net.URI;
import java.text.ParseException;
import java.util.Date;
import java.util.List;
import java.util.UUID;

import static org.openmetadata.catalog.exception.CatalogExceptionMessage.entityNotFound;


public class PipelineServiceRepository extends EntityRepository<PipelineService> {
  private final CollectionDAO dao;

  public PipelineServiceRepository(CollectionDAO dao) {
    super(PipelineService.class, dao.pipelineServiceDAO(), dao, Fields.EMPTY_FIELDS, Fields.EMPTY_FIELDS);
    this.dao = dao;
  }

  @Transaction
  public PipelineService update(UUID id, String description, URI url,
                                 Schedule ingestionSchedule)
          throws IOException {
    Utils.validateIngestionSchedule(ingestionSchedule);
    PipelineService pipelineService = dao.pipelineServiceDAO().findEntityById(id);
    // Update fields
    pipelineService.withDescription(description).withIngestionSchedule(ingestionSchedule)
            .withPipelineUrl(url);
    dao.pipelineServiceDAO().update(id, JsonUtils.pojoToJson(pipelineService));
    return pipelineService;
  }

  @Transaction
  public void delete(UUID id) {
    if (dao.pipelineServiceDAO().delete(id) <= 0) {
      throw EntityNotFoundException.byMessage(entityNotFound(Entity.PIPELINE_SERVICE, id));
    }
    dao.relationshipDAO().deleteAll(id.toString());
  }

  @Override
  public PipelineService setFields(PipelineService entity, Fields fields) throws IOException, ParseException {
    return entity;
  }

  @Override
  public void restorePatchAttributes(PipelineService original, PipelineService updated) throws IOException,
          ParseException {

  }

  @Override
  public EntityInterface<PipelineService> getEntityInterface(PipelineService entity) {
    return new PipelineServiceEntityInterface(entity);
  }

  @Override
  public void validate(PipelineService entity) throws IOException {
    Utils.validateIngestionSchedule(entity.getIngestionSchedule());
  }

  @Override
  public void store(PipelineService entity, boolean update) throws IOException {
    dao.pipelineServiceDAO().insert(entity);
  }

  @Override
  public void storeRelationships(PipelineService entity) throws IOException {

  }

  public static class PipelineServiceEntityInterface implements EntityInterface<PipelineService> {
    private final PipelineService entity;

    public PipelineServiceEntityInterface(PipelineService entity) {
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
    public EntityReference getOwner() { return null; }

    @Override
    public String getFullyQualifiedName() { return entity.getName(); }

    @Override
    public List<TagLabel> getTags() { return null; }

    @Override
    public Double getVersion() { return entity.getVersion(); }

    @Override
    public String getUpdatedBy() { return entity.getUpdatedBy(); }

    @Override
    public Date getUpdatedAt() { return entity.getUpdatedAt(); }

    @Override
    public EntityReference getEntityReference() {
      return new EntityReference().withId(getId()).withName(getFullyQualifiedName()).withDescription(getDescription())
              .withDisplayName(getDisplayName()).withType(Entity.PIPELINE_SERVICE);
    }

    @Override
    public PipelineService getEntity() { return entity; }

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
    public void setTags(List<TagLabel> tags) { }
  }
}