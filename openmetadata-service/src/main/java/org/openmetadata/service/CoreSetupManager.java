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

package org.openmetadata.service;

import static org.openmetadata.service.util.jdbi.JdbiUtils.createAndSetupJDBI;

import io.dropwizard.core.setup.Environment;
import jakarta.validation.Validation;
import java.io.IOException;
import java.util.Optional;
import javax.naming.ConfigurationException;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.hibernate.validator.messageinterpolation.ResourceBundleMessageInterpolator;
import org.hibernate.validator.resourceloading.PlatformResourceBundleLocator;
import org.jdbi.v3.core.Jdbi;
import org.jdbi.v3.sqlobject.SqlObjects;
import org.openmetadata.search.IndexMappingLoader;
import org.openmetadata.service.apps.ApplicationHandler;
import org.openmetadata.service.cache.RedisCacheBundle;
import org.openmetadata.service.fernet.Fernet;
import org.openmetadata.service.governance.workflows.WorkflowHandler;
import org.openmetadata.service.jdbi3.MigrationDAO;
import org.openmetadata.service.jdbi3.locator.ConnectionAwareAnnotationSqlLocator;
import org.openmetadata.service.jdbi3.locator.ConnectionType;
import org.openmetadata.service.jobs.JobDAO;
import org.openmetadata.service.migration.Migration;
import org.openmetadata.service.migration.MigrationValidationClient;
import org.openmetadata.service.migration.api.MigrationWorkflow;
import org.openmetadata.service.resources.databases.DatasourceConfig;
import org.openmetadata.service.resources.settings.SettingsCache;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.secrets.SecretsManagerFactory;
import org.openmetadata.service.secrets.masker.EntityMaskerFactory;
import org.openmetadata.service.security.jwt.JWTTokenGenerator;
import org.openmetadata.service.util.CustomParameterNameProvider;
import org.openmetadata.service.util.incidentSeverityClassifier.IncidentSeverityClassifierInterface;

@Slf4j
@Getter
public class CoreSetupManager {
  private final OpenMetadataApplicationConfig config;
  private final Environment environment;
  private Jdbi jdbi;

  public CoreSetupManager(OpenMetadataApplicationConfig config, Environment environment) {
    this.config = config;
    this.environment = environment;
  }

  public void setup() throws IOException, ConfigurationException {
    setupDatabase();
    validateConfiguration();
    initializeCore();
    initializeRepositories();
    configureFramework();
    validateMigrations();
  }

  private void validateConfiguration() throws ConfigurationException {
    if (config.getAuthorizerConfiguration().getBotPrincipals() != null) {
      throw new ConfigurationException(
          "'botPrincipals' configuration is deprecated. Please remove it from "
              + "'openmetadata.yaml and restart the server");
    }
    if (config.getPipelineServiceClientConfiguration().getAuthConfig() != null) {
      LOG.warn(
          "'authProvider' and 'authConfig' from the 'pipelineServiceClientConfiguration' option are deprecated and will be removed in future releases.");
    }
  }

  private void initializeCore() throws IOException {
    IncidentSeverityClassifierInterface.createInstance();
    IndexMappingLoader.init(config.getElasticSearchConfiguration());
    DatasourceConfig.initialize(config.getDataSourceFactory().getDriverClass());
    ApplicationHandler.initialize(config);
  }

  private void setupDatabase() {
    jdbi = createAndSetupJDBI(environment, config.getDataSourceFactory());
    Entity.setCollectionDAO(getDao());
    Entity.setJobDAO(jdbi.onDemand(JobDAO.class));
    Entity.setJdbi(jdbi);

    jdbi.getConfig(SqlObjects.class)
        .setSqlLocator(
            new ConnectionAwareAnnotationSqlLocator(
                config.getDataSourceFactory().getDriverClass()));
  }

