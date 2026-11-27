package org.openmetadata.service.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.auth0.jwk.JwkException;
import com.nimbusds.oauth2.sdk.AuthorizationCode;
import com.nimbusds.oauth2.sdk.AuthorizationCodeGrant;
import com.nimbusds.oauth2.sdk.TokenRequest;
import com.nimbusds.oauth2.sdk.id.ClientID;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.services.connections.metadata.AuthProvider;
import org.openmetadata.service.util.OutboundUrlBlockedException;
import org.pac4j.core.exception.TechnicalException;

class PublicOidcConfigurationTest {
  private final AtomicLong elapsedNanos = new AtomicLong();
  private final PublicOidcConfiguration configuration =
      new PublicOidcConfiguration(AuthProvider.CUSTOM_OIDC, elapsedNanos::get);
  private final AtomicInteger followed = new AtomicInteger();
  private HttpServer server;
  private URI redirect;

  @BeforeEach
  void startProvider() throws IOException {
    server = HttpServer.create(new InetSocketAddress(InetAddress.getLoopbackAddress(), 0), 0);
    redirect = URI.create("http://localhost:" + server.getAddress().getPort() + "/redirect");
    server.createContext(
        "/redirect",
        exchange -> {
          try (exchange) {
            exchange.getResponseHeaders().set("Location", "/final");
            exchange.sendResponseHeaders(307, -1);
          }
        });
    server.createContext(
        "/final",
        exchange -> {
          try (exchange) {
            followed.incrementAndGet();
            exchange.sendResponseHeaders(200, -1);
          }
        });
    server.start();
  }

  @AfterEach
  void stopProvider() {
    server.stop(0);
  }

  @Test
  void refusesDiscoveryRedirect() {
    configuration.setDiscoveryURI(redirect.toString());
    assertThatThrownBy(configuration::createNewOpMetadataResolver)
        .isInstanceOf(TechnicalException.class)
        .hasRootCauseMessage("OIDC provider returned HTTP 307");
    assertThat(followed).hasValue(0);
  }

  @Test
  void refreshesEndpointsForTheSameIssuerAndRejectsAnIssuerChange() {
    final URI issuer = redirect.resolve("/");
    final var metadata = new AtomicReference<>(discovery(issuer, "/first-token"));
    final var methods = new CopyOnWriteArrayList<String>();
    server.createContext(
        "/discovery",
        exchange -> {
          try (exchange) {
            methods.add(exchange.getRequestMethod());
            final byte[] body = metadata.get().getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().set("Content-Type", "application/json");
            exchange.sendResponseHeaders(200, body.length);
            exchange.getResponseBody().write(body);
          }
        });
    configuration.setDiscoveryURI(redirect.resolve("/discovery").toString());
    configuration.setClientId("public-client");
    final var resolver = configuration.createNewOpMetadataResolver();

    metadata.set(discovery(issuer, "/second-token"));
    assertThat(resolver.load().getTokenEndpointURI()).isEqualTo(issuer.resolve("/first-token"));
    elapsedNanos.addAndGet(Duration.ofMinutes(1).toNanos());
    assertThat(resolver.load().getTokenEndpointURI()).isEqualTo(issuer.resolve("/second-token"));

    elapsedNanos.addAndGet(Duration.ofMinutes(1).toNanos());
    metadata.set(discovery(issuer.resolve("/different-issuer"), "/third-token"));
    assertThatThrownBy(resolver::load).hasMessageContaining("changed the provider issuer");
    assertThatThrownBy(resolver::load).hasMessageContaining("changed the provider issuer");
    assertThatThrownBy(resolver::getTokenValidator)
        .hasMessageContaining("changed the provider issuer");
    assertThatThrownBy(resolver::getClientAuthenticationTokenEndpoint)
        .hasMessageContaining("changed the provider issuer");
    assertThatThrownBy(resolver::getClientAuthenticationPAREndpoint)
        .hasMessageContaining("changed the provider issuer");
    assertThat(methods).containsExactly("GET", "GET", "GET");

    elapsedNanos.addAndGet(Duration.ofMinutes(1).toNanos());
    metadata.set(discovery(issuer, "/third-token"));
    assertThat(resolver.load().getTokenEndpointURI()).isEqualTo(issuer.resolve("/third-token"));
    assertThat(methods).containsExactly("GET", "GET", "GET", "GET");
  }

  private static String discovery(URI issuer, String tokenPath) {
    return """
        {"issuer":"%s","authorization_endpoint":"%s","token_endpoint":"%s","jwks_uri":"%s",
         "response_types_supported":["code"],"subject_types_supported":["public"],
         "id_token_signing_alg_values_supported":["RS256"]}
        """
        .formatted(
            issuer,
            issuer.resolve("/authorize"),
            issuer.resolve(tokenPath),
            issuer.resolve("/jwks"));
  }

  @Test
  void returnsTokenRedirectWithoutResendingTheGrant() throws IOException {
    var response =
        AuthenticationCodeFlowHandler.executeTokenHttpRequest(configuration, grant(redirect));
    assertThat(response.getStatusCode()).isEqualTo(307);
    assertThat(followed).hasValue(0);
  }

  @Test
  void checksTheTokenDestinationBeforeSending() {
    final URI unresolved = URI.create("https://unregistered.invalid/token");
    assertThatThrownBy(
            () ->
                AuthenticationCodeFlowHandler.executeTokenHttpRequest(
                    configuration, grant(unresolved)))
        .isInstanceOf(OutboundUrlBlockedException.class);
  }

  @Test
  void doesNotFollowAKeySetRedirect() throws Exception {
    var keys = IdentityProviderKeys.forPublicMcp(List.of(redirect.toURL()), Duration.ofMinutes(5));
    assertThatThrownBy(() -> keys.get("example")).isInstanceOf(JwkException.class);
    assertThat(followed).hasValue(0);
  }

  private static TokenRequest grant(URI endpoint) {
    return new TokenRequest(
        endpoint,
        new ClientID("public-client"),
        new AuthorizationCodeGrant(
            new AuthorizationCode("example"), URI.create("https://catalog.example/callback")));
  }
}
