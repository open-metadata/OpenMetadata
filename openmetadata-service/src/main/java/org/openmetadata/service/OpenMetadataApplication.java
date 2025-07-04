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

import static org.openmetadata.service.util.MicrometerBundleSingleton.createMicrometerBundle;

import com.fasterxml.jackson.annotation.JsonInclude;
import io.dropwizard.assets.AssetsBundle;
import io.dropwizard.core.Application;
import io.dropwizard.core.setup.Bootstrap;
import io.dropwizard.core.setup.Environment;
import io.dropwizard.db.DataSourceFactory;
import io.dropwizard.health.conf.HealthConfiguration;
import io.dropwizard.health.core.HealthCheckBundle;
import io.dropwizard.jdbi3.JdbiFactory;
import io.dropwizard.jersey.errors.EarlyEofExceptionMapper;
import io.dropwizard.jersey.errors.LoggingExceptionMapper;
import io.dropwizard.jersey.jackson.JsonProcessingExceptionMapper;
import io.dropwizard.servlets.tasks.LogConfigurationTask;
import io.federecio.dropwizard.swagger.SwaggerBundle;
import io.federecio.dropwizard.swagger.SwaggerBundleConfiguration;
import io.swagger.v3.jaxrs2.integration.resources.AcceptHeaderOpenApiResource;
import io.swagger.v3.jaxrs2.integration.resources.OpenApiResource;
import io.swagger.v3.oas.integration.SwaggerConfiguration;
import jakarta.ws.rs.container.ContainerRequestFilter;
import java.io.IOException;
import java.lang.reflect.InvocationTargetException;
import java.time.temporal.ChronoUnit;
import java.util.EnumSet;
import java.util.List;
import java.util.concurrent.atomic.AtomicBoolean;
import javax.servlet.DispatcherType;
import javax.servlet.FilterRegistration;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.StringUtils;
import org.eclipse.jetty.servlets.CrossOriginFilter;
import org.flywaydb.core.Flyway;
import org.flywaydb.core.api.configuration.FluentConfiguration;
import org.glassfish.jersey.media.multipart.MultiPartFeature;
import org.glassfish.jersey.server.ServerProperties;
import org.jdbi.v3.core.Jdbi;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.schema.api.security.AuthenticationConfiguration;
import org.openmetadata.schema.api.security.AuthorizerConfiguration;
import org.openmetadata.schema.api.security.jwt.JWTTokenConfiguration;
import org.openmetadata.schema.api.security.jwt.JWTTokenExpiry;
import org.openmetadata.schema.api.security.jwt.JWTTokenType;
import org.openmetadata.schema.services.connections.metadata.AuthProvider;
import org.openmetadata.service.apps.bundles.changeEvent.ChangeEventHandler;
import org.openmetadata.service.apps.bundles.changeEvent.ChangeEventRepository;
import org.openmetadata.service.apps.bundles.insights.DataInsightsHandler;
import org.openmetadata.service.apps.bundles.insights.DataInsightsRepository;
import org.openmetadata.service.apps.scheduler.AppScheduler;
import org.openmetadata.service.auth.NoopAuthorizer;
import org.openmetadata.service.config.OMWebBundle;
import org.openmetadata.service.config.OMWebConfiguration;
import org.openmetadata.service.exception.CatalogGenericExceptionMapper;
import org.openmetadata.service.exception.ConstraintViolationExceptionMapper;
import org.openmetadata.service.exception.JsonMappingExceptionMapper;
import org.openmetadata.service.exception.OMErrorPageHandler;
import org.openmetadata.service.exception.UnhandledExceptionMapper;
import org.openmetadata.service.exception.WebAnalyticExceptionMapper;
import org.openmetadata.service.fernet.Fernet;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.locator.ConnectionAwareAnnotationSqlLocator;
import org.openmetadata.service.jdbi3.locator.ConnectionType;
import org.openmetadata.service.migration.Migration;
import org.openmetadata.service.migration.MigrationConfiguration;
import org.openmetadata.service.migration.api.MigrationWorkflow;
import org.openmetadata.service.resources.CollectionRegistry;
import org.openmetadata.service.resources.databases.DatasourceConfig;
import org.openmetadata.service.resources.settings.SettingsCache;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.search.elasticsearch.ElasticSearchConfiguration;
import org.openmetadata.service.search.elasticsearch.ElasticSearchIndexDefinition;
import org.openmetadata.service.search.opensearch.OpenSearchConfiguration;
import org.openmetadata.service.search.opensearch.OpenSearchIndexDefinition;
import org.openmetadata.service.secrets.SecretsManager;
import org.openmetadata.service.secrets.SecretsManagerFactory;
import org.openmetadata.service.secrets.SecretsManagerUpdateService;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.auth.AuthenticatorHandler;
import org.openmetadata.service.security.auth.AuthenticationConfigurationManager;
import org.openmetadata.service.security.jwt.JWTTokenGenerator;
import org.openmetadata.service.security.saml.SamlSettingsHolder;
import org.openmetadata.service.socket.FeedServlet;
import org.openmetadata.service.socket.WebSocketManager;
import org.openmetadata.service.util.MicrometerBundleSingleton;

