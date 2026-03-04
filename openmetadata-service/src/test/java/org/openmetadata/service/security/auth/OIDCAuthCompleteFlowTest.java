package org.openmetadata.service.security.auth;

import static org.junit.jupiter.api.Assertions.*;
import static org.junit.jupiter.api.Assertions.fail;
import static org.openmetadata.service.util.TestUtils.ADMIN_AUTH_HEADERS;

import jakarta.ws.rs.client.Invocation;
import jakarta.ws.rs.core.*;
import java.net.URI;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.*;
import lombok.extern.slf4j.Slf4j;
import org.glassfish.jersey.client.ClientProperties;
import org.junit.jupiter.api.*;
import org.openmetadata.service.OpenMetadataApplicationTest;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.containers.wait.strategy.Wait;
import org.testcontainers.utility.DockerImageName;

/**
 * OIDC Complete Flow Integration Test
 *
 * This test validates the complete OIDC authentication flow with a real test server
 * and the IDPTestResource providing mock OIDC provider endpoints.
 *
 * It tests the full flow:
 * 1. Login -> Redirect to IDP
 * 2. IDP Authorization -> Return auth code
 * 3. Callback -> Exchange code for tokens
 * 4. Redirect to frontend with tokens
 */
@Slf4j
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
public class OIDCAuthCompleteFlowTest extends OpenMetadataApplicationTest {

  private static final String AUTH_LOGIN_ENDPOINT = "/api/v1/auth/login";
  private static final String AUTH_CALLBACK_ENDPOINT = "/callback";

  // Mock OAuth2 server container
  private static GenericContainer<?> mockOAuth2Server;
  private static String mockOAuth2ServerUrl;

  @BeforeAll
  @Override
  public void createApplication() throws Exception {
    // Start mock OAuth2 server container
    startMockOAuth2Server();
    super.createApplication();
  }

  private void startMockOAuth2Server() {
    LOG.info("Starting mock OAuth2 server container...");

    // Using mock-oauth2-server from NAV (Norwegian Labour and Welfare Administration)
    // This is a lightweight mock server specifically designed for testing OAuth2/OIDC flows
    mockOAuth2Server =
        new GenericContainer<>(DockerImageName.parse("ghcr.io/navikt/mock-oauth2-server:2.1.0"))
            .withExposedPorts(8080)
            .waitingFor(
                Wait.forHttp("/default/.well-known/openid-configuration")
                    .forPort(8080)
                    .forStatusCode(200));

    mockOAuth2Server.start();

    String host = mockOAuth2Server.getHost();
    Integer port = mockOAuth2Server.getMappedPort(8080);
    mockOAuth2ServerUrl = String.format("http://%s:%d", host, port);

    LOG.info("Mock OAuth2 server started at: {}", mockOAuth2ServerUrl);
    LOG.info(
        "Discovery endpoint: {}/default/.well-known/openid-configuration", mockOAuth2ServerUrl);
  }

  @BeforeAll
  void setupOIDCConfiguration() throws Exception {
    // Wait for application to be ready
    Thread.sleep(3000);

    LOG.info("Application running on port: {}", APP.getLocalPort());
    LOG.info("Mock OAuth2 server running at: {}", mockOAuth2ServerUrl);

    // First verify the mock OAuth2 server discovery endpoint is accessible
    String discoveryUrl = mockOAuth2ServerUrl + "/default/.well-known/openid-configuration";
    LOG.info("Testing mock OAuth2 server discovery endpoint at: {}", discoveryUrl);

    try {
      // Test with a simple HTTP client first
      Response response = client.target(discoveryUrl).request().get();
      if (response.getStatus() == 200) {
        LOG.info("Mock OAuth2 server discovery endpoint is accessible");
        Map<String, Object> discovery = response.readEntity(Map.class);
        LOG.info("Discovery document issuer: {}", discovery.get("issuer"));
        LOG.info(
            "Discovery document authorization_endpoint: {}",
            discovery.get("authorization_endpoint"));
      } else {
        LOG.error("Discovery endpoint returned status: {}", response.getStatus());
        fail("Mock OAuth2 server discovery endpoint not accessible");
      }
    } catch (Exception e) {
      LOG.error("Failed to access mock OAuth2 server discovery endpoint", e);
      fail("Mock OAuth2 server discovery endpoint not accessible: " + e.getMessage());
    }

    // Now update the authentication configuration to use the mock OAuth2 server
    updateAuthenticationConfig();
    LOG.info("Test setup complete - OIDC configured with mock OAuth2 server");
  }

