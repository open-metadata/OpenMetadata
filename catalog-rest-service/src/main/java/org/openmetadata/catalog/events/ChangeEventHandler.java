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

package org.openmetadata.catalog.events;

import static org.openmetadata.catalog.type.EventType.ENTITY_DELETED;
import static org.openmetadata.catalog.type.EventType.ENTITY_SOFT_DELETED;
import static org.openmetadata.catalog.type.EventType.ENTITY_UPDATED;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.UUID;
import javax.ws.rs.container.ContainerRequestContext;
import javax.ws.rs.container.ContainerResponseContext;
import javax.ws.rs.core.Response.Status;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.core.Jdbi;
import org.openmetadata.catalog.CatalogApplicationConfig;
import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.entity.feed.Thread;
import org.openmetadata.catalog.jdbi3.CollectionDAO;
import org.openmetadata.catalog.jdbi3.FeedRepository;
import org.openmetadata.catalog.resources.feeds.MessageParser;
import org.openmetadata.catalog.type.ChangeEvent;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.type.EventType;
import org.openmetadata.catalog.type.FieldChange;
import org.openmetadata.catalog.type.Post;
import org.openmetadata.catalog.util.EntityInterface;
import org.openmetadata.catalog.util.JsonUtils;
import org.openmetadata.catalog.util.RestUtil;

@Slf4j
public class ChangeEventHandler implements EventHandler {
  private CollectionDAO dao;
  private FeedRepository feedDao;

  public void init(CatalogApplicationConfig config, Jdbi jdbi) {
    this.dao = jdbi.onDemand(CollectionDAO.class);
    this.feedDao = new FeedRepository(dao);
  }

  public Void process(ContainerRequestContext requestContext, ContainerResponseContext responseContext) {
    String method = requestContext.getMethod();
    try {
      ChangeEvent changeEvent = getChangeEvent(method, responseContext);
      if (changeEvent != null) {
        LOG.info(
            "Recording change event {}:{}:{}:{}",
            changeEvent.getTimestamp(),
            changeEvent.getEntityId(),
            changeEvent.getEventType(),
            changeEvent.getEntityType());
        EventPubSub.publish(changeEvent);
        if (changeEvent.getEntity() != null) {
          Object entity = changeEvent.getEntity();
          changeEvent = copyChangeEvent(changeEvent);
          changeEvent.setEntity(JsonUtils.pojoToJson(entity));
        }
        dao.changeEventDAO().insert(JsonUtils.pojoToJson(changeEvent));

        // Add a new thread to the entity for every change event
        // for the event to appear in activity feeds
        List<Thread> threads = getThreads(responseContext);
        if (threads != null) {
          for (var thread : threads) {
            feedDao.create(thread);
          }
        }
      }
    } catch (Exception e) {
      LOG.error("Failed to capture change event for method {} due to ", method, e);
    }
    return null;
  }

  public static ChangeEvent getChangeEvent(String method, ContainerResponseContext responseContext) {
    // GET operations don't produce change events
    if (method.equals("GET")) {
      return null;
    }

    Object entity = responseContext.getEntity();
    if (entity == null) {
      return null; // Response has no entity to produce change event from
    }

    int responseCode = responseContext.getStatus();
    String changeType = responseContext.getHeaderString(RestUtil.CHANGE_CUSTOM_HEADER);

    // Entity was created by either POST .../entities or PUT .../entities
    if (responseCode == Status.CREATED.getStatusCode() && !RestUtil.ENTITY_FIELDS_CHANGED.equals(changeType)) {
      var entityInterface = Entity.getEntityInterface(entity);
      EntityReference entityReference = Entity.getEntityReference(entity);
      String entityType = entityReference.getType();
      String entityFQN = entityReference.getName();
      return getChangeEvent(EventType.ENTITY_CREATED, entityType, entityInterface)
          .withEntity(entity)
          .withEntityFullyQualifiedName(entityFQN);
    }

    // PUT or PATCH operation didn't result in any change
    if (changeType == null || RestUtil.ENTITY_NO_CHANGE.equals(changeType)) {
      return null;
    }

    // Entity was updated by either PUT .../entities or PATCH .../entities
    // Entity was soft deleted by DELETE .../entities/{id} that updated the attribute `deleted` to true
    if (changeType.equals(RestUtil.ENTITY_UPDATED) || changeType.equals(RestUtil.ENTITY_SOFT_DELETED)) {
      var entityInterface = Entity.getEntityInterface(entity);
      EntityReference entityReference = Entity.getEntityReference(entity);
      String entityType = entityReference.getType();
      String entityFQN = entityReference.getName();
      EventType eventType = changeType.equals(RestUtil.ENTITY_UPDATED) ? ENTITY_UPDATED : ENTITY_SOFT_DELETED;
      return getChangeEvent(eventType, entityType, entityInterface)
          .withPreviousVersion(entityInterface.getChangeDescription().getPreviousVersion())
          .withEntity(entity)
          .withEntityFullyQualifiedName(entityFQN);
    }

    // Entity field was updated by PUT .../entities/{id}/fieldName - Example PUT ../tables/{id}/follower
    if (changeType.equals(RestUtil.ENTITY_FIELDS_CHANGED)) {
      return (ChangeEvent) entity;
    }

    // Entity field was updated by DELETE .../entities/{id}
    if (changeType.equals(RestUtil.ENTITY_DELETED)) {
      var entityInterface = Entity.getEntityInterface(entity);
      EntityReference entityReference = Entity.getEntityReference(entity);
      String entityType = entityReference.getType();
      String entityFQN = entityReference.getName();
      return getChangeEvent(ENTITY_DELETED, entityType, entityInterface)
          .withPreviousVersion(entityInterface.getVersion())
          .withEntity(entity)
          .withEntityFullyQualifiedName(entityFQN);
    }
    return null;
  }

