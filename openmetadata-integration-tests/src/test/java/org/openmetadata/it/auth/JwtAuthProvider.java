package org.openmetadata.it.auth;

import com.auth0.jwt.JWT;
import com.auth0.jwt.algorithms.Algorithm;
import java.io.InputStream;
import java.security.KeyFactory;
import java.security.PrivateKey;
import java.security.spec.PKCS8EncodedKeySpec;
import java.time.Instant;

public class JwtAuthProvider {

  private static PrivateKey privateKey;

  private static PrivateKey loadPrivateKey() {
    if (privateKey != null) return privateKey;
    try {
      InputStream is =
          JwtAuthProvider.class.getClassLoader().getResourceAsStream("private_key.der");
      if (is == null) throw new IllegalStateException("private_key.der not found in resources");
      byte[] keyBytes = is.readAllBytes();
      PKCS8EncodedKeySpec spec = new PKCS8EncodedKeySpec(keyBytes);
      KeyFactory kf = KeyFactory.getInstance("RSA");
      privateKey = kf.generatePrivate(spec);
      return privateKey;
    } catch (Exception e) {
      throw new RuntimeException("Failed to load private key", e);
    }
  }

  public static String tokenFor(String subject, String email, String[] roles, long ttlSeconds) {
    Algorithm alg =
        Algorithm.RSA256(null, (java.security.interfaces.RSAPrivateKey) loadPrivateKey());
    Instant now = Instant.now();
    com.auth0.jwt.JWTCreator.Builder b =
        JWT.create()
            .withIssuer("open-metadata.org")
            .withKeyId("test-key")
            .withIssuedAt(java.util.Date.from(now))
            .withExpiresAt(java.util.Date.from(now.plusSeconds(ttlSeconds)))
            .withSubject(subject)
            .withClaim("email", email);
    if (roles != null && roles.length > 0) {
      b.withArrayClaim("roles", roles);
    }
    return b.sign(alg);
  }
}
