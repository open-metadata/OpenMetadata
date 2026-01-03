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
import jakarta.ws.rs.container.ContainerRequestFilter;
import java.lang.reflect.InvocationTargetException;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.StringUtils;
import org.openmetadata.schema.api.security.AuthenticationConfiguration;
import org.openmetadata.schema.api.security.AuthorizerConfiguration;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.ContainerRequestFilterManager;
import org.openmetadata.service.security.DelegatingContainerRequestFilter;
import org.openmetadata.service.security.NoopAuthorizer;
import org.openmetadata.service.security.NoopFilter;

/**
 * Default OpenMetadata implementation of AuthorizerProvider.
 *
 * <p>This implementation creates the Authorizer based on configuration in openmetadata.yaml. It
 * supports:
 *
 * <ul>
 *   <li>Custom authorizer classes specified in authorizerConfiguration.className
 *   <li>Custom container request filters specified in authorizerConfiguration.containerRequestFilter
 *   <li>Fallback to NoopAuthorizer and NoopFilter when no configuration is provided
 * </ul>
 *
 * <p>Collate can override this by providing its own implementation that returns a different
 * Authorizer.
 */
@Slf4j
public class DefaultAuthorizerProvider implements AuthorizerProvider {

  @Override
  public Authorizer getAuthorizer(
      AuthorizerConfiguration authzConfig,
      AuthenticationConfiguration authConfig,
      Environment environment) {

    DelegatingContainerRequestFilter delegatingFilter = new DelegatingContainerRequestFilter();
    environment.jersey().register(delegatingFilter);

    if (authzConfig != null) {
      return createConfiguredAuthorizer(authzConfig, authConfig);
    } else {
      LOG.info("Authorizer config not set, setting noop authorizer");
      ContainerRequestFilter filter = new NoopFilter(authConfig, null);
      ContainerRequestFilterManager.getInstance().registerFilter(filter);
      return new NoopAuthorizer();
    }
  }

  private Authorizer createConfiguredAuthorizer(
      AuthorizerConfiguration authzConfig, AuthenticationConfiguration authConfig) {
    try {
      Authorizer authorizer =
          Class.forName(authzConfig.getClassName())
              .asSubclass(Authorizer.class)
              .getConstructor()
              .newInstance();

      String filterClazzName = authzConfig.getContainerRequestFilter();
      if (!StringUtils.isEmpty(filterClazzName)) {
        ContainerRequestFilter filter =
            Class.forName(filterClazzName)
                .asSubclass(ContainerRequestFilter.class)
                .getConstructor(AuthenticationConfiguration.class, AuthorizerConfiguration.class)
                .newInstance(authConfig, authzConfig);
        LOG.info("Registering ContainerRequestFilter: {}", filter.getClass().getCanonicalName());
        ContainerRequestFilterManager.getInstance().registerFilter(filter);
      }

      return authorizer;
    } catch (ClassNotFoundException
        | NoSuchMethodException
        | InstantiationException
        | IllegalAccessException
        | InvocationTargetException e) {
      throw new RuntimeException("Failed to create Authorizer from configuration", e);
    }
  }
}
