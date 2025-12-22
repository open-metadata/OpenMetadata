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
import org.jdbi.v3.core.Jdbi;
import org.jdbi.v3.sqlobject.SqlObjects;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.di.providers.CollectionDAOProvider;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.locator.ConnectionAwareAnnotationSqlLocator;
import org.openmetadata.service.jobs.JobDAO;
import org.openmetadata.service.util.jdbi.JdbiUtils;

/**
 * Dagger module providing database-related components.
 *
 * <p>This module provides:
 *
 * <ul>
 *   <li>JDBI instance with connection pooling and configuration
 *   <li>CollectionDAO for entity data access (customizable via CollectionDAOProvider)
 *   <li>JobDAO for background job management
 *   <li>SQL locator configuration for database-specific queries
 * </ul>
 *
 * <p>The CollectionDAO can be customized by providing a different CollectionDAOProvider
 * implementation. OpenMetadata uses DefaultCollectionDAOProvider which returns the standard
 * CollectionDAO, while Collate can provide CollateCollectionDAOProvider which returns DaoExtension.
 */
@Slf4j
@Module
public class DatabaseModule {

  /**
   * Provides JDBI instance with connection pooling.
   *
   * <p>JDBI is configured with the application's datasource factory and registered with Dropwizard
   * for health checks and metrics.
   *
   * @param environment Dropwizard environment for lifecycle management
   * @param config Application configuration containing datasource settings
   * @return Configured JDBI singleton instance
   */
  @Provides
  @Singleton
  public Jdbi provideJdbi(Environment environment, OpenMetadataApplicationConfig config) {
    LOG.info("Creating JDBI instance with datasource factory");
    Jdbi jdbi = JdbiUtils.createAndSetupJDBI(environment, config.getDataSourceFactory());

    // Configure SQL locator for database-specific query selection
    jdbi.getConfig(SqlObjects.class)
        .setSqlLocator(
            new ConnectionAwareAnnotationSqlLocator(
                config.getDataSourceFactory().getDriverClass()));

    LOG.info("JDBI instance created and configured successfully");
    return jdbi;
  }

  /**
   * Provides CollectionDAO instance via CollectionDAOProvider.
   *
   * <p>The actual CollectionDAO implementation is determined by the CollectionDAOProvider injected
   * by Dagger. OpenMetadata provides DefaultCollectionDAOProvider (returns CollectionDAO), while
   * Collate provides CollateCollectionDAOProvider (returns DaoExtension).
   *
   * @param jdbi JDBI instance for database access
   * @param provider Provider that creates the appropriate CollectionDAO implementation
   * @return CollectionDAO singleton instance
   */
  @Provides
  @Singleton
  public CollectionDAO provideCollectionDAO(Jdbi jdbi, CollectionDAOProvider provider) {
    LOG.info("Creating CollectionDAO via provider: {}", provider.getClass().getSimpleName());
    CollectionDAO collectionDAO = provider.getCollectionDAO(jdbi);
    LOG.info("CollectionDAO created: {}", collectionDAO.getClass().getSimpleName());
    return collectionDAO;
  }

  /**
   * Provides JobDAO instance for background job management.
   *
   * @param jdbi JDBI instance for database access
   * @return JobDAO singleton instance
   */
  @Provides
  @Singleton
  public JobDAO provideJobDAO(Jdbi jdbi) {
    LOG.debug("Creating JobDAO from JDBI");
    return jdbi.onDemand(JobDAO.class);
  }
}
