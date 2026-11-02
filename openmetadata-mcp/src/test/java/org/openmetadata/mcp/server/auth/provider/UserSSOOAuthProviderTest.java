package org.openmetadata.mcp.server.auth.provider;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.PrintWriter;
import java.io.StringWriter;
import java.lang.reflect.Field;
import java.net.URI;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.mcp.auth.OAuthClientInformation;
import org.openmetadata.mcp.auth.RefreshToken;
import org.openmetadata.mcp.auth.exception.TokenException;
import org.openmetadata.mcp.server.auth.repository.McpPendingAuthRequestRepository;
import org.openmetadata.mcp.server.auth.repository.OAuthAuthorizationCodeRepository;
import org.openmetadata.mcp.server.auth.repository.OAuthClientRepository;
import org.openmetadata.mcp.server.auth.repository.OAuthTokenRepository;
import org.openmetadata.schema.auth.JWTAuthMechanism;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.oauth.OAuthRecords.McpPendingAuthRequest;
import org.openmetadata.service.security.jwt.JWTTokenGenerator;

class UserSSOOAuthProviderTest {

  private static final String ISSUER = "https://om.test";
  private static final String CLIENT_ID = "client-1";
  private static final String MCP_REDIRECT_URI = "https://mcp-client.example.com/callback";
  private static final String AUTH_REQUEST_ID = "auth-req-1";
  private static final String USER_NAME = "alice";

  @Test
  void exchangeRefreshToken_storesAnAccessTokenNamingItsClient() throws Exception {
    OAuthTokenRepository tokenRepo = refreshTokenRepository();
    JWTTokenGenerator jwtGenerator = jwtGenerator();
    UserSSOOAuthProvider provider = newProvider(tokenRepo, jwtGenerator);

    try (MockedStatic<Entity> entity = mockStatic(Entity.class)) {
      stubUser(entity);
      provider.exchangeRefreshToken(registeredClient(), presentedToken(), null).join();
    }

    // The new access token names its client and is stored, so a revoke can reach it.
    verify(jwtGenerator)
        .generateJWTToken(
            eq("alice"),
            any(),
            anyBoolean(),
            any(),
            anyLong(),
            anyBoolean(),
            any(),
            any(),
            eq(CLIENT_ID));
    verify(tokenRepo).storeAccessToken(any(), eq(CLIENT_ID), eq("alice"), any());
  }

  /** The access token is stored before the rotation, so a failed write keeps the grant usable. */
  @Test
  void exchangeRefreshToken_aFailedAccessTokenWriteLeavesTheRefreshTokenUnrotated()
      throws Exception {
    OAuthTokenRepository tokenRepo = refreshTokenRepository();
    doThrow(new IllegalStateException("database unavailable"))
        .when(tokenRepo)
        .storeAccessToken(any(), any(), any(), any());
    UserSSOOAuthProvider provider = newProvider(tokenRepo, jwtGenerator());

    try (MockedStatic<Entity> entity = mockStatic(Entity.class)) {
      stubUser(entity);
      TokenException failed =
          assertThrows(
              TokenException.class,
              () ->
                  provider.exchangeRefreshToken(registeredClient(), presentedToken(), null).join());

      assertThat(failed.getError()).isEqualTo("server_error");
    }
    verify(tokenRepo, never()).rotateRefreshToken(any(), any(), any(), any(), any());
  }

  @Test
  void handleSSOCallbackWithDbState_keepsTheGrantUnderTheAccountsOwnName() throws Exception {
    // A SAML NameID keeps the provider's casing; the account it resolves to is lowercase.
    McpPendingAuthRequestRepository pendingRepo = mock(McpPendingAuthRequestRepository.class);
    when(pendingRepo.findByAuthRequestId(AUTH_REQUEST_ID)).thenReturn(samplePendingRequest());
    OAuthClientInformation client = mock(OAuthClientInformation.class);
    when(client.validateRedirectUri(URI.create(MCP_REDIRECT_URI)))
        .thenReturn(URI.create(MCP_REDIRECT_URI));
    OAuthClientRepository clientRepo = mock(OAuthClientRepository.class);
    when(clientRepo.findByClientId(CLIENT_ID)).thenReturn(client);
    OAuthAuthorizationCodeRepository codeRepo = mock(OAuthAuthorizationCodeRepository.class);
    UserSSOOAuthProvider provider = newProvider(pendingRepo, clientRepo, codeRepo);
    HttpServletResponse response = mock(HttpServletResponse.class);
    when(response.getWriter()).thenReturn(new PrintWriter(new StringWriter()));

    try (MockedStatic<Entity> entity = mockStatic(Entity.class)) {
      entity
          .when(() -> Entity.getEntityByName(Entity.USER, "Alice", "", Include.NON_DELETED))
          .thenReturn(new User().withName(USER_NAME));
      provider.handleSSOCallbackWithDbState(
          mock(HttpServletRequest.class),
          response,
          "Alice",
          "alice@corp.example",
          "mcp:" + AUTH_REQUEST_ID);
    }

    verify(codeRepo)
        .store(
            anyString(),
            eq(CLIENT_ID),
            eq(USER_NAME),
            anyString(),
            anyString(),
            any(),
            any(),
            anyLong());
  }

