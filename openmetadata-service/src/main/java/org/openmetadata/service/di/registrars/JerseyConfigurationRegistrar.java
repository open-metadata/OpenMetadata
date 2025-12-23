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

package org.openmetadata.service.di.registrars;

import io.dropwizard.core.server.DefaultServerFactory;
import io.dropwizard.core.setup.Environment;
import lombok.extern.slf4j.Slf4j;
import org.glassfish.jersey.media.multipart.MultiPartFeature;
import org.glassfish.jersey.server.ServerProperties;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.di.providers.JerseyRegistrar;

@Slf4j
public class JerseyConfigurationRegistrar implements JerseyRegistrar {

  @Override
  public void register(Environment environment, OpenMetadataApplicationConfig config) {
    LOG.debug("Configuring Jersey");

    ((DefaultServerFactory) config.getServerFactory()).setRegisterDefaultExceptionMappers(false);
    environment.jersey().property(ServerProperties.RESPONSE_SET_STATUS_OVER_SEND_ERROR, true);
    environment.jersey().register(MultiPartFeature.class);

    LOG.debug("Jersey configuration complete");
  }
}