  private void initializeRepositories() {
    initializeSearchRepository();
    MigrationValidationClient.initialize(jdbi.onDemand(MigrationDAO.class), config);
    Entity.initializeRepositories(config, jdbi);

    Fernet.getInstance().setFernetKey(config);
    WorkflowHandler.initialize(config);
    SettingsCache.initialize(config);

    initializeCache();

    SecretsManagerFactory.createSecretsManager(
        config.getSecretsManagerConfiguration(), config.getClusterName());
    EntityMaskerFactory.createEntityMasker();

    JWTTokenGenerator.getInstance()
        .init(
            config.getAuthenticationConfiguration().getTokenValidationAlgorithm(),
            config.getJwtTokenConfiguration());
  }

  private void initializeSearchRepository() {
    Integer databaseMaxSize = config.getDataSourceFactory().getMaxSize();
    LOG.info(
        "AUTO-TUNE INIT: Initializing SearchRepository with database max pool size: {}",
        databaseMaxSize);
    SearchRepository searchRepository =
        new SearchRepository(
            config.getElasticSearchConfiguration(), config.getDataSourceFactory().getMaxSize());
    Entity.setSearchRepository(searchRepository);
  }

  private void configureFramework() {
    environment.setValidator(
        Validation.byDefaultProvider()
            .configure()
            .parameterNameProvider(new CustomParameterNameProvider())
            .messageInterpolator(
                new ResourceBundleMessageInterpolator(
                    new PlatformResourceBundleLocator("jakarta.validation.ValidationMessages")))
            .buildValidatorFactory()
            .getValidator());
  }

  private void validateMigrations() throws IOException {
    LOG.info("Validating Flyway migrations");
    Optional<String> lastMigrated = Migration.lastMigrated(jdbi);
    String maxMigration = Migration.lastMigrationFile(config.getMigrationConfiguration());
    if (lastMigrated.isEmpty()) {
      throw new IllegalStateException(
          "Could not validate Flyway migrations in the database. Make sure you have run `./bootstrap/openmetadata-ops.sh migrate` at least once.");
    }
    if (lastMigrated.get().compareTo(maxMigration) < 0) {
      throw new IllegalStateException(
          "There are pending migrations to be run on the database."
              + " Please backup your data and run `./bootstrap/openmetadata-ops.sh migrate`."
              + " You can find more information on upgrading OpenMetadata at"
              + " https://docs.open-metadata.org/deployment/upgrade ");
    }

    LOG.info("Validating native migrations");
    ConnectionType connectionType =
        ConnectionType.from(config.getDataSourceFactory().getDriverClass());
    MigrationWorkflow migrationWorkflow =
        new MigrationWorkflow(
            jdbi,
            config.getMigrationConfiguration().getNativePath(),
            connectionType,
            config.getMigrationConfiguration().getExtensionPath(),
            config,
            false);
    migrationWorkflow.loadMigrations();
    migrationWorkflow.validateMigrationsForServer();
  }

  private void initializeCache() {
    if (config.getCacheConfiguration() != null && config.getCacheConfiguration().isEnabled()) {
      LOG.info("Initializing Redis cache");
      try {
        RedisCacheBundle cacheBundle = new RedisCacheBundle();
        cacheBundle.run(config, environment);
        LOG.info("Redis cache initialized successfully");
      } catch (Exception e) {
        LOG.error("Failed to initialize Redis cache", e);
        throw new RuntimeException("Failed to initialize Redis cache", e);
      }
    } else {
      LOG.info("Redis cache is disabled");
    }
  }

  private org.openmetadata.service.jdbi3.CollectionDAO getDao() {
    org.openmetadata.service.jdbi3.CollectionDAO originalDAO =
        jdbi.onDemand(org.openmetadata.service.jdbi3.CollectionDAO.class);

    if (org.openmetadata.service.cache.RelationshipCache.isAvailable()) {
      LOG.info("Wrapping CollectionDAO with caching support");
      return new org.openmetadata.service.cache.CachedCollectionDAO(originalDAO);
    }

    LOG.info("Using original CollectionDAO without caching");
    return originalDAO;
  }
}