  private void updateAuthenticationConfig() {
    LOG.info("Updating authentication configuration to use mock OAuth2 server...");
    LOG.info("Mock OAuth2 server URL: {}", mockOAuth2ServerUrl);
    LOG.info("Application server URL: {}", getServerUrl());

    // Create the OIDC configuration pointing to the mock OAuth2 server
    Map<String, Object> oidcConfig = new HashMap<>();
    oidcConfig.put("type", "custom");
    oidcConfig.put("id", "test-client");
    oidcConfig.put("secret", "test-secret");
    // Use the mock OAuth2 server's discovery endpoint
    String discoveryUri = mockOAuth2ServerUrl + "/default/.well-known/openid-configuration";
    LOG.info("Setting discoveryUri to: {}", discoveryUri);
    oidcConfig.put("discoveryUri", discoveryUri);
    oidcConfig.put("useNonce", "false");
    oidcConfig.put("preferredJwsAlgorithm", "RS256");
    oidcConfig.put("responseType", "code");
    oidcConfig.put("scope", "openid email profile offline_access");
    oidcConfig.put("maxClockSkew", 60);
    oidcConfig.put("clientAuthenticationMethod", "client_secret_post");
    oidcConfig.put("disablePkce", true);
    oidcConfig.put("tokenValidity", 3600);
    oidcConfig.put("serverUrl", getServerUrl());
    oidcConfig.put("callbackUrl", getServerUrl() + "/callback");
    oidcConfig.put("maxAge", "0");
    oidcConfig.put("prompt", "");
    oidcConfig.put("tenant", "");

    // Create the authentication configuration
    Map<String, Object> authConfig = new HashMap<>();
    authConfig.put("clientType", "confidential");
    authConfig.put("provider", "custom-oidc");
    authConfig.put("providerName", "Test OIDC Provider");
    authConfig.put("publicKeyUrls", new ArrayList<>());
    authConfig.put("authority", mockOAuth2ServerUrl);
    authConfig.put("clientId", "test-client");
    authConfig.put("callbackUrl", getServerUrl() + "/callback");
    authConfig.put("jwtPrincipalClaims", Arrays.asList("email", "preferred_username", "sub"));
    authConfig.put("enableSelfSignup", true);
    authConfig.put("oidcConfiguration", oidcConfig);

    // Create the authorizer configuration (required by API)
    Map<String, Object> authorizerConfig = new HashMap<>();
    authorizerConfig.put("className", "org.openmetadata.service.security.DefaultAuthorizer");
    authorizerConfig.put("containerRequestFilter", "org.openmetadata.service.security.JwtFilter");
    authorizerConfig.put("adminPrincipals", Arrays.asList("admin"));
    authorizerConfig.put("testPrincipals", new ArrayList<>());
    authorizerConfig.put("allowedEmailRegistrationDomains", Arrays.asList("all"));
    authorizerConfig.put("principalDomain", "open-metadata.org");
    authorizerConfig.put("allowedDomains", new ArrayList<>());
    authorizerConfig.put("enforcePrincipalDomain", false);
    authorizerConfig.put("enableSecureSocketConnection", false);
    authorizerConfig.put("useRolesFromProvider", false);

    // Create the security configuration wrapper
    Map<String, Object> securityConfig = new HashMap<>();
    securityConfig.put("authenticationConfiguration", authConfig);
    securityConfig.put("authorizerConfiguration", authorizerConfig);

    // Update the security configuration via API
    Invocation.Builder request =
        client
            .target(getServerUrl() + "/api/v1/system/security/config")
            .request(MediaType.APPLICATION_JSON);

    // Add authentication headers
    for (Map.Entry<String, String> entry : ADMIN_AUTH_HEADERS.entrySet()) {
      request = request.header(entry.getKey(), entry.getValue());
    }

    Response response = request.put(jakarta.ws.rs.client.Entity.json(securityConfig));

    LOG.info("Auth config update response status: {}", response.getStatus());

    if (response.getStatus() == 200 || response.getStatus() == 201) {
      LOG.info("✓ Successfully updated authentication configuration to custom OIDC");
      Map<String, Object> updatedConfig = response.readEntity(Map.class);
      Map<String, Object> authenticationConfig =
          (Map<String, Object>) updatedConfig.get("authenticationConfiguration");
      if (authenticationConfig != null) {
        LOG.info("  Provider: {}", authenticationConfig.get("provider"));
        LOG.info("  Provider Name: {}", authenticationConfig.get("providerName"));
      }
      try {
        Thread.sleep(2000);
      } catch (InterruptedException e) {
        Thread.currentThread().interrupt();
      }
    } else {
      LOG.error("Failed to update authentication configuration. Status: {}", response.getStatus());
      String error = response.readEntity(String.class);
      LOG.error("Error response: {}", error);
      fail(
          "Failed to update authentication configuration - Status: "
              + response.getStatus()
              + ", Error: "
              + error);
    }
  }

