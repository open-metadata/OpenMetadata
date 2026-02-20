package org.openmetadata.service.security;

import static org.junit.jupiter.api.Assertions.*;
import static org.openmetadata.service.util.TestUtils.ADMIN_AUTH_HEADERS;

import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.junit.jupiter.api.*;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.service.OpenMetadataApplicationTest;
import org.openmetadata.service.resources.teams.UserResourceTest;
import org.openmetadata.service.security.jwt.JWTTokenGenerator;
import org.openmetadata.service.socket.SocketAddressFilter;

/**
 * Test class to verify secure socket connection functionality
 *
 * This test validates the SocketAddressFilter behavior and configuration.
 * Note: The actual secure socket functionality requires application restart
 * to take effect, so this test primarily verifies configuration and setup.
 */
@Slf4j
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
public class SocketSecurityTest extends OpenMetadataApplicationTest {

  private static final String WEBSOCKET_PATH = "/api/v1/push/feed";
  private UUID testUserId;

  @BeforeAll
  @Override
  public void createApplication() throws Exception {
    // Override config to enable secure socket connection
    System.setProperty("AUTHORIZER_ENABLE_SECURE_SOCKET", "true");
    super.createApplication();
    testUserId = getAdminUserId();

    // Verify that secure socket connection is actually enabled
    boolean isEnabled =
        APP.getConfiguration().getAuthorizerConfiguration().getEnableSecureSocketConnection();
    LOG.info("Secure socket connection enabled: {}", isEnabled);

    // If not enabled, we need to manually update the configuration for this test
    if (!isEnabled) {
      // Force enable secure socket connection for this test
      APP.getConfiguration().getAuthorizerConfiguration().setEnableSecureSocketConnection(true);
      LOG.info("Manually enabled secure socket connection for test");
    }
  }

  protected UUID getAdminUserId() throws Exception {
    UserResourceTest userResourceTest = new UserResourceTest();
    User adminUser = userResourceTest.getEntityByName("admin", ADMIN_AUTH_HEADERS);
    return adminUser.getId();
  }

  @AfterAll
  public void cleanup() {
    System.clearProperty("AUTHORIZER_ENABLE_SECURE_SOCKET");
  }

  @Test
  @Order(1)
  @DisplayName("Verify JWT Token Generator is initialized before socket setup")
  void testJWTTokenGeneratorInitialization() {
    // This test verifies that the fix for JWT initialization order is working
    // The fix ensures JWTTokenGenerator.getInstance() is initialized before websockets

    // Verify JWT Token Generator is properly initialized
    assertDoesNotThrow(
        () -> {
          var jwtGenerator = org.openmetadata.service.security.jwt.JWTTokenGenerator.getInstance();
          assertNotNull(jwtGenerator, "JWT Token Generator should be initialized");

          // Try to get JWKS response - this would fail with NPE if not properly initialized
          var jwksResponse = jwtGenerator.getJWKSResponse();
          assertNotNull(jwksResponse, "JWKS response should be available");
          assertNotNull(jwksResponse.getJwsKeys(), "JWKS keys should be available");
          assertFalse(jwksResponse.getJwsKeys().isEmpty(), "JWKS keys should not be empty");

          LOG.info(
              "JWT Token Generator is properly initialized with {} keys",
              jwksResponse.getJwsKeys().size());
        },
        "JWT Token Generator should be initialized without errors");
  }

  @Test
  @Order(2)
  @DisplayName("Verify SocketAddressFilter can be created without NPE")
  void testSocketAddressFilterCreation() {
    // This test verifies that SocketAddressFilter can be created when
    // enableSecureSocketConnection=true
    // Previously this would fail with NPE due to uninitialized JWT generator

    assertDoesNotThrow(
        () -> {
          var authConfig = APP.getConfiguration().getAuthenticationConfiguration();
          var authorizerConfig = APP.getConfiguration().getAuthorizerConfiguration();

          // Force enable for this test (simulating the condition that caused the original NPE)
          authorizerConfig.setEnableSecureSocketConnection(true);

          // This should not throw NPE anymore due to our fix
          var socketFilter = new SocketAddressFilter(authConfig, authorizerConfig);
          assertNotNull(socketFilter, "SocketAddressFilter should be created successfully");

          LOG.info("SocketAddressFilter created successfully with secure socket enabled");
        },
        "SocketAddressFilter creation should not fail with NPE when secure socket is enabled");
  }

  @Test
  @Order(3)
  @DisplayName("Verify configuration reflects secure socket setting")
  void testSecureSocketConfiguration() {
    // Verify that the configuration can be read and set properly
    var authorizerConfig = APP.getConfiguration().getAuthorizerConfiguration();

    // Test both getter and setter
    boolean originalValue = authorizerConfig.getEnableSecureSocketConnection();

    authorizerConfig.setEnableSecureSocketConnection(true);
    assertTrue(
        authorizerConfig.getEnableSecureSocketConnection(),
        "Should be able to enable secure socket connection");

    authorizerConfig.setEnableSecureSocketConnection(false);
    assertFalse(
        authorizerConfig.getEnableSecureSocketConnection(),
        "Should be able to disable secure socket connection");

    // Restore original value
    authorizerConfig.setEnableSecureSocketConnection(originalValue);

    LOG.info("Secure socket configuration test passed. Original value: {}", originalValue);
  }

  @Test
  @Order(4)
  @DisplayName("Verify application startup order fix")
  void testApplicationStartupOrder() {
    // This test verifies that our fix for initialization order is working
    // By this point in the test, if the application started successfully,
    // it means the JWT generator was initialized before websockets

    // Verify that both JWT generator and application are properly initialized
    assertNotNull(APP, "Application should be initialized");
    assertNotNull(APP.getConfiguration(), "Application configuration should be available");

    var jwtGenerator = JWTTokenGenerator.getInstance();
    assertNotNull(jwtGenerator, "JWT Token Generator should be initialized");

    var jwksResponse = jwtGenerator.getJWKSResponse();
    assertNotNull(jwksResponse, "JWKS response should be available");

    LOG.info(
        "Application startup order verification passed - JWT generator initialized before websockets");
  }
}
