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

import org.openmetadata.catalog.CatalogApplicationConfig;
import org.openmetadata.catalog.entity.audit.AuditLog;
import org.openmetadata.catalog.jdbi3.AuditLogRepository;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.util.EntityUtil;
import org.skife.jdbi.v2.DBI;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import javax.ws.rs.container.ContainerRequestContext;
import javax.ws.rs.container.ContainerResponseContext;
import javax.ws.rs.container.ContainerResponseFilter;
import javax.ws.rs.ext.Provider;
import java.io.IOException;
import java.text.DateFormat;
import java.text.SimpleDateFormat;
import java.util.Arrays;
import java.util.Date;
import java.util.List;
import java.util.TimeZone;
import java.util.UUID;

@Provider
public class EventFilter implements ContainerResponseFilter {

  private static final Logger LOG = LoggerFactory.getLogger(EventFilter.class);
  private static final List<String> AUDITABLE_METHODS = Arrays.asList("POST", "PUT", "PATCH", "DELETE");
  private final DateFormat df = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm'Z'"); // Quoted "Z" to indicate UTC, no timezone offset
  private AuditLogRepository auditLogRepository;

  @SuppressWarnings("unused")
  private EventFilter() {
  }

  public EventFilter(CatalogApplicationConfig config, DBI dbi) {
    this.auditLogRepository = dbi.onDemand(AuditLogRepository.class);
    TimeZone tz = TimeZone.getTimeZone("UTC");
    this.df.setTimeZone(tz);
  }

  @Override
  public void filter(ContainerRequestContext requestContext,
                     ContainerResponseContext responseContext) throws IOException {

    int responseCode = responseContext.getStatus();
    String method = requestContext.getMethod();
    if ((responseCode < 200 || responseCode > 299) || (!AUDITABLE_METHODS.contains(method))) {
      return;
    }
    if (responseContext.getEntity() != null) {
      String path = requestContext.getUriInfo().getPath();
      String username = requestContext.getSecurityContext().getUserPrincipal().getName();
      String nowAsISO = df.format(new Date());

      try {
        EntityReference entityReference = EntityUtil.getEntityReference(responseContext.getEntity(),
                responseContext.getEntity().getClass());
        if (entityReference != null) {
          AuditLog auditLog = new AuditLog().withId(UUID.randomUUID())
                  .withPath(path)
                  .withDate(nowAsISO)
                  .withEntityId(entityReference.getId())
                  .withEntityType(entityReference.getType())
                  .withEntity(entityReference)
                  .withMethod(method)
                  .withUsername(username)
                  .withResponseCode(responseCode);
          auditLogRepository.create(auditLog);
          LOG.debug("Added audit log entry: {}", auditLog);
        } else {
          LOG.error("Failed to capture audit log for {}", path);
        }
      } catch(Exception e) {
        LOG.error("Failed to capture audit log due to {}", e.getMessage());
      }
    }
  }

}
