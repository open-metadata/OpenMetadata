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
import org.openmetadata.sdk.PipelineServiceClientInterface;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.clients.pipeline.PipelineServiceClientFactory;
import org.openmetadata.service.security.Authorizer;

/**
 * Dagger module providing core application components.
 *
 * <p>This module provides the foundational components initialized during application startup:
 *
 * <ul>
 *   <li>Environment - Dropwizard environment for lifecycle management
 *   <li>OpenMetadataApplicationConfig - Application configuration
 *   <li>Authorizer - Access control and authorization
 *   <li>PipelineServiceClientInterface - Pipeline service client
 * </ul>
 *
 * <p>Other infrastructure components (JDBI, CollectionDAO, SearchRepository) are provided by
 * specialized modules:
 *
 * <ul>
 *   <li>DatabaseModule - provides JDBI, CollectionDAO, JobDAO
 *   <li>SearchModule - provides SearchRepository
 * </ul>
 *
 * <p>These components are passed to CoreModule during application initialization and made available
 * to other modules via dependency injection.
 */
@Module
public class CoreModule {
  private final Environment environment;
  private final OpenMetadataApplicationConfig config;
  private final Authorizer authorizer;

  /**
   * Constructor for CoreModule.
   *
   * @param environment Dropwizard environment for lifecycle management
   * @param config OpenMetadataApplicationConfig for application configuration
   * @param authorizer Authorizer for access control
   */
  public CoreModule(
      Environment environment, OpenMetadataApplicationConfig config, Authorizer authorizer) {
    this.environment = environment;
    this.config = config;
    this.authorizer = authorizer;
  }

  @Provides
  @Singleton
  public Environment provideEnvironment() {
    return environment;
  }

  @Provides
  @Singleton
  public OpenMetadataApplicationConfig provideConfig() {
    return config;
  }

  @Provides
  @Singleton
  public Authorizer provideAuthorizer() {
    return authorizer;
  }

  @Provides
  @Singleton
  public PipelineServiceClientInterface providePipelineServiceClient(
      OpenMetadataApplicationConfig config) {
    return PipelineServiceClientFactory.createPipelineServiceClient(
        config.getPipelineServiceClientConfiguration());
  }
}
