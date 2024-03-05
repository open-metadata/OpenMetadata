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

import static org.openmetadata.service.util.MicrometerBundleSingleton.setWebAnalyticsEvents;

import io.dropwizard.Application;
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
import io.socket.engineio.server.EngineIoServerOptions;
import io.socket.engineio.server.JettyWebSocketHandler;
import java.io.IOException;
import java.lang.reflect.InvocationTargetException;
import java.security.KeyStoreException;
import java.security.NoSuchAlgorithmException;
import java.security.cert.CertificateException;
import java.time.temporal.ChronoUnit;
import java.util.EnumSet;
import java.util.Optional;
import javax.naming.ConfigurationException;
import javax.servlet.DispatcherType;
import javax.servlet.FilterRegistration;
import javax.servlet.ServletException;
import javax.servlet.ServletRegistration;
import javax.ws.rs.container.ContainerRequestFilter;
import javax.ws.rs.container.ContainerResponseFilter;
import javax.ws.rs.core.Response;
import lombok.SneakyThrows;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.StringUtils;
import org.eclipse.jetty.http.pathmap.ServletPathSpec;
import org.eclipse.jetty.servlet.FilterHolder;
import org.eclipse.jetty.servlet.ServletHolder;
import org.eclipse.jetty.websocket.server.NativeWebSocketServletContainerInitializer;
import org.eclipse.jetty.websocket.server.WebSocketUpgradeFilter;
import org.glassfish.jersey.media.multipart.MultiPartFeature;
import org.glassfish.jersey.server.ServerProperties;
import org.jdbi.v3.core.Jdbi;
import org.jdbi.v3.core.statement.SqlLogger;
import org.jdbi.v3.core.statement.StatementContext;
import org.jdbi.v3.sqlobject.SqlObjects;
import org.openmetadata.schema.api.security.AuthenticationConfiguration;
import org.openmetadata.schema.api.security.AuthorizerConfiguration;
import org.openmetadata.schema.services.connections.metadata.AuthProvider;
import org.openmetadata.service.apps.scheduler.AppScheduler;
import org.openmetadata.service.config.OMWebBundle;
import org.openmetadata.service.config.OMWebConfiguration;
import org.openmetadata.service.events.EventFilter;
import org.openmetadata.service.events.EventPubSub;
import org.openmetadata.service.events.scheduled.EventSubscriptionScheduler;
import org.openmetadata.service.events.scheduled.PipelineServiceStatusJobHandler;
import org.openmetadata.service.exception.CatalogGenericExceptionMapper;
import org.openmetadata.service.exception.ConstraintViolationExceptionMapper;
import org.openmetadata.service.exception.JsonMappingExceptionMapper;
import org.openmetadata.service.exception.OMErrorPageHandler;
import org.openmetadata.service.fernet.Fernet;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.jdbi3.locator.ConnectionAwareAnnotationSqlLocator;
import org.openmetadata.service.jdbi3.locator.ConnectionType;
import org.openmetadata.service.migration.Migration;
import org.openmetadata.service.migration.api.MigrationWorkflow;
import org.openmetadata.service.monitoring.EventMonitor;
import org.openmetadata.service.monitoring.EventMonitorFactory;
import org.openmetadata.service.monitoring.EventMonitorPublisher;
import org.openmetadata.service.resources.CollectionRegistry;
import org.openmetadata.service.resources.databases.DatasourceConfig;
import org.openmetadata.service.resources.settings.SettingsCache;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.secrets.SecretsManager;
import org.openmetadata.service.secrets.SecretsManagerFactory;
import org.openmetadata.service.secrets.SecretsManagerUpdateService;
import org.openmetadata.service.secrets.masker.EntityMaskerFactory;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.NoopAuthorizer;
import org.openmetadata.service.security.NoopFilter;
import org.openmetadata.service.security.auth.AuthenticatorHandler;
import org.openmetadata.service.security.auth.BasicAuthenticator;
import org.openmetadata.service.security.auth.LdapAuthenticator;
import org.openmetadata.service.security.auth.NoopAuthenticator;
import org.openmetadata.service.security.jwt.JWTTokenGenerator;
import org.openmetadata.service.security.saml.OMMicrometerHttpFilter;
import org.openmetadata.service.security.saml.SamlAssertionConsumerServlet;
import org.openmetadata.service.security.saml.SamlLoginServlet;
import org.openmetadata.service.security.saml.SamlMetadataServlet;
import org.openmetadata.service.security.saml.SamlSettingsHolder;
import org.openmetadata.service.socket.FeedServlet;
import org.openmetadata.service.socket.OpenMetadataAssetServlet;
import org.openmetadata.service.socket.SocketAddressFilter;
import org.openmetadata.service.socket.WebSocketManager;
import org.openmetadata.service.util.MicrometerBundleSingleton;
import org.openmetadata.service.util.incidentSeverityClassifier.IncidentSeverityClassifierInterface;
import org.openmetadata.service.util.jdbi.DatabaseAuthenticationProviderFactory;
import org.quartz.SchedulerException;

