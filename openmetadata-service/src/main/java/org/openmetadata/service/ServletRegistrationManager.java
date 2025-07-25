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
import io.dropwizard.jetty.ConnectorFactory;
import io.dropwizard.jetty.HttpsConnectorFactory;
import io.dropwizard.jetty.MutableServletContextHandler;
import io.socket.engineio.server.EngineIoServerOptions;
import io.socket.engineio.server.JettyWebSocketHandler;
import jakarta.servlet.DispatcherType;
import jakarta.servlet.SessionCookieConfig;
import java.io.IOException;
import java.security.KeyStoreException;
import java.security.NoSuchAlgorithmException;
import java.security.cert.CertificateException;
import java.util.EnumSet;
import java.util.Objects;
import lombok.extern.slf4j.Slf4j;
import org.eclipse.jetty.server.session.SessionHandler;
import org.eclipse.jetty.servlet.FilterHolder;
import org.eclipse.jetty.servlet.ServletHolder;
import org.eclipse.jetty.websocket.server.config.JettyWebSocketServletContainerInitializer;
import org.openmetadata.schema.api.security.ClientType;
import org.openmetadata.schema.services.connections.metadata.AuthProvider;
import org.openmetadata.service.config.OMWebConfiguration;
import org.openmetadata.service.security.AuthCallbackServlet;
import org.openmetadata.service.security.AuthLoginServlet;
import org.openmetadata.service.security.AuthLogoutServlet;
import org.openmetadata.service.security.AuthRefreshServlet;
import org.openmetadata.service.security.AuthenticationCodeFlowHandler;
import org.openmetadata.service.security.saml.SamlAssertionConsumerServlet;
import org.openmetadata.service.security.saml.SamlLoginServlet;
import org.openmetadata.service.security.saml.SamlLogoutServlet;
import org.openmetadata.service.security.saml.SamlMetadataServlet;
import org.openmetadata.service.security.saml.SamlSettingsHolder;
import org.openmetadata.service.security.saml.SamlTokenRefreshServlet;
import org.openmetadata.service.socket.FeedServlet;
import org.openmetadata.service.socket.OpenMetadataAssetServlet;
import org.openmetadata.service.socket.SocketAddressFilter;
import org.openmetadata.service.socket.WebSocketManager;
import org.pac4j.core.util.CommonHelper;

@Slf4j
public class ServletRegistrationManager {
  private final OpenMetadataApplicationConfig config;
  private final Environment environment;

  public ServletRegistrationManager(OpenMetadataApplicationConfig config, Environment environment) {
    this.config = config;
    this.environment = environment;
  }

  public void registerAllServlets()
      throws IOException, CertificateException, KeyStoreException, NoSuchAlgorithmException {
    registerAssetServlet();
    registerWebSocketServlets();
    registerSamlServlets();
    registerAuthServlets();
  }

  private void registerAssetServlet() {
    OMWebConfiguration webConfiguration = config.getWebConfiguration();
    OpenMetadataAssetServlet assetServlet =
        new OpenMetadataAssetServlet(
            config.getBasePath(), "/assets", "/", "index.html", webConfiguration);
    environment.servlets().addServlet("static", assetServlet).addMapping("/*");
  }

