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
import org.openmetadata.schema.api.security.AuthenticationConfiguration;
import org.openmetadata.schema.api.security.AuthorizerConfiguration;
import org.openmetadata.service.security.Authorizer;

/**
 * Provider interface for Authorizer instances.
 *
 * <p>This interface allows different implementations (OpenMetadata vs Collate) to provide their own
 * Authorizer implementations via dependency injection.
 *
 * <p>OpenMetadata provides the default implementation that reads from AuthorizerConfiguration,
 * while Collate can provide custom authorization implementations.
 *
 * <p>Example usage:
 *
 * <pre>
 * // OpenMetadata implementation
 * public class DefaultAuthorizerProvider implements AuthorizerProvider {
 *   public Authorizer getAuthorizer(AuthorizerConfiguration authzConfig,
 *                                   AuthenticationConfiguration authConfig,
 *                                   Environment environment) {
 *     // Create authorizer based on configuration
 *   }
 * }
 *
 * // Collate implementation
 * public class CollateAuthorizerProvider implements AuthorizerProvider {
 *   public Authorizer getAuthorizer(AuthorizerConfiguration authzConfig,
 *                                   AuthenticationConfiguration authConfig,
 *                                   Environment environment) {
 *     // Create custom Collate authorizer
 *   }
 * }
 * </pre>
 */
public interface AuthorizerProvider {
  /**
   * Get Authorizer instance based on configuration.
   *
   * @param authzConfig Authorizer configuration from openmetadata.yaml
   * @param authConfig Authentication configuration
   * @param environment Dropwizard environment for registering Jersey filters
   * @return Authorizer instance
   */
  Authorizer getAuthorizer(
      AuthorizerConfiguration authzConfig,
      AuthenticationConfiguration authConfig,
      Environment environment);
}
