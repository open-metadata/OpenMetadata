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
import org.openmetadata.catalog.util.ParallelStreamUtil;
import org.skife.jdbi.v2.DBI;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import javax.ws.rs.container.ContainerRequestContext;
import javax.ws.rs.container.ContainerResponseContext;
import javax.ws.rs.container.ContainerResponseFilter;
import javax.ws.rs.ext.Provider;
import java.io.IOException;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.concurrent.ForkJoinPool;

@Provider
public class EventFilter implements ContainerResponseFilter {

  private static final Logger LOG = LoggerFactory.getLogger(EventFilter.class);
  private static final List<String> AUDITABLE_METHODS = Arrays.asList("POST", "PUT", "PATCH", "DELETE");
  private static final int FORK_JOIN_POOL_PARALLELISM = 20;
  private CatalogApplicationConfig config;
  private DBI jdbi;
  private final ForkJoinPool forkJoinPool;
  List<EventHandler> eventHandlers;

  public EventFilter(CatalogApplicationConfig config, DBI jdbi) {
    this.config = config;
    this.jdbi = jdbi;
    this.forkJoinPool = new ForkJoinPool(FORK_JOIN_POOL_PARALLELISM);
    this.eventHandlers = new ArrayList<>();
    AuditEventHandler auditEventHandler = new AuditEventHandler();
    auditEventHandler.init(config, jdbi);
    eventHandlers.add(auditEventHandler);
    ElasticSearchEventHandler elasticSearchEventHandler = new ElasticSearchEventHandler();
    elasticSearchEventHandler.init(config, jdbi);
    eventHandlers.add(elasticSearchEventHandler);
  }

  @Override
  public void filter(ContainerRequestContext requestContext,
                     ContainerResponseContext responseContext) throws IOException {

    int responseCode = responseContext.getStatus();
    String method = requestContext.getMethod();
    if ((responseCode < 200 || responseCode > 299) || (!AUDITABLE_METHODS.contains(method))) {
      return;
    }

    eventHandlers.parallelStream().forEach(eventHandler -> ParallelStreamUtil.runAsync(() ->
            eventHandler.process(requestContext, responseContext), forkJoinPool));

  }


}
