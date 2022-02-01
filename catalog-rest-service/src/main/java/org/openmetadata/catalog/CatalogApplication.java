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

package org.openmetadata.catalog;

import io.dropwizard.Application;
import io.dropwizard.assets.AssetsBundle;
import io.dropwizard.configuration.EnvironmentVariableSubstitutor;
import io.dropwizard.configuration.SubstitutingSourceProvider;
import io.dropwizard.health.conf.HealthConfiguration;
import io.dropwizard.health.core.HealthCheckBundle;
import io.dropwizard.jdbi3.JdbiFactory;
import io.dropwizard.jersey.errors.EarlyEofExceptionMapper;
import io.dropwizard.jersey.errors.LoggingExceptionMapper;
import io.dropwizard.jersey.jackson.JsonProcessingExceptionMapper;
import io.dropwizard.lifecycle.Managed;
import io.dropwizard.server.DefaultServerFactory;
import io.dropwizard.setup.Bootstrap;
import io.dropwizard.setup.Environment;
import io.federecio.dropwizard.swagger.SwaggerBundle;
import io.federecio.dropwizard.swagger.SwaggerBundleConfiguration;
import java.io.IOException;
import java.lang.reflect.InvocationTargetException;
import java.sql.SQLException;
import java.time.temporal.ChronoUnit;
import java.util.Optional;
import javax.ws.rs.container.ContainerRequestFilter;
import javax.ws.rs.container.ContainerResponseFilter;
import javax.ws.rs.core.Response;
import lombok.SneakyThrows;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.StringUtils;
import org.eclipse.jetty.servlet.ErrorPageErrorHandler;
import org.glassfish.jersey.media.multipart.MultiPartFeature;
import org.glassfish.jersey.server.ServerProperties;
import org.jdbi.v3.core.Jdbi;
import org.jdbi.v3.core.statement.SqlLogger;
import org.jdbi.v3.core.statement.StatementContext;
import org.openmetadata.catalog.elasticsearch.ElasticSearchEventPublisher;
import org.openmetadata.catalog.events.EventFilter;
import org.openmetadata.catalog.events.EventPubSub;
import org.openmetadata.catalog.exception.CatalogGenericExceptionMapper;
import org.openmetadata.catalog.exception.ConstraintViolationExceptionMapper;
import org.openmetadata.catalog.exception.JsonMappingExceptionMapper;
import org.openmetadata.catalog.migration.Migration;
import org.openmetadata.catalog.migration.MigrationConfiguration;
import org.openmetadata.catalog.resources.CollectionRegistry;
import org.openmetadata.catalog.resources.config.ConfigResource;
import org.openmetadata.catalog.resources.search.SearchResource;
import org.openmetadata.catalog.security.AuthenticationConfiguration;
import org.openmetadata.catalog.security.Authorizer;
import org.openmetadata.catalog.security.AuthorizerConfiguration;
import org.openmetadata.catalog.security.NoopAuthorizer;
import org.openmetadata.catalog.security.NoopFilter;
import org.openmetadata.catalog.security.auth.CatalogSecurityContextRequestFilter;
import org.openmetadata.catalog.slack.SlackPublisherConfiguration;
import org.openmetadata.catalog.slack.SlackWebhookEventPublisher;

/** Main catalog application */
@Slf4j
public class CatalogApplication extends Application<CatalogApplicationConfig> {
  private Authorizer authorizer;

