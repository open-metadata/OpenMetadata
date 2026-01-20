package org.openmetadata.mcp.server.auth.handlers;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

import java.util.concurrent.CompletableFuture;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.openmetadata.mcp.server.auth.repository.OAuthTokenRepository;

/**
 * Unit tests for RevocationHandler - RFC 7009 compliant token revocation.
 *
 * <p>Tests cover:
 * - Refresh token revocation
 * - Access token revocation
 * - RFC 7009 compliance (returns success for non-existent tokens)
 * - Token type hint handling
 * - Error handling and logging
 */
@ExtendWith(MockitoExtension.class)
public class RevocationHandlerTest {

  @Mock private OAuthTokenRepository tokenRepository;

  private RevocationHandler revocationHandler;

  @BeforeEach
  void setUp() {
    revocationHandler = new RevocationHandler(tokenRepository);
  }

  @Test
  void testRevokeRefreshToken() {
    String token = "test-refresh-token";

    CompletableFuture<Void> result = revocationHandler.revokeToken(token, "refresh_token");

    assertThat(result).isNotNull();
    result.join();
    verify(tokenRepository).revokeRefreshToken(token);
    verify(tokenRepository, never()).deleteAccessToken(anyString());
  }

  @Test
  void testRevokeAccessToken() {
    String token = "test-access-token";

    CompletableFuture<Void> result = revocationHandler.revokeToken(token, "access_token");

    assertThat(result).isNotNull();
    result.join();
    verify(tokenRepository).deleteAccessToken(token);
    verify(tokenRepository, never()).revokeRefreshToken(anyString());
  }

  @Test
  void testRevokeWithoutTypeHint() {
    String token = "test-token";

    CompletableFuture<Void> result = revocationHandler.revokeToken(token, null);

    assertThat(result).isNotNull();
    result.join();
    verify(tokenRepository).revokeRefreshToken(token);
  }

  @Test
  void testRevokeNonExistentToken() {
    String token = "non-existent-token";
    doThrow(new RuntimeException("Token not found"))
        .when(tokenRepository)
        .revokeRefreshToken(token);
    doThrow(new RuntimeException("Token not found")).when(tokenRepository).deleteAccessToken(token);

    CompletableFuture<Void> result = revocationHandler.revokeToken(token, null);

    assertThat(result).isNotNull();
    result.join();
    verify(tokenRepository).revokeRefreshToken(token);
    verify(tokenRepository).deleteAccessToken(token);
  }

  @Test
  void testRevokeEmptyToken() {
    CompletableFuture<Void> result = revocationHandler.revokeToken("", null);

    assertThat(result).isNotNull();
    result.join();
    verify(tokenRepository, never()).revokeRefreshToken(anyString());
    verify(tokenRepository, never()).deleteAccessToken(anyString());
  }

  @Test
  void testRevokeNullToken() {
    CompletableFuture<Void> result = revocationHandler.revokeToken(null, null);

    assertThat(result).isNotNull();
    result.join();
    verify(tokenRepository, never()).revokeRefreshToken(anyString());
    verify(tokenRepository, never()).deleteAccessToken(anyString());
  }

  @Test
  void testRevokeWithRefreshTokenHintButIsAccessToken() {
    String token = "access-token";
    doThrow(new RuntimeException("Token not found"))
        .when(tokenRepository)
        .revokeRefreshToken(token);

    CompletableFuture<Void> result = revocationHandler.revokeToken(token, "refresh_token");

    assertThat(result).isNotNull();
    result.join();
    verify(tokenRepository).revokeRefreshToken(token);
    verify(tokenRepository, never()).deleteAccessToken(anyString());
  }

  @Test
  void testRevokeWithAccessTokenHintButIsRefreshToken() {
    String token = "refresh-token";

    CompletableFuture<Void> result = revocationHandler.revokeToken(token, "access_token");

    assertThat(result).isNotNull();
    result.join();
    verify(tokenRepository).deleteAccessToken(token);
    verify(tokenRepository, never()).revokeRefreshToken(anyString());
  }

  @Test
  void testRevokeWithInvalidTypeHint() {
    String token = "test-token";

    CompletableFuture<Void> result = revocationHandler.revokeToken(token, "invalid_hint");

    assertThat(result).isNotNull();
    result.join();
    verify(tokenRepository, never()).revokeRefreshToken(anyString());
    verify(tokenRepository, never()).deleteAccessToken(anyString());
  }
}
