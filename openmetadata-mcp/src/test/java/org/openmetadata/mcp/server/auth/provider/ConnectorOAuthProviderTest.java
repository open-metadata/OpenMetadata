package org.openmetadata.mcp.server.auth.provider;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.util.Base64;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.MockedStatic;
import org.mockito.Mockito;
import org.mockito.junit.jupiter.MockitoExtension;
import org.openmetadata.mcp.auth.AccessToken;
import org.openmetadata.mcp.auth.AuthorizationCode;
import org.openmetadata.mcp.auth.AuthorizationParams;
import org.openmetadata.mcp.auth.OAuthClientInformation;
import org.openmetadata.mcp.auth.OAuthToken;
import org.openmetadata.mcp.auth.RefreshToken;
import org.openmetadata.mcp.auth.exception.AuthorizeException;
import org.openmetadata.mcp.auth.exception.TokenException;
import org.openmetadata.schema.api.services.CreateDatabaseService;
import org.openmetadata.schema.api.services.DatabaseConnection;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.entity.services.ServiceType;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.services.connections.common.OAuthCredentials;
import org.openmetadata.schema.services.connections.database.SnowflakeConnection;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.DatabaseServiceRepository;
import org.openmetadata.service.secrets.SecretsManager;
import org.openmetadata.service.util.EntityUtil.Fields;

@ExtendWith(MockitoExtension.class)
class ConnectorOAuthProviderTest {

  @Mock private SecretsManager secretsManager;
  @Mock private DatabaseServiceRepository serviceRepository;
  @Mock private HttpClient httpClient;

  private ConnectorOAuthProvider provider;
  private final String baseUrl = "http://localhost:8585";
  private final String connectorName = "snowflake_test";

  @BeforeEach
  void setUp() {
    // Create provider with mocked dependencies
    provider = new ConnectorOAuthProvider(secretsManager, serviceRepository, baseUrl);
    // Use reflection to inject mocked HttpClient
    setHttpClient(provider, httpClient);
  }

  /**
   * Helper method to create a mock User for Entity.getEntityByName
   */
  private User createMockUser() {
    User mockUser = new User();
    mockUser.setName("admin");
    mockUser.setEmail("admin@openmetadata.org");
    mockUser.setId(UUID.randomUUID());
    mockUser.setIsAdmin(true);
    return mockUser;
  }

  /**
   * Helper method to inject HttpClient via reflection since constructor creates its own instance.
   */
  private void setHttpClient(ConnectorOAuthProvider provider, HttpClient httpClient) {
    try {
      java.lang.reflect.Field field = ConnectorOAuthProvider.class.getDeclaredField("httpClient");
      field.setAccessible(true);
      field.set(provider, httpClient);
    } catch (NoSuchFieldException | IllegalAccessException e) {
      throw new RuntimeException("Failed to inject HttpClient", e);
    }
  }

  @Test
  void testPkceVerificationSuccess() throws Exception {
    try (MockedStatic<Entity> entityMock = Mockito.mockStatic(Entity.class)) {
      // Setup Entity mock
      User mockUser = createMockUser();
      entityMock
          .when(
              () ->
                  Entity.getEntityByName(
                      eq(Entity.USER), anyString(), anyString(), any(Include.class)))
          .thenReturn(mockUser);

      // Given: Valid PKCE flow setup
      String codeVerifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
      String codeChallenge = computeCodeChallenge(codeVerifier);

      OAuthClientInformation client = createTestClient();
      String authCode = setupAuthorizationWithPkce(client, codeChallenge);

      // When: Exchange authorization code with correct code_verifier
      AuthorizationCode code = new AuthorizationCode();
      code.setCode(authCode);
      code.setCodeVerifier(codeVerifier);

      CompletableFuture<OAuthToken> tokenFuture = provider.exchangeAuthorizationCode(client, code);
      OAuthToken token = tokenFuture.get();

      // Then: Token should be issued successfully
      assertThat(token).isNotNull();
      assertThat(token.getAccessToken()).isNotNull();
      assertThat(token.getTokenType()).isEqualTo("Bearer");
      assertThat(token.getExpiresIn()).isEqualTo(3600);
    }
  }

