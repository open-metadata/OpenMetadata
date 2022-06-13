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
import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import javax.ws.rs.container.ContainerRequestContext;
import javax.ws.rs.container.ContainerResponseContext;
import javax.ws.rs.core.Response.Status;
import javax.ws.rs.core.SecurityContext;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.core.Jdbi;
import org.openmetadata.catalog.CatalogApplicationConfig;
import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.EntityInterface;
import org.openmetadata.catalog.entity.feed.Thread;
import org.openmetadata.catalog.jdbi3.CollectionDAO;
import org.openmetadata.catalog.jdbi3.FeedRepository;
import org.openmetadata.catalog.resources.feeds.MessageParser.EntityLink;
import org.openmetadata.catalog.socket.WebSocketManager;
import org.openmetadata.catalog.type.ChangeDescription;
import org.openmetadata.catalog.type.ChangeEvent;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.type.EventType;
import org.openmetadata.catalog.util.ChangeEventParser;
import org.openmetadata.catalog.util.JsonUtils;
import org.openmetadata.catalog.util.RestUtil;

@Slf4j
public class ChangeEventHandler implements EventHandler {
  private CollectionDAO dao;
  private FeedRepository feedDao;
  private ObjectMapper mapper;

  public void init(CatalogApplicationConfig config, Jdbi jdbi) {
    this.dao = jdbi.onDemand(CollectionDAO.class);
    this.feedDao = new FeedRepository(dao);
    this.mapper = new ObjectMapper();
  }

