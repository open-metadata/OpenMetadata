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

package org.openmetadata.service.events;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.schema.type.EventType.ENTITY_DELETED;
import static org.openmetadata.schema.type.EventType.ENTITY_SOFT_DELETED;
import static org.openmetadata.schema.type.EventType.ENTITY_UPDATED;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import javax.ws.rs.container.ContainerRequestContext;
import javax.ws.rs.container.ContainerResponseContext;
import javax.ws.rs.core.Response.Status;
import javax.ws.rs.core.SecurityContext;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.core.Jdbi;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.feed.Thread;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EventType;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.events.subscription.AlertUtil;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.FeedRepository;
import org.openmetadata.service.resources.feeds.MessageParser.EntityLink;
import org.openmetadata.service.socket.WebSocketManager;
import org.openmetadata.service.util.ChangeEventParser;
import org.openmetadata.service.util.ChangeEventParser.PublishTo;
import org.openmetadata.service.util.JsonUtils;
import org.openmetadata.service.util.NotificationHandler;
import org.openmetadata.service.util.RestUtil;

@Slf4j
public class ChangeEventHandler implements EventHandler {
  private CollectionDAO dao;
  private FeedRepository feedDao;
  private ObjectMapper mapper;
  private NotificationHandler notificationHandler;

  public void init(OpenMetadataApplicationConfig config, Jdbi jdbi) {
    this.dao = jdbi.onDemand(CollectionDAO.class);
    this.feedDao = new FeedRepository(dao);
    this.mapper = new ObjectMapper();
    this.notificationHandler = new NotificationHandler(jdbi.onDemand(CollectionDAO.class));
  }

