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

import io.dropwizard.Application;
import io.dropwizard.assets.AssetsBundle;
import io.dropwizard.configuration.EnvironmentVariableSubstitutor;
import io.dropwizard.configuration.SubstitutingSourceProvider;
import io.dropwizard.db.DataSourceFactory;
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
import io.github.maksymdolgykh.dropwizard.micrometer.MicrometerBundle;
import io.github.maksymdolgykh.dropwizard.micrometer.MicrometerHttpFilter;
import io.github.maksymdolgykh.dropwizard.micrometer.MicrometerJdbiTimingCollector;
import io.socket.engineio.server.EngineIoServerOptions;
import io.socket.engineio.server.JettyWebSocketHandler;
import java.io.IOException;
import java.lang.reflect.InvocationTargetException;
import java.time.temporal.ChronoUnit;
import java.util.EnumSet;
import java.util.Optional;
import javax.servlet.DispatcherType;
import javax.servlet.FilterRegistration;
import javax.servlet.ServletException;
import javax.ws.rs.container.ContainerRequestFilter;
import javax.ws.rs.container.ContainerResponseFilter;
import javax.ws.rs.core.Response;
import lombok.SneakyThrows;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.StringUtils;
import org.eclipse.jetty.http.pathmap.ServletPathSpec;
import org.eclipse.jetty.servlet.ErrorPageErrorHandler;
import org.eclipse.jetty.servlet.FilterHolder;
import org.eclipse.jetty.servlet.ServletHolder;
import org.eclipse.jetty.websocket.server.WebSocketUpgradeFilter;
import org.glassfish.jersey.media.multipart.MultiPartFeature;
import org.glassfish.jersey.server.ServerProperties;
import org.jdbi.v3.core.Jdbi;
import org.jdbi.v3.core.statement.SqlLogger;
import org.jdbi.v3.core.statement.StatementContext;
import org.jdbi.v3.sqlobject.SqlObjects;
import org.openmetadata.schema.api.security.AuthenticationConfiguration;
import org.openmetadata.schema.api.security.AuthorizerConfiguration;
import org.openmetadata.service.elasticsearch.ElasticSearchEventPublisher;
import org.openmetadata.service.events.EventFilter;
import org.openmetadata.service.events.EventPubSub;
import org.openmetadata.service.exception.CatalogGenericExceptionMapper;
import org.openmetadata.service.exception.ConstraintViolationExceptionMapper;
import org.openmetadata.service.exception.JsonMappingExceptionMapper;
import org.openmetadata.service.fernet.Fernet;
import org.openmetadata.service.jdbi3.locator.ConnectionAwareAnnotationSqlLocator;
import org.openmetadata.service.migration.Migration;
import org.openmetadata.service.migration.MigrationConfiguration;
import org.openmetadata.service.resources.CollectionRegistry;
import org.openmetadata.service.resources.search.SearchResource;
import org.openmetadata.service.secrets.SecretsManager;
import org.openmetadata.service.secrets.SecretsManagerFactory;
import org.openmetadata.service.secrets.SecretsManagerMigrationService;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.NoopAuthorizer;
import org.openmetadata.service.security.NoopFilter;
import org.openmetadata.service.security.jwt.JWTTokenGenerator;
import org.openmetadata.service.socket.FeedServlet;
import org.openmetadata.service.socket.SocketAddressFilter;
import org.openmetadata.service.socket.WebSocketManager;
import org.openmetadata.service.util.ConfigurationHolder;
import org.openmetadata.service.util.EmailUtil;

/** Main catalog application */
@Slf4j
public class OpenMetadataApplication extends Application<OpenMetadataApplicationConfig> {
  private Authorizer authorizer;

