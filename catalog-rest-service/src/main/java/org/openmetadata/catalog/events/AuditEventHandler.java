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
import org.openmetadata.catalog.type.AuditLog;
import org.openmetadata.catalog.type.EntityReference;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import javax.ws.rs.container.ContainerRequestContext;
import javax.ws.rs.container.ContainerResponseContext;
import java.util.Date;

public class AuditEventHandler implements  EventHandler {
  private static final Logger LOG = LoggerFactory.getLogger(AuditEventHandler.class);

  public void init(CatalogApplicationConfig config, Jdbi jdbi) {
    // Nothing to do
  }

  public Void process(ContainerRequestContext requestContext,
                      ContainerResponseContext responseContext) {
    int responseCode = responseContext.getStatus();
    String method = requestContext.getMethod();
    if (responseContext.getEntity() != null) {
      String path = requestContext.getUriInfo().getPath();
      String username = requestContext.getSecurityContext().getUserPrincipal().getName();
      Date nowAsISO = new Date();

      try {
        EntityReference entityReference = Entity.getEntityReference(responseContext.getEntity());
        AuditLog auditLog = new AuditLog()
                .withPath(path)
                .withDateTime(nowAsISO)
                .withEntityId(entityReference.getId())
                .withEntityType(entityReference.getType())
                .withMethod(AuditLog.Method.fromValue(method))
                .withUserName(username)
                .withResponseCode(responseCode);
        LOG.info("Added audit log entry: {}", auditLog);
      } catch(Exception e) {
        LOG.error("Failed to capture audit log for {} and method {} due to {}", path, method, e.getMessage());
      }
    }
    return null;
  }

  public void close() {}
}
