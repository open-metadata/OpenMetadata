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

package org.openmetadata.service.security;

import com.auth0.jwk.Jwk;
import com.auth0.jwk.JwkException;
import com.auth0.jwk.JwkProvider;
import com.auth0.jwk.SigningKeyNotFoundException;
import com.google.common.base.Ticker;
import java.net.URL;
import java.time.Duration;
import java.util.List;
import java.util.function.Supplier;
import org.openmetadata.service.exception.UnhandledServerException;

/** Finds the key a token names: OpenMetadata's own key, else the identity provider's. */
final class MultiUrlJwkProvider implements JwkProvider {
  private static final Duration KEY_LIFETIME = Duration.ofHours(24);

  private final LocalJwkProvider localJwkProvider = new LocalJwkProvider();
  private final IdentityProviderKeys identityProviderKeys;

  public MultiUrlJwkProvider(List<URL> publicKeyUris) {
    this(publicKeyUris, List::of);
  }

  /**
   * {@code providerKeySetUrls} adds the identity provider's own key set (its discovery document's
   * {@code jwks_uri}) to the configured URLs: provider tokens are signed with it, and a deployment
   * configured only through the environment never had it written into {@code publicKeyUrls}.
   */
  MultiUrlJwkProvider(List<URL> publicKeyUris, Supplier<List<URL>> providerKeySetUrls) {
    this.identityProviderKeys =
        new IdentityProviderKeys(
            publicKeyUris,
            providerKeySetUrls,
            KeySetFetchPolicy.DEFAULT,
            KEY_LIFETIME,
            Ticker.systemTicker());
  }

  @Override
  public Jwk get(String keyId) {
    try {
      return keyHolderOf(keyId).get(keyId);
    } catch (SigningKeyNotFoundException e) {
      // A key we do not trust signed the token (a rotated key, another issuer, a stale token, or
      // no key id at all). A 401 lets the client renew or sign in again; a 500 makes it treat a
      // session it could recover as fatal.
      throw AuthenticationException.getInvalidTokenException(
          "Token signing key not found in configured public keys", e);
    } catch (JwkException e) {
      throw new UnhandledServerException("JWKS key resolution failed", e);
    }
  }

  private JwkProvider keyHolderOf(String keyId) {
    return localJwkProvider.hasKey(keyId) ? localJwkProvider : identityProviderKeys;
  }
}
