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

package org.openmetadata.mcp.server.auth.validators;

import com.auth0.jwk.Jwk;
import com.auth0.jwk.JwkException;
import com.auth0.jwk.JwkProvider;
import com.auth0.jwk.SigningKeyNotFoundException;
import com.auth0.jwk.UrlJwkProvider;
import com.auth0.jwt.JWT;
import com.auth0.jwt.algorithms.Algorithm;
import com.auth0.jwt.exceptions.JWTDecodeException;
import com.auth0.jwt.interfaces.DecodedJWT;
import com.google.common.cache.CacheBuilder;
import com.google.common.cache.CacheLoader;
import com.google.common.cache.LoadingCache;
import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.jwt.JWTParser;
import java.net.MalformedURLException;
import java.net.URL;
import java.security.interfaces.RSAPublicKey;
import java.util.Calendar;
import java.util.List;
import java.util.TimeZone;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
import org.jetbrains.annotations.NotNull;

/**
 * Validates ID tokens from OIDC providers using JWKS-based signature verification.
 *
 * <p>This validator ensures that ID tokens received from SSO providers (Google, Azure, Okta, etc.)
 * are cryptographically valid by:
 *
 * <ol>
 *   <li>Verifying the JWT signature using the provider's public keys (JWKS endpoint)
 *   <li>Validating token expiration
 *   <li>Validating the issuer matches the expected OIDC provider
 *   <li>Checking audience (client ID) if present
 * </ol>
 *
 * <p>This prevents token forgery attacks where an attacker could create fake ID tokens to
 * impersonate users.
 *
 * <p><b>Usage:</b>
 *
 * <pre>{@code
 * IdTokenValidator validator = new IdTokenValidator(
 *     authConfig.getPublicKeyUrls(),
 *     "https://accounts.google.com",
 *     "my-client-id"
 * );
 *
 * try {
 *   JWTClaimsSet claims = validator.validateAndDecode(idTokenString);
 *   String email = (String) claims.getClaim("email");
 * } catch (IdTokenValidationException e) {
 *   LOG.error("ID token validation failed", e);
 *   // Handle invalid token
 * }
 * }</pre>
 *
 * @see MultiUrlJwkProvider
 * @see com.auth0.jwt.JWT
 */
@Slf4j
public class IdTokenValidator {

  private final JwkProvider jwkProvider;
  private final String expectedIssuer;
  private final String expectedAudience; // Client ID
  private final String tokenValidationAlgorithm;

  /**
   * Creates an ID token validator.
   *
   * @param publicKeyUrls List of JWKS endpoint URLs (e.g., Google's JWKS endpoint)
   * @param expectedIssuer The expected issuer claim (e.g., "https://accounts.google.com")
   * @param expectedAudience The expected audience (client ID), can be null if not validated
   */
  public IdTokenValidator(
      List<String> publicKeyUrls, String expectedIssuer, String expectedAudience) {
    this(publicKeyUrls, expectedIssuer, expectedAudience, "RS256");
  }

  /**
   * Creates an ID token validator with custom algorithm.
   *
   * @param publicKeyUrls List of JWKS endpoint URLs
   * @param expectedIssuer The expected issuer claim
   * @param expectedAudience The expected audience (client ID), can be null
   * @param tokenValidationAlgorithm JWT signature algorithm (default: RS256)
   */
  public IdTokenValidator(
      List<String> publicKeyUrls,
      String expectedIssuer,
      String expectedAudience,
      String tokenValidationAlgorithm) {
    if (publicKeyUrls == null || publicKeyUrls.isEmpty()) {
      throw new IllegalArgumentException("publicKeyUrls cannot be null or empty");
    }
    if (expectedIssuer == null || expectedIssuer.trim().isEmpty()) {
      throw new IllegalArgumentException("expectedIssuer cannot be null or empty");
    }

    // Convert URLs and initialize multi-URL JWKS provider with caching
    List<URL> urls =
        publicKeyUrls.stream()
            .map(
                urlString -> {
                  try {
                    return new URL(urlString);
                  } catch (MalformedURLException e) {
                    throw new IllegalArgumentException(
                        "Invalid JWKS URL: " + urlString + " - " + e.getMessage(), e);
                  }
                })
            .collect(Collectors.toList());

    this.jwkProvider = new CachingMultiUrlJwkProvider(urls);
    this.expectedIssuer = expectedIssuer;
    this.expectedAudience = expectedAudience;
    this.tokenValidationAlgorithm = tokenValidationAlgorithm;

    LOG.info(
        "Initialized IdTokenValidator with issuer: {}, audience: {}, algorithm: {}",
        expectedIssuer,
        expectedAudience != null ? expectedAudience : "not validated",
        tokenValidationAlgorithm);
  }