/** Main catalog application */
@Slf4j
public class OpenMetadataApplication extends Application<OpenMetadataApplicationConfig> {
  private Authorizer authorizer;
  private AuthenticatorHandler authenticatorHandler;

  protected Jdbi jdbi;

  @Override
  public void run(OpenMetadataApplicationConfig catalogConfig, Environment environment)
      throws ClassNotFoundException,
          IllegalAccessException,
          InstantiationException,
          NoSuchMethodException,
          InvocationTargetException,
          IOException,
          ConfigurationException,
          CertificateException,
          KeyStoreException,
          NoSuchAlgorithmException {
    validateConfiguration(catalogConfig);

    // Instantiate incident severity classifier
    IncidentSeverityClassifierInterface.createInstance(catalogConfig.getDataQualityConfiguration());

    // init for dataSourceFactory
    DatasourceConfig.initialize(catalogConfig.getDataSourceFactory().getDriverClass());

    jdbi = createAndSetupJDBI(environment, catalogConfig.getDataSourceFactory());
    CollectionDAO collectionDAO = jdbi.onDemand(CollectionDAO.class);
    Entity.setCollectionDAO(collectionDAO);

    // initialize Search Repository, all repositories use SearchRepository this line should always
    // before initializing repository
    new SearchRepository(catalogConfig.getElasticSearchConfiguration());
    // as first step register all the repositories
    Entity.initializeRepositories(catalogConfig, jdbi);

    // Init Settings Cache after repositories
    SettingsCache.initialize(catalogConfig);

    // Configure the Fernet instance
    Fernet.getInstance().setFernetKey(catalogConfig);

    // init Secret Manager
    final SecretsManager secretsManager =
        SecretsManagerFactory.createSecretsManager(
            catalogConfig.getSecretsManagerConfiguration(), catalogConfig.getClusterName());

    // init Entity Masker
    EntityMaskerFactory.createEntityMasker();

    // Instantiate JWT Token Generator
    JWTTokenGenerator.getInstance().init(catalogConfig.getJwtTokenConfiguration());

    // Set the Database type for choosing correct queries from annotations
    jdbi.getConfig(SqlObjects.class)
        .setSqlLocator(
            new ConnectionAwareAnnotationSqlLocator(
                catalogConfig.getDataSourceFactory().getDriverClass()));

    // Validate flyway Migrations
    validateMigrations(jdbi, catalogConfig);

    // Register Authorizer
    registerAuthorizer(catalogConfig, environment);

    // Register Authenticator
    registerAuthenticator(catalogConfig);

    // Unregister dropwizard default exception mappers
    ((DefaultServerFactory) catalogConfig.getServerFactory())
        .setRegisterDefaultExceptionMappers(false);
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
    environment
        .healthChecks()
        .register("OpenMetadataServerHealthCheck", new OpenMetadataServerHealthCheck());
    // start event hub before registering publishers
    EventPubSub.start();

    registerResources(catalogConfig, environment, jdbi);

    // Register Event Handler
    registerEventFilter(catalogConfig, environment);
    environment.lifecycle().manage(new ManagedShutdown());
    // Register Event publishers
    registerEventPublisher(catalogConfig);

    // update entities secrets if required
    new SecretsManagerUpdateService(secretsManager, catalogConfig.getClusterName())
        .updateEntities();

    // start authorizer after event publishers
    // authorizer creates admin/bot users, ES publisher should start before to index users created
    // by authorizer
    authorizer.init(catalogConfig);

    // authenticationHandler Handles auth related activities
    authenticatorHandler.init(catalogConfig);

    setWebAnalyticsEvents(catalogConfig);
    FilterRegistration.Dynamic micrometerFilter =
        environment.servlets().addFilter("OMMicrometerHttpFilter", new OMMicrometerHttpFilter());
    micrometerFilter.addMappingForUrlPatterns(
        EnumSet.allOf(DispatcherType.class),
        true,
        catalogConfig.getEventMonitorConfiguration().getPathPattern());
    initializeWebsockets(catalogConfig, environment);
    registerSamlHandlers(catalogConfig, environment);

    // Handle Asset Using Servlet
    OpenMetadataAssetServlet assetServlet =
        new OpenMetadataAssetServlet(
            "/assets", "/", "index.html", catalogConfig.getWebConfiguration());
    String pathPattern = "/" + '*';
    environment.servlets().addServlet("static", assetServlet).addMapping(pathPattern);

    // Handle Pipeline Service Client Status job
    PipelineServiceStatusJobHandler pipelineServiceStatusJobHandler =
        PipelineServiceStatusJobHandler.create(
            catalogConfig.getPipelineServiceClientConfiguration(), catalogConfig.getClusterName());
    pipelineServiceStatusJobHandler.addPipelineServiceStatusJob();
  }

