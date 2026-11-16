package org.openmetadata.it.sso.oidc;

import com.nimbusds.jose.JOSEException;
import com.nimbusds.jose.JOSEObjectType;
import com.nimbusds.jose.JWSAlgorithm;
import com.nimbusds.jose.JWSHeader;
import com.nimbusds.jose.crypto.MACSigner;
import com.nimbusds.jose.crypto.RSASSASigner;
import com.nimbusds.jose.jwk.JWK;
import com.nimbusds.jose.jwk.JWKSet;
import com.nimbusds.jose.jwk.KeyUse;
import com.nimbusds.jose.jwk.RSAKey;
import com.nimbusds.jose.jwk.gen.RSAKeyGenerator;
import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.jwt.PlainJWT;
import com.nimbusds.jwt.SignedJWT;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CopyOnWriteArrayList;

/**
 * The provider's signing keys. The newest key signs; every key it has published stays in the JWKS.
 * Key ids are never reused, because the server under test caches keys by {@code kid}.
 */
final class MockOidcKeys {
  private static final int RSA_KEY_SIZE = 2048;

  private final List<RSAKey> publishedKeys = new CopyOnWriteArrayList<>();

  MockOidcKeys() {
    rotate();
  }

  /** Publishes a new key and makes it the signing key; older keys stay published. */
  void rotate() {
    publishedKeys.add(generate());
  }

  String jwksJson() {
    List<JWK> publicKeys = publishedKeys.stream().map(key -> (JWK) key.toPublicJWK()).toList();
    return new JWKSet(publicKeys).toString();
  }

  String sign(JWTClaimsSet claims) {
    return sign(claims, signingKey());
  }

  /** Signs with a key that is never published, as a token from an untrusted signer would be. */
  String signWithUnpublishedKey(JWTClaimsSet claims) {
    return sign(claims, generate());
  }

  String forge(JWTClaimsSet claims, TokenForgery forgery) {
    RSAKey key = signingKey();
    return switch (forgery) {
      case UNSIGNED -> new PlainJWT(claims).serialize();
      case HMAC_KEYED_WITH_PUBLIC_KEY -> signWithPublicKeyAsSecret(claims, key);
      case RS512_SIGNATURE -> sign(claims, key, JWSAlgorithm.RS512);
    };
  }

  private RSAKey signingKey() {
    return publishedKeys.getLast();
  }

  private static String sign(JWTClaimsSet claims, RSAKey key) {
    return sign(claims, key, JWSAlgorithm.RS256);
  }

  private static String sign(JWTClaimsSet claims, RSAKey key, JWSAlgorithm algorithm) {
    SignedJWT jwt = new SignedJWT(header(key, algorithm), claims);
    try {
      jwt.sign(new RSASSASigner(key));
    } catch (JOSEException e) {
      throw new IllegalStateException("Could not sign a mock ID token", e);
    }
    return jwt.serialize();
  }

  private static String signWithPublicKeyAsSecret(JWTClaimsSet claims, RSAKey key) {
    SignedJWT jwt = new SignedJWT(header(key, JWSAlgorithm.HS256), claims);
    try {
      jwt.sign(new MACSigner(key.toRSAPublicKey().getEncoded()));
    } catch (JOSEException e) {
      throw new IllegalStateException("Could not forge an HMAC-signed token", e);
    }
    return jwt.serialize();
  }

  private static JWSHeader header(RSAKey key, JWSAlgorithm algorithm) {
    return new JWSHeader.Builder(algorithm).keyID(key.getKeyID()).type(JOSEObjectType.JWT).build();
  }

  private static RSAKey generate() {
    try {
      return new RSAKeyGenerator(RSA_KEY_SIZE)
          .keyID("mock-oidc-" + UUID.randomUUID())
          .keyUse(KeyUse.SIGNATURE)
          .algorithm(JWSAlgorithm.RS256)
          .generate();
    } catch (JOSEException e) {
      throw new IllegalStateException("Could not generate a mock identity provider key", e);
    }
  }
}
