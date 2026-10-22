package org.openmetadata.it.sso.oidc;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

/**
 * The person signed in at the mock identity provider, and the claims its ID tokens carry.
 *
 * @param extraClaims provider-specific claims (for example {@code upn}, {@code cognito:groups}).
 */
public record MockOidcIdentity(
    String subject, String email, String displayName, Map<String, Object> extraClaims) {
  private static final String EMAIL = "email";
  private static final String NAME = "name";

  public MockOidcIdentity {
    extraClaims = Map.copyOf(extraClaims);
  }

  public static MockOidcIdentity forEmail(String email) {
    return new MockOidcIdentity("sub-" + UUID.randomUUID(), email, null, Map.of());
  }

  public MockOidcIdentity withDisplayName(String newDisplayName) {
    return new MockOidcIdentity(subject, email, newDisplayName, extraClaims);
  }

  public MockOidcIdentity withClaim(String name, Object value) {
    Map<String, Object> claims = new LinkedHashMap<>(extraClaims);
    claims.put(name, value);
    return new MockOidcIdentity(subject, email, displayName, claims);
  }

  /** The identity claims of an ID token, without the protocol claims (iss, aud, exp, nonce). */
  Map<String, Object> identityClaims() {
    Map<String, Object> claims = new LinkedHashMap<>();
    putIfPresent(claims, EMAIL, email);
    putIfPresent(claims, NAME, displayName);
    claims.putAll(extraClaims);
    return claims;
  }

  private static void putIfPresent(Map<String, Object> claims, String name, Object value) {
    if (value != null) {
      claims.put(name, value);
    }
  }
}
