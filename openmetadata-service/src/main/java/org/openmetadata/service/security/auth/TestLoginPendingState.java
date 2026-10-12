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

import org.openmetadata.schema.configuration.SecurityConfiguration;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.fernet.Fernet;

/**
 * What a pending Test Login carries to whichever server completes it: the candidate configuration,
 * with the client secret or LDAP bind password it signs in with, and the protocol handshake. It is
 * stored sealed with the server's Fernet key.
 */
record TestLoginPendingState(SecurityConfiguration candidate, TestLoginHandshake handshake) {

  /** The stored form of a pending test; none for a completed one, which keeps no secrets. */
  static String seal(TestLoginSessionEntry entry) {
    if (entry.isCompleted()) {
      return null;
    }
    String json = JsonUtils.pojoToJson(Stored.of(entry.candidate(), entry.handshake()));
    Fernet fernet = Fernet.getInstance();
    // A deployment that turned Fernet off stores its other secrets unencrypted as well.
    return fernet.isKeyDefined() ? fernet.encrypt(json) : json;
  }

  static TestLoginPendingState open(String sealed) {
    Stored stored =
        JsonUtils.readValue(Fernet.getInstance().decryptIfApplies(sealed), Stored.class);
    return new TestLoginPendingState(stored.candidate(), stored.toHandshake());
  }

  @Override
  public String toString() {
    return "TestLoginPendingState[handshake=" + handshake + "]";
  }

  enum Kind {
    OIDC,
    SAML,
    CREDENTIALS
  }

  /** The handshake flattened into plain fields, so it serializes without type metadata. */
  record Stored(
      SecurityConfiguration candidate,
      Kind kind,
      String nonce,
      String codeVerifier,
      String redirectUri) {

    static Stored of(SecurityConfiguration candidate, TestLoginHandshake handshake) {
      return switch (handshake) {
        case TestLoginHandshake.Oidc oidc -> new Stored(
            candidate, Kind.OIDC, oidc.nonce(), oidc.codeVerifier(), oidc.redirectUri());
        case TestLoginHandshake.Saml saml -> new Stored(candidate, Kind.SAML, null, null, null);
        case TestLoginHandshake.Credentials credentials -> new Stored(
            candidate, Kind.CREDENTIALS, null, null, null);
      };
    }

    TestLoginHandshake toHandshake() {
      return switch (kind) {
        case OIDC -> new TestLoginHandshake.Oidc(nonce, codeVerifier, redirectUri);
        case SAML -> new TestLoginHandshake.Saml();
        case CREDENTIALS -> new TestLoginHandshake.Credentials();
      };
    }

    @Override
    public String toString() {
      return "TestLoginPendingState.Stored[kind=" + kind + "]";
    }
  }
}
