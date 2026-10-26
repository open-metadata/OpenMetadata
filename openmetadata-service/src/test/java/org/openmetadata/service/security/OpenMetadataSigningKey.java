/*
 *  Copyright 2026 Collate
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

import java.net.URISyntaxException;
import java.nio.file.Path;
import java.util.List;
import org.openmetadata.schema.api.security.AuthenticationConfiguration;
import org.openmetadata.schema.api.security.jwt.JWTTokenConfiguration;
import org.openmetadata.service.security.jwt.JWTTokenGenerator;

/**
 * Sets up the process-wide {@link JWTTokenGenerator} with the test key pair, as server startup
 * does, so a test mints tokens with the calls the server makes and verifies them with the key
 * lookup the server uses.
 */
final class OpenMetadataSigningKey {
  static final String KEY_ID = "test-key";
  static final String ISSUER = "open-metadata.org";

  private OpenMetadataSigningKey() {}

  static JWTTokenGenerator install() {
    JWTTokenConfiguration configuration =
        new JWTTokenConfiguration()
            .withJwtissuer(ISSUER)
            .withKeyId(KEY_ID)
            .withRsaprivateKeyFilePath(resourcePath("private_key.der"))
            .withRsapublicKeyFilePath(resourcePath("public_key.der"));
    JWTTokenGenerator generator = JWTTokenGenerator.getInstance();
    generator.init(
        new AuthenticationConfiguration()
            .withTokenValidationAlgorithm(
                AuthenticationConfiguration.TokenValidationAlgorithm.RS_256),
        configuration);
    return generator;
  }

  /** Resolves OpenMetadata's own key locally, as the server's key lookup does. */
  static MultiUrlJwkProvider keyLookup() {
    return new MultiUrlJwkProvider(List.of());
  }

  private static String resourcePath(String name) {
    try {
      return Path.of(OpenMetadataSigningKey.class.getClassLoader().getResource(name).toURI())
          .toString();
    } catch (URISyntaxException e) {
      throw new IllegalStateException(e);
    }
  }
}