  @Override
  public void run(OpenMetadataApplicationConfig catalogConfig, Environment environment)
      throws ClassNotFoundException, IllegalAccessException, InstantiationException, NoSuchMethodException,
          InvocationTargetException, IOException {
    // This should be first only as this holder has some config
    ConfigurationHolder.getInstance().init(catalogConfig);
    // init email Util for handling
    EmailUtil.EmailUtilBuilder.build(catalogConfig.getSmtpSettings());
    final Jdbi jdbi = createAndSetupJDBI(environment, catalogConfig.getDataSourceFactory());
    final SecretsManager secretsManager =
        SecretsManagerFactory.createSecretsManager(
            catalogConfig.getSecretsManagerConfiguration(), catalogConfig.getClusterName());

    secretsManager.encryptAirflowConnection(catalogConfig.getAirflowConfiguration());

    // Configure the Fernet instance
    Fernet.getInstance().setFernetKey(catalogConfig);

    // Instantiate JWT Token Generator
    JWTTokenGenerator.getInstance().init(catalogConfig.getJwtTokenConfiguration());

    // Set the Database type for choosing correct queries from annotations
    jdbi.getConfig(SqlObjects.class)
        .setSqlLocator(new ConnectionAwareAnnotationSqlLocator(catalogConfig.getDataSourceFactory().getDriverClass()));

    // Validate flyway Migrations
    validateMigrations(jdbi, catalogConfig.getMigrationConfiguration());

    // Register Authorizer
    registerAuthorizer(catalogConfig, environment);

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
    environment.healthChecks().register("OpenMetadataServerHealthCheck", new OpenMetadataServerHealthCheck());
    // start event hub before registering publishers
    EventPubSub.start();

    registerResources(catalogConfig, environment, jdbi, secretsManager);

    // Register Event Handler
    registerEventFilter(catalogConfig, environment, jdbi);
    environment.lifecycle().manage(new ManagedShutdown());
    // Register Event publishers
    registerEventPublisher(catalogConfig);

    // Check if migration is need from local secret manager to configured one and migrate
    new SecretsManagerMigrationService(secretsManager, catalogConfig.getClusterName())
        .migrateServicesToSecretManagerIfNeeded();

    // start authorizer after event publishers
    // authorizer creates admin/bot users, ES publisher should start before to index users created by authorizer
    authorizer.init(catalogConfig.getAuthorizerConfiguration(), jdbi);
    FilterRegistration.Dynamic micrometerFilter =
        environment.servlets().addFilter("MicrometerHttpFilter", new MicrometerHttpFilter());
    micrometerFilter.addMappingForUrlPatterns(EnumSet.allOf(DispatcherType.class), true, "/*");
    intializeWebsockets(catalogConfig, environment);
  }

  private Jdbi createAndSetupJDBI(Environment environment, DataSourceFactory dbFactory) {
    Jdbi jdbi = new JdbiFactory().build(environment, dbFactory, "database");
    jdbi.setTimingCollector(new MicrometerJdbiTimingCollector());

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
    // Set the Database type for choosing correct queries from annotations
    jdbi.getConfig(SqlObjects.class).setSqlLocator(new ConnectionAwareAnnotationSqlLocator(dbFactory.getDriverClass()));

    return jdbi;
  }

  @SneakyThrows
  @Override
  public void initialize(Bootstrap<OpenMetadataApplicationConfig> bootstrap) {
    bootstrap.setConfigurationSourceProvider(
        new SubstitutingSourceProvider(
            bootstrap.getConfigurationSourceProvider(), new EnvironmentVariableSubstitutor(false)));
    bootstrap.addBundle(
        new SwaggerBundle<>() {
          @Override
          protected SwaggerBundleConfiguration getSwaggerBundleConfiguration(
              OpenMetadataApplicationConfig catalogConfig) {
            return catalogConfig.getSwaggerBundleConfig();
          }
        });
    bootstrap.addBundle(new AssetsBundle("/assets", "/", "index.html", "static"));
    bootstrap.addBundle(
        new HealthCheckBundle<>() {
          @Override
          protected HealthConfiguration getHealthConfiguration(final OpenMetadataApplicationConfig configuration) {
            return configuration.getHealthConfiguration();
          }
        });
    bootstrap.addBundle(new MicrometerBundle());
    super.initialize(bootstrap);
  }

  private void validateMigrations(Jdbi jdbi, MigrationConfiguration conf) throws IOException {
    LOG.info("Validating Flyway migrations");
    Optional<String> lastMigrated = Migration.lastMigrated(jdbi);
    String maxMigration = Migration.lastMigrationFile(conf);

    if (lastMigrated.isEmpty()) {
      throw new IllegalStateException(
          "Could not validate Flyway migrations in the database. Make sure you have run `./bootstrap/bootstrap_storage.sh migrate-all` at least once.");
    }
    if (lastMigrated.get().compareTo(maxMigration) < 0) {
      throw new IllegalStateException(
          "There are pending migrations to be run on the database."
              + " Please backup your data and run `./bootstrap/bootstrap_storage.sh migrate-all`."
              + " You can find more information on upgrading OpenMetadata at"
              + " https://docs.open-metadata.org/deployment/upgrade ");
    }
  }