/** Main catalog application */
@Slf4j
@OpenAPIDefinition(
    info =
        @Info(
            title = "OpenMetadata APIs",
            version = "1.8.0",
            description = "Common types and API definition for OpenMetadata",
            contact =
                @Contact(
                    name = "OpenMetadata",
                    url = "https://open-metadata.org",
                    email = "openmetadata-dev@googlegroups.com"),
            license =
                @License(name = "Apache 2.0", url = "https://www.apache.org/licenses/LICENSE-2.0")),
    servers = {
      @Server(url = "/api", description = "Current Host"),
      @Server(url = "http://localhost:8585/api", description = "Endpoint URL")
    },
    security = @SecurityRequirement(name = "BearerAuth"))
@SecurityScheme(
    name = "BearerAuth",
    type = SecuritySchemeType.HTTP,
    scheme = "bearer",
    bearerFormat = "JWT")
public class OpenMetadataApplication extends Application<OpenMetadataApplicationConfig> {
  protected Authorizer authorizer;
  private AuthenticatorHandler authenticatorHandler;
  protected Limits limits;

  protected Jdbi jdbi;

  private OpenMetadataApplicationConfig configuration;
  private Environment environment;

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
    
    // Store config and environment for later use
    this.configuration = catalogConfig;
    this.environment = environment;

    // Validate configuration
    validateConfiguration(catalogConfig);

    // Instantiate incident severity classifier
    IncidentSeverityClassifierInterface.createInstance();

    // Initialize the IndexMapping class
    IndexMappingLoader.init(catalogConfig.getElasticSearchConfiguration());

    // init for dataSourceFactory
    DatasourceConfig.initialize(catalogConfig.getDataSourceFactory().getDriverClass());

    // Initialize HTTP and JDBI timers
    MicrometerBundleSingleton.initLatencyEvents();

    jdbi = createAndSetupJDBI(environment, catalogConfig.getDataSourceFactory());
    Entity.setCollectionDAO(getDao(jdbi));
    Entity.setJobDAO(jdbi.onDemand(JobDAO.class));
    Entity.setJdbi(jdbi);

    // Initialize AuthenticationConfigurationManager after database setup
    AuthenticationConfigurationManager.initialize(Entity.getSystemRepository(), this);
    AuthenticationConfigurationManager.getInstance().loadConfig();

    // Register Authenticator with loaded config
    registerAuthenticator(catalogConfig);

    // Initialize the MigrationValidationClient, used in the Settings Repository
    MigrationValidationClient.initialize(jdbi.onDemand(MigrationDAO.class), catalogConfig);
    // as first step register all the repositories
    Entity.initializeRepositories(catalogConfig, jdbi);

    // Configure the Fernet instance
    Fernet.getInstance().setFernetKey(catalogConfig);

    // Initialize Workflow Handler
    WorkflowHandler.initialize(catalogConfig);

    // Init Settings Cache after repositories
    SettingsCache.initialize(catalogConfig);

    initializeWebsockets(catalogConfig, environment);

    // init Secret Manager
    SecretsManagerFactory.createSecretsManager(
        catalogConfig.getSecretsManagerConfiguration(), catalogConfig.getClusterName());

    // init Entity Masker
    EntityMaskerFactory.createEntityMasker();