  @Override
  public void run(CatalogApplicationConfig catalogConfig, Environment environment)
      throws ClassNotFoundException, IllegalAccessException, InstantiationException, NoSuchMethodException,
          InvocationTargetException, IOException, SQLException {

    final JdbiFactory factory = new JdbiFactory();
    final Jdbi jdbi = factory.build(environment, catalogConfig.getDataSourceFactory(), "mysql3");

    SqlLogger sqlLogger =
        new SqlLogger() {
          @Override
          public void logAfterExecution(StatementContext context) {
            LOG.debug(
                "sql {}, parameters {}, timeTaken {} ms",
                context.getRenderedSql(),
                context.getBinding(),
                context.getElapsedTime(ChronoUnit.MILLIS));
          }
        };
    if (LOG.isDebugEnabled()) {
      jdbi.setSqlLogger(sqlLogger);
    }

    // Validate flyway Migrations
    validateMigrations(jdbi, catalogConfig.getMigrationConfiguration());

    // Register Authorizer
    registerAuthorizer(catalogConfig, environment, jdbi);

    // Unregister dropwizard default exception mappers
    ((DefaultServerFactory) catalogConfig.getServerFactory()).setRegisterDefaultExceptionMappers(false);
    environment.jersey().property(ServerProperties.RESPONSE_SET_STATUS_OVER_SEND_ERROR, true);
    environment.jersey().register(MultiPartFeature.class);
    environment.jersey().register(CatalogGenericExceptionMapper.class);

    // Override constraint violation mapper to catch Json validation errors
    environment.jersey().register(new ConstraintViolationExceptionMapper());

    // Restore dropwizard default exception mappers
    environment.jersey().register(new LoggingExceptionMapper<>() {});
    environment.jersey().register(new JsonProcessingExceptionMapper(true));
    environment.jersey().register(new EarlyEofExceptionMapper());
    environment.jersey().register(JsonMappingExceptionMapper.class);
    environment.healthChecks().register("UserDatabaseCheck", new CatalogHealthCheck(catalogConfig, jdbi));
    registerResources(catalogConfig, environment, jdbi);

    // Register Event Handler
    registerEventFilter(catalogConfig, environment, jdbi);
    environment.lifecycle().manage(new ManagedShutdown());
    // start event hub before registering publishers
    EventPubSub.start();
    // Register Event publishers
    registerEventPublisher(catalogConfig);
  }

  @SneakyThrows
  @Override
  public void initialize(Bootstrap<CatalogApplicationConfig> bootstrap) {
    bootstrap.setConfigurationSourceProvider(
        new SubstitutingSourceProvider(
            bootstrap.getConfigurationSourceProvider(), new EnvironmentVariableSubstitutor(false)));
    bootstrap.addBundle(
        new SwaggerBundle<>() {
          @Override
          protected SwaggerBundleConfiguration getSwaggerBundleConfiguration(CatalogApplicationConfig catalogConfig) {
            return catalogConfig.getSwaggerBundleConfig();
          }
        });
    bootstrap.addBundle(new AssetsBundle("/assets", "/", "index.html", "static"));
    bootstrap.addBundle(
        new HealthCheckBundle<>() {
          @Override
          protected HealthConfiguration getHealthConfiguration(final CatalogApplicationConfig configuration) {
            return configuration.getHealthConfiguration();
          }
        });
    // bootstrap.addBundle(new CatalogJdbiExceptionsBundle());
    super.initialize(bootstrap);
  }

  private void validateMigrations(Jdbi jdbi, MigrationConfiguration conf) throws IOException {
    LOG.info("Validating Flyway migrations");
    Optional<String> lastMigrated = Migration.lastMigrated(jdbi);
    String maxMigration = Migration.lastMigrationFile(conf);

    if (lastMigrated.isEmpty()) {
      System.out.println(
          "Could not validate Flyway migrations in MySQL."
              + " Make sure you have run `./bootstrap/bootstrap_storage.sh migrate-all` at least once.");
      System.exit(1);
    }
    if (lastMigrated.get().compareTo(maxMigration) < 0) {
      System.out.println(
          "There are pending migrations to be run on MySQL."
              + " Please backup your data and run `./bootstrap/bootstrap_storage.sh migrate-all`."
              + " You can find more information on upgrading OpenMetadata at"
              + " https://docs.open-metadata.org/install/upgrade-openmetadata");
      System.exit(1);
    }
  }

