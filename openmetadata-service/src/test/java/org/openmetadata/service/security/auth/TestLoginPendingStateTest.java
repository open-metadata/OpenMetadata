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
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.api.security.AuthenticationConfiguration;
import org.openmetadata.schema.configuration.SecurityConfiguration;
import org.openmetadata.schema.security.client.OidcClientConfig;
import org.openmetadata.schema.system.TestLoginProtocol;
import org.openmetadata.schema.system.TestLoginResult;
import org.openmetadata.service.fernet.Fernet;

class TestLoginPendingStateTest {
  private static final String FERNET_KEY = "jJ/9sz0g0OHxsfxOoSfdFdmk3ysNmPRnH3TUAbz3IHA=";
  private static final String CLIENT_SECRET = "s3cr3t-client-secret";
  private static final String NONCE = "nonce-value";
  private static final String CODE_VERIFIER = "pkce-verifier-value";
  private static final String REDIRECT_URI = "https://om.example.com/callback";

  @BeforeEach
  void setFernetKey() {
    Fernet.getInstance().setFernetKey(FERNET_KEY);
  }

  @AfterEach
  void clearFernetKey() {
    Fernet.getInstance().setFernetKey((String) null);
  }

  @Test
  void aPendingTestIsStoredEncryptedAndReadBackWhole() {
    String sealed =
        TestLoginPendingState.seal(
            pending(new TestLoginHandshake.Oidc(NONCE, CODE_VERIFIER, REDIRECT_URI)));

    assertTrue(Fernet.isTokenized(sealed));
    assertFalse(sealed.contains(CLIENT_SECRET));
    assertFalse(sealed.contains(CODE_VERIFIER));

    TestLoginPendingState opened = TestLoginPendingState.open(sealed);

    assertEquals(
        CLIENT_SECRET,
        opened.candidate().getAuthenticationConfiguration().getOidcConfiguration().getSecret());
    assertEquals(
        new TestLoginHandshake.Oidc(NONCE, CODE_VERIFIER, REDIRECT_URI), opened.handshake());
  }

  @Test
  void everyKindOfHandshakeSurvivesStorage() {
    for (TestLoginHandshake handshake :
        new TestLoginHandshake[] {
          new TestLoginHandshake.Saml(), new TestLoginHandshake.Credentials()
        }) {
      assertEquals(
          handshake,
          TestLoginPendingState.open(TestLoginPendingState.seal(pending(handshake))).handshake());
    }
  }

  @Test
  void aCompletedTestStoresNoSecretsAtAll() {
    assertNull(
        TestLoginPendingState.seal(
            TestLoginSessionEntry.completed(
                "session-1",
                "admin",
                TestLoginProtocol.OIDC,
                new TestLoginResult().withStatus(TestLoginResult.Status.FAILED))));
  }

  @Test
  void withoutAFernetKeyTheStateIsStoredLikeTheDeploymentsOtherSecrets() {
    Fernet.getInstance().setFernetKey((String) null);

    String stored = TestLoginPendingState.seal(pending(new TestLoginHandshake.Credentials()));

    assertFalse(Fernet.isTokenized(stored));
    assertEquals(
        new TestLoginHandshake.Credentials(), TestLoginPendingState.open(stored).handshake());
  }

  @Test
  void itsTextFormNeverShowsTheCandidate() {
    TestLoginPendingState state =
        new TestLoginPendingState(
            pending(new TestLoginHandshake.Credentials()).candidate(),
            new TestLoginHandshake.Oidc(NONCE, CODE_VERIFIER, REDIRECT_URI));

    assertFalse(state.toString().contains(CLIENT_SECRET));
    assertFalse(state.toString().contains(CODE_VERIFIER));
  }

  private static TestLoginSessionEntry pending(TestLoginHandshake handshake) {
    SecurityConfiguration candidate =
        new SecurityConfiguration()
            .withAuthenticationConfiguration(
                new AuthenticationConfiguration()
                    .withOidcConfiguration(new OidcClientConfig().withSecret(CLIENT_SECRET)));
    return TestLoginSessionEntry.pending(
        "session-1", "admin", candidate, TestLoginProtocol.OIDC, handshake);
  }
}
