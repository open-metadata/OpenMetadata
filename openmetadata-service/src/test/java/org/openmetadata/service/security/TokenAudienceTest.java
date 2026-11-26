/*
 *  Copyright 2026 Collate.
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
package org.openmetadata.service.security;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.auth0.jwt.JWT;
import com.auth0.jwt.interfaces.DecodedJWT;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

/** The {@code aud} rule each entry point applies to a token OpenMetadata signed. */
class TokenAudienceTest {
  private static final String MCP_RESOURCE = "https://om.example/mcp";
  private static final String ISSUED_FOR_ANOTHER_RESOURCE =
      "Not Authorized! Token was issued for another resource.";
  private static final TokenAudience MCP =
      TokenAudience.servedResourceNamedBy(MCP_RESOURCE::equals);

  @Test
  void aTokenWithoutAnAudienceIsAcceptedByEveryEntryPoint() {
    DecodedJWT unbound = tokenWith("{\"sub\":\"sam\"}");

    assertDoesNotThrow(() -> TokenAudience.OPENMETADATA_API.requireAddressedHere(unbound));
    assertDoesNotThrow(() -> MCP.requireAddressedHere(unbound));
  }

  @ParameterizedTest
  @ValueSource(
      strings = {
        "\"https://om.example/mcp\"",
        "[\"https://other.example/mcp\",\"https://om.example/mcp\"]"
      })
  void anAudienceNamingTheServedResourceIsAccepted(String audience) {
    DecodedJWT token = tokenWith("{\"sub\":\"sam\",\"aud\":" + audience + "}");

    assertDoesNotThrow(() -> MCP.requireAddressedHere(token));
  }

  /** No audience names the REST API or the push feed, so a token carrying one is not for them. */
  @ParameterizedTest
  @ValueSource(strings = {"\"https://om.example/mcp\"", "\"openmetadata\"", "[\"api\"]"})
  void theOpenMetadataApiRefusesEveryAudience(String audience) {
    assertRefused(TokenAudience.OPENMETADATA_API, "{\"sub\":\"sam\",\"aud\":" + audience + "}");
  }

  @ParameterizedTest
  @ValueSource(
      strings = {
        "\"https://other.example/mcp\"",
        "[\"https://a.example/mcp\",\"https://b.example/mcp\"]",
        "null",
        "[]",
        "\"\"",
        "123",
        "true",
        "{}",
        "[1]",
        "[\"https://om.example/mcp\",null]",
        "[null,\"https://om.example/mcp\"]"
      })
  void aForeignOrMalformedAudienceIsRefused(String audience) {
    assertRefused(MCP, "{\"sub\":\"sam\",\"aud\":" + audience + "}");
  }

  private static void assertRefused(TokenAudience servedResource, String payload) {
    DecodedJWT token = tokenWith(payload);

    AuthenticationException refused =
        assertThrows(
            AuthenticationException.class, () -> servedResource.requireAddressedHere(token));

    assertEquals(ISSUED_FOR_ANOTHER_RESOURCE, refused.getMessage());
    assertEquals(401, refused.getResponse().getStatus());
  }

  /** The rule reads claims only; the filter has verified the signature before it runs. */
  private static DecodedJWT tokenWith(String payload) {
    Base64.Encoder encoder = Base64.getUrlEncoder().withoutPadding();
    String header =
        encoder.encodeToString(
            "{\"alg\":\"RS256\",\"kid\":\"test-key\"}".getBytes(StandardCharsets.UTF_8));
    return JWT.decode(
        header + "." + encoder.encodeToString(payload.getBytes(StandardCharsets.UTF_8)) + ".sig");
  }
}
