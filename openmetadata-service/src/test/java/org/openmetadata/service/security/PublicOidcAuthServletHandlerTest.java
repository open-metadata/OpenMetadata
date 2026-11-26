package org.openmetadata.service.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.nimbusds.openid.connect.sdk.op.OIDCProviderMetadata;
import com.sun.net.httpserver.HttpServer;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.openmetadata.schema.api.security.AuthenticationConfiguration;
import org.openmetadata.schema.api.security.AuthorizerConfiguration;
import org.openmetadata.schema.security.client.OidcClientConfig;
import org.openmetadata.schema.services.connections.metadata.AuthProvider;

class PublicOidcAuthServletHandlerTest {
  @Test
  void initialDiscoveryRetriesAfterOneMinuteAndRecovers() throws Exception {
    final HttpServer server =
        HttpServer.create(new InetSocketAddress(InetAddress.getLoopbackAddress(), 0), 0);
    final String authority = "http://localhost:" + server.getAddress().getPort();
    final String base = "https://catalog.example.com";
    final var requests = new AtomicInteger();
    final var elapsed = new AtomicLong();
    server.createContext(
        "/.well-known/openid-configuration",
        exchange -> {
          try (exchange) {
            if (requests.incrementAndGet() == 1) {
              exchange.sendResponseHeaders(503, -1);
            } else {
              final byte[] document =
                  """
                  {"issuer":"%1$s","authorization_endpoint":"%1$s/authorize","token_endpoint":"%1$s/token",
                   "jwks_uri":"%1$s/keys","subject_types_supported":["public"],"response_types_supported":["code"],
                   "id_token_signing_alg_values_supported":["RS256"]}
                  """
                      .formatted(authority)
                      .getBytes(StandardCharsets.UTF_8);
              exchange.getResponseHeaders().set("Content-Type", "application/json");
              exchange.sendResponseHeaders(200, document.length);
              exchange.getResponseBody().write(document);
            }
          }
        });
    server.start();
    try {
      final var handler =
          new PublicOidcAuthServletHandler(
              new AuthenticationConfiguration()
                  .withProvider(AuthProvider.CUSTOM_OIDC)
                  .withAuthority(authority)
                  .withClientId("public-client"),
              new AuthorizerConfiguration(),
              null,
              elapsed::get);

      assertThatThrownBy(() -> handler.forMcp(base))
          .hasRootCauseMessage("OIDC provider returned HTTP 503");
      elapsed.set(Duration.ofSeconds(59).toNanos());
      assertThatThrownBy(() -> handler.forMcp(base))
          .hasRootCauseMessage("OIDC provider returned HTTP 503");
      assertThat(requests).hasValue(1);

      elapsed.set(Duration.ofMinutes(1).toNanos());
      final var recovered = handler.forMcp(base);
      assertThat(handler.forMcp(base)).isSameAs(recovered);
      assertThat(requests).hasValue(2);
    } finally {
      server.stop(0);
    }
  }

  @ParameterizedTest
  @CsvSource({
    "CUSTOM_OIDC, /realms/catalog/, /realms/catalog",
    "AUTH_0, /, ''",
    "AZURE, /tenant, /tenant/v2.0",
    "AZURE, /tenant/v2.0/, /tenant/v2.0"
  })
  void derivesDiscoveryFromThePublicAuthority(
      AuthProvider provider, String authorityPath, String discoveryPath) {
    String authority = "https://localhost" + authorityPath;
    String callback = "https://ui.example.com/auth/callback";
    AuthenticationConfiguration authentication =
        new AuthenticationConfiguration()
            .withProvider(provider)
            .withAuthority(authority)
            .withCallbackUrl(callback)
            .withClientId("public-client")
            .withOidcConfiguration(
                new OidcClientConfig().withId("old-client").withSecret("unused"));

    OidcClientConfig client =
        PublicOidcAuthServletHandler.publicCodeFlow(
            authentication, "https://catalog.example.com/catalog");
    assertThat(client.getDiscoveryUri())
        .isEqualTo("https://localhost" + discoveryPath + "/.well-known/openid-configuration");
    assertThat(client.getId()).isEqualTo("public-client");
    assertThat(client.getCallbackUrl())
        .isEqualTo("https://catalog.example.com/catalog/mcp/callback");
    assertThat(authentication.getCallbackUrl()).isEqualTo(callback);
    assertThat(client.getSecret()).isNull();
    assertThat(client.getDisablePkce()).isFalse();
  }

  @ParameterizedTest
  @ValueSource(strings = {"common", "organizations"})
  void readsTenantIndependentEntraDiscovery(String tenant) throws Exception {
    final String authority = "https://login.microsoftonline.com/" + tenant;
    final String document =
        """
        {
          "issuer": "https://login.microsoftonline.com/{tenantid}/v2.0",
          "authorization_endpoint": "%1$s/oauth2/v2.0/authorize",
          "token_endpoint": "%1$s/oauth2/v2.0/token",
          "jwks_uri": "%1$s/discovery/v2.0/keys",
          "subject_types_supported": ["pairwise"],
          "response_types_supported": ["code"],
          "id_token_signing_alg_values_supported": ["RS256"]
        }
        """
            .formatted(authority);

    final OIDCProviderMetadata metadata =
        PublicOidcAuthServletHandler.parseDiscovery(document, AuthProvider.AZURE);
    assertThat(metadata.getIssuer().getValue())
        .isEqualTo("https://login.microsoftonline.com/%7Btenantid%7D/v2.0");
    assertThat(metadata.getTokenEndpointURI().toString())
        .isEqualTo(authority + "/oauth2/v2.0/token");
  }
}
