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
import org.openmetadata.it.server.ContainerizedServer;
import org.openmetadata.it.server.sso.ClientType;
import org.openmetadata.it.server.sso.GoogleProfile;
import org.openmetadata.it.server.sso.MockOidcServer;

/**
 * End-to-end wiring check for SSO mode: launches OM with the Google confidential-client
 * profile and the {@link org.openmetadata.it.server.sso.MockOidcServer} sidecar, then
 * fetches OM's public {@code /api/v1/system/config/auth} endpoint to confirm OM picked up
 * the SSO env vars at boot — provider {@code google}, client type {@code confidential},
 * authority pointing at the mock IdP under the {@code om-mock-idp} hostname.
 *
 * <p>Does not exercise the browser flow (that's S2). Just proves the boot wiring.
 */
@Tag("sso-bootstrap")
class GoogleSsoBootstrapUIIT {

  private static final HttpClient HTTP =
      HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();
  private static final String EXPECTED_AUTHORITY =
      "http://" + MockOidcServer.NETWORK_ALIAS + ":" + MockOidcServer.PORT + "/google";

  @Test
  void omBootsWithGoogleConfidentialClientPointingAtMockIdp() throws Exception {
    try (ContainerizedServer server =
        ContainerizedServer.launch(new GoogleProfile(ClientType.CONFIDENTIAL))) {
      final URI configUri = server.uiUrl().resolve("/api/v1/system/config/auth");
      final HttpResponse<String> resp =
          HTTP.send(HttpRequest.newBuilder(configUri).GET().build(), BodyHandlers.ofString());

      assertEquals(200, resp.statusCode(), () -> "auth config endpoint failed: " + resp.body());
      final String body = resp.body();
      assertContainsField(body, "\"provider\"", "\"google\"");
      assertContainsField(body, "\"clientType\"", "\"confidential\"");
      assertContainsField(body, "\"authority\"", EXPECTED_AUTHORITY);
      assertContainsField(body, "\"clientId\"", "\"om-test-client\"");
      assertContainsField(body, "\"callbackUrl\"", "http://localhost:8585/callback");
    }
  }

  private static void assertContainsField(
      final String body, final String fieldQuoted, final String expectedSubstring) {
    assertTrue(
        body.contains(fieldQuoted) && body.contains(expectedSubstring),
        () -> "auth config missing " + fieldQuoted + "=" + expectedSubstring + "; body: " + body);
  }
}
