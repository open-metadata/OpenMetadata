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

import java.lang.reflect.Field;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.mcp.auth.OAuthClientInformation;
import org.openmetadata.mcp.auth.RefreshToken;
import org.openmetadata.mcp.auth.exception.TokenException;
import org.openmetadata.mcp.server.auth.repository.OAuthTokenRepository;
import org.openmetadata.schema.auth.JWTAuthMechanism;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.security.jwt.JWTTokenGenerator;

class UserSSOOAuthProviderTest {

  private static final String ISSUER = "https://om.test";
  private static final String CLIENT_ID = "client-1";

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
