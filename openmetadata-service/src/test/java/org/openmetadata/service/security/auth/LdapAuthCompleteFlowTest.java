package org.openmetadata.service.security.auth;

import static org.junit.jupiter.api.Assertions.*;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.ws.rs.client.Entity;
import jakarta.ws.rs.client.Invocation;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.NewCookie;
import jakarta.ws.rs.core.Response;
import java.time.Duration;
import java.util.*;
import lombok.extern.slf4j.Slf4j;
import org.glassfish.jersey.client.ClientProperties;
import org.junit.jupiter.api.*;
import org.openmetadata.schema.auth.LoginRequest;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.service.OpenMetadataApplicationTest;
import org.openmetadata.service.jdbi3.UserRepository;
import org.openmetadata.service.util.TestUtils;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.utility.DockerImageName;

@Slf4j
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class LdapAuthCompleteFlowTest extends OpenMetadataApplicationTest {

  private static final String AUTH_LOGIN_ENDPOINT = "/api/v1/auth/login";
  private static final String AUTH_LOGOUT_ENDPOINT = "/api/v1/auth/logout";

  private static GenericContainer<?> ldapContainer;
  private static String ldapHost;
  private static int ldapPort;

  private static final String TEST_USER_EMAIL = "testuser@testcompany.com";
  private static final String TEST_USER_PASSWORD = "testpass123";
  private static final String ADMIN_USER_EMAIL = "admin@testcompany.com";
  private static final String ADMIN_USER_PASSWORD = "admin123";
  private static final String ADMIN_PRINCIPAL_USER_EMAIL = "adminprincipal@testcompany.com";
  private static final String ADMIN_PRINCIPAL_USER_PASSWORD = "adminprincipal123";
  private static final String ADMIN_PRINCIPAL_USERNAME = "adminprincipal";

  @BeforeAll
  @Override
  public void createApplication() throws Exception {
    startLdapContainer();
    super.createApplication();
  }

  private void startLdapContainer() throws Exception {
    LOG.info("Starting LDAP container...");

    ldapContainer =
        new GenericContainer<>(DockerImageName.parse("osixia/openldap:1.5.0"))
            .withExposedPorts(389)
            .withEnv("LDAP_ORGANISATION", "TestCompany")
            .withEnv("LDAP_DOMAIN", "testcompany.com")
            .withEnv("LDAP_ADMIN_PASSWORD", "adminpassword")
            .withEnv("LDAP_CONFIG_PASSWORD", "config")
            .withEnv("LDAP_READONLY_USER", "false")
            .withEnv("LDAP_TLS", "false")
            .withCommand("--copy-service", "--loglevel", "debug")
            .withStartupTimeout(Duration.ofMinutes(2));

    ldapContainer.start();
    ldapHost = ldapContainer.getHost();
    ldapPort = ldapContainer.getMappedPort(389);

    LOG.info("LDAP container started at {}:{}", ldapHost, ldapPort);

    Thread.sleep(10000);

    loadTestLdapData();
  }

  private void loadTestLdapData() throws Exception {
    LOG.info("Loading test LDAP data...");

    LOG.info("Step 1: Creating organizational units");
    String ouLdif =
        "dn: ou=users,dc=testcompany,dc=com\n"
            + "objectClass: organizationalUnit\n"
            + "ou: users\n\n"
            + "dn: ou=groups,dc=testcompany,dc=com\n"
            + "objectClass: organizationalUnit\n"
            + "ou: groups";

    execLdapAdd(ouLdif, "organizational units");

    LOG.info("Step 2: Creating test user");
    String userLdif =
        "dn: uid=testuser,ou=users,dc=testcompany,dc=com\n"
            + "objectClass: inetOrgPerson\n"
            + "objectClass: posixAccount\n"
            + "objectClass: shadowAccount\n"
            + "uid: testuser\n"
            + "sn: User\n"
            + "givenName: Test\n"
            + "cn: Test User\n"
            + "displayName: Test User\n"
            + "uidNumber: 10001\n"
            + "gidNumber: 5000\n"
            + "userPassword: testpass123\n"
            + "loginShell: /bin/bash\n"
            + "homeDirectory: /home/testuser\n"
            + "mail: testuser@testcompany.com";

    execLdapAdd(userLdif, "test user");

    LOG.info("Step 3: Creating admin user");
    String adminLdif =
        "dn: uid=admin,ou=users,dc=testcompany,dc=com\n"
            + "objectClass: inetOrgPerson\n"
            + "objectClass: posixAccount\n"
            + "objectClass: shadowAccount\n"
            + "uid: admin\n"
            + "sn: Admin\n"
            + "givenName: System\n"
            + "cn: System Admin\n"
            + "displayName: System Admin\n"
            + "uidNumber: 10000\n"
            + "gidNumber: 5000\n"
            + "userPassword: admin123\n"
            + "loginShell: /bin/bash\n"
            + "homeDirectory: /home/admin\n"
            + "mail: admin@testcompany.com";

    execLdapAdd(adminLdif, "admin user");

    LOG.info("Step 4: Creating adminPrincipal test user");
    String adminPrincipalLdif =
        "dn: uid=adminprincipal,ou=users,dc=testcompany,dc=com\n"
            + "objectClass: inetOrgPerson\n"
            + "objectClass: posixAccount\n"
            + "objectClass: shadowAccount\n"
            + "uid: adminprincipal\n"
            + "sn: Principal\n"
            + "givenName: Admin\n"
            + "cn: Admin Principal\n"
            + "displayName: Admin Principal\n"
            + "uidNumber: 10002\n"
            + "gidNumber: 5000\n"
            + "userPassword: adminprincipal123\n"
            + "loginShell: /bin/bash\n"
            + "homeDirectory: /home/adminprincipal\n"
            + "mail: adminprincipal@testcompany.com";

    execLdapAdd(adminPrincipalLdif, "adminPrincipal test user");

    LOG.info("Step 5: Creating groups");
    String groupsLdif =
        "dn: cn=DataConsumer,ou=groups,dc=testcompany,dc=com\n"
            + "objectClass: groupOfNames\n"
            + "cn: DataConsumer\n"
            + "description: Data Consumer group\n"
            + "member: uid=testuser,ou=users,dc=testcompany,dc=com\n\n"
            + "dn: cn=admin,ou=groups,dc=testcompany,dc=com\n"
            + "objectClass: groupOfNames\n"
            + "cn: admin\n"
            + "description: Administrator group\n"
            + "member: uid=admin,ou=users,dc=testcompany,dc=com";

    execLdapAdd(groupsLdif, "groups");

    LOG.info("✓ All test LDAP data loaded successfully");
  }

  private void execLdapAdd(String ldifContent, String description) throws Exception {
    String[] ldapAddCommand = {
      "/bin/bash",
      "-c",
      "echo '"
          + ldifContent
          + "' | ldapadd -x -H ldap://localhost:389 -D 'cn=admin,dc=testcompany,dc=com' -w adminpassword"
    };

    org.testcontainers.containers.Container.ExecResult result =
        ldapContainer.execInContainer(ldapAddCommand);

    if (result.getExitCode() != 0) {
      LOG.error("Failed to add {}: {}", description, result.getStderr());
      throw new RuntimeException(
          "Failed to load " + description + ". Exit code: " + result.getExitCode());
    }
    LOG.info("✓ Added {}", description);
  }

  @BeforeAll
  void setupLdapConfiguration() throws Exception {
    Thread.sleep(3000);

    LOG.info("Application running on port: {}", APP.getLocalPort());
    LOG.info("LDAP server running at: {}:{}", ldapHost, ldapPort);

    updateAuthenticationConfigToLdap();
    LOG.info("Test setup complete - LDAP authentication configured");
  }

  private void updateAuthenticationConfigToLdap() throws Exception {
    LOG.info("Updating authentication configuration to LDAP...");

    Map<String, Object> ldapConfig = new HashMap<>();
    ldapConfig.put("host", ldapHost);
    ldapConfig.put("port", ldapPort);
    ldapConfig.put("dnAdminPrincipal", "cn=admin,dc=testcompany,dc=com");
    ldapConfig.put("dnAdminPassword", "adminpassword");
    ldapConfig.put("userBaseDN", "ou=users,dc=testcompany,dc=com");
    ldapConfig.put("groupBaseDN", "ou=groups,dc=testcompany,dc=com");
    ldapConfig.put("mailAttributeName", "mail");
    ldapConfig.put("groupAttributeName", "objectClass");
    ldapConfig.put("groupAttributeValue", "groupOfNames");
    ldapConfig.put("groupMemberAttributeName", "member");
    ldapConfig.put("allAttributeName", "*");
    ldapConfig.put("roleAdminName", "admin");
    ldapConfig.put("maxPoolSize", 10);
    ldapConfig.put("sslEnabled", false);

    Map<String, List<String>> roleMapping = new HashMap<>();
    roleMapping.put("cn=admin,ou=groups,dc=testcompany,dc=com", Arrays.asList("admin"));
    roleMapping.put(
        "cn=DataConsumer,ou=groups,dc=testcompany,dc=com", Arrays.asList("DataConsumer"));

    ldapConfig.put("authRolesMapping", new ObjectMapper().writeValueAsString(roleMapping));
    ldapConfig.put("authReassignRoles", Arrays.asList("*"));

    Map<String, Object> authConfig = new HashMap<>();
    authConfig.put("provider", "ldap");
    authConfig.put("providerName", "LDAP");
    authConfig.put("publicKeyUrls", new ArrayList<>());
    authConfig.put("clientId", "open-metadata");
    authConfig.put("authority", "http://localhost:" + APP.getLocalPort());
    authConfig.put("callbackUrl", "http://localhost:" + APP.getLocalPort() + "/callback");
    authConfig.put("jwtPrincipalClaims", Arrays.asList("email", "preferred_username", "sub"));
    authConfig.put("enableSelfSignup", true);
    authConfig.put("ldapConfiguration", ldapConfig);

    Map<String, Object> authorizerConfig = new HashMap<>();
    authorizerConfig.put("className", "org.openmetadata.service.security.DefaultAuthorizer");
    authorizerConfig.put("containerRequestFilter", "org.openmetadata.service.security.JwtFilter");
    authorizerConfig.put("adminPrincipals", Arrays.asList("admin", ADMIN_PRINCIPAL_USERNAME));
    authorizerConfig.put("testPrincipals", new ArrayList<>());
    authorizerConfig.put("allowedEmailRegistrationDomains", Arrays.asList("all"));
    authorizerConfig.put("principalDomain", "open-metadata.org");
    authorizerConfig.put("allowedDomains", new ArrayList<>());
    authorizerConfig.put("enforcePrincipalDomain", false);
    authorizerConfig.put("enableSecureSocketConnection", false);
    authorizerConfig.put("useRolesFromProvider", false);

    Map<String, Object> securityConfig = new HashMap<>();
    securityConfig.put("authenticationConfiguration", authConfig);
    securityConfig.put("authorizerConfiguration", authorizerConfig);

    Invocation.Builder request =
        client
            .target(getServerUrl() + "/api/v1/system/security/config")
            .request(MediaType.APPLICATION_JSON);

    for (Map.Entry<String, String> entry : TestUtils.ADMIN_AUTH_HEADERS.entrySet()) {
      request = request.header(entry.getKey(), entry.getValue());
    }

    Response response = request.put(Entity.json(securityConfig));

    LOG.info("Auth config update response status: {}", response.getStatus());

    if (response.getStatus() == 200 || response.getStatus() == 201) {
      LOG.info("✓ Successfully updated authentication configuration to LDAP");
      Thread.sleep(3000);
    } else {
      String error = response.readEntity(String.class);
      LOG.error("Failed to update authentication configuration: {}", error);
      fail("Failed to update authentication configuration - Status: " + response.getStatus());
    }
  }

  @Test
  @Order(1)
  void testLdapContainerStartup() {
    LOG.info("Testing LDAP container startup");
    assertNotNull(ldapContainer);
    assertTrue(ldapContainer.isRunning());
    assertNotNull(ldapHost);
    assertTrue(ldapPort > 0);
    LOG.info("LDAP container is running at {}:{}", ldapHost, ldapPort);
  }

  @Test
  @Order(3)
  void testSuccessfulLoginWithValidCredentials() throws Exception {
    LOG.info("Testing successful LDAP login with valid credentials");

    LoginRequest loginRequest = new LoginRequest();
    loginRequest.setEmail(TEST_USER_EMAIL);
    loginRequest.setPassword(Base64.getEncoder().encodeToString(TEST_USER_PASSWORD.getBytes()));

    Response response =
        client
            .target(getServerUrl() + AUTH_LOGIN_ENDPOINT)
            .request(MediaType.APPLICATION_JSON)
            .property(ClientProperties.FOLLOW_REDIRECTS, false)
            .post(Entity.json(loginRequest));

    LOG.info("Login response status: {}", response.getStatus());
    assertEquals(200, response.getStatus(), "Login should succeed with valid credentials");

    String responseBody = response.readEntity(String.class);
    LOG.info("Login response: {}", responseBody);

    Map<String, Object> jwtResponse = new ObjectMapper().readValue(responseBody, Map.class);

    assertNotNull(jwtResponse.get("accessToken"), "Access token should be present");
    assertEquals("Bearer", jwtResponse.get("tokenType"), "Token type should be Bearer");
    assertNotNull(jwtResponse.get("expiryDuration"), "Expiry duration should be present");
    assertNull(jwtResponse.get("refreshToken"), "Refresh token should not be sent to client");

    Map<String, NewCookie> cookies = response.getCookies();
    LOG.info("Session cookies: {}", cookies.keySet());
  }

  @Test
  @Order(4)
  void testFailedLoginWithInvalidPassword() throws Exception {
    LOG.info("Testing failed LDAP login with invalid password");

    LoginRequest loginRequest = new LoginRequest();
    loginRequest.setEmail(TEST_USER_EMAIL);
    loginRequest.setPassword(Base64.getEncoder().encodeToString("wrongpassword".getBytes()));

    Response response =
        client
            .target(getServerUrl() + AUTH_LOGIN_ENDPOINT)
            .request(MediaType.APPLICATION_JSON)
            .property(ClientProperties.FOLLOW_REDIRECTS, false)
            .post(Entity.json(loginRequest));

    LOG.info("Login response status: {}", response.getStatus());
    assertNotEquals(200, response.getStatus(), "Login should fail with invalid password");
    assertTrue(
        response.getStatus() == 401 || response.getStatus() == 500,
        "Should return 401 or 500 for invalid credentials");
  }

  @Test
  @Order(5)
  void testFailedLoginWithNonExistentUser() throws Exception {
    LOG.info("Testing failed LDAP login with non-existent user");

    LoginRequest loginRequest = new LoginRequest();
    loginRequest.setEmail("nonexistent@testcompany.com");
    loginRequest.setPassword(Base64.getEncoder().encodeToString("password".getBytes()));

    Response response =
        client
            .target(getServerUrl() + AUTH_LOGIN_ENDPOINT)
            .request(MediaType.APPLICATION_JSON)
            .property(ClientProperties.FOLLOW_REDIRECTS, false)
            .post(Entity.json(loginRequest));

    LOG.info("Login response status: {}", response.getStatus());
    assertNotEquals(200, response.getStatus(), "Login should fail with non-existent user");
  }

  @Test
  @Order(7)
  void testLogout() throws Exception {
    LOG.info("Testing logout flow");

    LoginRequest loginRequest = new LoginRequest();
    loginRequest.setEmail(TEST_USER_EMAIL);
    loginRequest.setPassword(Base64.getEncoder().encodeToString(TEST_USER_PASSWORD.getBytes()));

    Response loginResponse =
        client
            .target(getServerUrl() + AUTH_LOGIN_ENDPOINT)
            .request(MediaType.APPLICATION_JSON)
            .property(ClientProperties.FOLLOW_REDIRECTS, false)
            .post(Entity.json(loginRequest));

    assertEquals(200, loginResponse.getStatus(), "Login should succeed");

    Map<String, NewCookie> cookies = loginResponse.getCookies();

    Invocation.Builder logoutRequest =
        client
            .target(getServerUrl() + AUTH_LOGOUT_ENDPOINT)
            .request(MediaType.APPLICATION_JSON)
            .property(ClientProperties.FOLLOW_REDIRECTS, false);

    for (NewCookie cookie : cookies.values()) {
      logoutRequest = logoutRequest.cookie(cookie);
    }

    Response logoutResponse = logoutRequest.get();

    LOG.info("Logout response status: {}", logoutResponse.getStatus());
    assertEquals(200, logoutResponse.getStatus(), "Logout should succeed");
  }

  @Test
  @Order(8)
  void testAdminPrincipalsGrantsAdminPrivileges() throws Exception {
    LOG.info("Testing that users in adminPrincipals list get admin privileges");

    LoginRequest loginRequest = new LoginRequest();
    loginRequest.setEmail(ADMIN_PRINCIPAL_USER_EMAIL);
    loginRequest.setPassword(
        Base64.getEncoder().encodeToString(ADMIN_PRINCIPAL_USER_PASSWORD.getBytes()));

    Response response =
        client
            .target(getServerUrl() + AUTH_LOGIN_ENDPOINT)
            .request(MediaType.APPLICATION_JSON)
            .property(ClientProperties.FOLLOW_REDIRECTS, false)
            .post(Entity.json(loginRequest));

    LOG.info("AdminPrincipal login response status: {}", response.getStatus());
    assertEquals(200, response.getStatus(), "AdminPrincipal login should succeed");

    String responseBody = response.readEntity(String.class);
    Map<String, Object> jwtResponse = new ObjectMapper().readValue(responseBody, Map.class);

    assertNotNull(jwtResponse.get("accessToken"), "Access token should be present");

    // Verify that the user was granted admin privileges via adminPrincipals
    UserRepository userRepository =
        (UserRepository)
            org.openmetadata.service.Entity.getEntityRepository(
                org.openmetadata.service.Entity.USER);
    User user =
        userRepository.getByEmail(
            null, ADMIN_PRINCIPAL_USER_EMAIL, userRepository.getFields("id,name,email,isAdmin"));

    assertNotNull(user, "User should exist in database after login");
    assertTrue(
        user.getIsAdmin(), "User should have admin privileges via adminPrincipals configuration");

    LOG.info(
        "AdminPrincipal user '{}' successfully granted admin privileges via adminPrincipals",
        user.getName());
  }

  @Test
  @Order(9)
  void testMultipleLoginAttempts() throws Exception {
    LOG.info("Testing multiple failed login attempts");

    String testEmail = "multitest@testcompany.com";

    for (int i = 0; i < 3; i++) {
      LoginRequest loginRequest = new LoginRequest();
      loginRequest.setEmail(testEmail);
      loginRequest.setPassword(Base64.getEncoder().encodeToString("wrongpassword".getBytes()));

      Response response =
          client
              .target(getServerUrl() + AUTH_LOGIN_ENDPOINT)
              .request(MediaType.APPLICATION_JSON)
              .property(ClientProperties.FOLLOW_REDIRECTS, false)
              .post(Entity.json(loginRequest));

      LOG.info("Attempt {} - Response status: {}", i + 1, response.getStatus());
      assertNotEquals(200, response.getStatus(), "Login should fail with wrong password");

      Thread.sleep(500);
    }

    LoginAttemptCache.getInstance().recordSuccessfulLogin(testEmail);
  }

  private String getServerUrl() {
    return "http://localhost:" + APP.getLocalPort();
  }

  @AfterAll
  void cleanup() {
    if (ldapContainer != null && ldapContainer.isRunning()) {
      LOG.info("Stopping LDAP container");
      ldapContainer.stop();
    }
  }
}
