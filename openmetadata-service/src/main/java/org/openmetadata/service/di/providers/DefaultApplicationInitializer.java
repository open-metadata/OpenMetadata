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

package org.openmetadata.service.di.providers;

import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.core.Jdbi;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.apps.ApplicationHandler;
import org.openmetadata.service.events.EventPubSub;
import org.openmetadata.service.governance.workflows.WorkflowHandler;
import org.openmetadata.service.resources.settings.SettingsCache;

@Slf4j
public class DefaultApplicationInitializer implements ApplicationInitializer {

  @Override
  public void initialize(OpenMetadataApplicationConfig config, Jdbi jdbi) {
    LOG.info("Initializing application components");

    Entity.initializeRepositories(config, jdbi);
    LOG.debug("Entity repositories initialized");

    WorkflowHandler.initialize(config);
    LOG.debug("Workflow handler initialized");

    SettingsCache.initialize(config);
    LOG.debug("Settings cache initialized");

    EventPubSub.start();
    LOG.debug("Event pub/sub started");

    ApplicationHandler.initialize(config);
    LOG.debug("Application handler initialized");

    LOG.info("Application components initialized successfully");
  }
}
