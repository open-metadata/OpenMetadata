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

import java.io.IOException;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.search.IndexMappingLoader;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.OpenMetadataApplicationConfigHolder;
import org.openmetadata.service.resources.databases.DatasourceConfig;
import org.openmetadata.service.util.incidentSeverityClassifier.IncidentSeverityClassifierInterface;

@Slf4j
public class DefaultConfigurationInitializer implements ConfigurationInitializer {

  @Override
  public void initialize(OpenMetadataApplicationConfig config) throws IOException {
    LOG.info("Initializing configuration components");

    OpenMetadataApplicationConfigHolder.initialize(config);
    LOG.debug("Config holder initialized");

    IncidentSeverityClassifierInterface.createInstance();
    LOG.debug("Incident severity classifier created");

    IndexMappingLoader.init(config.getElasticSearchConfiguration());
    LOG.debug("Index mapping loader initialized");

    DatasourceConfig.initialize(config.getDataSourceFactory().getDriverClass());
    LOG.debug("Datasource config initialized");

    LOG.info("Configuration components initialized successfully");
  }
}