  private static McpPendingAuthRequest samplePendingRequest() {
    return new McpPendingAuthRequest(
        AUTH_REQUEST_ID,
        CLIENT_ID,
        "codeChallenge-123456789012345678901234567890123456789012",
        "S256",
        MCP_REDIRECT_URI,
        "mcp-client-state-xyz",
        List.of("openid", "profile"),
        "pac4j-state-abc",
        "pac4j-nonce",
        "pac4j-verifier",
        System.currentTimeMillis() + 600_000L);
  }

  /** Allocates a UserSSOOAuthProvider without running its constructor and injects mock repos. */
  private static UserSSOOAuthProvider newProvider(
      McpPendingAuthRequestRepository pendingRepo,
      OAuthClientRepository clientRepo,
      OAuthAuthorizationCodeRepository codeRepo)
      throws Exception {
    sun.misc.Unsafe unsafe = getUnsafe();
    UserSSOOAuthProvider provider =
        (UserSSOOAuthProvider) unsafe.allocateInstance(UserSSOOAuthProvider.class);
    setField(provider, "pendingAuthRepository", pendingRepo);
    setField(provider, "clientRepository", clientRepo);
    setField(provider, "codeRepository", codeRepo);
    setField(provider, "issuer", ISSUER);
    return provider;
  }

  private static OAuthTokenRepository refreshTokenRepository() {
    RefreshToken stored =
        new RefreshToken(
            "old-token", CLIENT_ID, List.of("openid"), System.currentTimeMillis() + 60_000L);
    stored.setUserName("alice");
    OAuthTokenRepository tokenRepo = mock(OAuthTokenRepository.class);
    when(tokenRepo.findRefreshToken("old-token")).thenReturn(stored);
    return tokenRepo;
  }

  private static JWTTokenGenerator jwtGenerator() {
    JWTTokenGenerator jwtGenerator = mock(JWTTokenGenerator.class);
    when(jwtGenerator.generateJWTToken(
            anyString(), any(), anyBoolean(), any(), anyLong(), anyBoolean(), any(), any(), any()))
        .thenReturn(new JWTAuthMechanism().withJWTToken("jwt"));
    return jwtGenerator;
  }

  private static RefreshToken presentedToken() {
    RefreshToken presented = new RefreshToken();
    presented.setToken("old-token");
    return presented;
  }

  private static void stubUser(MockedStatic<Entity> entity) {
    entity
        .when(
            () ->
                Entity.getEntityByName(
                    eq(Entity.USER), eq("alice"), anyString(), eq(Include.NON_DELETED)))
        .thenReturn(new User().withName("alice").withEmail("alice@corp.example"));
  }

  private static OAuthClientInformation registeredClient() {
    OAuthClientInformation client = mock(OAuthClientInformation.class);
    when(client.getClientId()).thenReturn(CLIENT_ID);
    return client;
  }

  /** Allocates a UserSSOOAuthProvider without running its constructor and injects mocks. */
  private static UserSSOOAuthProvider newProvider(
      OAuthTokenRepository tokenRepo, JWTTokenGenerator jwtGenerator) throws Exception {
    sun.misc.Unsafe unsafe = getUnsafe();
    UserSSOOAuthProvider provider =
        (UserSSOOAuthProvider) unsafe.allocateInstance(UserSSOOAuthProvider.class);
    setField(provider, "tokenRepository", tokenRepo);
    setField(provider, "jwtGenerator", jwtGenerator);
    setField(provider, "issuer", ISSUER);
    return provider;
  }

  private static sun.misc.Unsafe getUnsafe() throws Exception {
    Field unsafeField = sun.misc.Unsafe.class.getDeclaredField("theUnsafe");
    unsafeField.setAccessible(true);
    return (sun.misc.Unsafe) unsafeField.get(null);
  }

  private static void setField(Object target, String fieldName, Object value) throws Exception {
    Field field = target.getClass().getDeclaredField(fieldName);
    field.setAccessible(true);
    field.set(target, value);
  }
}
