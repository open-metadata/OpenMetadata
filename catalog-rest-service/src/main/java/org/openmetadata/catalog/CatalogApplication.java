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
import org.openmetadata.catalog.elasticsearch.ElasticSearchEventPublisher;
import org.openmetadata.catalog.events.EventFilter;
import org.openmetadata.catalog.events.EventPubSub;
import org.openmetadata.catalog.exception.CatalogGenericExceptionMapper;
import org.openmetadata.catalog.exception.ConstraintViolationExceptionMapper;
import org.openmetadata.catalog.exception.JsonMappingExceptionMapper;
import org.openmetadata.catalog.fernet.Fernet;
import org.openmetadata.catalog.jdbi3.locator.ConnectionAwareAnnotationSqlLocator;
import org.openmetadata.catalog.migration.Migration;
import org.openmetadata.catalog.migration.MigrationConfiguration;
import org.openmetadata.catalog.resources.CollectionRegistry;
import org.openmetadata.catalog.resources.search.SearchResource;
import org.openmetadata.catalog.secrets.SecretsManager;
import org.openmetadata.catalog.secrets.SecretsManagerFactory;
import org.openmetadata.catalog.security.AuthenticationConfiguration;
import org.openmetadata.catalog.security.Authorizer;
import org.openmetadata.catalog.security.AuthorizerConfiguration;
import org.openmetadata.catalog.security.NoopAuthorizer;
import org.openmetadata.catalog.security.NoopFilter;
import org.openmetadata.catalog.security.jwt.JWTTokenGenerator;
import org.openmetadata.catalog.security.policyevaluator.PolicyEvaluator;
import org.openmetadata.catalog.security.policyevaluator.RoleEvaluator;
import org.openmetadata.catalog.socket.FeedServlet;
import org.openmetadata.catalog.socket.SocketAddressFilter;
import org.openmetadata.catalog.socket.WebSocketManager;

/** Main catalog application */
@Slf4j
public class CatalogApplication extends Application<CatalogApplicationConfig> {
  private Authorizer authorizer;

  @Override
  public void run(CatalogApplicationConfig catalogConfig, Environment environment)
      throws ClassNotFoundException, IllegalAccessException, InstantiationException, NoSuchMethodException,
          InvocationTargetException, IOException {
    final Jdbi jdbi = new JdbiFactory().build(environment, catalogConfig.getDataSourceFactory(), "database");
    jdbi.setTimingCollector(new MicrometerJdbiTimingCollector());

    final SecretsManager secretsManager =
        SecretsManagerFactory.createSecretsManager(catalogConfig.getSecretsManagerConfiguration());

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
    registerResources(catalogConfig, environment, jdbi, secretsManager);
    RoleEvaluator.getInstance().load();
    PolicyEvaluator.getInstance().load();

    // Register Event Handler
    registerEventFilter(catalogConfig, environment, jdbi);
    environment.lifecycle().manage(new ManagedShutdown());
    // start event hub before registering publishers
    EventPubSub.start();
    // Register Event publishers
    registerEventPublisher(catalogConfig);

    // start authorizer after event publishers
    // authorizer creates admin/bot users, ES publisher should start before to index users created by authorizer
    authorizer.init(catalogConfig.getAuthorizerConfiguration(), jdbi);
    FilterRegistration.Dynamic micrometerFilter =
        environment.servlets().addFilter("MicrometerHttpFilter", new MicrometerHttpFilter());
    micrometerFilter.addMappingForUrlPatterns(EnumSet.allOf(DispatcherType.class), true, "/*");
    intializeWebsockets(catalogConfig, environment);
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
              + " https://docs.open-metadata.org/install/upgrade-openmetadata");
    }
  }

  private void registerAuthorizer(CatalogApplicationConfig catalogConfig, Environment environment)
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
  }

  private void registerResources(
      CatalogApplicationConfig config, Environment environment, Jdbi jdbi, SecretsManager secretsManager) {
    CollectionRegistry.getInstance().registerResources(jdbi, environment, config, authorizer, secretsManager);
    if (config.getElasticSearchConfiguration() != null) {
      environment.jersey().register(new SearchResource(config.getElasticSearchConfiguration()));
    }
    environment.jersey().register(new JsonPatchProvider());
    ErrorPageErrorHandler eph = new ErrorPageErrorHandler();
    eph.addErrorPage(Response.Status.NOT_FOUND.getStatusCode(), "/");
    environment.getApplicationContext().setErrorHandler(eph);
  }

  private void intializeWebsockets(CatalogApplicationConfig catalogConfig, Environment environment) {
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
    CatalogApplication catalogApplication = new CatalogApplication();
    catalogApplication.run(args);
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