  @Test
  void testPkceVerificationFailure() throws Exception {
    // Given: PKCE flow with mismatched verifier
    String correctVerifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
    String wrongVerifier = "invalid_verifier_that_does_not_match";
    String codeChallenge = computeCodeChallenge(correctVerifier);

    OAuthClientInformation client = createTestClient();
    String authCode = setupAuthorizationWithPkce(client, codeChallenge);

    // When: Exchange with wrong code_verifier
    AuthorizationCode code = new AuthorizationCode();
    code.setCode(authCode);
    code.setCodeVerifier(wrongVerifier);

    // Then: Should throw TokenException with PKCE verification error
    assertThatThrownBy(() -> provider.exchangeAuthorizationCode(client, code).get())
        .cause()
        .isInstanceOf(TokenException.class)
        .hasMessageContaining("PKCE verification failed");
  }

  @Test
  void testPkceVerificationMissing() throws Exception {
    // Given: Authorization code created with code_challenge
    String codeVerifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
    String codeChallenge = computeCodeChallenge(codeVerifier);

    OAuthClientInformation client = createTestClient();
    String authCode = setupAuthorizationWithPkce(client, codeChallenge);

    // When: Exchange without code_verifier
    AuthorizationCode code = new AuthorizationCode();
    code.setCode(authCode);
    code.setCodeVerifier(null); // Missing verifier

    // Then: Should throw TokenException requiring code_verifier
    assertThatThrownBy(() -> provider.exchangeAuthorizationCode(client, code).get())
        .cause()
        .isInstanceOf(TokenException.class)
        .hasMessageContaining("code_verifier is required");
  }

  @Test
  void testAuthorizationCodeGeneration() throws Exception {
    // Given: Connector with valid OAuth credentials
    OAuthClientInformation client = createTestClient();
    provider.registerClient(client).get();

    OAuthCredentials oauth = createValidOAuthCredentials();
    DatabaseService service = createDatabaseService(oauth);

    when(serviceRepository.getByName(any(), eq(connectorName), any(Fields.class)))
        .thenReturn(service);
    when(secretsManager.decryptServiceConnectionConfig(any(), anyString(), any(ServiceType.class)))
        .thenReturn(createSnowflakeConnection(oauth));

    // When: Request authorization with PKCE
    String codeVerifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
    String codeChallenge = computeCodeChallenge(codeVerifier);

    AuthorizationParams params = new AuthorizationParams();
    params.setState(connectorName);
    params.setCodeChallenge(codeChallenge);
    params.setRedirectUri(URI.create("http://localhost:3000/callback"));
    params.setScopes(List.of("read:metadata"));

    CompletableFuture<String> authCodeFuture = provider.authorize(client, params);
    String authCode = authCodeFuture.get();

    // Then: Authorization code should be generated
    assertThat(authCode).isNotNull();
    assertThat(authCode).isNotEmpty();
    assertThat(UUID.fromString(authCode)).isNotNull(); // Valid UUID format
  }

  @Test
  void testTokenExchange() throws Exception {
    // Given: Valid authorization code without PKCE
    OAuthClientInformation client = createTestClient();
    String authCode = setupAuthorizationWithoutPkce(client);

    // When: Exchange authorization code for tokens
    AuthorizationCode code = new AuthorizationCode();
    code.setCode(authCode);

    CompletableFuture<OAuthToken> tokenFuture = provider.exchangeAuthorizationCode(client, code);
    OAuthToken token = tokenFuture.get();

    // Then: Valid OAuth token should be returned
    assertThat(token).isNotNull();
    assertThat(token.getAccessToken()).isNotNull();
    assertThat(token.getRefreshToken()).isNotNull();
    assertThat(token.getTokenType()).isEqualTo("Bearer");
    assertThat(token.getExpiresIn()).isEqualTo(3600);
    assertThat(token.getScope()).contains("read:metadata");
  }

