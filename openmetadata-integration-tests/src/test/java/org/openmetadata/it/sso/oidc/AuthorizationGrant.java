package org.openmetadata.it.sso.oidc;

import static java.nio.charset.StandardCharsets.US_ASCII;

import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Arrays;
import java.util.Base64;

/** What the authorize endpoint promised to the holder of one authorization code. */
record AuthorizationGrant(
    MockOidcIdentity identity,
    String redirectUri,
    String nonce,
    String codeChallenge,
    String scope) {
  private static final String SHA_256 = "SHA-256";
  private static final String SCOPE_SEPARATOR = " ";

  boolean isRedeemableBy(String presentedRedirectUri, String codeVerifier) {
    return redirectUri.equals(presentedRedirectUri) && isProvenBy(codeVerifier);
  }

  boolean requestsOfflineAccess() {
    return scope != null
        && Arrays.asList(scope.split(SCOPE_SEPARATOR)).contains(MockOidcProtocol.OFFLINE_ACCESS);
  }

  // Without a challenge the client did not use PKCE, so any (or no) verifier is accepted.
  private boolean isProvenBy(String codeVerifier) {
    return codeChallenge == null
        || (codeVerifier != null && codeChallenge.equals(s256(codeVerifier)));
  }

  private static String s256(String codeVerifier) {
    try {
      byte[] digest = MessageDigest.getInstance(SHA_256).digest(codeVerifier.getBytes(US_ASCII));
      return Base64.getUrlEncoder().withoutPadding().encodeToString(digest);
    } catch (NoSuchAlgorithmException e) {
      throw new IllegalStateException("SHA-256 is unavailable", e);
    }
  }
}
