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

package org.openmetadata.service.di;

import dagger.Module;
import dagger.Provides;
import io.dropwizard.core.setup.Environment;
import javax.inject.Singleton;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.di.providers.AuthenticatorProvider;
import org.openmetadata.service.di.providers.AuthorizerProvider;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.auth.AuthenticatorHandler;

/**
 * Dagger module providing security-related components.
 *
 * <p>This module provides:
 *
 * <ul>
 *   <li>Authorizer - Access control and authorization (customizable via AuthorizerProvider)
 *   <li>AuthenticatorHandler - Authentication handling (customizable via AuthenticatorProvider)
 * </ul>
 *
 * <p>The implementations are determined by the providers injected by Dagger. OpenMetadata provides
 * default providers, while Collate can provide its own provider implementations.
 */
@Slf4j
@Module
public class SecurityModule {

  /**
   * Provides Authorizer instance via AuthorizerProvider.
   *
   * <p>The actual Authorizer implementation is determined by the AuthorizerProvider injected by
   * Dagger. OpenMetadata provides DefaultAuthorizerProvider which creates authorizers based on
   * configuration (supports DefaultAuthorizer, NoopAuthorizer, etc.), while Collate can provide its
   * own AuthorizerProvider for custom authorization logic.
   *
   * @param environment Dropwizard environment for registering Jersey filters
   * @param config Application configuration containing auth settings
   * @param provider Provider that creates the appropriate Authorizer implementation
   * @return Authorizer singleton instance
   */
  @Provides
  @Singleton
  public Authorizer provideAuthorizer(
      Environment environment, OpenMetadataApplicationConfig config, AuthorizerProvider provider) {
    LOG.info("Creating Authorizer via provider: {}", provider.getClass().getSimpleName());
    Authorizer authorizer =
        provider.getAuthorizer(
            config.getAuthorizerConfiguration(),
            config.getAuthenticationConfiguration(),
            environment);
    LOG.info("Authorizer created: {}", authorizer.getClass().getSimpleName());
    return authorizer;
  }

  /**
   * Provides AuthenticatorHandler instance via AuthenticatorProvider.
   *
   * <p>The actual AuthenticatorHandler implementation is determined by the AuthenticatorProvider
   * injected by Dagger. OpenMetadata provides DefaultAuthenticatorProvider which creates handlers
   * based on the auth provider type (BasicAuthenticator, LdapAuthenticator, NoopAuthenticator),
   * while Collate can provide its own AuthenticatorProvider for custom authentication logic.
   *
   * @param config Application configuration containing auth settings
   * @param provider Provider that creates the appropriate AuthenticatorHandler implementation
   * @return AuthenticatorHandler singleton instance
   */
  @Provides
  @Singleton
  public AuthenticatorHandler provideAuthenticatorHandler(
      OpenMetadataApplicationConfig config, AuthenticatorProvider provider) {
    LOG.info("Creating AuthenticatorHandler via provider: {}", provider.getClass().getSimpleName());
    AuthenticatorHandler handler =
        provider.getAuthenticator(config.getAuthenticationConfiguration());
    LOG.info("AuthenticatorHandler created: {}", handler.getClass().getSimpleName());
    return handler;
  }
}