  @Test
  void testTokenRefresh() throws Exception {
    // Given: Connector with expired access token
    OAuthClientInformation client = createTestClient();
    provider.registerClient(client).get();

    OAuthCredentials expiredOauth = createExpiredOAuthCredentials();
    DatabaseService service = createDatabaseService(expiredOauth);

    when(serviceRepository.getByName(any(), eq(connectorName), any(Fields.class)))
        .thenReturn(service);
    when(secretsManager.decryptServiceConnectionConfig(any(), anyString(), any(ServiceType.class)))
        .thenReturn(createSnowflakeConnection(expiredOauth));

    // Mock HTTP response for token refresh
    String newAccessToken = "new_access_token_" + UUID.randomUUID();
    mockTokenRefreshResponse(newAccessToken, 3600);

    // When: Authorize (which should trigger token refresh internally)
    AuthorizationParams params = new AuthorizationParams();
    params.setState(connectorName);
    params.setRedirectUri(URI.create("http://localhost:3000/callback"));

    CompletableFuture<String> authCodeFuture = provider.authorize(client, params);
    String authCode = authCodeFuture.get();

    // Then: Authorization should succeed and token refresh should be called
    assertThat(authCode).isNotNull();
    verify(httpClient, times(1)).send(any(HttpRequest.class), any());
  }

  @Test
  void testTokenNotExpired() throws Exception {
    // Given: Connector with valid non-expired token
    OAuthClientInformation client = createTestClient();
    provider.registerClient(client).get();

    OAuthCredentials validOauth = createValidOAuthCredentials();
    DatabaseService service = createDatabaseService(validOauth);

    when(serviceRepository.getByName(any(), eq(connectorName), any(Fields.class)))
        .thenReturn(service);
    when(secretsManager.decryptServiceConnectionConfig(any(), anyString(), any(ServiceType.class)))
        .thenReturn(createSnowflakeConnection(validOauth));

    // When: Authorize
    AuthorizationParams params = new AuthorizationParams();
    params.setState(connectorName);
    params.setRedirectUri(URI.create("http://localhost:3000/callback"));

    CompletableFuture<String> authCodeFuture = provider.authorize(client, params);
    String authCode = authCodeFuture.get();

    // Then: Authorization should succeed WITHOUT calling token refresh
    assertThat(authCode).isNotNull();
    verify(httpClient, never()).send(any(HttpRequest.class), any());
  }

  @Test
  void testInvalidAuthorizationCode() {
    // Given: Client with registered info
    OAuthClientInformation client = createTestClient();

    // When: Try to exchange invalid authorization code
    AuthorizationCode code = new AuthorizationCode();
    code.setCode("invalid_code_that_does_not_exist");

    // Then: Should throw TokenException
    assertThatThrownBy(() -> provider.exchangeAuthorizationCode(client, code).get())
        .cause()
        .isInstanceOf(TokenException.class)
        .hasMessageContaining("Invalid authorization code");
  }

  @Test
  void testExpiredAuthorizationCode() throws Exception {
    // Given: Authorization code that has expired
    OAuthClientInformation client = createTestClient();
    String authCode = setupExpiredAuthorizationCode(client);

    // When: Try to exchange expired code
    AuthorizationCode code = new AuthorizationCode();
    code.setCode(authCode);

    // Then: Should throw TokenException
    assertThatThrownBy(() -> provider.exchangeAuthorizationCode(client, code).get())
        .cause()
        .isInstanceOf(TokenException.class)
        .hasMessageContaining("Authorization code expired");
  }

  @Test
  void testRegisterClient() throws Exception {
    // Given: New OAuth client information
    OAuthClientInformation client = createTestClient();

    // When: Register client
    CompletableFuture<Void> registerFuture = provider.registerClient(client);
    registerFuture.get();

    // Then: Client should be retrievable
    CompletableFuture<OAuthClientInformation> getClientFuture =
        provider.getClient(client.getClientId());
    OAuthClientInformation retrievedClient = getClientFuture.get();

    assertThat(retrievedClient).isNotNull();
    assertThat(retrievedClient.getClientId()).isEqualTo(client.getClientId());
  }

  @Test
  void testLoadAccessToken() throws Exception {
    // Given: Authorization code exchanged for access token
    OAuthClientInformation client = createTestClient();
    String authCode = setupAuthorizationWithoutPkce(client);

    AuthorizationCode code = new AuthorizationCode();
    code.setCode(authCode);
    OAuthToken token = provider.exchangeAuthorizationCode(client, code).get();

    // When: Load access token
    CompletableFuture<AccessToken> loadedTokenFuture =
        provider.loadAccessToken(token.getAccessToken());
    AccessToken loadedToken = loadedTokenFuture.get();

    // Then: Access token should be found
    assertThat(loadedToken).isNotNull();
    assertThat(loadedToken.getToken()).isEqualTo(token.getAccessToken());
    assertThat(loadedToken.getClientId()).isEqualTo(client.getClientId());
  }