  @Test
  @Order(1)
  void testMockOAuth2ServerStartup() {
    LOG.info("Testing mock OAuth2 server startup");
    assertNotNull(mockOAuth2Server);
    assertTrue(mockOAuth2Server.isRunning());
    assertNotNull(mockOAuth2ServerUrl);
    LOG.info("Mock OAuth2 server is running at: {}", mockOAuth2ServerUrl);

    // Test discovery endpoint
    String discoveryUrl = mockOAuth2ServerUrl + "/default/.well-known/openid-configuration";
    Response response = client.target(discoveryUrl).request().get();
    assertEquals(200, response.getStatus());
    LOG.info("Mock OAuth2 server discovery endpoint is accessible");
  }

  @Test
  @Order(2)
  void testOIDCConfigurationUpdate() {
    LOG.info("Testing OIDC configuration update");

    // The configuration should have been updated in setupOIDCConfiguration
    // Verify by checking if login redirects to the mock OAuth2 server
    Response loginResponse =
        client
            .target(getServerUrl() + AUTH_LOGIN_ENDPOINT)
            .queryParam("redirectUri", "http://localhost:3000")
            .request(MediaType.APPLICATION_JSON)
            .property(ClientProperties.FOLLOW_REDIRECTS, false)
            .get();

    assertEquals(302, loginResponse.getStatus(), "Login should redirect after OIDC config");

    String location = loginResponse.getHeaderString("Location");
    assertNotNull(location);

    // Should redirect to the mock OAuth2 server's authorize endpoint
    assertTrue(
        location.contains(mockOAuth2ServerUrl + "/default/authorize"),
        "Should redirect to mock OAuth2 server authorize endpoint");
    LOG.info("OIDC configuration successfully updated");
  }

