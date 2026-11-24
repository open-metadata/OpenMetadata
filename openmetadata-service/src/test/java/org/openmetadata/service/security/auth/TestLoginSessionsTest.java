/*
 *  Copyright 2025 Collate.
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
package org.openmetadata.service.security.auth;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.api.security.AuthenticationConfiguration;
import org.openmetadata.schema.configuration.SecurityConfiguration;
import org.openmetadata.schema.security.client.OidcClientConfig;
import org.openmetadata.schema.system.TestLoginProtocol;

class TestLoginSessionsTest {
  private static final String CLIENT_SECRET = "s3cr3t-client-secret";
  private static final String CODE_VERIFIER = "pkce-verifier-value";

  @Test
  void sessionIdsAreUrlSafeAndUnique() {
    String first = TestLoginSessions.newSessionId();
    String second = TestLoginSessions.newSessionId();

    // 32 random bytes, base64url without padding.
    assertEquals(43, first.length());
    assertTrue(first.matches("[A-Za-z0-9_-]+"));
    assertNotEquals(first, second);
  }

  @Test
  void markerRoundTripsAndRejectsEverythingElse() {
    String marker = TestLoginSessions.markerFor("abc123");

    assertEquals(Optional.of("abc123"), TestLoginSessions.sessionIdFromMarker(marker));
    assertTrue(TestLoginSessions.isTestLoginMarker(marker));
    assertFalse(TestLoginSessions.isTestLoginMarker("omtest:"));
    assertFalse(TestLoginSessions.isTestLoginMarker("mcp:abc123"));
    assertFalse(TestLoginSessions.isTestLoginMarker("a-live-login-state"));
    assertFalse(TestLoginSessions.isTestLoginMarker(null));
  }

  @Test
  void anEntrysTextFormNeverRevealsTheCandidateSecretsOrTheHandshake() {
    SecurityConfiguration candidate =
        new SecurityConfiguration()
            .withAuthenticationConfiguration(
                new AuthenticationConfiguration()
                    .withOidcConfiguration(new OidcClientConfig().withSecret(CLIENT_SECRET)));
    TestLoginHandshake handshake =
        new TestLoginHandshake.Oidc("nonce-value", CODE_VERIFIER, "https://om/callback");

    String rendered =
        TestLoginSessionEntry.pending(
                "session-1", "admin", candidate, TestLoginProtocol.OIDC, handshake)
            .toString();

    assertFalse(rendered.contains(CLIENT_SECRET));
    assertFalse(rendered.contains(CODE_VERIFIER));
    assertFalse(handshake.toString().contains(CODE_VERIFIER));
  }
}