  @Test
  void testLoadRefreshToken() throws Exception {
    // Given: Authorization code exchanged for tokens
    OAuthClientInformation client = createTestClient();
    String authCode = setupAuthorizationWithoutPkce(client);

    AuthorizationCode code = new AuthorizationCode();
    code.setCode(authCode);
    OAuthToken token = provider.exchangeAuthorizationCode(client, code).get();

    // When: Load refresh token
    CompletableFuture<RefreshToken> loadedTokenFuture =
        provider.loadRefreshToken(client, token.getRefreshToken());
    RefreshToken loadedToken = loadedTokenFuture.get();

    // Then: Refresh token should be found
    assertThat(loadedToken).isNotNull();
    assertThat(loadedToken.getToken()).isEqualTo(token.getRefreshToken());
    assertThat(loadedToken.getClientId()).isEqualTo(client.getClientId());
  }

  @Test
  void testExchangeRefreshToken() throws Exception {
    // Given: Valid refresh token
    OAuthClientInformation client = createTestClient();
    String authCode = setupAuthorizationWithoutPkce(client);

    AuthorizationCode code = new AuthorizationCode();
    code.setCode(authCode);
    OAuthToken initialToken = provider.exchangeAuthorizationCode(client, code).get();

    RefreshToken refreshToken = new RefreshToken();
    refreshToken.setToken(initialToken.getRefreshToken());
    refreshToken.setClientId(client.getClientId());
    refreshToken.setScopes(List.of("read:metadata"));

    // When: Exchange refresh token for new access token
    CompletableFuture<OAuthToken> newTokenFuture =
        provider.exchangeRefreshToken(client, refreshToken, List.of("read:metadata"));
    OAuthToken newToken = newTokenFuture.get();

    // Then: New access token should be issued
    assertThat(newToken).isNotNull();
    assertThat(newToken.getAccessToken()).isNotNull();
    assertThat(newToken.getAccessToken()).isNotEqualTo(initialToken.getAccessToken());
    assertThat(newToken.getRefreshToken()).isEqualTo(initialToken.getRefreshToken());
  }

  @Test
  void testRevokeAccessToken() throws Exception {
    // Given: Valid access token
    OAuthClientInformation client = createTestClient();
    String authCode = setupAuthorizationWithoutPkce(client);

    AuthorizationCode code = new AuthorizationCode();
    code.setCode(authCode);
    OAuthToken token = provider.exchangeAuthorizationCode(client, code).get();

    // When: Revoke access token
    AccessToken accessToken = provider.loadAccessToken(token.getAccessToken()).get();
    provider.revokeToken(accessToken).get();

    // Then: Token should no longer be loadable
    CompletableFuture<AccessToken> loadedTokenFuture =
        provider.loadAccessToken(token.getAccessToken());
    AccessToken loadedToken = loadedTokenFuture.get();
    assertThat(loadedToken).isNull();
  }

  @Test
  void testRevokeRefreshToken() throws Exception {
    // Given: Valid refresh token
    OAuthClientInformation client = createTestClient();
    String authCode = setupAuthorizationWithoutPkce(client);

    AuthorizationCode code = new AuthorizationCode();
    code.setCode(authCode);
    OAuthToken token = provider.exchangeAuthorizationCode(client, code).get();

    // When: Revoke refresh token
    RefreshToken refreshToken = provider.loadRefreshToken(client, token.getRefreshToken()).get();
    provider.revokeToken(refreshToken).get();

    // Then: Token should no longer be loadable
    CompletableFuture<RefreshToken> loadedTokenFuture =
        provider.loadRefreshToken(client, token.getRefreshToken());
    RefreshToken loadedToken = loadedTokenFuture.get();
    assertThat(loadedToken).isNull();
  }

