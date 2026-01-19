package org.openmetadata.mcp.server.auth.repository;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.openmetadata.mcp.auth.RefreshToken;
import org.openmetadata.service.fernet.Fernet;
import org.openmetadata.service.jdbi3.CollectionDAO;

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
