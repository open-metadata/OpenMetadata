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

package org.openmetadata.service;

import io.dropwizard.core.setup.Environment;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.core.Jdbi;
import org.openmetadata.service.apps.ApplicationHandler;
import org.openmetadata.service.cache.CachedCollectionDAO;
import org.openmetadata.service.cache.RelationshipCache;
import org.openmetadata.service.events.scheduled.ServicesStatusJobHandler;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jobs.EnumCleanupHandler;
import org.openmetadata.service.jobs.GenericBackgroundWorker;
import org.openmetadata.service.jobs.JobDAO;
import org.openmetadata.service.jobs.JobHandlerRegistry;

@Slf4j
public class BackgroundServiceManager {
  private final OpenMetadataApplicationConfig config;
  private final Environment environment;
  private final Jdbi jdbi;

  public BackgroundServiceManager(
      OpenMetadataApplicationConfig config, Environment environment, Jdbi jdbi) {
    this.config = config;
    this.environment = environment;
    this.jdbi = jdbi;
  }

  public void setup() {
    initializeApplicationHandler();
    registerBackgroundWorkers();
    registerHealthCheckJobs();
    registerManagedShutdown();
  }

  private void initializeApplicationHandler() {
    ApplicationHandler.initialize(config);
  }

  private void registerBackgroundWorkers() {
    JobHandlerRegistry registry = createJobHandlerRegistry();
    environment
        .lifecycle()
        .manage(new GenericBackgroundWorker(jdbi.onDemand(JobDAO.class), registry));
  }

  private JobHandlerRegistry createJobHandlerRegistry() {
    JobHandlerRegistry registry = new JobHandlerRegistry();
    registry.register("EnumCleanupHandler", new EnumCleanupHandler(getDao()));
    return registry;
  }

  private void registerHealthCheckJobs() {
    ServicesStatusJobHandler healthCheckStatusHandler =
        ServicesStatusJobHandler.create(
            config.getEventMonitorConfiguration(),
            config.getPipelineServiceClientConfiguration(),
            config.getClusterName());
    healthCheckStatusHandler.addPipelineServiceStatusJob();
    healthCheckStatusHandler.addDatabaseAndSearchStatusJobs();
  }

  private void registerManagedShutdown() {
    environment.lifecycle().manage(new OpenMetadataApplication.ManagedShutdown());
  }

  private CollectionDAO getDao() {
    CollectionDAO originalDAO = jdbi.onDemand(CollectionDAO.class);

    if (RelationshipCache.isAvailable()) {
      LOG.info("Wrapping CollectionDAO with caching support");
      return new CachedCollectionDAO(originalDAO);
    }

    LOG.info("Using original CollectionDAO without caching");
    return originalDAO;
  }
}