  @Test
  void testGetConnectorToken() throws Exception {
    // Given: Authorization code exchanged for MCP token
    OAuthClientInformation client = createTestClient();
    String authCode = setupAuthorizationWithoutPkce(client);

    AuthorizationCode code = new AuthorizationCode();
    code.setCode(authCode);
    OAuthToken mcpToken = provider.exchangeAuthorizationCode(client, code).get();

    // When: Get connector token using MCP token
    String connectorToken = provider.getConnectorToken(mcpToken.getAccessToken());

    // Then: Should return the underlying connector access token
    assertThat(connectorToken).isNotNull();
    assertThat(connectorToken).startsWith("connector_access_token_");
  }

  @Test
  void testAuthorizationWithoutConnectorName() {
    // Given: Client and params without connector name (state)
    OAuthClientInformation client = createTestClient();

    AuthorizationParams params = new AuthorizationParams();
    params.setState(null); // Missing connector name
    params.setRedirectUri(URI.create("http://localhost:3000/callback"));

    // When/Then: Should throw AuthorizeException
    assertThatThrownBy(() -> provider.authorize(client, params).get())
        .cause()
        .isInstanceOf(AuthorizeException.class)
        .hasMessageContaining("connector_name parameter required");
  }

  @Test
  void testAuthorizationWithNonExistentConnector() {
    // Given: Client and params with non-existent connector
    OAuthClientInformation client = createTestClient();

    when(serviceRepository.getByName(any(), eq("non_existent_connector"), any(Fields.class)))
        .thenReturn(null);

    AuthorizationParams params = new AuthorizationParams();
    params.setState("non_existent_connector");
    params.setRedirectUri(URI.create("http://localhost:3000/callback"));

    // When/Then: Should throw AuthorizeException
    assertThatThrownBy(() -> provider.authorize(client, params).get())
        .cause()
        .isInstanceOf(AuthorizeException.class)
        .hasMessageContaining("Connector not found");
  }

  @Test
  void testAuthorizationWithoutOAuthConfigured() throws Exception {
    // Given: Connector without OAuth credentials
    OAuthClientInformation client = createTestClient();
    provider.registerClient(client).get();

    DatabaseService service = createDatabaseService(null); // No OAuth

    when(serviceRepository.getByName(any(), eq(connectorName), any(Fields.class)))
        .thenReturn(service);
    when(secretsManager.decryptServiceConnectionConfig(any(), anyString(), any(ServiceType.class)))
        .thenReturn(createSnowflakeConnection(null));

    AuthorizationParams params = new AuthorizationParams();
    params.setState(connectorName);
    params.setRedirectUri(URI.create("http://localhost:3000/callback"));

    // When/Then: Should throw AuthorizeException
    assertThatThrownBy(() -> provider.authorize(client, params).get())
        .cause()
        .isInstanceOf(AuthorizeException.class)
        .hasMessageContaining("does not have OAuth configured");
  }

  // ============== Helper Methods ==============

  private OAuthClientInformation createTestClient() {
    OAuthClientInformation client = new OAuthClientInformation();
    client.setClientId("test-client-" + UUID.randomUUID());
    client.setClientSecret("test-secret");
    return client;
  }

  private OAuthCredentials createValidOAuthCredentials() {
    OAuthCredentials oauth = new OAuthCredentials();
    oauth.setClientId("snowflake_client_id");
    oauth.setClientSecret("snowflake_client_secret");
    oauth.setAccessToken("connector_access_token_" + UUID.randomUUID());
    oauth.setRefreshToken("connector_refresh_token_" + UUID.randomUUID());
    oauth.setExpiresAt((int) Instant.now().plusSeconds(3600).getEpochSecond()); // Valid for 1 hour
    oauth.setTokenEndpoint(
        URI.create("https://account.snowflakecomputing.com/oauth/token-request"));
    return oauth;
  }

  private OAuthCredentials createExpiredOAuthCredentials() {
    OAuthCredentials oauth = new OAuthCredentials();
    oauth.setClientId("snowflake_client_id");
    oauth.setClientSecret("snowflake_client_secret");
    oauth.setAccessToken("expired_access_token");
    oauth.setRefreshToken("refresh_token_for_renewal");
    oauth.setExpiresAt(
        (int) Instant.now().minusSeconds(3600).getEpochSecond()); // Expired 1 hour ago
    oauth.setTokenEndpoint(
        URI.create("https://account.snowflakecomputing.com/oauth/token-request"));
    return oauth;
  }

