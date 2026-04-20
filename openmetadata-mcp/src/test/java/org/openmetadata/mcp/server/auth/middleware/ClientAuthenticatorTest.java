package org.openmetadata.mcp.server.auth.middleware;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

import at.favre.lib.crypto.bcrypt.BCrypt;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.openmetadata.mcp.auth.OAuthAuthorizationServerProvider;
import org.openmetadata.mcp.auth.OAuthClientInformation;

@ExtendWith(MockitoExtension.class)
class ClientAuthenticatorTest {

  @Mock private OAuthAuthorizationServerProvider provider;

  private ClientAuthenticator authenticator;

  @BeforeEach
  void setUp() {
    authenticator = new ClientAuthenticator(provider);
  }

  @Test
  void testNullClientId_failsWithMissingClientId() {
    assertThatThrownBy(() -> authenticator.authenticate(null, "secret").join())
        .isInstanceOf(CompletionException.class)
        .hasCauseInstanceOf(ClientAuthenticator.AuthenticationException.class)
        .hasRootCauseMessage("Missing client_id parameter");
  }

  @Test
  void testClientNotFound_failsWithClientNotFound() {
    when(provider.getClient("unknown")).thenReturn(CompletableFuture.completedFuture(null));

    assertThatThrownBy(() -> authenticator.authenticate("unknown", "secret").join())
        .isInstanceOf(CompletionException.class)
        .hasCauseInstanceOf(ClientAuthenticator.AuthenticationException.class)
        .hasRootCauseMessage("Client not found");
  }

  @Test
  void testClientHasSecret_missingSecret_failsWithSecretRequired() {
    OAuthClientInformation client = new OAuthClientInformation();
    client.setClientId("client-1");
    String hashedSecret = BCrypt.withDefaults().hashToString(4, "real-secret".toCharArray());
    client.setClientSecret(hashedSecret);

    when(provider.getClient("client-1")).thenReturn(CompletableFuture.completedFuture(client));

    assertThatThrownBy(() -> authenticator.authenticate("client-1", null).join())
        .isInstanceOf(CompletionException.class)
        .hasCauseInstanceOf(ClientAuthenticator.AuthenticationException.class)
        .hasRootCauseMessage("Client secret required");
  }

  @Test
  void testClientHasSecret_wrongSecret_failsWithInvalidSecret() {
    OAuthClientInformation client = new OAuthClientInformation();
    client.setClientId("client-1");
    String hashedSecret = BCrypt.withDefaults().hashToString(4, "correct-secret".toCharArray());
    client.setClientSecret(hashedSecret);

    when(provider.getClient("client-1")).thenReturn(CompletableFuture.completedFuture(client));

    assertThatThrownBy(() -> authenticator.authenticate("client-1", "wrong-secret").join())
        .isInstanceOf(CompletionException.class)
        .hasCauseInstanceOf(ClientAuthenticator.AuthenticationException.class)
        .hasRootCauseMessage("Invalid client secret");
  }

  @Test
  void testClientHasSecret_correctSecret_succeeds() {
    OAuthClientInformation client = new OAuthClientInformation();
    client.setClientId("client-1");
    String hashedSecret = BCrypt.withDefaults().hashToString(4, "correct-secret".toCharArray());
    client.setClientSecret(hashedSecret);

    when(provider.getClient("client-1")).thenReturn(CompletableFuture.completedFuture(client));

    OAuthClientInformation result = authenticator.authenticate("client-1", "correct-secret").join();

    assertThat(result).isSameAs(client);
  }

  @Test
  void testPublicClient_noSecret_succeeds() {
    OAuthClientInformation client = new OAuthClientInformation();
    client.setClientId("public-client");
    client.setClientSecret(null);

    when(provider.getClient("public-client")).thenReturn(CompletableFuture.completedFuture(client));

    OAuthClientInformation result = authenticator.authenticate("public-client", null).join();

    assertThat(result).isSameAs(client);
  }

  @Test
  void testPublicClient_secretProvided_stillSucceeds() {
    OAuthClientInformation client = new OAuthClientInformation();
    client.setClientId("public-client");
    client.setClientSecret(null);

    when(provider.getClient("public-client")).thenReturn(CompletableFuture.completedFuture(client));

    OAuthClientInformation result =
        authenticator.authenticate("public-client", "some-secret").join();

    assertThat(result).isSameAs(client);
  }
}
