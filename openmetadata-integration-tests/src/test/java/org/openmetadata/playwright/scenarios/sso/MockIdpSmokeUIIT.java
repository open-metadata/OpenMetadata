package org.openmetadata.playwright.scenarios.sso;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.net.http.HttpResponse.BodyHandlers;
import java.time.Duration;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.openmetadata.it.server.sso.MockOidcServer;
import org.testcontainers.containers.Network;

/**
 * Standalone smoke check for {@link MockOidcServer}: brings up the mock OIDC container,
 * fetches the discovery and JWKS endpoints from the host JVM through the
 * {@code om-mock-idp} hostname, and asserts they return well-formed OIDC responses with
 * {@code iss} matching the network alias URL.
 *
 * <p>Validates the network premise of the SSO infrastructure: that a single URL works
 * for both inside-Docker and host-side actors, which is what makes token validation line
 * up later when OM and Playwright both point at this server.
 */
@Tag("sso-bootstrap")
class MockIdpSmokeUIIT {

  private static final HttpClient HTTP =
      HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();
  private static final String DEFAULT_ISSUER = "default";

  @Test
  void mockIdpServesDiscoveryAndJwksUnderTheSharedHostname() throws Exception {
    try (Network network = Network.newNetwork();
        MockOidcServer idp = MockOidcServer.launch(network)) {
      final URI discoveryUri = idp.discoveryUrl(DEFAULT_ISSUER);
      final HttpResponse<String> discovery =
          HTTP.send(HttpRequest.newBuilder(discoveryUri).GET().build(), BodyHandlers.ofString());

      assertEquals(200, discovery.statusCode(), "discovery endpoint should be reachable from host");
      final String discoveryBody = discovery.body();
      assertTrue(
          discoveryBody.contains("\"issuer\""),
          () -> "discovery response missing 'issuer' field: " + discoveryBody);
      assertTrue(
          discoveryBody.contains("om-mock-idp:" + MockOidcServer.PORT),
          () -> "issuer URL should match the shared hostname; got: " + discoveryBody);

      final HttpResponse<String> jwks =
          HTTP.send(
              HttpRequest.newBuilder(idp.jwksUrl(DEFAULT_ISSUER)).GET().build(),
              BodyHandlers.ofString());
      assertEquals(200, jwks.statusCode(), "jwks endpoint should be reachable from host");
      assertTrue(
          jwks.body().contains("\"keys\""),
          () -> "jwks response missing 'keys' array: " + jwks.body());
    }
  }
}
