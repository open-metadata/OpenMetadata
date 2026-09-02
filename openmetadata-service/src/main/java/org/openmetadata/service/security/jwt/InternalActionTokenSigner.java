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

package org.openmetadata.service.security.jwt;

import com.auth0.jwt.JWT;
import com.auth0.jwt.JWTVerifier;
import com.auth0.jwt.algorithms.Algorithm;
import com.auth0.jwt.exceptions.InvalidClaimException;
import com.auth0.jwt.interfaces.DecodedJWT;
import java.time.Clock;
import java.time.Instant;
import java.util.Date;
import java.util.Objects;

/** Signs short-lived, purpose-bound tokens that are never accepted as authentication tokens. */
public final class InternalActionTokenSigner {
  private static final String PURPOSE_CLAIM = "internalPurpose";
  private static final String PRINCIPAL_CLAIM = "internalPrincipal";
  private static final String REVISION_CLAIM = "internalRevision";
  private static final String FINGERPRINT_CLAIM = "internalFingerprint";

  private final Algorithm signingAlgorithm;
  private final JWTVerifier verifier;
  private final String issuer;
  private final Clock clock;

  InternalActionTokenSigner(
      final Algorithm signingAlgorithm,
      final Algorithm verificationAlgorithm,
      final String issuer,
      final Clock clock) {
    this.signingAlgorithm = Objects.requireNonNull(signingAlgorithm);
    this.issuer = Objects.requireNonNull(issuer);
    this.clock = Objects.requireNonNull(clock);
    verifier = verifier(verificationAlgorithm, issuer, clock);
  }

  public static InternalActionTokenSigner createDefault(final Clock clock) {
    final JWTTokenGenerator generator = JWTTokenGenerator.getInstance();
    return new InternalActionTokenSigner(
        generator.internalSigningAlgorithm(),
        generator.internalVerificationAlgorithm(),
        generator.getIssuer(),
        clock);
  }

  public String sign(final Claims claims) {
    final Instant now = clock.instant();
    return JWT.create()
        .withIssuer(issuer)
        .withSubject(claims.subject())
        .withClaim(PURPOSE_CLAIM, claims.purpose())
        .withClaim(PRINCIPAL_CLAIM, claims.principal())
        .withClaim(REVISION_CLAIM, claims.revision())
        .withClaim(FINGERPRINT_CLAIM, claims.fingerprint())
        .withIssuedAt(Date.from(now))
        .withExpiresAt(Date.from(claims.expiresAt()))
        .sign(signingAlgorithm);
  }

  public Claims verify(final String token, final String expectedPurpose) {
    final DecodedJWT decoded = verifier.verify(token);
    final String purpose = requiredClaim(decoded, PURPOSE_CLAIM);
    requireExpectedPurpose(purpose, expectedPurpose);
    return new Claims(
        purpose,
        requiredText(decoded.getSubject(), "subject"),
        requiredClaim(decoded, PRINCIPAL_CLAIM),
        requiredClaim(decoded, REVISION_CLAIM),
        requiredClaim(decoded, FINGERPRINT_CLAIM),
        decoded.getExpiresAtAsInstant());
  }

  private static JWTVerifier verifier(
      final Algorithm algorithm, final String issuer, final Clock clock) {
    final JWTVerifier.BaseVerification verification =
        (JWTVerifier.BaseVerification) JWT.require(Objects.requireNonNull(algorithm));
    verification.withIssuer(issuer);
    return verification.build(clock);
  }

  private static String requiredClaim(final DecodedJWT decoded, final String name) {
    return requiredText(decoded.getClaim(name).asString(), name);
  }

  private static String requiredText(final String value, final String name) {
    if (value == null || value.isBlank()) {
      throw new InvalidClaimException("Internal token is missing required claim '" + name + "'");
    }
    return value;
  }

  private static void requireExpectedPurpose(final String actual, final String expected) {
    if (!Objects.equals(actual, expected)) {
      throw new InvalidClaimException("Internal token purpose does not match the requested action");
    }
  }

  public record Claims(
      String purpose,
      String subject,
      String principal,
      String revision,
      String fingerprint,
      Instant expiresAt) {
    public Claims {
      Objects.requireNonNull(purpose);
      Objects.requireNonNull(subject);
      Objects.requireNonNull(principal);
      Objects.requireNonNull(revision);
      Objects.requireNonNull(fingerprint);
      Objects.requireNonNull(expiresAt);
    }
  }
}
