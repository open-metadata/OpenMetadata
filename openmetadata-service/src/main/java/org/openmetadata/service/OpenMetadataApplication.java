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

import io.dropwizard.configuration.EnvironmentVariableSubstitutor;
import io.dropwizard.configuration.SubstitutingSourceProvider;
import io.dropwizard.core.Application;
import io.dropwizard.core.server.DefaultServerFactory;
import io.dropwizard.core.setup.Bootstrap;
import io.dropwizard.core.setup.Environment;
import io.dropwizard.jersey.errors.EarlyEofExceptionMapper;
import io.dropwizard.jersey.errors.LoggingExceptionMapper;
import io.dropwizard.jersey.jackson.JsonProcessingExceptionMapper;
import io.dropwizard.jetty.ConnectorFactory;
import io.dropwizard.jetty.HttpConnectorFactory;
import io.dropwizard.jetty.HttpsConnectorFactory;
import io.dropwizard.jetty.MutableServletContextHandler;
import io.dropwizard.lifecycle.Managed;
import io.socket.engineio.server.EngineIoServerOptions;
import io.swagger.v3.oas.annotations.OpenAPIDefinition;
import io.swagger.v3.oas.annotations.enums.SecuritySchemeType;
import io.swagger.v3.oas.annotations.info.Contact;
import io.swagger.v3.oas.annotations.info.Info;
import io.swagger.v3.oas.annotations.info.License;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.security.SecurityScheme;
import io.swagger.v3.oas.annotations.servers.Server;
import jakarta.servlet.DispatcherType;
import jakarta.servlet.FilterRegistration;
import jakarta.servlet.SessionCookieConfig;
import jakarta.validation.Validation;
import jakarta.ws.rs.container.ContainerRequestFilter;
import jakarta.ws.rs.container.ContainerResponseFilter;
import jakarta.ws.rs.core.Response;
import java.io.IOException;
import java.lang.reflect.InvocationTargetException;
import java.security.KeyStoreException;
import java.security.NoSuchAlgorithmException;
import java.security.cert.CertificateException;
import java.util.Collections;
import java.util.EnumSet;
import java.util.List;
import java.util.Objects;
import javax.naming.ConfigurationException;
import lombok.SneakyThrows;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.StringUtils;
import org.eclipse.jetty.ee10.servlet.FilterHolder;
import org.eclipse.jetty.ee10.servlet.ServletHandler;
import org.eclipse.jetty.ee10.servlet.ServletHolder;
import org.eclipse.jetty.ee10.servlet.ServletMapping;
import org.eclipse.jetty.ee10.servlet.SessionHandler;
import org.eclipse.jetty.ee10.websocket.server.config.JettyWebSocketServletContainerInitializer;
import org.eclipse.jetty.http.UriCompliance;
import org.glassfish.jersey.media.multipart.MultiPartFeature;
import org.glassfish.jersey.server.ServerProperties;
import org.hibernate.validator.messageinterpolation.ResourceBundleMessageInterpolator;
import org.hibernate.validator.resourceloading.PlatformResourceBundleLocator;
import org.jdbi.v3.core.Jdbi;
import org.jdbi.v3.sqlobject.SqlObjects;
import org.jetbrains.annotations.NotNull;
import org.openmetadata.schema.api.configuration.rdf.RdfConfiguration;
import org.openmetadata.schema.api.security.AuthenticationConfiguration;
import org.openmetadata.schema.api.security.AuthorizerConfiguration;
import org.openmetadata.schema.configuration.LimitsConfiguration;
import org.openmetadata.schema.services.connections.metadata.AuthProvider;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.search.IndexMappingLoader;
import org.openmetadata.service.apps.ApplicationContext;
import org.openmetadata.service.apps.ApplicationHandler;
import org.openmetadata.service.apps.McpServerProvider;
import org.openmetadata.service.apps.bundles.searchIndex.distributed.DistributedJobParticipant;
import org.openmetadata.service.apps.bundles.searchIndex.distributed.ServerIdentityResolver;
import org.openmetadata.service.apps.scheduler.AppScheduler;
import org.openmetadata.service.audit.AuditLogEventPublisher;
import org.openmetadata.service.audit.AuditLogRepository;
import org.openmetadata.service.cache.CacheConfig;
import org.openmetadata.service.config.OMWebBundle;
import org.openmetadata.service.config.OMWebConfiguration;
import org.openmetadata.service.events.EventFilter;
import org.openmetadata.service.events.EventPubSub;
import org.openmetadata.service.events.scheduled.EventSubscriptionScheduler;
import org.openmetadata.service.events.scheduled.ServicesStatusJobHandler;
import org.openmetadata.service.exception.CatalogGenericExceptionMapper;
import org.openmetadata.service.exception.ConstraintViolationExceptionMapper;
import org.openmetadata.service.exception.JsonMappingExceptionMapper;
import org.openmetadata.service.exception.OMErrorPageHandler;
import org.openmetadata.service.fernet.Fernet;
import org.openmetadata.service.governance.workflows.WorkflowHandler;
import org.openmetadata.service.jdbi3.BulkExecutor;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.EntityRelationshipRepository;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.jdbi3.MigrationDAO;
import org.openmetadata.service.jdbi3.SystemRepository;
import org.openmetadata.service.jdbi3.locator.ConnectionAwareAnnotationSqlLocator;
import org.openmetadata.service.jdbi3.locator.ConnectionType;
import org.openmetadata.service.jobs.EnumCleanupHandler;
import org.openmetadata.service.jobs.GenericBackgroundWorker;
import org.openmetadata.service.jobs.JobDAO;
import org.openmetadata.service.jobs.JobHandlerRegistry;
import org.openmetadata.service.limits.DefaultLimits;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.migration.MigrationValidationClient;
import org.openmetadata.service.migration.api.MigrationWorkflow;
import org.openmetadata.service.monitoring.EventMonitor;
import org.openmetadata.service.monitoring.EventMonitorConfiguration;
import org.openmetadata.service.monitoring.EventMonitorFactory;
import org.openmetadata.service.monitoring.EventMonitorPublisher;
import org.openmetadata.service.monitoring.JettyMetricsIntegration;
import org.openmetadata.service.monitoring.UserMetricsServlet;
import org.openmetadata.service.rdf.RdfUpdater;
import org.openmetadata.service.resources.CollectionRegistry;
import org.openmetadata.service.resources.audit.AuditLogResource;
import org.openmetadata.service.resources.databases.DatasourceConfig;
import org.openmetadata.service.resources.filters.ETagRequestFilter;
import org.openmetadata.service.resources.filters.ETagResponseFilter;
import org.openmetadata.service.resources.settings.SettingsCache;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.secrets.SecretsManagerFactory;
import org.openmetadata.service.secrets.masker.EntityMaskerFactory;
import org.openmetadata.service.security.AuthCallbackServlet;
import org.openmetadata.service.security.AuthLoginServlet;
import org.openmetadata.service.security.AuthLogoutServlet;
import org.openmetadata.service.security.AuthRefreshServlet;
import org.openmetadata.service.security.AuthServeletHandlerFactory;
import org.openmetadata.service.security.AuthServeletHandlerRegistry;
import org.openmetadata.service.security.AuthenticationCodeFlowHandler;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.ContainerRequestFilterManager;
import org.openmetadata.service.security.DelegatingContainerRequestFilter;
import org.openmetadata.service.security.NoopAuthorizer;
import org.openmetadata.service.security.NoopFilter;
import org.openmetadata.service.security.auth.AuthenticatorHandler;
import org.openmetadata.service.security.auth.BasicAuthenticator;
import org.openmetadata.service.security.auth.LdapAuthenticator;
import org.openmetadata.service.security.auth.NoopAuthenticator;
import org.openmetadata.service.security.auth.SecurityConfigurationManager;
import org.openmetadata.service.security.auth.UserActivityFilter;
import org.openmetadata.service.security.auth.UserActivityTracker;
import org.openmetadata.service.security.jwt.JWTTokenGenerator;
import org.openmetadata.service.security.saml.OMMicrometerHttpFilter;
import org.openmetadata.service.security.saml.SamlAssertionConsumerServlet;
import org.openmetadata.service.security.saml.SamlLoginServlet;
import org.openmetadata.service.security.saml.SamlLogoutServlet;
import org.openmetadata.service.security.saml.SamlMetadataServlet;
import org.openmetadata.service.security.saml.SamlSettingsHolder;
import org.openmetadata.service.security.saml.SamlTokenRefreshServlet;
import org.openmetadata.service.socket.FeedServlet;
import org.openmetadata.service.socket.Jetty12WebSocketHandler;
import org.openmetadata.service.socket.OpenMetadataAssetServlet;
import org.openmetadata.service.socket.SocketAddressFilter;
import org.openmetadata.service.socket.WebSocketManager;
import org.openmetadata.service.swagger.SwaggerBundle;
import org.openmetadata.service.swagger.SwaggerBundleConfiguration;
import org.openmetadata.service.util.CustomParameterNameProvider;
import org.openmetadata.service.util.incidentSeverityClassifier.IncidentSeverityClassifierInterface;
import org.quartz.SchedulerException;