  private void registerWebSocketServlets() {
    SocketAddressFilter socketAddressFilter;
    String pathSpec = "/api/v1/push/feed/*";

    if (config.getAuthorizerConfiguration() != null) {
      socketAddressFilter =
          new SocketAddressFilter(
              config.getAuthenticationConfiguration(), config.getAuthorizerConfiguration());
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

    try {
      JettyWebSocketServletContainerInitializer.configure(
          environment.getApplicationContext(),
          (servletContext, wsContainer) -> {
            wsContainer.setMaxTextMessageSize(65535);
            wsContainer.setMaxBinaryMessageSize(65535);
            wsContainer.addMapping(
                pathSpec,
                (req, resp) ->
                    new JettyWebSocketHandler(WebSocketManager.getInstance().getEngineIoServer()));
          });
    } catch (Exception ex) {
      LOG.error("Websocket configuration error: {}", ex.getMessage());
    }
  }

  private void registerSamlServlets()
      throws IOException, CertificateException, KeyStoreException, NoSuchAlgorithmException {
    if (!isSamlAuthEnabled()) {
      return;
    }

    MutableServletContextHandler contextHandler = environment.getApplicationContext();
    if (contextHandler.getSessionHandler() == null) {
      contextHandler.setSessionHandler(new SessionHandler());
    }

    SamlSettingsHolder.getInstance().initDefaultSettings(config);
    contextHandler.addServlet(new ServletHolder(new SamlLoginServlet()), "/api/v1/saml/login");
    contextHandler.addServlet(
        new ServletHolder(new SamlAssertionConsumerServlet(config.getAuthorizerConfiguration())),
        "/api/v1/saml/acs");
    contextHandler.addServlet(
        new ServletHolder(new SamlMetadataServlet()), "/api/v1/saml/metadata");
    contextHandler.addServlet(
        new ServletHolder(new SamlTokenRefreshServlet()), "/api/v1/saml/refresh");
    contextHandler.addServlet(
        new ServletHolder(
            new SamlLogoutServlet(
                config.getAuthenticationConfiguration(), config.getAuthorizerConfiguration())),
        "/api/v1/saml/logout");
  }

  private void registerAuthServlets() {
    if (!isConfidentialClientAuth()) {
      return;
    }

    CommonHelper.assertNotNull(
        "OidcConfiguration", config.getAuthenticationConfiguration().getOidcConfiguration());

    setupSessionHandler();

    AuthenticationCodeFlowHandler authenticationCodeFlowHandler =
        new AuthenticationCodeFlowHandler(
            config.getAuthenticationConfiguration(), config.getAuthorizerConfiguration());

    registerAuthenticationServlets(authenticationCodeFlowHandler);
  }

  private boolean isSamlAuthEnabled() {
    return config.getAuthenticationConfiguration() != null
        && config.getAuthenticationConfiguration().getProvider().equals(AuthProvider.SAML);
  }

  private boolean isConfidentialClientAuth() {
    return config.getAuthenticationConfiguration() != null
        && config.getAuthenticationConfiguration().getClientType().equals(ClientType.CONFIDENTIAL);
  }

  private void setupSessionHandler() {
    MutableServletContextHandler contextHandler = environment.getApplicationContext();
    SessionHandler sessionHandler = contextHandler.getSessionHandler();
    if (sessionHandler == null) {
      sessionHandler = new SessionHandler();
      contextHandler.setSessionHandler(sessionHandler);
    }

    SessionCookieConfig cookieConfig =
        Objects.requireNonNull(sessionHandler).getSessionCookieConfig();
    cookieConfig.setHttpOnly(true);
    cookieConfig.setSecure(isHttps());
    cookieConfig.setMaxAge(
        config.getAuthenticationConfiguration().getOidcConfiguration().getSessionExpiry());
    cookieConfig.setPath("/");
    sessionHandler.setMaxInactiveInterval(
        config.getAuthenticationConfiguration().getOidcConfiguration().getSessionExpiry());
  }

  private void registerAuthenticationServlets(AuthenticationCodeFlowHandler authHandler) {
    ServletHolder authLoginHolder = new ServletHolder(new AuthLoginServlet(authHandler));
    authLoginHolder.setName("oauth_login");
    environment.getApplicationContext().addServlet(authLoginHolder, "/api/v1/auth/login");

    ServletHolder authCallbackHolder = new ServletHolder(new AuthCallbackServlet(authHandler));
    authCallbackHolder.setName("auth_callback");
    environment.getApplicationContext().addServlet(authCallbackHolder, "/callback");

    ServletHolder authLogoutHolder = new ServletHolder(new AuthLogoutServlet(authHandler));
    authLogoutHolder.setName("auth_logout");
    environment.getApplicationContext().addServlet(authLogoutHolder, "/api/v1/auth/logout");

    ServletHolder refreshHolder = new ServletHolder(new AuthRefreshServlet(authHandler));
    refreshHolder.setName("auth_refresh");
    environment.getApplicationContext().addServlet(refreshHolder, "/api/v1/auth/refresh");
  }

  private boolean isHttps() {
    if (config.getServerFactory() instanceof DefaultServerFactory serverFactory) {
      ConnectorFactory connector = serverFactory.getApplicationConnectors().getFirst();
      return connector instanceof HttpsConnectorFactory;
    }
    return false;
  }
}