  /**
   * Validates an ID token and returns the verified claims.
   *
   * <p>This method performs comprehensive validation:
   *
   * <ol>
   *   <li><b>JWT Decoding:</b> Parses the token structure
   *   <li><b>Expiration Check:</b> Ensures token hasn't expired (with 60s clock skew)
   *   <li><b>Issuer Validation:</b> Verifies token was issued by expected provider
   *   <li><b>Audience Validation:</b> Checks client ID matches (if configured)
   *   <li><b>Signature Verification:</b> Cryptographically verifies using JWKS public key
   * </ol>
   *
   * @param idTokenString The ID token JWT string
   * @return Validated JWT claims set
   * @throws IdTokenValidationException if validation fails for any reason
   */
  public JWTClaimsSet validateAndDecode(String idTokenString) throws IdTokenValidationException {
    if (idTokenString == null || idTokenString.trim().isEmpty()) {
      throw new IdTokenValidationException("ID token cannot be null or empty");
    }

    // Step 1: Decode JWT using auth0 library (for signature verification)
    DecodedJWT jwt;
    try {
      jwt = JWT.decode(idTokenString);
    } catch (JWTDecodeException e) {
      LOG.error("Failed to decode ID token: {}", e.getMessage());
      throw new IdTokenValidationException("Unable to decode ID token: " + e.getMessage(), e);
    }

    // Step 2: Check expiration (with clock skew tolerance)
    if (jwt.getExpiresAt() != null) {
      Calendar now = Calendar.getInstance(TimeZone.getTimeZone("UTC"));
      // Allow 60 seconds clock skew (accept tokens that expired up to 60 seconds ago)
      // This accounts for slight clock differences between servers
      now.add(Calendar.SECOND, -60);

      if (jwt.getExpiresAt().before(now.getTime())) {
        LOG.warn("ID token has expired. Expiration: {}", jwt.getExpiresAt());
        throw new IdTokenValidationException(
            "ID token has expired at " + jwt.getExpiresAt() + ". Please restart authentication.");
      }
    }

    // Step 3: Validate issuer
    String issuer = jwt.getIssuer();
    if (issuer == null || issuer.trim().isEmpty()) {
      LOG.error("ID token missing issuer claim");
      throw new IdTokenValidationException("ID token is missing required 'iss' (issuer) claim");
    }

    if (!expectedIssuer.equals(issuer)) {
      LOG.warn(
          "ID token issuer mismatch. Expected: {}, Got: {}. This may indicate a token from a different OIDC provider.",
          expectedIssuer,
          issuer);
      throw new IdTokenValidationException(
          String.format(
              "ID token issuer mismatch. Expected '%s' but got '%s'. "
                  + "Ensure the token is from the correct OIDC provider.",
              expectedIssuer, issuer));
    }

    // Step 4: Validate audience (client ID) if configured
    if (expectedAudience != null) {
      List<String> audiences = jwt.getAudience();
      if (audiences == null || audiences.isEmpty()) {
        LOG.warn("ID token missing audience claim");
        throw new IdTokenValidationException("ID token is missing required 'aud' (audience) claim");
      }

      if (!audiences.contains(expectedAudience)) {
        LOG.warn("ID token audience mismatch. Expected: {}, Got: {}", expectedAudience, audiences);
        throw new IdTokenValidationException(
            String.format(
                "ID token audience mismatch. Expected '%s' but got %s",
                expectedAudience, audiences));
      }
    }

    // Step 5: Verify JWT signature using JWKS public key
    String keyId = jwt.getKeyId();
    if (keyId == null || keyId.trim().isEmpty()) {
      LOG.error("ID token missing key ID (kid) header");
      throw new IdTokenValidationException(
          "ID token is missing 'kid' header. Cannot verify signature.");
    }

    try {
      // Fetch public key from JWKS endpoint (with caching)
      Jwk jwk = jwkProvider.get(keyId);
      RSAPublicKey publicKey = (RSAPublicKey) jwk.getPublicKey();

      // Create algorithm for verification
      Algorithm algorithm = getAlgorithm(tokenValidationAlgorithm, publicKey);

      // Verify signature
      algorithm.verify(jwt);

      LOG.debug("ID token signature verified successfully for key ID: {}", keyId);

    } catch (JwkException e) {
      LOG.error("Failed to fetch public key for key ID '{}': {}", keyId, e.getMessage());
      throw new IdTokenValidationException(
          String.format(
              "Failed to fetch public key for key ID '%s'. The signing key may have rotated or the JWKS endpoint is unreachable.",
              keyId),
          e);
    } catch (RuntimeException e) {
      LOG.error("ID token signature verification failed: {}", e.getMessage());
      throw new IdTokenValidationException(
          "ID token signature verification failed. The token may have been tampered with or signed with a different key.",
          e);
    }

    // Step 6: Parse claims using nimbus library (for compatibility with existing code)
    JWTClaimsSet claimsSet;
    try {
      claimsSet = JWTParser.parse(idTokenString).getJWTClaimsSet();
    } catch (Exception e) {
      LOG.error("Failed to parse ID token claims: {}", e.getMessage());
      throw new IdTokenValidationException("Failed to parse ID token claims: " + e.getMessage(), e);
    }

    LOG.info(
        "ID token validated successfully. Issuer: {}, Subject: {}, Expiration: {}",
        issuer,
        jwt.getSubject(),
        jwt.getExpiresAt());

    return claimsSet;
  }

