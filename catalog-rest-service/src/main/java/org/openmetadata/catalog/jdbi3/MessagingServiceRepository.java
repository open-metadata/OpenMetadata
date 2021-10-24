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
import org.openmetadata.catalog.entity.services.MessagingService;
import org.openmetadata.catalog.exception.EntityNotFoundException;
import org.openmetadata.catalog.resources.services.messaging.MessagingServiceResource.MessagingServiceList;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.type.Schedule;
import org.openmetadata.catalog.type.TagLabel;
import org.openmetadata.catalog.util.EntityInterface;
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
import java.util.UUID;

import static org.openmetadata.catalog.exception.CatalogExceptionMessage.entityNotFound;

public class MessagingServiceRepository extends EntityRepository<MessagingService> {
  private final CollectionDAO dao;

  public MessagingServiceRepository(CollectionDAO dao) {
    super(MessagingService.class, dao.messagingServiceDAO());
    this.dao = dao;
  }

  @Transaction
  public MessagingService update(UUID id, String description, List<String> brokers, URI schemaRegistry,
                                 Schedule ingestionSchedule)
          throws IOException {
    Utils.validateIngestionSchedule(ingestionSchedule);
    MessagingService dbService = dao.messagingServiceDAO().findEntityById(id);
    // Update fields
    dbService.withDescription(description).withIngestionSchedule(ingestionSchedule)
            .withSchemaRegistry(schemaRegistry).withBrokers(brokers);
    dao.messagingServiceDAO().update(id, JsonUtils.pojoToJson(dbService));
    return dbService;
  }

  @Transaction
  public void delete(UUID id) {
    if (dao.messagingServiceDAO().delete(id) <= 0) {
      throw EntityNotFoundException.byMessage(entityNotFound(Entity.MESSAGING_SERVICE, id));
    }
    dao.relationshipDAO().deleteAll(id.toString());
  }

  @Override
  public String getFullyQualifiedName(MessagingService entity) {
    return entity.getName();
  }

  @Override
  public MessagingService setFields(MessagingService entity, Fields fields) throws IOException, ParseException {
    return entity;
  }

  @Override
  public ResultList<MessagingService> getResultList(List<MessagingService> entities, String beforeCursor,
                                                    String afterCursor, int total)
          throws GeneralSecurityException, UnsupportedEncodingException {
    return new MessagingServiceList(entities);
  }

  @Override
  public void validate(MessagingService entity) throws IOException {
    Utils.validateIngestionSchedule(entity.getIngestionSchedule());
  }

  @Override
  public void store(MessagingService entity, boolean update) throws IOException {
    dao.messagingServiceDAO().insert(entity);
    // TODO Other cleanup
  }

  @Override
  public void storeRelationships(MessagingService entity) throws IOException {

  }

  public static class MessagingServiceEntityInterface implements EntityInterface<MessagingService> {
    private final MessagingService entity;

    public MessagingServiceEntityInterface(MessagingService entity) {
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
    public EntityReference getOwner() { return null;
    }

    @Override
    public String getFullyQualifiedName() { return entity.getName(); }

    @Override
    public List<TagLabel> getTags() { return null; }

    @Override
    public EntityReference getEntityReference() {
      return new EntityReference().withId(getId()).withName(getFullyQualifiedName()).withDescription(getDescription())
              .withDisplayName(getDisplayName()).withType(Entity.MESSAGING_SERVICE);
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
    public void setTags(List<TagLabel> tags) { }
  }
}