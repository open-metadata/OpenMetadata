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

import io.dropwizard.core.server.DefaultServerFactory;
import io.dropwizard.core.setup.Environment;
import io.dropwizard.jersey.errors.EarlyEofExceptionMapper;
import io.dropwizard.jersey.errors.LoggingExceptionMapper;
import io.dropwizard.jersey.jackson.JsonProcessingExceptionMapper;
import io.dropwizard.lifecycle.Managed;
import jakarta.servlet.DispatcherType;
import jakarta.servlet.FilterRegistration;
import jakarta.ws.rs.container.ContainerResponseFilter;
import jakarta.ws.rs.core.Response;
import java.io.IOException;
import java.security.KeyStoreException;
import java.security.NoSuchAlgorithmException;
import java.security.cert.CertificateException;
import java.util.EnumSet;
import lombok.extern.slf4j.Slf4j;
import org.glassfish.jersey.media.multipart.MultiPartFeature;
import org.glassfish.jersey.server.ServerProperties;
import org.jdbi.v3.core.Jdbi;
import org.openmetadata.service.apps.ApplicationContext;
import org.openmetadata.service.apps.McpServerProvider;
import org.openmetadata.service.events.EventFilter;
import org.openmetadata.service.events.EventPubSub;
import org.openmetadata.service.exception.CatalogGenericExceptionMapper;
import org.openmetadata.service.exception.ConstraintViolationExceptionMapper;
import org.openmetadata.service.exception.JsonMappingExceptionMapper;
import org.openmetadata.service.exception.OMErrorPageHandler;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.monitoring.EventMonitor;
import org.openmetadata.service.monitoring.EventMonitorConfiguration;
import org.openmetadata.service.monitoring.EventMonitorFactory;
import org.openmetadata.service.monitoring.EventMonitorPublisher;
import org.openmetadata.service.resources.CollectionRegistry;
import org.openmetadata.service.resources.filters.ETagRequestFilter;
import org.openmetadata.service.resources.filters.ETagResponseFilter;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.auth.AuthenticatorHandler;
import org.openmetadata.service.security.auth.UserActivityFilter;
import org.openmetadata.service.security.auth.UserActivityTracker;
import org.openmetadata.service.security.saml.OMMicrometerHttpFilter;

@Slf4j
public class WebServiceManager {
  private final OpenMetadataApplicationConfig config;
  private final Environment environment;
  private final Jdbi jdbi;
  private final Authorizer authorizer;
  private final AuthenticatorHandler authenticatorHandler;
  private final Limits limits;

  public WebServiceManager(
      OpenMetadataApplicationConfig config,
      Environment environment,
      Jdbi jdbi,
      Authorizer authorizer,
      AuthenticatorHandler authenticatorHandler,
      Limits limits) {
    this.config = config;
    this.environment = environment;
    this.jdbi = jdbi;
    this.authorizer = authorizer;
    this.authenticatorHandler = authenticatorHandler;
    this.limits = limits;
  }

  public void setup()
      throws IOException, CertificateException, KeyStoreException, NoSuchAlgorithmException {
    configureJersey();
    registerExceptionMappers();
    registerHealthCheck();
    startEventPubSub();
    registerResources();
    registerFilters();
    registerUserActivityTracking();
    registerEventPublisher();
    registerMicrometerFilter();
    registerServlets();
    registerMCPServer();
  }

  private void configureJersey() {
    ((DefaultServerFactory) config.getServerFactory()).setRegisterDefaultExceptionMappers(false);
    environment.jersey().property(ServerProperties.RESPONSE_SET_STATUS_OVER_SEND_ERROR, true);
    environment.jersey().register(MultiPartFeature.class);
  }

  private void registerExceptionMappers() {
    environment.jersey().register(CatalogGenericExceptionMapper.class);
    environment.jersey().register(new ConstraintViolationExceptionMapper());
    environment.jersey().register(new LoggingExceptionMapper<>() {});
    environment.jersey().register(new JsonProcessingExceptionMapper(true));
    environment.jersey().register(new EarlyEofExceptionMapper());
    environment.jersey().register(JsonMappingExceptionMapper.class);
  }

  private void registerHealthCheck() {
    environment
        .healthChecks()
        .register("OpenMetadataServerHealthCheck", new OpenMetadataServerHealthCheck());
  }

  private void startEventPubSub() {
    EventPubSub.start();
  }

  private void registerResources() {
    CollectionRegistry.initialize();
    CollectionRegistry.getInstance()
        .registerResources(jdbi, environment, config, authorizer, authenticatorHandler, limits);
    environment.jersey().register(new JsonPatchProvider());
    environment.jersey().register(new JsonPatchMessageBodyReader());
    OMErrorPageHandler eph = new OMErrorPageHandler(config.getWebConfiguration());
    eph.addErrorPage(Response.Status.NOT_FOUND.getStatusCode(), "/");
    environment.getApplicationContext().setErrorHandler(eph);
  }

  private void registerFilters() {
    registerEventFilter();
    environment.jersey().register(ETagRequestFilter.class);
    environment.jersey().register(ETagResponseFilter.class);
  }

  private void registerEventFilter() {
    if (config.getEventHandlerConfiguration() != null) {
      ContainerResponseFilter eventFilter = new EventFilter(config);
      environment.jersey().register(eventFilter);
    }
    environment.jersey().register(org.openmetadata.service.monitoring.MetricsRequestFilter.class);
  }

  private void registerUserActivityTracking() {
    environment.jersey().register(UserActivityFilter.class);
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

  private void registerEventPublisher() {
    if (config.getEventMonitorConfiguration() != null) {
      final EventMonitor eventMonitor =
          EventMonitorFactory.createEventMonitor(
              config.getEventMonitorConfiguration(), config.getClusterName());
      EventMonitorPublisher eventMonitorPublisher =
          new EventMonitorPublisher(config.getEventMonitorConfiguration(), eventMonitor);
      EventPubSub.addEventHandler(eventMonitorPublisher);
    }
  }

  private void registerMicrometerFilter() {
    EventMonitorConfiguration eventMonitorConfiguration = config.getEventMonitorConfiguration();
    FilterRegistration.Dynamic micrometerFilter =
        environment.servlets().addFilter("OMMicrometerHttpFilter", OMMicrometerHttpFilter.class);

    micrometerFilter.addMappingForUrlPatterns(
        EnumSet.allOf(DispatcherType.class), true, eventMonitorConfiguration.getPathPattern());
  }

  private void registerServlets()
      throws IOException, CertificateException, KeyStoreException, NoSuchAlgorithmException {
    ServletRegistrationManager servletManager = new ServletRegistrationManager(config, environment);
    servletManager.registerAllServlets();
  }

  private void registerMCPServer() {
    try {
      if (ApplicationContext.getInstance().getAppIfExists("McpApplication") != null) {
        Class<?> mcpServerClass = Class.forName("org.openmetadata.mcp.McpServer");
        McpServerProvider mcpServer =
            (McpServerProvider) mcpServerClass.getDeclaredConstructor().newInstance();
        mcpServer.initializeMcpServer(environment, authorizer, limits, config);
        LOG.info("MCP Server registered successfully");
      }
    } catch (ClassNotFoundException ex) {
      LOG.info("MCP module not found in classpath, skipping MCP server initialization");
    } catch (Exception ex) {
      LOG.error("Error initializing MCP server", ex);
    }
  }
}