/** Main catalog application */
@Slf4j
@OpenAPIDefinition(
    info =
        @Info(
            title = "OpenMetadata APIs",
            version = "1.9.8",
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
  private Environment environment;
  private AuditLogRepository auditLogRepository;

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

    this.environment = environment;

    OpenMetadataApplicationConfigHolder.initialize(catalogConfig);

    // Configure URI compliance to LEGACY mode by default for Jetty 12
    // This allows special characters in entity names that were permitted in Jetty 11
    configureUriCompliance(catalogConfig);

    // Configure ServletHandler to preserve encoded slashes in paths
    // This is needed for entity names containing slashes (e.g., "domain.name/with-slash")
    configureServletHandler(environment);

    validateConfiguration(catalogConfig);

    // Instantiate incident severity classifier
    IncidentSeverityClassifierInterface.createInstance();

    // Initialize the IndexMapping class
    IndexMappingLoader.init(catalogConfig.getElasticSearchConfiguration());

    // init for dataSourceFactory
    DatasourceConfig.initialize(catalogConfig.getDataSourceFactory().getDriverClass());

    // Metrics initialization now handled by MicrometerBundle

    jdbi = createAndSetupJDBI(environment, catalogConfig.getDataSourceFactory());
    // Initialize the MigrationValidationClient, used in the Settings Repository
    MigrationValidationClient.initialize(jdbi.onDemand(MigrationDAO.class), catalogConfig);
    Entity.setCollectionDAO(getDao(jdbi));
    Entity.setEntityRelationshipRepository(
        new EntityRelationshipRepository(Entity.getCollectionDAO()));
    Entity.setSystemRepository(new SystemRepository());
    Entity.setJobDAO(jdbi.onDemand(JobDAO.class));
    Entity.setJdbi(jdbi);

    // Initialize bulk operation executor
    BulkExecutor.initialize(catalogConfig.getBulkOperationConfiguration());

    // Phase 1: Core search infrastructure (needed by repositories)
    initializeCoreSearchInfrastructure(catalogConfig);

    // as first step register all the repositories (now they can access SearchRepository)
    Entity.initializeRepositories(catalogConfig, jdbi);
    auditLogRepository = new AuditLogRepository(Entity.getCollectionDAO());
    Entity.setAuditLogRepository(auditLogRepository);
    ResourceRegistry.addResource(
        Entity.AUDIT_LOG, List.of(MetadataOperation.AUDIT_LOGS), Collections.emptySet());

    // Configure the Fernet instance
    Fernet.getInstance().setFernetKey(catalogConfig);

    // Initialize Workflow Handler
    WorkflowHandler.initialize(catalogConfig);

    // Init Settings Cache after repositories and Fernet (needed for database access and encryption)
    SettingsCache.initialize(catalogConfig);

    // Phase 2: Advanced search features (after settings are available)
    initializeAdvancedSearchFeatures();

    SecurityConfigurationManager.getInstance().initialize(this, catalogConfig, environment);

    // Instantiate JWT Token Generator
    JWTTokenGenerator.getInstance()
        .init(
            SecurityConfigurationManager.getCurrentAuthConfig().getTokenValidationAlgorithm(),
            catalogConfig.getJwtTokenConfiguration());

    initializeWebsockets(catalogConfig, environment);

    // init Secret Manager
    SecretsManagerFactory.createSecretsManager(
        catalogConfig.getSecretsManagerConfiguration(), catalogConfig.getClusterName());

    // init Entity Masker
    EntityMaskerFactory.createEntityMasker();

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

    // Validate native migrations
    validateMigrations(jdbi, catalogConfig);

    // Register Authorizer
    registerAuthorizer(catalogConfig, environment);

    // Register Authenticator
    registerAuthenticator(SecurityConfigurationManager.getInstance());

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

    // Register ETag Filters for optimistic concurrency control
    environment.jersey().register(ETagRequestFilter.class);
    environment.jersey().register(ETagResponseFilter.class);

    // Register User Activity Tracking
    registerUserActivityTracking(environment);

    environment.lifecycle().manage(new ManagedShutdown());

    JobHandlerRegistry registry = getJobHandlerRegistry();
    environment
        .lifecycle()
        .manage(new GenericBackgroundWorker(jdbi.onDemand(JobDAO.class), registry));

    // Register Distributed Job Participant for distributed search indexing
    registerDistributedJobParticipant(environment, jdbi, catalogConfig.getCacheConfig());

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

    // Register User Metrics Servlet
    registerUserMetricsServlet(environment);
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
            catalogConfig.getEventMonitorConfiguration(), catalogConfig.getClusterName());
    healthCheckStatusHandler.addDatabaseAndSearchStatusJobs();
  }

  private void registerAuthServlets(OpenMetadataApplicationConfig config, Environment environment) {
    AuthServeletHandlerRegistry.setHandler(AuthServeletHandlerFactory.getHandler(config));
    // Set up a Session Manager
    MutableServletContextHandler contextHandler = environment.getApplicationContext();
    SessionHandler sessionHandler = contextHandler.getSessionHandler();
    if (contextHandler.getSessionHandler() == null) {
      sessionHandler = new SessionHandler();
      contextHandler.setSessionHandler(sessionHandler);
    }

    SessionCookieConfig cookieConfig =
        Objects.requireNonNull(sessionHandler).getSessionCookieConfig();
    cookieConfig.setHttpOnly(true);
    cookieConfig.setSecure(
        isHttps(config) || config.getAuthenticationConfiguration().getForceSecureSessionCookie());

    // Get session expiry - use OIDC config if available, otherwise default
    int sessionExpiry = 604800; // Default 7 days in seconds
    if (SecurityConfigurationManager.getCurrentAuthConfig().getOidcConfiguration() != null
        && SecurityConfigurationManager.getCurrentAuthConfig()
                .getOidcConfiguration()
                .getSessionExpiry()
            >= 3600) {
      sessionExpiry =
          SecurityConfigurationManager.getCurrentAuthConfig()
              .getOidcConfiguration()
              .getSessionExpiry();
    }

    cookieConfig.setMaxAge(sessionExpiry);
    cookieConfig.setPath("/");
    sessionHandler.setMaxInactiveInterval(sessionExpiry);

    // Register Servlets
    ServletHolder authLoginHolder = new ServletHolder(new AuthLoginServlet());
    authLoginHolder.setName("oauth_login");
    environment.getApplicationContext().addServlet(authLoginHolder, "/api/v1/auth/login");

    ServletHolder authCallbackHolder = new ServletHolder(new AuthCallbackServlet());
    authCallbackHolder.setName("auth_callback");
    environment.getApplicationContext().addServlet(authCallbackHolder, "/callback");

    ServletHolder authLogoutHolder = new ServletHolder(new AuthLogoutServlet());
    authLogoutHolder.setName("auth_logout");
    environment.getApplicationContext().addServlet(authLogoutHolder, "/api/v1/auth/logout");

    ServletHolder refreshHolder = new ServletHolder(new AuthRefreshServlet());
    refreshHolder.setName("auth_refresh");
    environment.getApplicationContext().addServlet(refreshHolder, "/api/v1/auth/refresh");
  }

  private void registerUserMetricsServlet(Environment environment) {
    ServletHolder userMetricsHolder = new ServletHolder(new UserMetricsServlet());
    userMetricsHolder.setName("user_metrics");
    environment.getAdminContext().addServlet(userMetricsHolder, "/user-metrics");
    LOG.info("Registered UserMetricsServlet on admin port at /user-metrics");
  }

  public static boolean isHttps(OpenMetadataApplicationConfig configuration) {
    if (configuration.getServerFactory() instanceof DefaultServerFactory serverFactory) {
      ConnectorFactory connector = serverFactory.getApplicationConnectors().getFirst();
      return connector instanceof HttpsConnectorFactory;
    }
    return false;
  }

  /**
   * Configure URI compliance for Jetty 12. By default, Jetty 12 uses strict URI compliance which
   * rejects special characters that were allowed in Jetty 11. OpenMetadata allows special
   * characters in entity names (including encoded chars like %22 for double quotes), so we
   * default to UNSAFE compliance mode unless explicitly configured otherwise.
   * Note: For tests using DropwizardAppExtension, uriCompliance must be set in YAML config
   * since the server is initialized before run() is called.
   */
  private void configureUriCompliance(OpenMetadataApplicationConfig configuration) {
    if (configuration.getServerFactory() instanceof DefaultServerFactory serverFactory) {
      // Configure application connectors - always set to UNSAFE for backward compatibility
      for (ConnectorFactory connector : serverFactory.getApplicationConnectors()) {
        if (connector instanceof HttpConnectorFactory httpConnector) {
          httpConnector.setUriCompliance(UriCompliance.UNSAFE);
          LOG.info("Set URI compliance to UNSAFE for application connector");
        }
      }
      // Configure admin connectors - always set to UNSAFE for backward compatibility
      for (ConnectorFactory connector : serverFactory.getAdminConnectors()) {
        if (connector instanceof HttpConnectorFactory httpConnector) {
          httpConnector.setUriCompliance(UriCompliance.UNSAFE);
          LOG.info("Set URI compliance to UNSAFE for admin connector");
        }
      }
    }
  }

  /**
   * Configure the ServletHandler to allow ambiguous URIs in servlet API methods.
   * In Jetty 12 / Servlet 6, methods like getServletPath() and getPathInfo() throw
   * IllegalArgumentException for URIs containing ambiguous characters like %2F (encoded slash)
   * or %22 (encoded quote). Setting setDecodeAmbiguousURIs(true) allows these methods to work.
   *
   * This is required because OpenMetadata entity names can contain special characters
   * (e.g., "domain.name/with-slash") which get URL-encoded by clients.
   *
   * See: https://github.com/jetty/jetty.project/issues/12346
   * See: https://jetty.org/docs/jetty/12/programming-guide/server/compliance.html
   */
  private void configureServletHandler(Environment environment) {
    MutableServletContextHandler contextHandler = environment.getApplicationContext();
    org.eclipse.jetty.ee10.servlet.ServletHandler servletHandler =
        contextHandler.getServletHandler();
    if (servletHandler != null) {
      servletHandler.setDecodeAmbiguousURIs(true);
      LOG.info(
          "Configured ServletHandler to allow ambiguous URIs (required for %2F, %22 in paths)");
    }
  }

  /**
   * Phase 1: Initialize core search infrastructure without advanced features.
   * This creates the basic SearchRepository and SearchClient but defers
   * lineage builders that depend on settings.
   */
  protected void initializeCoreSearchInfrastructure(OpenMetadataApplicationConfig config) {
    Integer databaseMaxSize = config.getDataSourceFactory().getMaxSize();
    LOG.info(
        "Phase 1: Initializing core search infrastructure with database max pool size: {}",
        databaseMaxSize);

    SearchRepository searchRepository =
        new SearchRepository(
            config.getElasticSearchConfiguration(), config.getDataSourceFactory().getMaxSize());
    Entity.setSearchRepository(searchRepository);

    // Initialize RDF if enabled (core infrastructure)
    RdfConfiguration rdfConfig = config.getRdfConfiguration();
    if (rdfConfig != null && rdfConfig.getEnabled() != null && rdfConfig.getEnabled()) {
      RdfUpdater.initialize(rdfConfig);
      LOG.info("RDF knowledge graph support initialized");
    }

    LOG.info("Core search infrastructure initialization completed");
  }

  /**
   * Phase 2: Initialize advanced search features that depend on settings.
   * This includes lineage builders and other components that require
   * database settings to be available.
   */
  protected void initializeAdvancedSearchFeatures() {
    LOG.info("Phase 2: Initializing advanced search features");

    SearchRepository searchRepository = Entity.getSearchRepository();
    if (searchRepository != null) {
      searchRepository.initializeLineageComponents();
      LOG.info("Advanced search features initialization completed");
    } else {
      LOG.warn("SearchRepository not found during advanced features initialization");
    }
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

    LOG.info("Registering Asset Servlet with basePath: {}", config.getBasePath());
    LOG.info("Application Context Path: {}", environment.getApplicationContext().getContextPath());

    // Handle Asset Using Servlet
    OpenMetadataAssetServlet assetServlet =
        new OpenMetadataAssetServlet(
            config.getBasePath(), "/assets", "/", "index.html", webConfiguration);
    environment.servlets().addServlet("static", assetServlet).addMapping("/*");

    LOG.info("Asset Servlet registered with mapping: /*");
  }

  protected CollectionDAO getDao(Jdbi jdbi) {
    CollectionDAO originalDAO = jdbi.onDemand(CollectionDAO.class);

    LOG.info("Using original CollectionDAO without caching");
    return originalDAO;
  }

  private void registerSamlServlets(
      OpenMetadataApplicationConfig catalogConfig, Environment environment)
      throws IOException, CertificateException, KeyStoreException, NoSuchAlgorithmException {

    // Ensure we have a session handler
    if (SecurityConfigurationManager.getCurrentAuthConfig() != null
        && SecurityConfigurationManager.getCurrentAuthConfig()
            .getProvider()
            .equals(AuthProvider.SAML)) {
      MutableServletContextHandler contextHandler = environment.getApplicationContext();
      if (contextHandler.getSessionHandler() == null) {
        contextHandler.setSessionHandler(new SessionHandler());
      }

      // Initialize default SAML settings (e.g. IDP metadata, SP keys, etc.)
      SamlSettingsHolder.getInstance().initDefaultSettings(catalogConfig);

      // Only register servlets if they don't already exist to prevent duplicate registration
      if (!isSamlServletRegistered(contextHandler, "/api/v1/saml/login")) {
        contextHandler.addServlet(new ServletHolder(new SamlLoginServlet()), "/api/v1/saml/login");
      }
      if (!isSamlServletRegistered(contextHandler, "/api/v1/saml/acs")) {
        contextHandler.addServlet(
            new ServletHolder(new SamlAssertionConsumerServlet()), "/api/v1/saml/acs");
      }
      if (!isSamlServletRegistered(contextHandler, "/api/v1/saml/metadata")) {
        contextHandler.addServlet(
            new ServletHolder(new SamlMetadataServlet()), "/api/v1/saml/metadata");
      }
      if (!isSamlServletRegistered(contextHandler, "/api/v1/saml/refresh")) {
        contextHandler.addServlet(
            new ServletHolder(new SamlTokenRefreshServlet()), "/api/v1/saml/refresh");
      }
      if (!isSamlServletRegistered(contextHandler, "/api/v1/saml/logout")) {
        contextHandler.addServlet(
            new ServletHolder(new SamlLogoutServlet()), "/api/v1/saml/logout");
      }
    }
  }

  private boolean isSamlServletRegistered(
      MutableServletContextHandler contextHandler, String path) {
    try {
      ServletHandler servletHandler = contextHandler.getServletHandler();
      ServletMapping[] servletMappings = servletHandler.getServletMappings();

      if (servletMappings != null) {
        for (ServletMapping mapping : servletMappings) {
          if (mapping.getPathSpecs() != null) {
            for (String pathSpec : mapping.getPathSpecs()) {
              if (path.equals(pathSpec)) {
                LOG.debug("SAML servlet already registered at path: {}", path);
                return true;
              }
            }
          }
        }
      }
      return false;
    } catch (Exception e) {
      LOG.warn(
          "Failed to check if SAML servlet is registered at path {}: {}", path, e.getMessage());
      return false;
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

    // Add Micrometer bundle for Prometheus metrics
    bootstrap.addBundle(new org.openmetadata.service.monitoring.MicrometerBundle());

    // Add Cache bundle for Redis/cache support
    bootstrap.addBundle(new org.openmetadata.service.cache.CacheBundle());

    super.initialize(bootstrap);
  }

  private void validateMigrations(Jdbi jdbi, OpenMetadataApplicationConfig conf)
      throws IOException {
    LOG.info("Validating native migrations");
    ConnectionType connectionType =
        ConnectionType.from(conf.getDataSourceFactory().getDriverClass());
    MigrationWorkflow migrationWorkflow =
        new MigrationWorkflow(
            jdbi,
            conf.getMigrationConfiguration().getNativePath(),
            connectionType,
            conf.getMigrationConfiguration().getExtensionPath(),
            conf.getMigrationConfiguration().getFlywayPath(),
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

  public void reinitializeAuthSystem(
      OpenMetadataApplicationConfig config, Environment environment) {
    try {
      LOG.info("Starting authentication system reinitialization");
      AuthServeletHandlerRegistry.setHandler(AuthServeletHandlerFactory.getHandler(config));

      // Update JWT configuration first
      JWTTokenGenerator.getInstance()
          .init(
              SecurityConfigurationManager.getCurrentAuthConfig().getTokenValidationAlgorithm(),
              config.getJwtTokenConfiguration());

      // Re-register authenticator with new config
      registerAuthenticator(SecurityConfigurationManager.getInstance());
      reRegisterAuthorizer(config, environment);
      config.setAuthenticationConfiguration(SecurityConfigurationManager.getCurrentAuthConfig());
      authenticatorHandler.init(config);

      // Re-register servlets
      if (AuthServeletHandlerFactory.getHandler(config) instanceof AuthenticationCodeFlowHandler) {
        AuthenticationCodeFlowHandler.getInstance(
                SecurityConfigurationManager.getCurrentAuthConfig(),
                SecurityConfigurationManager.getCurrentAuthzConfig())
            .updateConfiguration(
                SecurityConfigurationManager.getCurrentAuthConfig(),
                SecurityConfigurationManager.getCurrentAuthzConfig());
      }

      // Reinitialize SAML settings if SAML is enabled
      if (SecurityConfigurationManager.getCurrentAuthConfig() != null
          && SecurityConfigurationManager.getCurrentAuthConfig()
              .getProvider()
              .equals(AuthProvider.SAML)) {
        LOG.info("Reinitializing SAML settings during authentication reinitialization");
        registerSamlServlets(config, environment);
      }

      LOG.info("Successfully reinitialized authentication system");
    } catch (Exception e) {
      LOG.error("Failed to reinitialize authentication system", e);
      // Trigger rollback in AuthenticationConfigurationManager
      // Rollback is handled internally by SecurityConfigurationManager
      throw new RuntimeException("Authentication system reinitialization failed", e);
    }
  }

  private void registerAuthorizer(
      OpenMetadataApplicationConfig catalogConfig, Environment environment)
      throws NoSuchMethodException,
          ClassNotFoundException,
          IllegalAccessException,
          InvocationTargetException,
          InstantiationException {
    AuthorizerConfiguration authorizerConf = SecurityConfigurationManager.getCurrentAuthzConfig();
    AuthenticationConfiguration authenticationConfiguration =
        SecurityConfigurationManager.getCurrentAuthConfig();
    DelegatingContainerRequestFilter delegatingFilter = new DelegatingContainerRequestFilter();
    environment.jersey().register(delegatingFilter);
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
        ContainerRequestFilterManager.getInstance().registerFilter(filter);
      }
    } else {
      LOG.info("Authorizer config not set, setting noop authorizer");
      authorizer = new NoopAuthorizer();
      ContainerRequestFilter filter = new NoopFilter(authenticationConfiguration, null);
      ContainerRequestFilterManager.getInstance().registerFilter(filter);
    }
  }

  private void reRegisterAuthorizer(
      OpenMetadataApplicationConfig catalogConfig, Environment environment)
      throws NoSuchMethodException,
          ClassNotFoundException,
          IllegalAccessException,
          InvocationTargetException,
          InstantiationException {
    AuthorizerConfiguration authorizerConf = SecurityConfigurationManager.getCurrentAuthzConfig();
    AuthenticationConfiguration authenticationConfiguration =
        SecurityConfigurationManager.getCurrentAuthConfig();
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
        LOG.info("Re Registering ContainerRequestFilter: {}", filter.getClass().getCanonicalName());
        ContainerRequestFilterManager.getInstance().registerFilter(filter);
      }
    } else {
      LOG.info("Authorizer config not set, setting noop authorizer");
      authorizer = new NoopAuthorizer();
      ContainerRequestFilter filter = new NoopFilter(authenticationConfiguration, null);
      ContainerRequestFilterManager.getInstance().registerFilter(filter);
    }
  }

  private void registerAuthenticator(SecurityConfigurationManager catalogConfig) {
    AuthenticationConfiguration authenticationConfiguration =
        SecurityConfigurationManager.getCurrentAuthConfig();
    switch (authenticationConfiguration.getProvider()) {
      case BASIC -> authenticatorHandler = new BasicAuthenticator();
      case LDAP -> authenticatorHandler = new LdapAuthenticator();
      default ->
      // For all other types, google, okta etc. auth is handled externally
      authenticatorHandler = new NoopAuthenticator();
    }
    SecurityConfigurationManager.getInstance().setAuthenticatorHandler(authenticatorHandler);
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

    // Register metrics request filter for tracking request latencies
    environment.jersey().register(org.openmetadata.service.monitoring.MetricsRequestFilter.class);
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

    EventPubSub.addEventHandler(new AuditLogEventPublisher(auditLogRepository));

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
        .registerResources(
            jdbi,
            environment,
            config,
            authorizer,
            SecurityConfigurationManager.getInstance().getAuthenticatorHandler(),
            limits);
    environment.jersey().register(new AuditLogResource(authorizer, auditLogRepository));
    environment.jersey().register(new JsonPatchProvider());
    environment.jersey().register(new JsonPatchMessageBodyReader());

    // Register Jetty metrics for monitoring
    JettyMetricsIntegration.registerJettyMetrics(environment);

    // RDF resources are now automatically registered via @Collection annotation
    if (config.getRdfConfiguration() != null
        && config.getRdfConfiguration().getEnabled() != null
        && Boolean.TRUE.equals(config.getRdfConfiguration().getEnabled())) {
      LOG.info("RDF support is enabled and resources will be registered via CollectionRegistry");
    } else {
      LOG.info(
          "RDF support is disabled - config: {}, enabled: {}",
          config.getRdfConfiguration(),
          config.getRdfConfiguration() != null
              ? config.getRdfConfiguration().getEnabled()
              : "null");
    }

    OMErrorPageHandler eph = new OMErrorPageHandler(config.getWebConfiguration());
    eph.addErrorPage(Response.Status.NOT_FOUND.getStatusCode(), "/");
    environment.getApplicationContext().setErrorHandler(eph);
  }

  private void initializeWebsockets(
      OpenMetadataApplicationConfig catalogConfig, Environment environment) {
    SocketAddressFilter socketAddressFilter;
    String pathSpec = "/api/v1/push/feed/*";

    LOG.info("Initializing WebSockets");
    LOG.info("WebSocket pathSpec: {}", pathSpec);
    LOG.info(
        "Application Context Path during WebSocket init: {}",
        environment.getApplicationContext().getContextPath());

    if (catalogConfig.getAuthorizerConfiguration() != null) {
      socketAddressFilter =
          new SocketAddressFilter(
              SecurityConfigurationManager.getCurrentAuthConfig(),
              SecurityConfigurationManager.getCurrentAuthzConfig());
    } else {
      socketAddressFilter = new SocketAddressFilter();
    }

    EngineIoServerOptions eioOptions = EngineIoServerOptions.newFromDefault();
    eioOptions.setAllowedCorsOrigins(null);
    WebSocketManager.WebSocketManagerBuilder.build(eioOptions);
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

            // Register endpoint using Jetty 12 WebSocket API
            wsContainer.addMapping(
                pathSpec,
                (req, resp) ->
                    new Jetty12WebSocketHandler(
                        WebSocketManager.getInstance().getEngineIoServer()));
          });
    } catch (Exception ex) {
      LOG.error("Websocket configuration error: {}", ex.getMessage());
    }
  }

  protected void registerDistributedJobParticipant(
      Environment environment, Jdbi jdbi, CacheConfig cacheConfig) {
    try {
      CollectionDAO collectionDAO = jdbi.onDemand(CollectionDAO.class);
      SearchRepository searchRepository = Entity.getSearchRepository();
      String serverId = ServerIdentityResolver.getInstance().getServerId();

      DistributedJobParticipant participant =
          new DistributedJobParticipant(collectionDAO, searchRepository, serverId, cacheConfig);
      environment.lifecycle().manage(participant);

      String notifierType =
          (cacheConfig != null && cacheConfig.provider == CacheConfig.Provider.redis)
              ? "Redis Pub/Sub"
              : "database polling";
      LOG.info(
          "Registered DistributedJobParticipant for distributed search indexing using {}",
          notifierType);
    } catch (Exception e) {
      LOG.warn("Failed to register DistributedJobParticipant: {}", e.getMessage());
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
