/*
 *  Copyright 2025 Collate
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
package org.openmetadata.sdk.test.auth;

import com.auth0.jwt.JWT;
import com.auth0.jwt.algorithms.Algorithm;
import java.io.InputStream;
import java.security.KeyFactory;
import java.security.PrivateKey;
import java.security.interfaces.RSAPrivateKey;
import java.security.spec.PKCS8EncodedKeySpec;
import java.time.Instant;
import java.util.Date;

/**
 * Issues short-lived RSA256 JWTs suitable for integration tests against a local OpenMetadata
 * server. Loads a test-only private key from the classpath at {@code private_key.der}. The
 * caller's test harness is responsible for configuring the server with a matching public key.
 */
public final class JwtAuthProvider {

  private static final String DEFAULT_ISSUER = "open-metadata.org";
  private static final String DEFAULT_KEY_ID = "test-key";
  private static final String DEFAULT_KEY_RESOURCE = "private_key.der";

  private static volatile PrivateKey cachedKey;

  private JwtAuthProvider() {}

  public static String tokenFor(String subject, String email, String[] roles, long ttlSeconds) {
    return tokenFor(subject, email, roles, ttlSeconds, DEFAULT_ISSUER, DEFAULT_KEY_ID);
  }

  public static String tokenFor(
      String subject,
      String email,
      String[] roles,
      long ttlSeconds,
      String issuer,
      String keyId) {
    Algorithm alg = Algorithm.RSA256(null, (RSAPrivateKey) loadPrivateKey());
    Instant now = Instant.now();
    var builder =
        JWT.create()
            .withIssuer(issuer)
            .withKeyId(keyId)
            .withIssuedAt(Date.from(now))
            .withExpiresAt(Date.from(now.plusSeconds(ttlSeconds)))
            .withSubject(subject)
            .withClaim("email", email);
    if (roles != null && roles.length > 0) {
      builder.withArrayClaim("roles", roles);
    }
    return builder.sign(alg);
  }

  private static synchronized PrivateKey loadPrivateKey() {
    if (cachedKey != null) {
      return cachedKey;
    }
    try (InputStream is =
        JwtAuthProvider.class.getClassLoader().getResourceAsStream(DEFAULT_KEY_RESOURCE)) {
      if (is == null) {
        throw new IllegalStateException(DEFAULT_KEY_RESOURCE + " not found on the test classpath");
      }
      byte[] keyBytes = is.readAllBytes();
      PKCS8EncodedKeySpec spec = new PKCS8EncodedKeySpec(keyBytes);
      cachedKey = KeyFactory.getInstance("RSA").generatePrivate(spec);
      return cachedKey;
    } catch (Exception e) {
      throw new IllegalStateException("Failed to load test private key", e);
    }
  }
}