  /**
   * Creates the appropriate algorithm for JWT signature verification.
   *
   * @param algorithm Algorithm name (e.g., "RS256", "RS384", "RS512")
   * @param publicKey RSA public key for verification
   * @return Algorithm instance for verification
   */
  private Algorithm getAlgorithm(String algorithm, RSAPublicKey publicKey) {
    return switch (algorithm) {
      case "RS256" -> Algorithm.RSA256(publicKey, null);
      case "RS384" -> Algorithm.RSA384(publicKey, null);
      case "RS512" -> Algorithm.RSA512(publicKey, null);
      default -> throw new IllegalArgumentException(
          "Unsupported token validation algorithm: "
              + algorithm
              + ". Supported: RS256, RS384, RS512");
    };
  }

  /**
   * Exception thrown when ID token validation fails.
   *
   * <p>This can occur for various reasons:
   *
   * <ul>
   *   <li>Token expired
   *   <li>Invalid signature (token tampered with or forged)
   *   <li>Issuer mismatch (token from different OIDC provider)
   *   <li>Audience mismatch (token intended for different client)
   *   <li>Missing required claims
   *   <li>JWKS endpoint unreachable
   * </ul>
   */
  public static class IdTokenValidationException extends Exception {
    public IdTokenValidationException(String message) {
      super(message);
    }

    public IdTokenValidationException(String message, Throwable cause) {
      super(message, cause);
    }
  }

  /**
   * Multi-URL JWKS provider with caching for ID token signature verification.
   *
   * <p>Tries multiple JWKS endpoints to fetch public keys and caches them for 24 hours. This
   * handles key rotation and multiple SSO providers gracefully.
   */
  private static class CachingMultiUrlJwkProvider implements JwkProvider {
    private final List<JwkProvider> jwkProviders;
    private final LoadingCache<String, Jwk> cache;

    public CachingMultiUrlJwkProvider(List<URL> publicKeyUrls) {
      this.jwkProviders =
          publicKeyUrls.stream().map(UrlJwkProvider::new).collect(Collectors.toList());

      this.cache =
          CacheBuilder.newBuilder()
              .maximumSize(10)
              .expireAfterWrite(24, TimeUnit.HOURS)
              .build(
                  new CacheLoader<>() {
                    @Override
                    public @NotNull Jwk load(@NotNull String keyId) throws Exception {
                      JwkException lastException =
                          new SigningKeyNotFoundException(
                              "Key ID '" + keyId + "' not found in any configured JWKS endpoint",
                              null);

                      for (JwkProvider provider : jwkProviders) {
                        try {
                          return provider.get(keyId);
                        } catch (JwkException e) {
                          lastException.addSuppressed(e);
                        }
                      }
                      throw lastException;
                    }
                  });
    }

    @Override
    public Jwk get(String keyId) throws JwkException {
      try {
        return cache.get(keyId);
      } catch (Exception e) {
        if (e.getCause() instanceof JwkException) {
          throw (JwkException) e.getCause();
        }
        throw new JwkException("Failed to fetch JWK for key ID: " + keyId, e);
      }
    }
  }
}
