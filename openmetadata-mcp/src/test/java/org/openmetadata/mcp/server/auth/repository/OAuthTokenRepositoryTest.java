package org.openmetadata.mcp.server.auth.repository;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.MockedStatic;
import org.mockito.junit.jupiter.MockitoExtension;
import org.openmetadata.mcp.auth.RefreshToken;
import org.openmetadata.service.Entity;
import org.openmetadata.service.fernet.Fernet;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.oauth.OAuthRecords.OAuthAccessTokenRecord;
import org.openmetadata.service.jdbi3.oauth.OAuthRecords.OAuthRefreshTokenRecord;

/**
 * Unit tests for OAuthTokenRepository - token storage, retrieval, revocation, and encryption.
 *
 * <p>Tests cover: - Refresh token storage with hashing and encryption - Token retrieval and
 * decryption - Token revocation - Expired token cleanup - Security (hashing prevents raw lookup)
 *
 * <p>Note: These are mock-based unit tests. For integration tests with real database, see
 * OAuthFlowIntegrationTest.
 */
@ExtendWith(MockitoExtension.class)
public class OAuthTokenRepositoryTest {

  @Mock private CollectionDAO.OAuthRefreshTokenDAO refreshTokenDAO;
  @Mock private Fernet fernet;

  private OAuthTokenRepository tokenRepository;

  /** A client may revoke only its own tokens (RFC 7009 section 2.1). */
  @Test
  void accessTokenIsRevokedOnlyForTheClientItWasIssuedTo() {
    CollectionDAO dao = mock(CollectionDAO.class);
    CollectionDAO.OAuthAccessTokenDAO accessTokens = mock(CollectionDAO.OAuthAccessTokenDAO.class);
    when(dao.oauthAccessTokenDAO()).thenReturn(accessTokens);
    String hash = OAuthTokenRepository.hashToken("access-jwt");
    when(accessTokens.findByTokenHash(hash))
        .thenReturn(
            new OAuthAccessTokenRecord(
                UUID.randomUUID(), hash, "encrypted", "owner-client", "alice", List.of(), 1L));

    try (MockedStatic<Entity> entity = mockStatic(Entity.class);
        MockedStatic<Fernet> fernets = mockStatic(Fernet.class)) {
      entity.when(Entity::getCollectionDAO).thenReturn(dao);
      fernets.when(Fernet::getInstance).thenReturn(fernet);
      tokenRepository = new OAuthTokenRepository();

      assertThat(tokenRepository.revokeAccessTokenIssuedTo("access-jwt", "other-client")).isFalse();
      verify(accessTokens, never()).delete(hash);
      assertThat(tokenRepository.revokeAccessTokenIssuedTo("access-jwt", "owner-client")).isTrue();
      verify(accessTokens).delete(hash);
    }
  }

  /** Only the owning client revokes a live refresh token, and the grant's access tokens go too. */
  @Test
  void refreshTokenIsRevokedOnlyForTheClientItWasIssuedTo() {
    CollectionDAO dao = mock(CollectionDAO.class);
    when(dao.oauthRefreshTokenDAO()).thenReturn(refreshTokenDAO);
    String live = OAuthTokenRepository.hashToken("live-refresh");
    String used = OAuthTokenRepository.hashToken("used-refresh");
    when(refreshTokenDAO.findByTokenHash(live)).thenReturn(refreshRecord(live, false));
    when(refreshTokenDAO.findByTokenHash(used)).thenReturn(refreshRecord(used, true));

    try (MockedStatic<Entity> entity = mockStatic(Entity.class);
        MockedStatic<Fernet> fernets = mockStatic(Fernet.class)) {
      entity.when(Entity::getCollectionDAO).thenReturn(dao);
      fernets.when(Fernet::getInstance).thenReturn(fernet);
      tokenRepository = new OAuthTokenRepository();

      assertThat(tokenRepository.revokeRefreshTokenIssuedTo("live-refresh", "other-client"))
          .isFalse();
      assertThat(tokenRepository.revokeRefreshTokenIssuedTo("used-refresh", "owner-client"))
          .isFalse();
      verify(refreshTokenDAO, never()).revokeWithAccessTokens(any(), any(), any());

      assertThat(tokenRepository.revokeRefreshTokenIssuedTo("live-refresh", "owner-client"))
          .isTrue();
      verify(refreshTokenDAO).revokeWithAccessTokens(live, "owner-client", "alice");
    }
  }

  private static OAuthRefreshTokenRecord refreshRecord(String hash, boolean revoked) {
    return new OAuthRefreshTokenRecord(
        UUID.randomUUID(), hash, "encrypted", "owner-client", "alice", List.of(), 1L, revoked);
  }

  @Test
  void testRefreshTokenDataModel() {
    String tokenValue = "test-refresh-token-" + UUID.randomUUID();
    String clientId = "test-client-id";
    String userName = "test-user";
    List<String> scopes = List.of("read:metadata", "write:metadata");
    long expiresAt = System.currentTimeMillis() + 3600000;

    RefreshToken token = new RefreshToken(tokenValue, clientId, userName, scopes, expiresAt);

    assertThat(token.getToken()).isEqualTo(tokenValue);
    assertThat(token.getClientId()).isEqualTo(clientId);
    assertThat(token.getUserName()).isEqualTo(userName);
    assertThat(token.getScopes()).containsExactlyInAnyOrderElementsOf(scopes);
    assertThat(token.getExpiresAt()).isEqualTo(expiresAt);
  }

  @Test
  void testRefreshTokenSetters() {
    RefreshToken token = new RefreshToken();

    String tokenValue = "setter-test-token";
    String clientId = "setter-client-id";
    String userName = "setter-user";
    List<String> scopes = List.of("read:metadata");
    long expiresAt = System.currentTimeMillis() + 3600000;

    token.setToken(tokenValue);
    token.setClientId(clientId);
    token.setUserName(userName);
    token.setScopes(scopes);
    token.setExpiresAt(expiresAt);

    assertThat(token.getToken()).isEqualTo(tokenValue);
    assertThat(token.getClientId()).isEqualTo(clientId);
    assertThat(token.getUserName()).isEqualTo(userName);
    assertThat(token.getScopes()).containsExactlyInAnyOrderElementsOf(scopes);
    assertThat(token.getExpiresAt()).isEqualTo(expiresAt);
  }

  @Test
  void testRefreshTokenExpiration() {
    long currentTime = System.currentTimeMillis();
    long expiryTime = currentTime + 30L * 24 * 60 * 60 * 1000;

    RefreshToken token =
        new RefreshToken("token", "client", "user", List.of("read:metadata"), expiryTime);

    assertThat(token.getExpiresAt()).isGreaterThan(currentTime);
    assertThat(token.getExpiresAt() - currentTime).isGreaterThan(29L * 24 * 60 * 60 * 1000);
  }

  @Test
  void testRefreshTokenWithEmptyScopes() {
    RefreshToken token =
        new RefreshToken("token", "client", "user", List.of(), System.currentTimeMillis());

    assertThat(token.getScopes()).isEmpty();
  }

  @Test
  void testRefreshTokenWithMultipleScopes() {
    List<String> scopes =
        List.of("read:metadata", "write:metadata", "read:tables", "write:tables", "admin:lineage");

    RefreshToken token =
        new RefreshToken("token", "client", "user", scopes, System.currentTimeMillis());

    assertThat(token.getScopes()).hasSize(5);
    assertThat(token.getScopes()).containsExactlyInAnyOrderElementsOf(scopes);
  }
}