    // Instantiate JWT Token Generator
    JWTTokenGenerator.getInstance()
        .init(
            catalogConfig.getAuthenticationConfiguration().getTokenValidationAlgorithm(),
            catalogConfig.getJwtTokenConfiguration());

    // Set the Database type for choosing correct queries from annotations
    jdbi.getConfig(SqlObjects.class)
        .setSqlLocator(
            new ConnectionAwareAnnotationSqlLocator(
                catalogConfig.getDataSourceFactory().getDriverClass()));

    // Configure validator to use simple message interpolation
    environment.setValidator(
        Validation.byDefaultProvider()
            .configure()
            .parameterNameProvider(new CustomParameterNameProvider())
            .messageInterpolator(
                new ResourceBundleMessageInterpolator(
                    new PlatformResourceBundleLocator("jakarta.validation.ValidationMessages")))
            .buildValidatorFactory()
            .getValidator());

    // Validate flyway Migrations
    validateMigrations(jdbi, catalogConfig);

    // Register Authorizer
    registerAuthorizer(catalogConfig, environment);

    // Register Limits
    registerLimits(catalogConfig);

    // Unregister dropwizard default exception mappers
    ((DefaultServerFactory) catalogConfig.getServerFactory())
        .setRegisterDefaultExceptionMappers(false);
    environment.jersey().property(ServerProperties.RESPONSE_SET_STATUS_OVER_SEND_ERROR, true);
    environment.jersey().register(MultiPartFeature.class);

    // Exception Mappers
    registerExceptionMappers(environment);

    // Health Check
    registerHealthCheck(environment);

    // start event hub before registering publishers
    EventPubSub.start();

    ApplicationHandler.initialize(catalogConfig);
    registerResources(catalogConfig, environment, jdbi);

    // Register Event Handler
    registerEventFilter(catalogConfig, environment);

    // Register User Activity Tracking
    registerUserActivityTracking(environment);

    environment.lifecycle().manage(new ManagedShutdown());

    JobHandlerRegistry registry = getJobHandlerRegistry();
    environment
        .lifecycle()
        .manage(new GenericBackgroundWorker(jdbi.onDemand(JobDAO.class), registry));

    // Register Event publishers
    registerEventPublisher(catalogConfig);

    // start authorizer after event publishers
    // authorizer creates admin/bot users, ES publisher should start before to index users created
    // by authorizer
    authorizer.init(catalogConfig);

    // authenticationHandler Handles auth related activities
    authenticatorHandler.init(catalogConfig);

    registerMicrometerFilter(environment, catalogConfig.getEventMonitorConfiguration());

    registerSamlServlets(catalogConfig, environment);

    // Asset Servlet Registration
    registerAssetServlet(catalogConfig, catalogConfig.getWebConfiguration(), environment);

    // Register MCP
    registerMCPServer(catalogConfig, environment);

    // Handle Services Jobs
    registerHealthCheckJobs(catalogConfig);

