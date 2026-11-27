package org.openmetadata.it.sso.oidc;

/** Ways a forged ID token can try to pass as one the provider signed. */
public enum TokenForgery {
  /** {@code alg: none}, no signature at all. */
  UNSIGNED,
  /** HS256 keyed with the provider's RSA public key: the classic algorithm-confusion attack. */
  HMAC_KEYED_WITH_PUBLIC_KEY,
  /** Correctly signed by the published key, but with RS512 where the server expects RS256. */
  RS512_SIGNATURE
}
