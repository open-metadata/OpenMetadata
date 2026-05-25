package org.openmetadata.mcp.server.auth.handlers;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

import java.net.URI;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.openmetadata.mcp.auth.InvalidRedirectUriException;
import org.openmetadata.mcp.auth.InvalidScopeException;
import org.openmetadata.mcp.auth.OAuthAuthorizationServerProvider;
import org.openmetadata.mcp.auth.OAuthClientInformation;
import org.openmetadata.mcp.auth.exception.AuthorizeException;

@ExtendWith(MockitoExtension.class)
class AuthorizationHandlerTest {

  @Mock private OAuthAuthorizationServerProvider provider;
  @Mock private OAuthClientInformation client;

  private AuthorizationHandler handler;

  @BeforeEach
  void setUp() {
    handler = new AuthorizationHandler(provider);
  }

  private Map<String, String> validParams() {
    Map<String, String> params = new HashMap<>();
    params.put("client_id", "test-client");
    params.put("response_type", "code");
    params.put("code_challenge", "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
    params.put("code_challenge_method", "S256");
    params.put("state", "state123");
    params.put("redirect_uri", "https://example.com/callback");
    return params;
  }

  @Test
  void testMissingClientId_returnsInvalidRequest() {
    Map<String, String> params = validParams();
    params.remove("client_id");

    AuthorizationHandler.AuthorizationResponse response = handler.handle(params).join();

    assertThat(response.isSuccess()).isFalse();
    assertThat(response.getError().getError()).isEqualTo("invalid_request");
    assertThat(response.isRedirect()).isFalse();
  }

  @Test
  void testMissingResponseType_returnsInvalidRequest() {
    Map<String, String> params = validParams();
    params.remove("response_type");

    AuthorizationHandler.AuthorizationResponse response = handler.handle(params).join();

    assertThat(response.isSuccess()).isFalse();
    assertThat(response.getError().getError()).isEqualTo("invalid_request");
  }

  @Test
  void testMissingCodeChallenge_returnsInvalidRequest() {
    Map<String, String> params = validParams();
    params.remove("code_challenge");

    AuthorizationHandler.AuthorizationResponse response = handler.handle(params).join();

    assertThat(response.isSuccess()).isFalse();
    assertThat(response.getError().getError()).isEqualTo("invalid_request");
  }

  @Test
  void testUnsupportedResponseType_returnsUnsupportedResponseType() {
    Map<String, String> params = validParams();
    params.put("response_type", "token");

    AuthorizationHandler.AuthorizationResponse response = handler.handle(params).join();

    assertThat(response.isSuccess()).isFalse();
    assertThat(response.getError().getError()).isEqualTo("unsupported_response_type");
  }

  @Test
  void testInvalidCodeChallengeMethod_returnsInvalidRequest() {
    Map<String, String> params = validParams();
    params.put("code_challenge_method", "plain");

    AuthorizationHandler.AuthorizationResponse response = handler.handle(params).join();

    assertThat(response.isSuccess()).isFalse();
    assertThat(response.getError().getError()).isEqualTo("invalid_request");
    assertThat(response.getError().getErrorDescription()).contains("S256");
  }

  @Test
  void testClientNotFound_returnsInvalidRequest() {
    when(provider.getClient("test-client")).thenReturn(CompletableFuture.completedFuture(null));

    AuthorizationHandler.AuthorizationResponse response = handler.handle(validParams()).join();

    assertThat(response.isSuccess()).isFalse();
    assertThat(response.getError().getError()).isEqualTo("invalid_request");
    assertThat(response.getError().getErrorDescription()).contains("Client ID not found");
  }

  @Test
  void testInvalidRedirectUri_returnsInvalidRequest() throws InvalidRedirectUriException {
    when(provider.getClient("test-client")).thenReturn(CompletableFuture.completedFuture(client));
    when(client.validateRedirectUri(any()))
        .thenThrow(new InvalidRedirectUriException("URI not registered"));

    AuthorizationHandler.AuthorizationResponse response = handler.handle(validParams()).join();

    assertThat(response.isSuccess()).isFalse();
    assertThat(response.getError().getError()).isEqualTo("invalid_request");
    assertThat(response.isRedirect()).isFalse();
  }

  @Test
  void testInvalidScope_returnsInvalidScopeWithRedirect()
      throws InvalidRedirectUriException, InvalidScopeException {
    URI redirectUri = URI.create("https://example.com/callback");
    when(provider.getClient("test-client")).thenReturn(CompletableFuture.completedFuture(client));
    when(client.validateRedirectUri(any())).thenReturn(redirectUri);
    when(client.validateScope("admin")).thenThrow(new InvalidScopeException("Not allowed"));

    Map<String, String> params = validParams();
    params.put("scope", "admin");

    AuthorizationHandler.AuthorizationResponse response = handler.handle(params).join();

    assertThat(response.isSuccess()).isFalse();
    assertThat(response.getError().getError()).isEqualTo("invalid_scope");
    assertThat(response.isRedirect()).isTrue();
    assertThat(response.getRedirectUrl()).contains("error=invalid_scope");
  }

  @Test
  void testSuccessfulAuthCodeGeneration_returnsRedirectWithCode()
      throws InvalidRedirectUriException, InvalidScopeException, AuthorizeException {
    URI redirectUri = URI.create("https://example.com/callback");
    when(provider.getClient("test-client")).thenReturn(CompletableFuture.completedFuture(client));
    when(client.validateRedirectUri(any())).thenReturn(redirectUri);
    when(client.validateScope(any())).thenReturn(null);
    when(provider.authorize(eq(client), any()))
        .thenReturn(CompletableFuture.completedFuture("auth-code-123"));

    AuthorizationHandler.AuthorizationResponse response = handler.handle(validParams()).join();

    assertThat(response.isSuccess()).isTrue();
    assertThat(response.isRedirect()).isTrue();
    assertThat(response.getRedirectUrl()).contains("code=auth-code-123");
    assertThat(response.getRedirectUrl()).contains("state=state123");
  }

  @Test
  void testSuccessfulSSORedirect_returnsRedirectUrl()
      throws InvalidRedirectUriException, InvalidScopeException, AuthorizeException {
    URI redirectUri = URI.create("https://example.com/callback");
    when(provider.getClient("test-client")).thenReturn(CompletableFuture.completedFuture(client));
    when(client.validateRedirectUri(any())).thenReturn(redirectUri);
    when(client.validateScope(any())).thenReturn(null);
    when(provider.authorize(eq(client), any()))
        .thenReturn(
            CompletableFuture.completedFuture("https://accounts.google.com/o/oauth2/auth?..."));

    AuthorizationHandler.AuthorizationResponse response = handler.handle(validParams()).join();

    assertThat(response.isSuccess()).isTrue();
    assertThat(response.isRedirect()).isTrue();
    assertThat(response.getRedirectUrl()).startsWith("https://accounts.google.com");
  }

  @Test
  void testSSORedirectInitiated_returnsNoRedirect()
      throws InvalidRedirectUriException, InvalidScopeException, AuthorizeException {
    URI redirectUri = URI.create("https://example.com/callback");
    when(provider.getClient("test-client")).thenReturn(CompletableFuture.completedFuture(client));
    when(client.validateRedirectUri(any())).thenReturn(redirectUri);
    when(client.validateScope(any())).thenReturn(null);
    when(provider.authorize(eq(client), any()))
        .thenReturn(CompletableFuture.completedFuture("SSO_REDIRECT_INITIATED"));

    AuthorizationHandler.AuthorizationResponse response = handler.handle(validParams()).join();

    assertThat(response.isSuccess()).isTrue();
    assertThat(response.isRedirect()).isFalse();
    assertThat(response.getRedirectUrl()).isNull();
  }

  @Test
  void testAuthorizeException_returnsErrorWithRedirect()
      throws InvalidRedirectUriException, InvalidScopeException, AuthorizeException {
    URI redirectUri = URI.create("https://example.com/callback");
    when(provider.getClient("test-client")).thenReturn(CompletableFuture.completedFuture(client));
    when(client.validateRedirectUri(any())).thenReturn(redirectUri);
    when(client.validateScope(any())).thenReturn(null);
    when(provider.authorize(eq(client), any()))
        .thenReturn(
            CompletableFuture.failedFuture(
                new AuthorizeException("access_denied", "User denied access")));

    AuthorizationHandler.AuthorizationResponse response = handler.handle(validParams()).join();

    assertThat(response.isSuccess()).isFalse();
    assertThat(response.getError().getError()).isEqualTo("access_denied");
    assertThat(response.isRedirect()).isTrue();
    assertThat(response.getRedirectUrl()).contains("error=access_denied");
  }

  @Test
  void testUnexpectedException_returnsServerError()
      throws InvalidRedirectUriException, InvalidScopeException, AuthorizeException {
    URI redirectUri = URI.create("https://example.com/callback");
    when(provider.getClient("test-client")).thenReturn(CompletableFuture.completedFuture(client));
    when(client.validateRedirectUri(any())).thenReturn(redirectUri);
    when(client.validateScope(any())).thenReturn(null);
    when(provider.authorize(eq(client), any()))
        .thenReturn(CompletableFuture.failedFuture(new RuntimeException("DB connection lost")));

    AuthorizationHandler.AuthorizationResponse response = handler.handle(validParams()).join();

    assertThat(response.isSuccess()).isFalse();
    assertThat(response.getError().getError()).isEqualTo("server_error");
    assertThat(response.isRedirect()).isTrue();
  }
}
