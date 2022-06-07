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

package org.openmetadata.catalog.security;

import com.auth0.jwk.Jwk;
import com.auth0.jwk.JwkException;
import com.auth0.jwk.JwkProvider;
import com.auth0.jwk.SigningKeyNotFoundException;
import com.auth0.jwk.UrlJwkProvider;
import java.net.URL;
import java.util.List;
import java.util.stream.Collectors;

final class MultiUrlJwkProvider implements JwkProvider {
  private final List<UrlJwkProvider> urlJwkProviders;

  public MultiUrlJwkProvider(List<URL> publicKeyUris) {
    this.urlJwkProviders = publicKeyUris.stream().map(UrlJwkProvider::new).collect(Collectors.toUnmodifiableList());
  }

  @Override
  public Jwk get(String keyId) throws JwkException {
    JwkException lastException = new SigningKeyNotFoundException("No key found in with kid " + keyId, null);
    for (UrlJwkProvider jwkProvider : urlJwkProviders) {
      try {
        return jwkProvider.get(keyId);
      } catch (JwkException e) {
        lastException.addSuppressed(e);
      }
    }
    throw lastException;
  }
}