  private void registerAuthorizer(CatalogApplicationConfig catalogConfig, Environment environment, Jdbi jdbi)
      throws NoSuchMethodException, ClassNotFoundException, IllegalAccessException, InvocationTargetException,
          InstantiationException, IOException {
    AuthorizerConfiguration authorizerConf = catalogConfig.getAuthorizerConfiguration();
    AuthenticationConfiguration authenticationConfiguration = catalogConfig.getAuthenticationConfiguration();
    if (authorizerConf != null) {
      authorizer = ((Class<Authorizer>) Class.forName(authorizerConf.getClassName())).getConstructor().newInstance();
      authorizer.init(authorizerConf, jdbi);
      String filterClazzName = authorizerConf.getContainerRequestFilter();
      ContainerRequestFilter filter;
      if (StringUtils.isEmpty(filterClazzName)) {
        filter = new CatalogSecurityContextRequestFilter(); // default
      } else {
        filter =
            ((Class<ContainerRequestFilter>) Class.forName(filterClazzName))
                .getConstructor(AuthenticationConfiguration.class)
                .newInstance(authenticationConfiguration);
      }
      LOG.info("Registering ContainerRequestFilter: {}", filter.getClass().getCanonicalName());
      environment.jersey().register(filter);
    } else {
      LOG.info("Authorizer config not set, setting noop authorizer");
      authorizer = NoopAuthorizer.class.getConstructor().newInstance();
      ContainerRequestFilter filter = NoopFilter.class.getConstructor().newInstance();
      environment.jersey().register(filter);
    }
    // Registering config api
    environment.jersey().register(new ConfigResource(catalogConfig, authorizer));
  }

  private void registerEventFilter(CatalogApplicationConfig catalogConfig, Environment environment, Jdbi jdbi) {
    if (catalogConfig.getEventHandlerConfiguration() != null) {
      ContainerResponseFilter eventFilter = new EventFilter(catalogConfig, jdbi);
      environment.jersey().register(eventFilter);
    }
  }

  private void registerEventPublisher(CatalogApplicationConfig catalogApplicationConfig) {
    // register ElasticSearch Event publisher
    if (catalogApplicationConfig.getElasticSearchConfiguration() != null) {
      ElasticSearchEventPublisher elasticSearchEventPublisher =
          new ElasticSearchEventPublisher(catalogApplicationConfig.getElasticSearchConfiguration());
      EventPubSub.addEventHandler(elasticSearchEventPublisher);
    }
    // register slack Event publishers
    if (catalogApplicationConfig.getSlackEventPublishers() != null) {
      for (SlackPublisherConfiguration slackPublisherConfiguration :
          catalogApplicationConfig.getSlackEventPublishers()) {
        SlackWebhookEventPublisher slackPublisher = new SlackWebhookEventPublisher(slackPublisherConfiguration);
        EventPubSub.addEventHandler(slackPublisher);
      }
    }
  }

  private void registerResources(CatalogApplicationConfig config, Environment environment, Jdbi jdbi) {
    CollectionRegistry.getInstance().registerResources(jdbi, environment, config, authorizer);
    environment.jersey().register(new SearchResource(config.getElasticSearchConfiguration()));
    environment.jersey().register(new JsonPatchProvider());
    ErrorPageErrorHandler eph = new ErrorPageErrorHandler();
    eph.addErrorPage(Response.Status.NOT_FOUND.getStatusCode(), "/");
    environment.getApplicationContext().setErrorHandler(eph);
  }

  public static void main(String[] args) throws Exception {
    CatalogApplication catalogApplication = new CatalogApplication();
    catalogApplication.run(args);
  }

  public class ManagedShutdown implements Managed {

    @Override
    public void start() throws Exception {
      LOG.info("Starting the application");
    }

    @Override
    public void stop() throws Exception {
      EventPubSub.shutdown();
      LOG.info("Stopping the application");
    }
  }
}
