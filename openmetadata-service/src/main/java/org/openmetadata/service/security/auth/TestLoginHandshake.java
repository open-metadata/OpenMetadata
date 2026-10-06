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

/**
 * What a Test Login round-trip must remember between sending the admin to the identity provider and
 * the provider's callback. Each variant holds only what that protocol's callback has to verify.
 */
public sealed interface TestLoginHandshake {

  /**
   * OIDC authorization code + PKCE. The callback must redeem the code with this verifier, check the
   * id_token nonce, and use the same redirect URI the authorization request named.
   */
  record Oidc(String nonce, String codeVerifier, String redirectUri) implements TestLoginHandshake {
    // The verifier and nonce are one-time secrets of an in-flight login; keep them out of logs.
    @Override
    public String toString() {
      return "TestLoginHandshake.Oidc[redirectUri=" + redirectUri + "]";
    }
  }

  /**
   * SAML. Nothing to remember: live login does not bind the response to its AuthnRequest, and a
   * test must never be stricter than the login it predicts, or it would fail a working config.
   */
  record Saml() implements TestLoginHandshake {}

  /** LDAP/Basic. Nothing crosses a redirect; the credentials arrive on an authenticated call. */
  record Credentials() implements TestLoginHandshake {}
}
