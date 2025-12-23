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

import io.dropwizard.core.setup.Environment;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.service.OpenMetadataApplication;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.fernet.Fernet;
import org.openmetadata.service.secrets.SecretsManagerFactory;
import org.openmetadata.service.secrets.masker.EntityMaskerFactory;
import org.openmetadata.service.security.auth.SecurityConfigurationManager;
import org.openmetadata.service.security.jwt.JWTTokenGenerator;

@Slf4j
public class DefaultSecurityInitializer implements SecurityInitializer {

  @Override
  public void initialize(
      OpenMetadataApplication application,
      OpenMetadataApplicationConfig config,
      Environment environment) {
    LOG.info("Initializing security components");

    Fernet.getInstance().setFernetKey(config);
    LOG.debug("Fernet initialized");

    SecurityConfigurationManager.getInstance().initialize(application, config, environment);
    LOG.debug("Security configuration manager initialized");

    JWTTokenGenerator.getInstance()
        .init(
            SecurityConfigurationManager.getCurrentAuthConfig().getTokenValidationAlgorithm(),
            config.getJwtTokenConfiguration());
    LOG.debug("JWT token generator initialized");

    SecretsManagerFactory.createSecretsManager(
        config.getSecretsManagerConfiguration(), config.getClusterName());
    LOG.debug("Secrets manager initialized");

    EntityMaskerFactory.createEntityMasker();
    LOG.debug("Entity masker initialized");

    LOG.info("Security components initialized successfully");
  }
}
