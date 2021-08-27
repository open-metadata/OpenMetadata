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
import org.joda.time.Period;
import org.joda.time.format.ISOPeriodFormat;
import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.entity.services.MessagingService;
import org.openmetadata.catalog.exception.EntityNotFoundException;
import org.openmetadata.catalog.type.Schedule;
import org.openmetadata.catalog.util.EntityUtil;
import org.openmetadata.catalog.util.JsonUtils;
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


public abstract class MessagingServiceRepository {
  private static final Logger LOG = LoggerFactory.getLogger(MessagingServiceRepository.class);

  @CreateSqlObject
  abstract MessagingServiceDAO messagingServiceDOA();

  @CreateSqlObject
  abstract EntityRelationshipDAO relationshipDAO();

  @Transaction
  public List<MessagingService> list(String name) throws IOException {
    return JsonUtils.readObjects(messagingServiceDOA().list(name), MessagingService.class);
  }

  @Transaction
  public MessagingService get(String id) throws IOException {
    return EntityUtil.validate(id, messagingServiceDOA().findById(id), MessagingService.class);
  }

  @Transaction
  public MessagingService getByName(String name) throws IOException {
    return EntityUtil.validate(name, messagingServiceDOA().findByName(name), MessagingService.class);
  }

  @Transaction
  public MessagingService create(MessagingService messagingService) throws JsonProcessingException {
    // Validate fields
    validateIngestionSchedule(messagingService.getIngestionSchedule());
    messagingServiceDOA().insert(JsonUtils.pojoToJson(messagingService));
    return messagingService;
  }

  public MessagingService update(String id, String description, List<String> brokers, URI schemaRegistry,
                                 Schedule ingestionSchedule)
          throws IOException {
    validateIngestionSchedule(ingestionSchedule);
    MessagingService dbService = EntityUtil.validate(id, messagingServiceDOA().findById(id), MessagingService.class);
    // Update fields
    dbService.withDescription(description).withIngestionSchedule(ingestionSchedule)
            .withSchemaRegistry(schemaRegistry).withBrokers(brokers);
    messagingServiceDOA().update(id, JsonUtils.pojoToJson(dbService));
    return dbService;
  }

  @Transaction
  public void delete(String id) {
    if (messagingServiceDOA().delete(id) <= 0) {
      throw EntityNotFoundException.byMessage(entityNotFound(Entity.MESSAGING_SERVICE, id));
    }
    relationshipDAO().deleteAll(id);
  }

  private void validateIngestionSchedule(Schedule ingestion) {
    if (ingestion == null) {
      return;
    }
    String duration = ingestion.getRepeatFrequency();

    // ISO8601 duration format is P{y}Y{m}M{d}DT{h}H{m}M{s}S.
    String[] splits = duration.split("T");
    if (splits[0].contains("Y") || splits[0].contains("M") ||
            (splits.length == 2 && splits[1].contains("S"))) {
      throw new IllegalArgumentException("Ingestion repeatFrequency can only contain Days, Hours, and Minutes - " +
              "example P{d}DT{h}H{m}M");
    }

    Period period;
    try {
      period = ISOPeriodFormat.standard().parsePeriod(duration);
    } catch (IllegalArgumentException e) {
      throw new IllegalArgumentException("Invalid ingestion repeatFrequency " + duration, e);
    }
    if (period.toStandardMinutes().getMinutes() < 60) {
      throw new IllegalArgumentException("Ingestion repeatFrequency is too short and must be more than 60 minutes");
    }
  }

  public interface MessagingServiceDAO {
    @SqlUpdate("INSERT INTO messaging_service_entity (json) VALUES (:json)")
    void insert(@Bind("json") String json);

    @SqlUpdate("UPDATE messaging_service_entity SET  json = :json where id = :id")
    void update(@Bind("id") String id, @Bind("json") String json);

    @SqlQuery("SELECT json FROM messaging_service_entity WHERE id = :id")
    String findById(@Bind("id") String id);

    @SqlQuery("SELECT json FROM messaging_service_entity WHERE name = :name")
    String findByName(@Bind("name") String name);

    @SqlQuery("SELECT json FROM messaging_service_entity WHERE (name = :name OR :name is NULL)")
    List<String> list(@Bind("name") String name);

    @SqlUpdate("DELETE FROM messaging_service_entity WHERE id = :id")
    int delete(@Bind("id") String id);
  }
}