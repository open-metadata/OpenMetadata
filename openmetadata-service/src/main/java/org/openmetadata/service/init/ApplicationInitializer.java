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

package org.openmetadata.service.init;

import io.dropwizard.core.setup.Environment;
import io.dropwizard.jdbi3.JdbiFactory;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.core.Jdbi;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.jdbi3.CollectionDAO;
// NOTE: ApplicationInitializer is a template for phased initialization
// It will be fully implemented when integrating with OpenMetadataApplication
// import org.openmetadata.service.migration.MigrationValidationClient;
import org.openmetadata.service.jdbi3.MigrationDAO;
import org.openmetadata.service.migration.MigrationValidationClient;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.services.ServiceRegistry;

/**
 * Application initializer that manages phased initialization of OpenMetadata components.
 *
 * <p>This class breaks down the initialization process into explicit phases with clear
 * dependencies:
 *
 * <ol>
 *   <li>Core Infrastructure - JDBI, DAOs, Search
 *   <li>Repositories - Entity repositories
 *   <li>Services - Business logic services
 *   <li>Application Components - Settings, Security, etc.
 *   <li>Event System - Event publishers, authorizer
 *   <li>Resource Registration - REST resources
 * </ol>
 *
 * <p>Each phase has explicit inputs and outputs, making dependencies clear and testable.
 */
@Slf4j
public class ApplicationInitializer {

  /**
   * Phase 1: Initialize core infrastructure components.
   *
   * <p>This phase sets up the foundational infrastructure needed by all other components:
   *
   * <ul>
   *   <li>JDBI for database access
   *   <li>CollectionDAO for data access
   *   <li>SearchRepository for search operations
   * </ul>
   *
   * @param environment Dropwizard environment
   * @param config Application configuration
   * @return CoreComponents containing initialized infrastructure
   */
  public CoreComponents initializeCoreInfrastructure(
      Environment environment, OpenMetadataApplicationConfig config) {
    LOG.info("Phase 1: Initializing core infrastructure");

    final JdbiFactory factory = new JdbiFactory();
    Jdbi jdbi = factory.build(environment, config.getDataSourceFactory(), "openmetadata");

    CollectionDAO collectionDAO = jdbi.onDemand(CollectionDAO.class);
    Entity.setCollectionDAO(collectionDAO);
    Entity.setJdbi(jdbi);

    SearchRepository searchRepository = createSearchRepository(config);
    Entity.setSearchRepository(searchRepository);

    LOG.info("Phase 1: Core infrastructure initialized successfully");
    return new CoreComponents(jdbi, collectionDAO, searchRepository);
  }

  /**
   * Phase 2: Initialize repositories.
   *
   * <p>This phase creates and registers all entity repositories using the core infrastructure from
   * Phase 1.
   *
   * @param core Core components from Phase 1
   * @param config Application configuration
   * @return RepositoryRegistry containing all initialized repositories
   */
  public void initializeRepositories(CoreComponents core, OpenMetadataApplicationConfig config) {
    LOG.info("Phase 2: Initializing repositories");

    // Initialize migration validation client
    MigrationValidationClient.initialize(core.getJdbi().onDemand(MigrationDAO.class), config);

    // Initialize all entity repositories
    Entity.initializeRepositories(config, core.getJdbi());

    LOG.info("Phase 2: Repositories initialized successfully");
  }

  /**
   * Phase 3: Initialize services.
   *
   * <p>This phase creates and registers all entity services that provide business logic on top of
   * repositories.
   *
   * <p>NOTE: This method is a template for service initialization. Actual service registration
   * will be done when the application is integrated with the phased initialization pattern.
   *
   * @param core Core components from Phase 1
   * @param config Application configuration
   * @param authorizer Authorizer instance (to be passed from application)
   * @return ServiceRegistry containing all initialized services
   */
  public ServiceRegistry initializeServices(
      CoreComponents core,
      OpenMetadataApplicationConfig config,
      org.openmetadata.service.security.Authorizer authorizer) {
    LOG.info("Phase 3: Initializing services");

    ServiceRegistry serviceRegistry = new ServiceRegistry();

    // Register TableService (pilot implementation)
    org.openmetadata.service.jdbi3.TableRepository tableRepository =
        (org.openmetadata.service.jdbi3.TableRepository) Entity.getEntityRepository(Entity.TABLE);
    org.openmetadata.service.resources.databases.TableMapper tableMapper =
        new org.openmetadata.service.resources.databases.TableMapper();
    org.openmetadata.service.services.databases.TableService tableService =
        new org.openmetadata.service.services.databases.TableService(
            tableRepository, core.getSearchRepository(), authorizer, tableMapper);
    serviceRegistry.register(Entity.TABLE, tableService);
    LOG.info("Registered TableService");

    // Additional services will be registered here as we migrate entities

    LOG.info(
        "Phase 3: Services initialized successfully - {} services registered",
        serviceRegistry.size());
    return serviceRegistry;
  }

  /**
   * Phase 4: Initialize application components.
   *
   * <p>This phase sets up application-level components that depend on repositories and services:
   *
   * <ul>
   *   <li>Settings cache
   *   <li>Security configuration
   *   <li>JWT token generator
   *   <li>Workflow handler
   * </ul>
   *
   * @param serviceRegistry Service registry from Phase 3
   * @param config Application configuration
   */
  public void initializeApplicationComponents(
      ServiceRegistry serviceRegistry, OpenMetadataApplicationConfig config) {
    LOG.info("Phase 4: Initializing application components");

    // These initializations will be refactored to use services instead of static repositories
    // in subsequent phases of the refactoring

    LOG.info("Phase 4: Application components initialized successfully");
  }

  /**
   * Create search repository based on configuration.
   *
   * @param config Application configuration
   * @return Configured SearchRepository instance
   */
  private SearchRepository createSearchRepository(OpenMetadataApplicationConfig config) {
    SearchRepository searchRepository = null;
    if (config.getElasticSearchConfiguration() != null) {
      searchRepository =
          new SearchRepository(
              config.getElasticSearchConfiguration(), config.getDataSourceFactory().getMaxSize());
    }
    return searchRepository;
  }

  /**
   * Container for core infrastructure components from Phase 1.
   *
   * <p>This class provides type-safe access to the core components needed by later initialization
   * phases.
   */
  @Getter
  public static class CoreComponents {
    private final Jdbi jdbi;
    private final CollectionDAO collectionDAO;
    private final SearchRepository searchRepository;

    public CoreComponents(
        Jdbi jdbi, CollectionDAO collectionDAO, SearchRepository searchRepository) {
      this.jdbi = jdbi;
      this.collectionDAO = collectionDAO;
      this.searchRepository = searchRepository;
    }
  }
}