  private DatabaseService createDatabaseService(OAuthCredentials oauth) {
    DatabaseService service = new DatabaseService();
    service.setName(connectorName);
    service.setServiceType(CreateDatabaseService.DatabaseServiceType.Snowflake);

    DatabaseConnection connection = new DatabaseConnection();
    connection.setConfig(createSnowflakeConnection(oauth));
    service.setConnection(connection);

    return service;
  }

  private SnowflakeConnection createSnowflakeConnection(OAuthCredentials oauth) {
    SnowflakeConnection connection = new SnowflakeConnection();
    connection.setAccount("test_account");
    connection.setOauth(oauth);
    return connection;
  }

  private String setupAuthorizationWithPkce(OAuthClientInformation client, String codeChallenge)
      throws Exception {
    provider.registerClient(client).get();

    OAuthCredentials oauth = createValidOAuthCredentials();
    DatabaseService service = createDatabaseService(oauth);

    when(serviceRepository.getByName(any(), eq(connectorName), any(Fields.class)))
        .thenReturn(service);
    when(secretsManager.decryptServiceConnectionConfig(any(), anyString(), any(ServiceType.class)))
        .thenReturn(createSnowflakeConnection(oauth));

    AuthorizationParams params = new AuthorizationParams();
    params.setState(connectorName);
    params.setCodeChallenge(codeChallenge);
    params.setRedirectUri(URI.create("http://localhost:3000/callback"));
    params.setScopes(List.of("read:metadata"));

    return provider.authorize(client, params).get();
  }

  private String setupAuthorizationWithoutPkce(OAuthClientInformation client) throws Exception {
    provider.registerClient(client).get();

    OAuthCredentials oauth = createValidOAuthCredentials();
    DatabaseService service = createDatabaseService(oauth);

    when(serviceRepository.getByName(any(), eq(connectorName), any(Fields.class)))
        .thenReturn(service);
    when(secretsManager.decryptServiceConnectionConfig(any(), anyString(), any(ServiceType.class)))
        .thenReturn(createSnowflakeConnection(oauth));

    AuthorizationParams params = new AuthorizationParams();
    params.setState(connectorName);
    params.setRedirectUri(URI.create("http://localhost:3000/callback"));
    params.setScopes(List.of("read:metadata"));

    return provider.authorize(client, params).get();
  }

  private String setupExpiredAuthorizationCode(OAuthClientInformation client) throws Exception {
    String authCode = setupAuthorizationWithoutPkce(client);

    // Use reflection to modify expiry time to past
    java.lang.reflect.Field field =
        ConnectorOAuthProvider.class.getDeclaredField("authorizationCodes");
    field.setAccessible(true);
    @SuppressWarnings("unchecked")
    java.util.Map<String, Object> authorizationCodes =
        (java.util.Map<String, Object>) field.get(provider);

    Object codeEntity = authorizationCodes.get(authCode);
    java.lang.reflect.Field expiresAtField = codeEntity.getClass().getDeclaredField("expiresAt");
    expiresAtField.setAccessible(true);
    expiresAtField.setLong(codeEntity, Instant.now().minusSeconds(600).getEpochSecond());

    return authCode;
  }

  private void mockTokenRefreshResponse(String newAccessToken, long expiresIn)
      throws IOException, InterruptedException {
    String responseBody =
        String.format(
            "{\"access_token\":\"%s\",\"expires_in\":%d,\"token_type\":\"Bearer\"}",
            newAccessToken, expiresIn);

    HttpResponse<String> mockResponse = mock(HttpResponse.class);
    when(mockResponse.statusCode()).thenReturn(200);
    when(mockResponse.body()).thenReturn(responseBody);

    @SuppressWarnings("unchecked")
    HttpResponse<Object> mockResponseCast = (HttpResponse<Object>) (HttpResponse<?>) mockResponse;
    when(httpClient.send(any(HttpRequest.class), any())).thenReturn(mockResponseCast);
  }

  private String computeCodeChallenge(String codeVerifier) throws NoSuchAlgorithmException {
    MessageDigest digest = MessageDigest.getInstance("SHA-256");
    byte[] hash = digest.digest(codeVerifier.getBytes(StandardCharsets.UTF_8));
    return Base64.getUrlEncoder().withoutPadding().encodeToString(hash);
  }
}
