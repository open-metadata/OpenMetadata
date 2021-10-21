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
import org.openmetadata.catalog.entity.services.MessagingService;
import org.openmetadata.catalog.exception.EntityNotFoundException;
import org.openmetadata.catalog.type.Schedule;
import org.openmetadata.catalog.util.EntityUtil;
import org.openmetadata.catalog.util.JsonUtils;
import org.openmetadata.catalog.util.Utils;
import org.skife.jdbi.v2.sqlobject.CreateSqlObject;
import org.skife.jdbi.v2.sqlobject.Transaction;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.net.URI;
import java.util.List;

import static org.openmetadata.catalog.exception.CatalogExceptionMessage.entityNotFound;


public abstract class MessagingServiceRepository {
  private static final Logger LOG = LoggerFactory.getLogger(MessagingServiceRepository.class);

  @CreateSqlObject
  abstract MessagingServiceDAO messagingServiceDAO();

  @CreateSqlObject
  abstract EntityRelationshipDAO relationshipDAO();

  @Transaction
  public List<MessagingService> list(String name) throws IOException {
    return JsonUtils.readObjects(messagingServiceDAO().list(name), MessagingService.class);
  }

  @Transaction
  public MessagingService get(String id) throws IOException {
    return EntityUtil.validate(id, messagingServiceDAO().findById(id), MessagingService.class);
  }

  @Transaction
  public MessagingService getByName(String name) throws IOException {
    return EntityUtil.validate(name, messagingServiceDAO().findByName(name), MessagingService.class);
  }

  @Transaction
  public MessagingService create(MessagingService messagingService) throws JsonProcessingException {
    // Validate fields
    Utils.validateIngestionSchedule(messagingService.getIngestionSchedule());
    messagingServiceDAO().insert(JsonUtils.pojoToJson(messagingService));
    return messagingService;
  }

  @Transaction
  public MessagingService update(String id, String description, List<String> brokers, URI schemaRegistry,
                                 Schedule ingestionSchedule)
          throws IOException {
    Utils.validateIngestionSchedule(ingestionSchedule);
    MessagingService dbService = EntityUtil.validate(id, messagingServiceDAO().findById(id), MessagingService.class);
    // Update fields
    dbService.withDescription(description).withIngestionSchedule(ingestionSchedule)
            .withSchemaRegistry(schemaRegistry).withBrokers(brokers);
    messagingServiceDAO().update(id, JsonUtils.pojoToJson(dbService));
    return dbService;
  }

  @Transaction
  public void delete(String id) {
    if (messagingServiceDAO().delete(id) <= 0) {
      throw EntityNotFoundException.byMessage(entityNotFound(Entity.MESSAGING_SERVICE, id));
    }
    relationshipDAO().deleteAll(id);
  }

}