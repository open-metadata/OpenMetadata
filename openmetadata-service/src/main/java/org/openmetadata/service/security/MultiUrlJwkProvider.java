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
import com.auth0.jwk.UrlJwkProvider;
import com.google.common.cache.CacheBuilder;
import com.google.common.cache.CacheLoader;
import com.google.common.cache.LoadingCache;
import java.net.URL;
import java.util.List;
import java.util.concurrent.TimeUnit;
import org.jetbrains.annotations.NotNull;
import org.openmetadata.service.exception.UnhandledServerException;

final class MultiUrlJwkProvider implements JwkProvider {
  private final List<JwkProvider> jwkProviders;
  private final LocalJwkProvider localJwkProvider = new LocalJwkProvider();
  private final LoadingCache<String, Jwk> CACHE =
      CacheBuilder.newBuilder()
          .maximumSize(10)
          .expireAfterWrite(24, TimeUnit.HOURS)
          .build(
              new CacheLoader<>() {
                @Override
                public @NotNull Jwk load(@NotNull String key) throws Exception {
                  try {
                    return localJwkProvider.get(key);
                  } catch (Exception ignored) {
                    // ignore exception
                  }
                  JwkException lastException =
                      new SigningKeyNotFoundException(
                          "JWT Token keyID doesn't match the configured keyID. This usually happens if you didn't configure "
                              + "proper publicKeyUrls under authentication configuration.",
                          null);
                  for (JwkProvider jwkProvider : jwkProviders) {
                    try {
                      return jwkProvider.get(key);
                    } catch (JwkException e) {
                      lastException.addSuppressed(e);
                    }
                  }
                  throw lastException;
                }
              });

  public MultiUrlJwkProvider(List<URL> publicKeyUris) {
    this.jwkProviders =
        publicKeyUris.stream()
            .map(UrlJwkProvider::new)
            .collect(java.util.stream.Collectors.toList());
  }

  @Override
  public Jwk get(String keyId) {
    try {
      return CACHE.get(keyId);
    } catch (Exception e) {
      throw new UnhandledServerException(e.getMessage());
    }
  }
}
