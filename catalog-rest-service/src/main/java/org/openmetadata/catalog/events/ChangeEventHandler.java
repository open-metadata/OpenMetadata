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

import javax.ws.rs.container.ContainerRequestContext;
import javax.ws.rs.container.ContainerResponseContext;
import javax.ws.rs.core.Response.Status;
import org.jdbi.v3.core.Jdbi;
import org.openmetadata.catalog.CatalogApplicationConfig;
import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.jdbi3.CollectionDAO;
import org.openmetadata.catalog.type.ChangeEvent;
import org.openmetadata.catalog.type.EventType;
import org.openmetadata.catalog.util.EntityInterface;
import org.openmetadata.catalog.util.JsonUtils;
import org.openmetadata.catalog.util.RestUtil;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class ChangeEventHandler implements EventHandler {
  private static final Logger LOG = LoggerFactory.getLogger(ChangeEventHandler.class);
  private CollectionDAO dao;

  public void init(CatalogApplicationConfig config, Jdbi jdbi) {
    this.dao = jdbi.onDemand(CollectionDAO.class);
  }

  public Void process(ContainerRequestContext requestContext, ContainerResponseContext responseContext) {
    String method = requestContext.getMethod();
    try {
      ChangeEvent changeEvent = getChangeEvent(method, responseContext);
      if (changeEvent != null) {
        LOG.info("Recording change event {} {}", changeEvent.getDateTime().getTime(), changeEvent);
        if (changeEvent.getEntity() != null) {
          changeEvent.setEntity(JsonUtils.pojoToJson(changeEvent.getEntity()));
        }
        dao.changeEventDAO().insert(JsonUtils.pojoToJson(changeEvent));
      }
    } catch (Exception e) {
      LOG.error("Failed to capture change event for method {} due to {}", method, e);
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
      String entityType = Entity.getEntityReference(entity).getType();
      return getChangeEvent(EventType.ENTITY_CREATED, entityType, entityInterface).withEntity(entity);
    }

    // PUT or PATCH operation didn't result in any change
    if (changeType == null) {
      return null;
    }

    // Entity was updated by either PUT .../entities or PATCH .../entities
    if (changeType.equals(RestUtil.ENTITY_UPDATED)) {
      var entityInterface = Entity.getEntityInterface(entity);
      String entityType = Entity.getEntityReference(entity).getType();
      return getChangeEvent(EventType.ENTITY_UPDATED, entityType, entityInterface)
          .withPreviousVersion(entityInterface.getChangeDescription().getPreviousVersion());
    }

    // Entity field was updated by PUT .../entities/{id}/fieldName - Example PUT ../tables/{id}/follower
    if (changeType.equals(RestUtil.ENTITY_FIELDS_CHANGED)) {
      return (ChangeEvent) entity;
    }

    // Entity was deleted by DELETE .../entities/{id}
    if (changeType.equals(RestUtil.ENTITY_DELETED)) {
      return (ChangeEvent) entity;
    }
    return null;
  }

  private static ChangeEvent getChangeEvent(EventType eventType, String entityType, EntityInterface entityInterface) {
    return new ChangeEvent()
        .withEventType(eventType)
        .withEntityId(entityInterface.getId())
        .withEntityType(entityType)
        .withUserName(entityInterface.getUpdatedBy())
        .withDateTime(entityInterface.getUpdatedAt())
        .withChangeDescription(entityInterface.getChangeDescription())
        .withCurrentVersion(entityInterface.getVersion());
  }

  public void close() {}
}