  public Void process(ContainerRequestContext requestContext, ContainerResponseContext responseContext) {
    String method = requestContext.getMethod();
    SecurityContext securityContext = requestContext.getSecurityContext();
    String loggedInUserName = securityContext.getUserPrincipal().getName();
    try {
      ChangeEvent changeEvent = getChangeEvent(method, responseContext);
      if (changeEvent == null) {
        return null;
      }
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
      if (Entity.shouldDisplayEntityChangeOnFeed(changeEvent.getEntityType())) {
        for (var thread : listOrEmpty(getThreads(responseContext, loggedInUserName))) {
          // Don't create a thread if there is no message
          if (!thread.getMessage().isEmpty()) {
            EntityInterface entity;
            // In case of ENTITY_FIELDS_CHANGED entity from responseContext will be a ChangeEvent
            if (responseContext.getEntity() instanceof ChangeEvent) {
              ChangeEvent change = (ChangeEvent) responseContext.getEntity();
              entity = (EntityInterface) change.getEntity();
            } else {
              entity = (EntityInterface) responseContext.getEntity();
            }
            EntityReference entityReference = entity.getEntityReference();
            EntityReference owner;
            try {
              owner = Entity.getOwner(entityReference);
            } catch (Exception exception) {
              owner = null;
            }
            EntityLink about = EntityLink.parse(thread.getAbout());
            feedDao.create(thread, entity.getId(), owner, about);
            String json = mapper.writeValueAsString(thread);
            WebSocketManager.getInstance().broadCastMessageToClients(json);
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

    if (responseContext.getEntity() == null) {
      return null; // Response has no entity to produce change event from
    }

    int responseCode = responseContext.getStatus();
    String changeType = responseContext.getHeaderString(RestUtil.CHANGE_CUSTOM_HEADER);

    // Entity was created by either POST .../entities or PUT .../entities
    if (responseCode == Status.CREATED.getStatusCode() && !RestUtil.ENTITY_FIELDS_CHANGED.equals(changeType)) {
      var entityInterface = (EntityInterface) responseContext.getEntity();
      EntityReference entityReference = entityInterface.getEntityReference();
      String entityType = entityReference.getType();
      String entityFQN = entityReference.getFullyQualifiedName();
      return getChangeEvent(EventType.ENTITY_CREATED, entityType, entityInterface)
          .withEntity(entityInterface)
          .withEntityFullyQualifiedName(entityFQN);
    }

    // PUT or PATCH operation didn't result in any change
    if (changeType == null || RestUtil.ENTITY_NO_CHANGE.equals(changeType)) {
      return null;
    }

    // Entity was updated by either PUT .../entities or PATCH .../entities
    // Entity was soft deleted by DELETE .../entities/{id} that updated the attribute `deleted` to true
    if (changeType.equals(RestUtil.ENTITY_UPDATED) || changeType.equals(RestUtil.ENTITY_SOFT_DELETED)) {
      var entityInterface = (EntityInterface) responseContext.getEntity();
      EntityReference entityReference = entityInterface.getEntityReference();
      String entityType = entityReference.getType();
      String entityFQN = entityReference.getFullyQualifiedName();
      EventType eventType = null;
      switch (changeType) {
        case RestUtil.ENTITY_UPDATED:
          eventType = ENTITY_UPDATED;
          break;
        case RestUtil.ENTITY_SOFT_DELETED:
          eventType = ENTITY_SOFT_DELETED;
          break;
      }

      return getChangeEvent(eventType, entityType, entityInterface)
          .withPreviousVersion(entityInterface.getChangeDescription().getPreviousVersion())
          .withEntity(entityInterface)
          .withEntityFullyQualifiedName(entityFQN);
    }

    // Entity field was updated by PUT .../entities/{id}/fieldName - Example PUT ../tables/{id}/follower
    if (changeType.equals(RestUtil.ENTITY_FIELDS_CHANGED)) {
      return (ChangeEvent) responseContext.getEntity();
    }

    // Entity was hard deleted by DELETE .../entities/{id}
    if (changeType.equals(RestUtil.ENTITY_DELETED)) {
      var entityInterface = (EntityInterface) responseContext.getEntity();
      EntityReference entityReference = entityInterface.getEntityReference();
      String entityType = entityReference.getType();
      String entityFQN = entityReference.getFullyQualifiedName();
      return getChangeEvent(ENTITY_DELETED, entityType, entityInterface)
          .withPreviousVersion(entityInterface.getVersion())
          .withEntity(entityInterface)
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

  private List<Thread> getThreads(ContainerResponseContext responseContext, String loggedInUserName) {
    Object entity = responseContext.getEntity();
    String changeType = responseContext.getHeaderString(RestUtil.CHANGE_CUSTOM_HEADER);

    if (entity == null) {
      return null; // Response has no entity to produce change event from
    }

    // In case of ENTITY_FIELDS_CHANGED entity from responseContext will be a ChangeEvent
    // Get the actual entity from ChangeEvent in those cases.
    if (entity instanceof ChangeEvent) {
      ChangeEvent changeEvent = (ChangeEvent) entity;
      EntityInterface realEntity = (EntityInterface) changeEvent.getEntity();
      if (realEntity != null) {
        return getThreads(realEntity, changeEvent.getChangeDescription(), loggedInUserName);
      }
      return null; // Cannot create a thread without entity
    }

    var entityInterface = (EntityInterface) entity;
    if (RestUtil.ENTITY_DELETED.equals(changeType)) {
      String entityType = Entity.getEntityTypeFromClass(entity.getClass());
      // In this case, the entity itself got deleted
      // for which there will be no change description.
      String message = String.format("Deleted **%s**: `%s`", entityType, entityInterface.getFullyQualifiedName());
      EntityLink about = new EntityLink(entityType, entityInterface.getFullyQualifiedName(), null, null, null);
      Thread thread =
          new Thread()
              .withId(UUID.randomUUID())
              .withThreadTs(System.currentTimeMillis())
              .withCreatedBy(entityInterface.getUpdatedBy())
              .withAbout(about.getLinkString())
              .withUpdatedBy(entityInterface.getUpdatedBy())
              .withUpdatedAt(System.currentTimeMillis())
              .withMessage(message);
      return List.of(thread);
    }

    if (entityInterface.getChangeDescription() == null) {
      return null;
    }

    return getThreads(entityInterface, entityInterface.getChangeDescription(), loggedInUserName);
  }

  private List<Thread> getThreads(
      EntityInterface entity, ChangeDescription changeDescription, String loggedInUserName) {
    List<Thread> threads = new ArrayList<>();
    Map<EntityLink, String> messages = ChangeEventParser.getFormattedMessages(changeDescription, entity);

    // Create an automated thread
    for (var link : messages.keySet()) {
      threads.add(getThread(link.getLinkString(), messages.get(link), loggedInUserName));
    }

    return threads;
  }

  private Thread getThread(String linkString, String message, String loggedInUserName) {
    return new Thread()
        .withId(UUID.randomUUID())
        .withThreadTs(System.currentTimeMillis())
        .withCreatedBy(loggedInUserName)
        .withAbout(linkString)
        .withUpdatedBy(loggedInUserName)
        .withUpdatedAt(System.currentTimeMillis())
        .withMessage(message);
  }

  public void close() {
    /* Nothing to do */
  }
}
