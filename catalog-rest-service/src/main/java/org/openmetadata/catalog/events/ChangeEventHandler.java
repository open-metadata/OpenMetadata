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

package org.openmetadata.catalog.events;

import org.jdbi.v3.core.Jdbi;
import org.openmetadata.catalog.CatalogApplicationConfig;
import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.jdbi3.CollectionDAO;
import org.openmetadata.catalog.type.ChangeEvent;
import org.openmetadata.catalog.type.ChangeEvent.EventType;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.util.EntityInterface;
import org.openmetadata.catalog.util.JsonUtils;
import org.openmetadata.catalog.util.RestUtil;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import javax.ws.rs.container.ContainerRequestContext;
import javax.ws.rs.container.ContainerResponseContext;
import javax.ws.rs.core.Response.Status;

public class ChangeEventHandler implements  EventHandler {
  private static final Logger LOG = LoggerFactory.getLogger(ChangeEventHandler.class);
  private CollectionDAO dao;

  public void init(CatalogApplicationConfig config, Jdbi jdbi) {
    this.dao = jdbi.onDemand(CollectionDAO.class);
  }

  public Void process(ContainerRequestContext requestContext,
                      ContainerResponseContext responseContext) {
    int responseCode = responseContext.getStatus();
    String method = requestContext.getMethod();
    if (method.equals("GET")) {
      return null;
    }

    if (responseContext.getEntity() != null) {
      ChangeEvent changeEvent = null;
      try {
        Object entity = responseContext.getEntity();
        String changeType = responseContext.getHeaderString(RestUtil.CHANGE_CUSTOM_HEADER);
        System.out.println("Change type is " + changeType);

        if (responseCode == Status.CREATED.getStatusCode()) {
          EntityInterface entityInterface = Entity.getEntityInterface(entity);
          EntityReference entityReference = Entity.getEntityReference(entity);

          changeEvent.withEventType(EventType.ENTITY_CREATED).withEntityId(entityInterface.getId())
                  .withEntityType(entityReference.getType()).withDateTime(entityInterface.getUpdatedAt())
                  .withEntity(JsonUtils.pojoToJson(entity))
                  .withPreviousVersion(entityInterface.getVersion())
                  .withCurrentVersion(entityInterface.getVersion());
        } else if (changeType.equals(RestUtil.ENTITY_UPDATED)) {
          EntityInterface entityInterface = Entity.getEntityInterface(entity);
          EntityReference entityReference = Entity.getEntityReference(entity);
          changeEvent.withEventType(EventType.ENTITY_UPDATED).withEntityId(entityInterface.getId())
                  .withEntityType(entityReference.getType())
                  .withDateTime(entityInterface.getUpdatedAt())
                  .withChangeDescription(entityInterface.getChangeDescription())
                  .withPreviousVersion(entityInterface.getVersion())
                  .withCurrentVersion(entityInterface.getVersion());
        } else if (changeType.equals(RestUtil.ENTITY_FIELDS_CHANGED)){
          changeEvent = (ChangeEvent) entity;
        } else if (changeType.equals(RestUtil.ENTITY_DELETED)) {
          changeEvent = (ChangeEvent) entity;
        }
        System.out.println(changeEvent);

        if (changeEvent != null) {
          dao.changeEventDAO().insert(JsonUtils.pojoToJson(changeEvent));
        }
      } catch(Exception e) {
        LOG.error("Failed to capture change event for {} and method {} due to {}", method, e.getMessage());
      }
    }
    return null;
  }

  public void close() {}
}