  @Test
  @Order(3)
  void testCompleteOIDCFlow() {
    // First, initiate a login to get a valid state parameter
    Response loginResponse =
        client
            .target(getServerUrl() + AUTH_LOGIN_ENDPOINT)
            .queryParam("redirectUri", "http://localhost:3000")
            .request(MediaType.APPLICATION_JSON)
            .property(ClientProperties.FOLLOW_REDIRECTS, false)
            .get();

    assertEquals(302, loginResponse.getStatus(), "Login should redirect to IDP");

    String authorizationUrl = loginResponse.getHeaderString("Location");
    assertNotNull(authorizationUrl, "Should have authorization URL");

    // Extract parameters from the authorization URL
    URI authUri = URI.create(authorizationUrl);
    Map<String, String> authParams = parseQueryParams(authUri.getQuery());
    String stateFromLogin = authParams.get("state");
    String redirectUri = authParams.get("redirect_uri");
    assertNotNull(stateFromLogin, "State parameter should be present in authorization URL");
    assertNotNull(redirectUri, "Redirect URI should be present in authorization URL");

    LOG.info("Got state from login flow: {}", stateFromLogin);
    LOG.info("Redirect URI: {}", redirectUri);

    // Get the session cookies from the login response
    Map<String, NewCookie> cookies = loginResponse.getCookies();

    // Actually call the mock OAuth2 server's authorization endpoint
    // The mock OAuth2 server will automatically redirect with an authorization code
    Response authResponse =
        client
            .target(authorizationUrl)
            .request()
            .property(ClientProperties.FOLLOW_REDIRECTS, false)
            .get();

    // The mock OAuth2 server should redirect back with an authorization code
    int authStatus = authResponse.getStatus();
    LOG.info("Mock OAuth2 server authorization response status: {}", authStatus);

    String authCode = null;
    String returnedState = null;

    if (authStatus == 302) {
      // Extract the authorization code from the redirect
      String location = authResponse.getHeaderString("Location");
      assertNotNull(location, "Should have redirect location from OAuth2 server");
      LOG.info("OAuth2 server redirects to: {}", location);

      URI callbackUri = URI.create(location);
      Map<String, String> callbackParams = parseQueryParams(callbackUri.getQuery());
      authCode = callbackParams.get("code");
      returnedState = callbackParams.get("state");

      assertNotNull(authCode, "Authorization code should be present");
      assertEquals(stateFromLogin, returnedState, "State should match");
    } else {
      // For mock OAuth2 server that returns 200 with login page,
      // we'll use a simulated authorization code
      LOG.info("Mock OAuth2 server returned login page, using simulated auth code");
      authCode = "simulated-auth-code-" + UUID.randomUUID();
      returnedState = stateFromLogin;
    }

    LOG.info("Using authorization code: {}", authCode);

    // Step 4: Call the callback endpoint with the authorization code and state
    Invocation.Builder callbackRequest =
        client
            .target(getServerUrl() + AUTH_CALLBACK_ENDPOINT)
            .queryParam("code", authCode)
            .queryParam("state", returnedState)
            .request()
            .property(ClientProperties.FOLLOW_REDIRECTS, false);

    // Add session cookies to maintain state
    for (NewCookie cookie : cookies.values()) {
      callbackRequest = callbackRequest.cookie(cookie);
    }

    Response callbackResponse = callbackRequest.get();

    LOG.info("Callback response status: {}", callbackResponse.getStatus());
    assertEquals(
        302, callbackResponse.getStatus(), "Callback should redirect after processing auth code");

    String redirectLocation = callbackResponse.getHeaderString("Location");
    assertNotNull(redirectLocation, "Callback should provide redirect location");
    LOG.info("Callback redirects to: {}", redirectLocation);

    // Verify it redirects to the frontend with tokens
    assertTrue(redirectLocation.contains("id_token"), "Should redirect to frontend with tokens");
  }

  private Map<String, String> parseQueryParams(String query) {
    Map<String, String> params = new HashMap<>();
    if (query != null) {
      for (String param : query.split("&")) {
        String[] kv = param.split("=", 2);
        if (kv.length == 2) {
          params.put(kv[0], URLDecoder.decode(kv[1], StandardCharsets.UTF_8));
        }
      }
    }
    return params;
  }

  private String getServerUrl() {
    return "http://localhost:" + APP.getLocalPort();
  }

  @AfterAll
  void cleanup() {
    // Stop the mock OAuth2 server container
    if (mockOAuth2Server != null && mockOAuth2Server.isRunning()) {
      LOG.info("Stopping mock OAuth2 server container");
      mockOAuth2Server.stop();
    }
  }
}
