/*
 *  Copyright 2021 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.Base64;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.util.SdkClients;

/**
 * End-to-end regression test for <a
 * href="https://github.com/open-metadata/OpenMetadata/issues/28223">issue #28223</a>: SSO
 * callbacks for users with 60+ AD group claims used to be rejected at the Jetty layer with HTTP
 * 414 on {@code /badMessage} before the {@link
 * org.openmetadata.service.security.AuthCallbackServlet} ever ran.
 *
 * <p>This test drives the real running OpenMetadata server through the exact path Azure AD /
 * Okta exercise after consent: a GET to {@code /callback?id_token=<huge JWT>&state=...} whose
 * URI exceeds 8 KiB. The assertion is not about authentication outcome — basic-auth ITs do not
 * have OIDC configured, so {@code NoopAuthServeletHandler} returns 404 — but about *delivery*:
 * the request must reach the callback servlet (status 404 from the handler) and NOT die at the
 * Jetty connector (414 / 431 / connection close).
 */
@Execution(ExecutionMode.CONCURRENT)
class LargeOidcCallbackIT {

  /**
   * Matches the issue reporter's environment: a user belonging to "60+ AD groups". Real Azure
   * AD {@code id_token}s for such users carry the GUID, the display name, and several
   * directory-role IDs per group, plus standard Azure claims like {@code wids}, {@code
   * xms_st}, {@code amr}, and a fresh {@code nonce}. We replicate that claim density rather
   * than a bare GUID list, which brings the URI into the realistic 10–15 KiB range — above the
   * 8 KiB historical default and inside the new 64 KiB default.
   */
  private static final int SIMULATED_AD_GROUP_COUNT = 60;

  private static final HttpClient HTTP =
      HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();

  @Test
  void callbackReachesServletForUserWithSixtyAdGroups() throws Exception {
    String callbackUrl = buildCallbackUrl(SIMULATED_AD_GROUP_COUNT);

    assertTrue(
        callbackUrl.length() > 8 * 1024,
        "Test URI must exceed the historical 8KiB header buffer to reproduce #28223; got "
            + callbackUrl.length()
            + " bytes");

    HttpRequest request =
        HttpRequest.newBuilder(URI.create(callbackUrl))
            .timeout(Duration.ofSeconds(15))
            .GET()
            .build();
    HttpResponse<String> response = HTTP.send(request, HttpResponse.BodyHandlers.ofString());

    assertNotEquals(
        414,
        response.statusCode(),
        "Jetty rejected the OIDC callback with HTTP 414 — maxRequestHeaderSize is too small");
    assertNotEquals(
        431,
        response.statusCode(),
        "Jetty rejected the OIDC callback with HTTP 431 — maxRequestHeaderSize is too small");
    assertEquals(
        404,
        response.statusCode(),
        "Expected NoopAuthServeletHandler to return 404 for the unconfigured OIDC callback; got "
            + response.statusCode()
            + ". A non-404 status means the request didn't reach AuthCallbackServlet.");
  }

  /**
   * Builds a {@code /callback?...} URL whose query string mimics an OIDC implicit-flow
   * response from Azure AD: a signed {@code id_token} JWT carrying {@code groups} group GUIDs,
   * plus the {@code state} and {@code code} parameters pac4j expects. The JWT is not
   * cryptographically valid — we only need the bytes; the handler we want to reach is the
   * thing under test, not the token validator.
   */
  private static String buildCallbackUrl(int groups) {
    String idTokenPayload = buildSimulatedIdTokenPayload(groups);
    String state = UUID.randomUUID().toString();
    String code = UUID.randomUUID().toString();
    return SdkClients.getServerUrl()
        + "/callback?state="
        + state
        + "&code="
        + code
        + "&id_token="
        + idTokenPayload;
  }

  private static String buildSimulatedIdTokenPayload(int groups) {
    StringBuilder groupClaims = new StringBuilder("[");
    StringBuilder groupNames = new StringBuilder("[");
    for (int i = 0; i < groups; i++) {
      if (i > 0) {
        groupClaims.append(',');
        groupNames.append(',');
      }
      groupClaims.append('"').append(UUID.randomUUID()).append('"');
      groupNames
          .append('"')
          .append("ENT-DATA-PLATFORM-GROUP-")
          .append(String.format("%04d", i))
          .append("-")
          .append(UUID.randomUUID())
          .append('"');
    }
    groupClaims.append(']');
    groupNames.append(']');
    String header = base64Url("{\"alg\":\"RS256\",\"typ\":\"JWT\",\"kid\":\"test-key\"}");
    String payload =
        base64Url(
            "{\"iss\":\"https://login.microsoftonline.com/"
                + UUID.randomUUID()
                + "/v2.0\","
                + "\"aud\":\""
                + UUID.randomUUID()
                + "\","
                + "\"sub\":\""
                + UUID.randomUUID()
                + "\","
                + "\"oid\":\""
                + UUID.randomUUID()
                + "\","
                + "\"tid\":\""
                + UUID.randomUUID()
                + "\","
                + "\"nonce\":\""
                + UUID.randomUUID()
                + "\","
                + "\"xms_st\":{\"sub\":\""
                + UUID.randomUUID()
                + "\"},"
                + "\"amr\":[\"pwd\",\"mfa\",\"rsa\"],"
                + "\"wids\":[\""
                + UUID.randomUUID()
                + "\",\""
                + UUID.randomUUID()
                + "\"],"
                + "\"groups\":"
                + groupClaims
                + ","
                + "\"groups_names\":"
                + groupNames
                + "}");
    String signature = base64Url("not-a-real-signature".repeat(16));
    return header + "." + payload + "." + signature;
  }

  private static String base64Url(String input) {
    return Base64.getUrlEncoder().withoutPadding().encodeToString(input.getBytes());
  }
}