  private void registerAuthorizer(OpenMetadataApplicationConfig catalogConfig, Environment environment)
      throws NoSuchMethodException, ClassNotFoundException, IllegalAccessException, InvocationTargetException,
          InstantiationException {
    AuthorizerConfiguration authorizerConf = catalogConfig.getAuthorizerConfiguration();
    AuthenticationConfiguration authenticationConfiguration = catalogConfig.getAuthenticationConfiguration();
    // to authenticate request while opening websocket connections
    if (authorizerConf != null) {
      authorizer =
          Class.forName(authorizerConf.getClassName()).asSubclass(Authorizer.class).getConstructor().newInstance();
      String filterClazzName = authorizerConf.getContainerRequestFilter();
      ContainerRequestFilter filter;
      if (!StringUtils.isEmpty(filterClazzName)) {
        filter =
            Class.forName(filterClazzName)
                .asSubclass(ContainerRequestFilter.class)
                .getConstructor(AuthenticationConfiguration.class, AuthorizerConfiguration.class)
                .newInstance(authenticationConfiguration, authorizerConf);
        LOG.info("Registering ContainerRequestFilter: {}", filter.getClass().getCanonicalName());
        environment.jersey().register(filter);
      }
    } else {
      LOG.info("Authorizer config not set, setting noop authorizer");
      authorizer = new NoopAuthorizer();
      ContainerRequestFilter filter = new NoopFilter(authenticationConfiguration, null);
      environment.jersey().register(filter);
    }
  }

  private void registerEventFilter(OpenMetadataApplicationConfig catalogConfig, Environment environment, Jdbi jdbi) {
    if (catalogConfig.getEventHandlerConfiguration() != null) {
      ContainerResponseFilter eventFilter = new EventFilter(catalogConfig, jdbi);
      environment.jersey().register(eventFilter);
    }
  }

  private void registerEventPublisher(OpenMetadataApplicationConfig openMetadataApplicationConfig) {
    // register ElasticSearch Event publisher
    if (openMetadataApplicationConfig.getElasticSearchConfiguration() != null) {
      ElasticSearchEventPublisher elasticSearchEventPublisher =
          new ElasticSearchEventPublisher(openMetadataApplicationConfig.getElasticSearchConfiguration());
      EventPubSub.addEventHandler(elasticSearchEventPublisher);
    }
  }

  private void registerResources(
      OpenMetadataApplicationConfig config, Environment environment, Jdbi jdbi, SecretsManager secretsManager) {
    CollectionRegistry.getInstance().registerResources(jdbi, environment, config, authorizer, secretsManager);
    if (config.getElasticSearchConfiguration() != null) {
      environment.jersey().register(new SearchResource(config.getElasticSearchConfiguration()));
    }
    environment.jersey().register(new JsonPatchProvider());
    ErrorPageErrorHandler eph = new ErrorPageErrorHandler();
    eph.addErrorPage(Response.Status.NOT_FOUND.getStatusCode(), "/");
    environment.getApplicationContext().setErrorHandler(eph);
  }

  private void intializeWebsockets(OpenMetadataApplicationConfig catalogConfig, Environment environment) {
    SocketAddressFilter socketAddressFilter;
    String pathSpec = "/api/v1/push/feed/*";
    if (catalogConfig.getAuthorizerConfiguration() != null) {
      socketAddressFilter =
          new SocketAddressFilter(
              catalogConfig.getAuthenticationConfiguration(), catalogConfig.getAuthorizerConfiguration());
    } else {
      socketAddressFilter = new SocketAddressFilter();
    }

    EngineIoServerOptions eioOptions = EngineIoServerOptions.newFromDefault();
    eioOptions.setAllowedCorsOrigins(null);
    WebSocketManager.WebSocketManagerBuilder.build(eioOptions);
    environment.getApplicationContext().setContextPath("/");
    environment
        .getApplicationContext()
        .addFilter(new FilterHolder(socketAddressFilter), pathSpec, EnumSet.of(DispatcherType.REQUEST));
    environment.getApplicationContext().addServlet(new ServletHolder(new FeedServlet()), pathSpec);
    // Upgrade connection to websocket from Http
    try {
      WebSocketUpgradeFilter webSocketUpgradeFilter =
          WebSocketUpgradeFilter.configureContext(environment.getApplicationContext());
      webSocketUpgradeFilter.addMapping(
          new ServletPathSpec(pathSpec),
          (servletUpgradeRequest, servletUpgradeResponse) ->
              new JettyWebSocketHandler(WebSocketManager.getInstance().getEngineIoServer()));
    } catch (ServletException ex) {
      LOG.error("Websocket Upgrade Filter error : " + ex.getMessage());
    }
  }

  public static void main(String[] args) throws Exception {
    OpenMetadataApplication OpenMetadataApplication = new OpenMetadataApplication();
    OpenMetadataApplication.run(args);
  }

  public static class ManagedShutdown implements Managed {

    @Override
    public void start() {
      LOG.info("Starting the application");
    }

    @Override
    public void stop() throws InterruptedException {
      EventPubSub.shutdown();
      LOG.info("Stopping the application");
    }
  }
}