    // Register Auth Handlers
    registerAuthServlets(catalogConfig, environment);
  }

  protected void registerMCPServer(
      OpenMetadataApplicationConfig catalogConfig, Environment environment) {
    try {
      if (ApplicationContext.getInstance().getAppIfExists("McpApplication") != null) {
        Class<?> mcpServerClass = Class.forName("org.openmetadata.mcp.McpServer");
        McpServerProvider mcpServer =
            (McpServerProvider) mcpServerClass.getDeclaredConstructor().newInstance();
        mcpServer.initializeMcpServer(environment, authorizer, limits, catalogConfig);
        LOG.info("MCP Server registered successfully");
      }
    } catch (ClassNotFoundException ex) {
      LOG.info("MCP module not found in classpath, skipping MCP server initialization");
    } catch (Exception ex) {
      LOG.error("Error initializing MCP server", ex);
    }
  }

  protected @NotNull JobHandlerRegistry getJobHandlerRegistry() {
    JobHandlerRegistry registry = new JobHandlerRegistry();
    registry.register("EnumCleanupHandler", new EnumCleanupHandler(getDao(jdbi)));
    return registry;
  }

  private void registerHealthCheckJobs(OpenMetadataApplicationConfig catalogConfig) {
    ServicesStatusJobHandler healthCheckStatusHandler =
        ServicesStatusJobHandler.create(
            catalogConfig.getEventMonitorConfiguration(),
            catalogConfig.getPipelineServiceClientConfiguration(),
            catalogConfig.getClusterName());
    healthCheckStatusHandler.addPipelineServiceStatusJob();
    healthCheckStatusHandler.addDatabaseAndSearchStatusJobs();
  }

  private void registerAuthServlets(OpenMetadataApplicationConfig config, Environment environment) {
    if (config.getAuthenticationConfiguration() != null
        && config
            .getAuthenticationConfiguration()
            .getClientType()
            .equals(ClientType.CONFIDENTIAL)) {
      CommonHelper.assertNotNull(
          "OidcConfiguration", config.getAuthenticationConfiguration().getOidcConfiguration());

      // Set up a Session Manager
      MutableServletContextHandler contextHandler = environment.getApplicationContext();
      if (contextHandler.getSessionHandler() == null) {
        contextHandler.setSessionHandler(new SessionHandler());
      }

      AuthenticationCodeFlowHandler authenticationCodeFlowHandler =
          new AuthenticationCodeFlowHandler(
              config.getAuthenticationConfiguration(), config.getAuthorizerConfiguration());

      // Register Servlets
      ServletHolder authLoginHolder =
          new ServletHolder(new AuthLoginServlet(authenticationCodeFlowHandler));
      authLoginHolder.setName("oauth_login");
      environment.getApplicationContext().addServlet(authLoginHolder, "/api/v1/auth/login");

      ServletHolder authCallbackHolder =
          new ServletHolder(new AuthCallbackServlet(authenticationCodeFlowHandler));
      authCallbackHolder.setName("auth_callback");
      environment.getApplicationContext().addServlet(authCallbackHolder, "/callback");

      ServletHolder authLogoutHolder =
          new ServletHolder(new AuthLogoutServlet(authenticationCodeFlowHandler));
      authLogoutHolder.setName("auth_logout");
      environment.getApplicationContext().addServlet(authLogoutHolder, "/api/v1/auth/logout");

      ServletHolder refreshHolder =
          new ServletHolder(new AuthRefreshServlet(authenticationCodeFlowHandler));
      refreshHolder.setName("auth_refresh");
      environment.getApplicationContext().addServlet(refreshHolder, "/api/v1/auth/refresh");
    }
  }

  protected void initializeSearchRepository(OpenMetadataApplicationConfig config) {
    // initialize Search Repository, all repositories use SearchRepository this line should always
    // before initializing repository
    SearchRepository searchRepository =
        new SearchRepository(
            config.getElasticSearchConfiguration(), config.getDataSourceFactory().getMaxSize());
    Entity.setSearchRepository(searchRepository);
  }

  private void registerHealthCheck(Environment environment) {
    environment
        .healthChecks()
        .register("OpenMetadataServerHealthCheck", new OpenMetadataServerHealthCheck());
  }

  private void registerExceptionMappers(Environment environment) {
    environment.jersey().register(CatalogGenericExceptionMapper.class);
    // Override constraint violation mapper to catch Json validation errors
    environment.jersey().register(new ConstraintViolationExceptionMapper());
    // Restore dropwizard default exception mappers
    environment.jersey().register(new LoggingExceptionMapper<>() {});
    environment.jersey().register(new JsonProcessingExceptionMapper(true));
    environment.jersey().register(new EarlyEofExceptionMapper());
    environment.jersey().register(JsonMappingExceptionMapper.class);
  }

  private void registerMicrometerFilter(
      Environment environment, EventMonitorConfiguration eventMonitorConfiguration) {
    FilterRegistration.Dynamic micrometerFilter =
        environment.servlets().addFilter("OMMicrometerHttpFilter", OMMicrometerHttpFilter.class);

    micrometerFilter.addMappingForUrlPatterns(
        EnumSet.allOf(DispatcherType.class), true, eventMonitorConfiguration.getPathPattern());
  }

  private void registerAssetServlet(
      OpenMetadataApplicationConfig config,
      OMWebConfiguration webConfiguration,
      Environment environment) {

    // Handle Asset Using Servlet
    OpenMetadataAssetServlet assetServlet =
        new OpenMetadataAssetServlet(
            config.getBasePath(), "/assets", "/", "index.html", webConfiguration);
    environment.servlets().addServlet("static", assetServlet).addMapping("/*");
  }

  protected CollectionDAO getDao(Jdbi jdbi) {
    return jdbi.onDemand(CollectionDAO.class);
  }

  private void registerSamlServlets(
      OpenMetadataApplicationConfig catalogConfig, Environment environment)
      throws IOException, CertificateException, KeyStoreException, NoSuchAlgorithmException {

    if (catalogConfig.getAuthenticationConfiguration() != null
        && catalogConfig.getAuthenticationConfiguration().getProvider().equals(AuthProvider.SAML)) {

      // Ensure we have a session handler
      MutableServletContextHandler contextHandler = environment.getApplicationContext();
      if (contextHandler.getSessionHandler() == null) {
        contextHandler.setSessionHandler(new SessionHandler());
      }

      // Initialize default SAML settings (e.g. IDP metadata, SP keys, etc.)
      SamlSettingsHolder.getInstance().initDefaultSettings(catalogConfig);
      contextHandler.addServlet(new ServletHolder(new SamlLoginServlet()), "/api/v1/saml/login");
      contextHandler.addServlet(
          new ServletHolder(
              new SamlAssertionConsumerServlet(catalogConfig.getAuthorizerConfiguration())),
          "/api/v1/saml/acs");
      contextHandler.addServlet(
          new ServletHolder(new SamlMetadataServlet()), "/api/v1/saml/metadata");
      contextHandler.addServlet(
          new ServletHolder(new SamlTokenRefreshServlet()), "/api/v1/saml/refresh");
      contextHandler.addServlet(
          new ServletHolder(
              new SamlLogoutServlet(
                  catalogConfig.getAuthenticationConfiguration(),
                  catalogConfig.getAuthorizerConfiguration())),
          "/api/v1/saml/logout");
    }
  }

  @SneakyThrows
  @Override
  public void initialize(Bootstrap<OpenMetadataApplicationConfig> bootstrap) {
    bootstrap.setConfigurationSourceProvider(
        new SubstitutingSourceProvider(
            bootstrap.getConfigurationSourceProvider(), new EnvironmentVariableSubstitutor(false)));

    // Register custom filter factories
    bootstrap
        .getObjectMapper()
        .registerSubtypes(
            org.openmetadata.service.events.AuditOnlyFilterFactory.class,
            org.openmetadata.service.events.AuditExcludeFilterFactory.class);

    bootstrap.addBundle(
        new SwaggerBundle<>() {
          @Override
          protected SwaggerBundleConfiguration getSwaggerBundleConfiguration(
              OpenMetadataApplicationConfig catalogConfig) {
            return catalogConfig.getSwaggerBundleConfig();
          }
        });

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
        ConnectionType.from(conf.getDataSourceFactory().getDriverClass());
    MigrationWorkflow migrationWorkflow =
        new MigrationWorkflow(
            jdbi,
            conf.getMigrationConfiguration().getNativePath(),
            connectionType,
            conf.getMigrationConfiguration().getExtensionPath(),
            conf,
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

  private void registerLimits(OpenMetadataApplicationConfig serverConfig)
      throws NoSuchMethodException,
          ClassNotFoundException,
          IllegalAccessException,
          InvocationTargetException,
          InstantiationException {
    LimitsConfiguration limitsConfiguration = serverConfig.getLimitsConfiguration();
    if (limitsConfiguration != null && limitsConfiguration.getEnable()) {
      limits =
          Class.forName(limitsConfiguration.getClassName())
              .asSubclass(Limits.class)
              .getConstructor()
              .newInstance();
    } else {
      LOG.info("Limits config not set, setting DefaultLimits");
      limits = new DefaultLimits();
    }
    limits.init(serverConfig, jdbi);
  }

  private void registerEventFilter(
      OpenMetadataApplicationConfig catalogConfig, Environment environment) {
    if (catalogConfig.getEventHandlerConfiguration() != null) {
      ContainerResponseFilter eventFilter = new EventFilter(catalogConfig);
      environment.jersey().register(eventFilter);
    }
  }

  private void registerUserActivityTracking(Environment environment) {
    // Register the activity tracking filter
    environment.jersey().register(UserActivityFilter.class);

    // Register lifecycle management for UserActivityTracker
    environment
        .lifecycle()
        .manage(
            new Managed() {
              @Override
              public void start() {
                // UserActivityTracker starts automatically on first use
              }

              @Override
              public void stop() {
                UserActivityTracker.getInstance().shutdown();
              }
            });
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
        .registerResources(jdbi, environment, config, authorizer, authenticatorHandler, limits);
    environment.jersey().register(new JsonPatchProvider());
    environment.jersey().register(new JsonPatchMessageBodyReader());
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
    FilterHolder socketAddressFilterHolder = new FilterHolder();
    socketAddressFilterHolder.setFilter(socketAddressFilter);
    environment
        .getApplicationContext()
        .addFilter(socketAddressFilterHolder, pathSpec, EnumSet.of(DispatcherType.REQUEST));
    environment.getApplicationContext().addServlet(new ServletHolder(new FeedServlet()), pathSpec);
    // Upgrade connection to websocket from Http
    try {
      JettyWebSocketServletContainerInitializer.configure(
          environment.getApplicationContext(),
          (servletContext, wsContainer) -> {
            wsContainer.setMaxTextMessageSize(65535);
            wsContainer.setMaxBinaryMessageSize(65535);

            // Register endpoint using Jetty WebSocket API
            wsContainer.addMapping(
                pathSpec,
                (req, resp) ->
                    new JettyWebSocketHandler(WebSocketManager.getInstance().getEngineIoServer()));
          });
    } catch (Exception ex) {
      LOG.error("Websocket configuration error: {}", ex.getMessage());
    }
  }

  public AuthenticatorHandler getAuthenticatorHandler() {
    return authenticatorHandler;
  }

  public OpenMetadataApplicationConfig getConfiguration() {
    return configuration;
  }

  public void reinitializeAuthHandlers(OpenMetadataApplicationConfig config) {
    try {
        LOG.info("Reinitializing authentication handlers");
        
        // Get the current auth provider
        String currentProvider = config.getAuthenticationConfiguration().getProvider();
        
        // Reinitialize the authenticator handler
        authenticatorHandler.reload(config);
        
        // Reload servlets if needed
        if (currentProvider != null && !currentProvider.equals(config.getAuthenticationConfiguration().getProvider())) {
            reloadAuthServlets(config);
        }
        
        LOG.info("Successfully reinitialized authentication handlers");
    } catch (Exception e) {
        LOG.error("Failed to reinitialize authentication handlers", e);
        throw new RuntimeException("Failed to reinitialize authentication handlers", e);
    }
}

private void reloadAuthServlets(OpenMetadataApplicationConfig config) {
    try {
        LOG.info("Reloading authentication servlets");
        
        // Remove existing auth servlets
        for (String path : environment.servlets().getServlets().keySet()) {
            if (path.startsWith("/api/v1/auth/")) {
                environment.servlets().removeServlet(path);
            }
        }
        
        // Register new auth servlets based on the provider
        registerAuthServlets(config);
        
        LOG.info("Successfully reloaded authentication servlets");
    } catch (Exception e) {
        LOG.error("Failed to reload authentication servlets", e);
        throw new RuntimeException("Failed to reload authentication servlets", e);
    }
}

private void registerAuthServlets(OpenMetadataApplicationConfig config) {
    // Add provider-specific servlets based on the authentication configuration
    String provider = config.getAuthenticationConfiguration().getProvider();
    
    switch (provider.toLowerCase()) {
        case "google":
            environment.servlets().addServlet("googleAuthServlet", new GoogleAuthServlet())
                .addMapping("/api/v1/auth/google/*");
            break;
        case "okta":
            environment.servlets().addServlet("oktaAuthServlet", new OktaAuthServlet())
                .addMapping("/api/v1/auth/okta/*");
            break;
        case "auth0":
            environment.servlets().addServlet("auth0AuthServlet", new Auth0AuthServlet())
                .addMapping("/api/v1/auth/auth0/*");
            break;
        case "azure":
            environment.servlets().addServlet("azureAuthServlet", new AzureAuthServlet())
                .addMapping("/api/v1/auth/azure/*");
            break;
        case "custom-oidc":
            environment.servlets().addServlet("customOidcAuthServlet", new CustomOidcAuthServlet())
                .addMapping("/api/v1/auth/custom-oidc/*");
            break;
        // Add more cases for other providers
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