  public Void process(ContainerRequestContext requestContext, ContainerResponseContext responseContext) {
    String method = requestContext.getMethod();
    SecurityContext securityContext = requestContext.getSecurityContext();
    String loggedInUserName = securityContext.getUserPrincipal().getName();
    try {
      notificationHandler.processNotifications(responseContext);
      ChangeEvent changeEvent = getChangeEvent(loggedInUserName, method, responseContext);
      if (changeEvent == null) {
        return null;
      }
      // Always set the Change Event Username as context Principal, the one creating the CE
      changeEvent.setUserName(loggedInUserName);
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
        changeEvent.setEntity(JsonUtils.pojoToMaskedJson(entity));
      }
      dao.changeEventDAO().insert(JsonUtils.pojoToJson(changeEvent));

      // Add a new thread to the entity for every change event
      // for the event to appear in activity feeds
      if (Entity.shouldDisplayEntityChangeOnFeed(changeEvent.getEntityType())) {
        // ignore usageSummary updates in the feed
        boolean filterEnabled;
        filterEnabled = AlertUtil.shouldProcessActivityFeedRequest(changeEvent);
        if (filterEnabled) {
          for (Thread thread : listOrEmpty(getThreads(responseContext, loggedInUserName))) {
            // Don't create a thread if there is no message
            if (thread.getMessage() != null && !thread.getMessage().isEmpty()) {
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
              String jsonThread = mapper.writeValueAsString(thread);
              WebSocketManager.getInstance().broadCastMessageToAll(WebSocketManager.FEED_BROADCAST_CHANNEL, jsonThread);
            }
          }
        }
      }
    } catch (Exception e) {
      LOG.error("Failed to capture change event for method {} due to ", method, e);
    }
    return null;
  }

  public ChangeEvent getChangeEvent(String updateBy, String method, ContainerResponseContext responseContext) {
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
    if (responseCode == Status.CREATED.getStatusCode()
        && !RestUtil.ENTITY_FIELDS_CHANGED.equals(changeType)
        && !responseContext.getEntity().getClass().equals(Thread.class)) {
      EntityInterface entityInterface = (EntityInterface) responseContext.getEntity();
      EntityReference entityReference = entityInterface.getEntityReference();
      String entityType = entityReference.getType();
      String entityFQN = entityReference.getFullyQualifiedName();
      return getChangeEvent(updateBy, EventType.ENTITY_CREATED, entityType, entityInterface)
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
      EntityInterface entityInterface = (EntityInterface) responseContext.getEntity();
      EntityReference entityReference = entityInterface.getEntityReference();
      String entityType = entityReference.getType();
      String entityFQN = entityReference.getFullyQualifiedName();
      EventType eventType;
      if (RestUtil.ENTITY_UPDATED.equals(changeType)) {
        eventType = ENTITY_UPDATED;
      } else {
        eventType = ENTITY_SOFT_DELETED;
      }

      return getChangeEvent(updateBy, eventType, entityType, entityInterface)
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
      EntityInterface entityInterface = (EntityInterface) responseContext.getEntity();
      EntityReference entityReference = entityInterface.getEntityReference();
      String entityType = entityReference.getType();
      String entityFQN = entityReference.getFullyQualifiedName();
      return getChangeEvent(updateBy, ENTITY_DELETED, entityType, entityInterface)
          .withPreviousVersion(entityInterface.getVersion())
          .withEntity(entityInterface)
          .withEntityFullyQualifiedName(entityFQN);
    }
    return null;
  }

  private static ChangeEvent getChangeEvent(
      String updateBy, EventType eventType, String entityType, EntityInterface entityInterface) {
    return new ChangeEvent()
        .withEventType(eventType)
        .withEntityId(entityInterface.getId())
        .withEntityType(entityType)
        .withUserName(updateBy)
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
      return Collections.emptyList(); // Response has no entity to produce change event from
    }

    // In case of ENTITY_FIELDS_CHANGED entity from responseContext will be a ChangeEvent
    // Get the actual entity from ChangeEvent in those cases.
    if (entity instanceof ChangeEvent) {
      ChangeEvent changeEvent = (ChangeEvent) entity;
      EntityInterface realEntity = (EntityInterface) changeEvent.getEntity();
      if (realEntity != null) {
        return getThreads(realEntity, changeEvent.getChangeDescription(), loggedInUserName);
      }
      return Collections.emptyList(); // Cannot create a thread without entity
    }

    EntityInterface entityInterface = (EntityInterface) entity;
    if (RestUtil.ENTITY_SOFT_DELETED.equals(changeType)) {
      String entityType = Entity.getEntityTypeFromClass(entity.getClass());
      String message = String.format("Soft deleted **%s**: `%s`", entityType, entityInterface.getFullyQualifiedName());
      EntityLink about = new EntityLink(entityType, entityInterface.getFullyQualifiedName(), null, null, null);
      Thread thread = getThread(about.getLinkString(), message, loggedInUserName);
      return List.of(thread);
    }
    if (RestUtil.ENTITY_DELETED.equals(changeType)) {
      String entityType = Entity.getEntityTypeFromClass(entity.getClass());
      // In this case, the entity itself got deleted
      // for which there will be no change description.
      String message =
          String.format("Permanently Deleted **%s**: `%s`", entityType, entityInterface.getFullyQualifiedName());
      EntityLink about = new EntityLink(entityType, entityInterface.getFullyQualifiedName(), null, null, null);
      Thread thread = getThread(about.getLinkString(), message, loggedInUserName);
      return List.of(thread);
    }

    if (entityInterface.getChangeDescription() == null) {
      return Collections.emptyList();
    }

    return getThreads(entityInterface, entityInterface.getChangeDescription(), loggedInUserName);
  }

  private List<Thread> getThreads(
      EntityInterface entity, ChangeDescription changeDescription, String loggedInUserName) {
    List<Thread> threads = new ArrayList<>();
    Map<EntityLink, String> messages =
        ChangeEventParser.getFormattedMessages(PublishTo.FEED, changeDescription, entity);

    // Create an automated thread
    for (EntityLink link : messages.keySet()) {
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
        .withReactions(Collections.emptyList())
        .withUpdatedBy(loggedInUserName)
        .withUpdatedAt(System.currentTimeMillis())
        .withMessage(message);
  }

  public void close() {
    /* Nothing to do */
  }
}
