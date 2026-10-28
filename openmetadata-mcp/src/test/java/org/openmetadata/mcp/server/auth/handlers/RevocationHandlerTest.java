package org.openmetadata.mcp.server.auth.handlers;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

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

  private static final String CLIENT_ID = "mcp-client";

  @Mock private OAuthTokenRepository tokenRepository;

  private RevocationHandler revocationHandler;

  @BeforeEach
  void setUp() {
    revocationHandler = new RevocationHandler(tokenRepository);
  }

  @Test
  void testRevokeRefreshToken() {
    String token = "test-refresh-token";

    CompletableFuture<Void> result =
        revocationHandler.revokeToken(token, "refresh_token", CLIENT_ID);

    assertThat(result).isNotNull();
    result.join();
    verify(tokenRepository).revokeRefreshTokenIssuedTo(token, CLIENT_ID);
    verify(tokenRepository, never()).revokeAccessTokenIssuedTo(anyString(), anyString());
  }

  @Test
  void testRevokeAccessToken() {
    String token = "test-access-token";

    CompletableFuture<Void> result =
        revocationHandler.revokeToken(token, "access_token", CLIENT_ID);

    assertThat(result).isNotNull();
    result.join();
    verify(tokenRepository).revokeAccessTokenIssuedTo(token, CLIENT_ID);
    verify(tokenRepository, never()).revokeRefreshTokenIssuedTo(anyString(), anyString());
  }

  @Test
  void testRevokeWithoutTypeHint() {
    String token = "test-token";
    when(tokenRepository.revokeRefreshTokenIssuedTo(token, CLIENT_ID)).thenReturn(true);

    CompletableFuture<Void> result = revocationHandler.revokeToken(token, null, CLIENT_ID);

    assertThat(result).isNotNull();
    result.join();
    verify(tokenRepository).revokeRefreshTokenIssuedTo(token, CLIENT_ID);
  }

  /** Clients often send no hint: an access token must still be revoked once no refresh matches. */
  @Test
  void accessTokenWithoutTypeHintIsRevokedWhenNoRefreshTokenMatches() {
    String token = "access-token";
    when(tokenRepository.revokeAccessTokenIssuedTo(token, CLIENT_ID)).thenReturn(true);

    revocationHandler.revokeToken(token, null, CLIENT_ID).join();

    verify(tokenRepository).revokeRefreshTokenIssuedTo(token, CLIENT_ID);
    verify(tokenRepository).revokeAccessTokenIssuedTo(token, CLIENT_ID);
  }

  @Test
  void testRevokeNonExistentToken() {
    String token = "non-existent-token";
    doThrow(new IllegalArgumentException("Token not found"))
        .when(tokenRepository)
        .revokeRefreshTokenIssuedTo(token, CLIENT_ID);
    doThrow(new IllegalArgumentException("Token not found"))
        .when(tokenRepository)
        .revokeAccessTokenIssuedTo(token, CLIENT_ID);

    CompletableFuture<Void> result = revocationHandler.revokeToken(token, null, CLIENT_ID);

    assertThat(result).isNotNull();
    result.join();
    verify(tokenRepository).revokeRefreshTokenIssuedTo(token, CLIENT_ID);
    verify(tokenRepository).revokeAccessTokenIssuedTo(token, CLIENT_ID);
  }

  @Test
  void testRevokeEmptyToken() {
    CompletableFuture<Void> result = revocationHandler.revokeToken("", null, CLIENT_ID);

    assertThat(result).isNotNull();
    result.join();
    verify(tokenRepository, never()).revokeRefreshTokenIssuedTo(anyString(), anyString());
    verify(tokenRepository, never()).revokeAccessTokenIssuedTo(anyString(), anyString());
  }

  @Test
  void testRevokeNullToken() {
    CompletableFuture<Void> result = revocationHandler.revokeToken(null, null, CLIENT_ID);

    assertThat(result).isNotNull();
    result.join();
    verify(tokenRepository, never()).revokeRefreshTokenIssuedTo(anyString(), anyString());
    verify(tokenRepository, never()).revokeAccessTokenIssuedTo(anyString(), anyString());
  }

  @Test
  void testRevokeWithRefreshTokenHintButIsAccessToken() {
    String token = "access-token";
    doThrow(new IllegalArgumentException("Token not found"))
        .when(tokenRepository)
        .revokeRefreshTokenIssuedTo(token, CLIENT_ID);

    CompletableFuture<Void> result =
        revocationHandler.revokeToken(token, "refresh_token", CLIENT_ID);

    assertThat(result).isNotNull();
    result.join();
    verify(tokenRepository).revokeRefreshTokenIssuedTo(token, CLIENT_ID);
    verify(tokenRepository, never()).revokeAccessTokenIssuedTo(anyString(), anyString());
  }

  @Test
  void testRevokeWithAccessTokenHintButIsRefreshToken() {
    String token = "refresh-token";

    CompletableFuture<Void> result =
        revocationHandler.revokeToken(token, "access_token", CLIENT_ID);

    assertThat(result).isNotNull();
    result.join();
    verify(tokenRepository).revokeAccessTokenIssuedTo(token, CLIENT_ID);
    verify(tokenRepository, never()).revokeRefreshTokenIssuedTo(anyString(), anyString());
  }

  @Test
  void testRevokeWithInvalidTypeHint() {
    String token = "test-token";

    CompletableFuture<Void> result =
        revocationHandler.revokeToken(token, "invalid_hint", CLIENT_ID);

    assertThat(result).isNotNull();
    result.join();
    verify(tokenRepository, never()).revokeRefreshTokenIssuedTo(anyString(), anyString());
    verify(tokenRepository, never()).revokeAccessTokenIssuedTo(anyString(), anyString());
  }
}