  private static ChangeEvent getChangeEvent(EventType eventType, String entityType, EntityInterface entityInterface) {
    return new ChangeEvent()
        .withEventType(eventType)
        .withEntityId(entityInterface.getId())
        .withEntityType(entityType)
        .withUserName(entityInterface.getUpdatedBy())
        .withTimestamp(entityInterface.getUpdatedAt())
        .withChangeDescription(entityInterface.getChangeDescription())
        .withCurrentVersion(entityInterface.getVersion());
  }

  private static ChangeEvent copyChangeEvent(ChangeEvent changeEvent) {
    return new ChangeEvent()
        .withEventType(changeEvent.getEventType())
        .withEntityId(changeEvent.getEntityId())
        .withEntityType(changeEvent.getEntityType())
        .withUserName(changeEvent.getUserName())
        .withTimestamp(changeEvent.getTimestamp())
        .withChangeDescription(changeEvent.getChangeDescription())
        .withCurrentVersion(changeEvent.getCurrentVersion());
  }

  private enum CHANGE_TYPE {
    UPDATE,
    ADD,
    DELETE
  }

  private List<Thread> getThreads(ContainerResponseContext responseContext) {
    Object entity = responseContext.getEntity();
    if (entity == null) {
      return null; // Response has no entity to produce change event from
    }

    var entityInterface = Entity.getEntityInterface(entity);

    List<FieldChange> fieldsUpdated = entityInterface.getChangeDescription().getFieldsUpdated();
    List<Thread> threads = new ArrayList<>(getThreads(fieldsUpdated, entity, CHANGE_TYPE.UPDATE));

    List<FieldChange> fieldsAdded = entityInterface.getChangeDescription().getFieldsAdded();
    threads.addAll(getThreads(fieldsAdded, entity, CHANGE_TYPE.ADD));

    List<FieldChange> fieldsDeleted = entityInterface.getChangeDescription().getFieldsDeleted();
    threads.addAll(getThreads(fieldsDeleted, entity, CHANGE_TYPE.DELETE));
    return threads;
  }

  private List<Thread> getThreads(List<FieldChange> fields, Object entity, CHANGE_TYPE changeType) {
    List<Thread> threads = new ArrayList<>();
    var entityInterface = Entity.getEntityInterface(entity);
    EntityReference entityReference = Entity.getEntityReference(entity);
    String entityType = entityReference.getType();
    String entityFQN = entityReference.getName();
    for (var field : fields) {
      // if field name has dots, then it is an array field
      String fieldName = field.getName();
      String arrayFieldName = null;
      String arrayFieldValue = null;
      String newFieldValue = field.getNewValue().toString();
      if (fieldName.contains(".")) {
        String[] fieldNameParts = fieldName.split("\\.");
        // For array type, it should have 3 ex: columns.comment.description
        fieldName = fieldNameParts[0];
        if (fieldNameParts.length == 3) {
          arrayFieldName = fieldNameParts[1];
          arrayFieldValue = fieldNameParts[2];
        }
      }

      MessageParser.EntityLink link =
          new MessageParser.EntityLink(entityType, entityFQN, fieldName, arrayFieldName, arrayFieldValue);

      // Create an automated post
      String message = null;
      switch (changeType) {
        case ADD:
          message =
              String.format("Added %s: `*%s*`", arrayFieldValue != null ? arrayFieldValue : fieldName, newFieldValue);
          break;
        case UPDATE:
          message =
              String.format(
                  "Updated %s to `*%s*`", arrayFieldValue != null ? arrayFieldValue : fieldName, newFieldValue);
          break;
        case DELETE:
          message = String.format("Deleted %s", arrayFieldValue != null ? arrayFieldValue : fieldName);
          break;
        default:
          break;
      }

      Post post =
          new Post()
              .withFrom(entityInterface.getUpdatedBy())
              .withMessage(message)
              .withPostTs(System.currentTimeMillis());

      threads.add(
          new Thread()
              .withId(UUID.randomUUID())
              .withThreadTs(System.currentTimeMillis())
              .withCreatedBy(entityInterface.getUpdatedBy())
              .withAbout(link.getLinkString())
              .withUpdatedBy(entityInterface.getUpdatedBy())
              .withUpdatedAt(System.currentTimeMillis())
              .withPosts(Collections.singletonList(post)));
    }

    return threads;
  }

  public void close() {
    /* Nothing to do */
  }
}