  private void registerSamlHandlers(
      OpenMetadataApplicationConfig catalogConfig, Environment environment)
      throws IOException, CertificateException, KeyStoreException, NoSuchAlgorithmException {
    if (catalogConfig.getAuthenticationConfiguration() != null
        && catalogConfig.getAuthenticationConfiguration().getProvider().equals(AuthProvider.SAML)) {
      SamlSettingsHolder.getInstance().initDefaultSettings(catalogConfig);
      ServletRegistration.Dynamic samlRedirectServlet =
          environment.servlets().addServlet("saml_login", new SamlLoginServlet());
      samlRedirectServlet.addMapping("/api/v1/saml/login");
      ServletRegistration.Dynamic samlReceiverServlet =
          environment.servlets().addServlet("saml_acs", new SamlAssertionConsumerServlet());
      samlReceiverServlet.addMapping("/api/v1/saml/acs");
      ServletRegistration.Dynamic samlMetadataServlet =
          environment.servlets().addServlet("saml_metadata", new SamlMetadataServlet());
      samlMetadataServlet.addMapping("/api/v1/saml/metadata");
    }
  }

  private Jdbi createAndSetupJDBI(Environment environment, DataSourceFactory dbFactory) {
    // Check for db auth providers.
    DatabaseAuthenticationProviderFactory.get(dbFactory.getUrl())
        .ifPresent(
            databaseAuthenticationProvider -> {
              String token =
                  databaseAuthenticationProvider.authenticate(
                      dbFactory.getUrl(), dbFactory.getUser(), dbFactory.getPassword());
              dbFactory.setPassword(token);
            });

    Jdbi jdbi = new JdbiFactory().build(environment, dbFactory, "database");
    SqlLogger sqlLogger =
        new SqlLogger() {
          @Override
          public void logBeforeExecution(StatementContext context) {
            LOG.debug("sql {}, parameters {}", context.getRenderedSql(), context.getBinding());
          }

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
    jdbi.getConfig(SqlObjects.class)
        .setSqlLocator(new ConnectionAwareAnnotationSqlLocator(dbFactory.getDriverClass()));

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
    bootstrap.addBundle(
        new HealthCheckBundle<>() {
          @Override
          protected HealthConfiguration getHealthConfiguration(
              final OpenMetadataApplicationConfig configuration) {
            return configuration.getHealthConfiguration();
          }
        });
    bootstrap.addBundle(MicrometerBundleSingleton.getInstance());
    bootstrap.addBundle(
        new OMWebBundle<>() {
          @Override
          public OMWebConfiguration getWebConfiguration(
              final OpenMetadataApplicationConfig configuration) {
            return configuration.getWebConfiguration();
          }
        });
    super.initialize(bootstrap);
  }

  private void validateMigrations(Jdbi jdbi, OpenMetadataApplicationConfig conf)
      throws IOException {
    LOG.info("Validating Flyway migrations");
    Optional<String> lastMigrated = Migration.lastMigrated(jdbi);
    String maxMigration = Migration.lastMigrationFile(conf.getMigrationConfiguration());
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

    LOG.info("Validating native migrations");
    ConnectionType connectionType =
        ConnectionType.from(conf.getDataSourceFactory().getDriverClass());
    MigrationWorkflow migrationWorkflow =
        new MigrationWorkflow(
            jdbi,
            conf.getMigrationConfiguration().getNativePath(),
            connectionType,
            conf.getMigrationConfiguration().getExtensionPath(),
            false);
    migrationWorkflow.loadMigrations();
    migrationWorkflow.validateMigrationsForServer();
  }

  private void validateConfiguration(OpenMetadataApplicationConfig catalogConfig)
      throws ConfigurationException {
    if (catalogConfig.getAuthorizerConfiguration().getBotPrincipals() != null) {
      throw new ConfigurationException(
          "'botPrincipals' configuration is deprecated. Please remove it from "
              + "'openmetadata.yaml and restart the server");
    }
    if (catalogConfig.getPipelineServiceClientConfiguration().getAuthConfig() != null) {
      LOG.warn(
          "'authProvider' and 'authConfig' from the 'pipelineServiceClientConfiguration' option are deprecated and will be removed in future releases.");
    }
  }

  private void registerAuthorizer(
      OpenMetadataApplicationConfig catalogConfig, Environment environment)
      throws NoSuchMethodException,
          ClassNotFoundException,
          IllegalAccessException,
          InvocationTargetException,
          InstantiationException {
    AuthorizerConfiguration authorizerConf = catalogConfig.getAuthorizerConfiguration();
    AuthenticationConfiguration authenticationConfiguration =
        catalogConfig.getAuthenticationConfiguration();
    // to authenticate request while opening websocket connections
    if (authorizerConf != null) {
      authorizer =
          Class.forName(authorizerConf.getClassName())
              .asSubclass(Authorizer.class)
              .getConstructor()
              .newInstance();
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

  private void registerAuthenticator(OpenMetadataApplicationConfig catalogConfig) {
    AuthenticationConfiguration authenticationConfiguration =
        catalogConfig.getAuthenticationConfiguration();
    switch (authenticationConfiguration.getProvider()) {
      case BASIC -> authenticatorHandler = new BasicAuthenticator();
      case LDAP -> authenticatorHandler = new LdapAuthenticator();
      default ->
      // For all other types, google, okta etc. auth is handled externally
      authenticatorHandler = new NoopAuthenticator();
    }
  }

  private void registerEventFilter(
      OpenMetadataApplicationConfig catalogConfig, Environment environment) {
    if (catalogConfig.getEventHandlerConfiguration() != null) {
      ContainerResponseFilter eventFilter = new EventFilter(catalogConfig);
      environment.jersey().register(eventFilter);
    }
  }

  private void registerEventPublisher(OpenMetadataApplicationConfig openMetadataApplicationConfig) {

    if (openMetadataApplicationConfig.getEventMonitorConfiguration() != null) {
      final EventMonitor eventMonitor =
          EventMonitorFactory.createEventMonitor(
              openMetadataApplicationConfig.getEventMonitorConfiguration(),
              openMetadataApplicationConfig.getClusterName());
      EventMonitorPublisher eventMonitorPublisher =
          new EventMonitorPublisher(
              openMetadataApplicationConfig.getEventMonitorConfiguration(), eventMonitor);
      EventPubSub.addEventHandler(eventMonitorPublisher);
    }
  }

  private void registerResources(
      OpenMetadataApplicationConfig config, Environment environment, Jdbi jdbi) {
    CollectionRegistry.initialize();
    CollectionRegistry.getInstance()
        .registerResources(jdbi, environment, config, authorizer, authenticatorHandler);
    environment.jersey().register(new JsonPatchProvider());
    OMErrorPageHandler eph = new OMErrorPageHandler(config.getWebConfiguration());
    eph.addErrorPage(Response.Status.NOT_FOUND.getStatusCode(), "/");
    environment.getApplicationContext().setErrorHandler(eph);
  }

  private void initializeWebsockets(
      OpenMetadataApplicationConfig catalogConfig, Environment environment) {
    SocketAddressFilter socketAddressFilter;
    String pathSpec = "/api/v1/push/feed/*";
    if (catalogConfig.getAuthorizerConfiguration() != null) {
      socketAddressFilter =
          new SocketAddressFilter(
              catalogConfig.getAuthenticationConfiguration(),
              catalogConfig.getAuthorizerConfiguration());
    } else {
      socketAddressFilter = new SocketAddressFilter();
    }

    EngineIoServerOptions eioOptions = EngineIoServerOptions.newFromDefault();
    eioOptions.setAllowedCorsOrigins(null);
    WebSocketManager.WebSocketManagerBuilder.build(eioOptions);
    environment.getApplicationContext().setContextPath("/");
    environment
        .getApplicationContext()
        .addFilter(
            new FilterHolder(socketAddressFilter), pathSpec, EnumSet.of(DispatcherType.REQUEST));
    environment.getApplicationContext().addServlet(new ServletHolder(new FeedServlet()), pathSpec);
    // Upgrade connection to websocket from Http
    try {
      WebSocketUpgradeFilter.configure(environment.getApplicationContext());
      NativeWebSocketServletContainerInitializer.configure(
          environment.getApplicationContext(),
          (context, container) ->
              container.addMapping(
                  new ServletPathSpec(pathSpec),
                  (servletUpgradeRequest, servletUpgradeResponse) ->
                      new JettyWebSocketHandler(
                          WebSocketManager.getInstance().getEngineIoServer())));
    } catch (ServletException ex) {
      LOG.error("Websocket Upgrade Filter error : " + ex.getMessage());
    }
  }

  public static void main(String[] args) throws Exception {
    OpenMetadataApplication openMetadataApplication = new OpenMetadataApplication();
    openMetadataApplication.run(args);
  }

  public static class ManagedShutdown implements Managed {

    @Override
    public void start() {
      LOG.info("Starting the application");
    }

    @Override
    public void stop() throws InterruptedException, SchedulerException {
      LOG.info("Cache with Id Stats {}", EntityRepository.CACHE_WITH_ID.stats());
      LOG.info("Cache with name Stats {}", EntityRepository.CACHE_WITH_NAME.stats());
      EventPubSub.shutdown();
      AppScheduler.shutDown();
      EventSubscriptionScheduler.shutDown();
      LOG.info("Stopping the application");
    }
  }
}
