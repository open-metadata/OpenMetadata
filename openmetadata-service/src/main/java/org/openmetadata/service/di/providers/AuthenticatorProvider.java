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

import org.openmetadata.schema.api.security.AuthenticationConfiguration;
import org.openmetadata.service.security.auth.AuthenticatorHandler;

/**
 * Provider interface for AuthenticatorHandler instances.
 *
 * <p>This interface allows different implementations (OpenMetadata vs Collate) to provide their own
 * AuthenticatorHandler implementations via dependency injection.
 *
 * <p>OpenMetadata provides the default implementation that creates handlers based on the
 * authentication provider type (BASIC, LDAP, or external OIDC providers).
 *
 * <p>Example usage:
 *
 * <pre>
 * // OpenMetadata implementation
 * public class DefaultAuthenticatorProvider implements AuthenticatorProvider {
 *   public AuthenticatorHandler getAuthenticator(AuthenticationConfiguration authConfig) {
 *     return switch (authConfig.getProvider()) {
 *       case BASIC -> new BasicAuthenticator();
 *       case LDAP -> new LdapAuthenticator();
 *       default -> new NoopAuthenticator();
 *     };
 *   }
 * }
 *
 * // Collate implementation
 * public class CollateAuthenticatorProvider implements AuthenticatorProvider {
 *   public AuthenticatorHandler getAuthenticator(AuthenticationConfiguration authConfig) {
 *     // Return custom Collate authenticator
 *   }
 * }
 * </pre>
 */
public interface AuthenticatorProvider {
  /**
   * Get AuthenticatorHandler instance based on configuration.
   *
   * @param authConfig Authentication configuration from openmetadata.yaml
   * @return AuthenticatorHandler instance appropriate for the configured auth provider
   */
  AuthenticatorHandler getAuthenticator(AuthenticationConfiguration authConfig);
}
