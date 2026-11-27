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
package org.openmetadata.service.socket;

import java.net.URISyntaxException;
import java.nio.file.Path;
import java.util.List;
import org.openmetadata.schema.api.security.AuthenticationConfiguration;
import org.openmetadata.schema.api.security.AuthorizerConfiguration;
import org.openmetadata.schema.api.security.jwt.JWTTokenConfiguration;
import org.openmetadata.schema.services.connections.metadata.AuthProvider;
import org.openmetadata.service.security.jwt.JWTTokenGenerator;

/** Real push-feed handshake filters, built and reloaded the way the server builds them. */
public final class PushFeedFilters {
  private PushFeedFilters() {}

  /**
   * The filter's token validator reads OpenMetadata's own signing key, so the key is installed
   * first: a test must not depend on an earlier test in the same JVM having installed it.
   */
  public static SocketAddressFilter validatingUnder(AuthProvider provider) {
    installSigningKey();
    return new SocketAddressFilter(authenticationFor(provider), authorizer());
  }

  /** What the push-feed reload listener does to the filter once a reload has succeeded. */
  public static void applyReload(SocketAddressFilter filter, AuthProvider provider) {
    filter.updateConfiguration(authenticationFor(provider), authorizer());
  }

  public static AuthenticationConfiguration authenticationFor(AuthProvider provider) {
    return new AuthenticationConfiguration()
        .withProvider(provider)
        .withPublicKeyUrls(List.of())
        .withJwtPrincipalClaims(List.of("sub", "email"))
        .withJwtPrincipalClaimsMapping(List.of());
  }

  private static AuthorizerConfiguration authorizer() {
    return new AuthorizerConfiguration()
        .withPrincipalDomain("open-metadata.org")
        .withEnforcePrincipalDomain(false)
        .withUseRolesFromProvider(false);
  }

  private static void installSigningKey() {
    JWTTokenConfiguration tokenConfiguration = new JWTTokenConfiguration();
    tokenConfiguration.setJwtissuer("open-metadata.org");
    tokenConfiguration.setKeyId("test-key");
    tokenConfiguration.setRsaprivateKeyFilePath(resourcePath("private_key.der"));
    tokenConfiguration.setRsapublicKeyFilePath(resourcePath("public_key.der"));
    JWTTokenGenerator.getInstance()
        .init(
            new AuthenticationConfiguration()
                .withTokenValidationAlgorithm(
                    AuthenticationConfiguration.TokenValidationAlgorithm.RS_256),
            tokenConfiguration);
  }

  private static String resourcePath(String resourceName) {
    try {
      return Path.of(
              Thread.currentThread().getContextClassLoader().getResource(resourceName).toURI())
          .toString();
    } catch (URISyntaxException e) {
      throw new IllegalStateException(e);
    }
  }
}
