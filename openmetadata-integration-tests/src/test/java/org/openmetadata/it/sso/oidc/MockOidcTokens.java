package org.openmetadata.it.sso.oidc;

import com.nimbusds.jwt.JWTClaimsSet;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.Date;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicReference;
import org.openmetadata.it.sso.MockHttp;
import org.openmetadata.it.sso.oidc.MockOidcProtocol.TokenResponse;

/** Mints the provider's tokens and remembers the codes and refresh tokens it handed out. */
final class MockOidcTokens {
  private static final int MAX_OUTSTANDING = 1_000;
  private static final int RANDOM_TOKEN_BYTES = 32;
  private static final String BEARER = "Bearer";
  private static final String NONCE = "nonce";
  private static final Duration ID_TOKEN_LIFETIME = Duration.ofMinutes(10);

  private final String issuer;
  private final String clientId;
  private final MockOidcKeys keys;
  private final OidcProviderProfile profile;
  private final SecureRandom random = new SecureRandom();
  private final Map<String, AuthorizationGrant> pendingCodes = MockHttp.boundedMap(MAX_OUTSTANDING);
  private final Map<String, MockOidcIdentity> refreshTokenHolders =
      MockHttp.boundedMap(MAX_OUTSTANDING);
  private final AtomicReference<String> lastIssuedIdToken = new AtomicReference<>();
  private final AtomicReference<IdTokenDefect> nextDefect = new AtomicReference<>();

  MockOidcTokens(String issuer, String clientId, MockOidcKeys keys, OidcProviderProfile profile) {
    this.issuer = issuer;
    this.clientId = clientId;
    this.keys = keys;
    this.profile = profile;
  }

  String issueCode(AuthorizationGrant grant) {
    String code = randomToken();
    pendingCodes.put(code, grant);
    return code;
  }

  /** Codes are single use: redeeming one removes it whether or not the exchange succeeds. */
  Optional<AuthorizationGrant> redeemCode(String code) {
    return Optional.ofNullable(code).map(pendingCodes::remove);
  }

  Optional<MockOidcIdentity> holderOf(String refreshToken) {
    return Optional.ofNullable(refreshToken).map(refreshTokenHolders::get);
  }

  TokenResponse forLogin(AuthorizationGrant grant) {
    String refreshToken = grant.requestsOfflineAccess() ? newRefreshToken(grant.identity()) : null;
    return tokenResponse(
        idToken(grant.identity(), grant.nonce(), ID_TOKEN_LIFETIME),
        refreshToken,
        ID_TOKEN_LIFETIME);
  }

  TokenResponse forRefresh(
      MockOidcIdentity holder, String presentedRefreshToken, RefreshOutcome.Renew renew) {
    Duration lifetime =
        renew.idTokenLifetime() == null ? ID_TOKEN_LIFETIME : renew.idTokenLifetime();
    String idToken = renew.includesIdToken() ? idToken(holder, null, lifetime) : null;
    String rotated =
        renew.rotatesRefreshToken() ? rotateRefreshToken(presentedRefreshToken, holder) : null;
    return tokenResponse(idToken, rotated, lifetime);
  }

  TokenResponse forClientCredentials() {
    return tokenResponse(null, null, ID_TOKEN_LIFETIME);
  }

  String idToken(MockOidcIdentity identity, String nonce) {
    return idToken(identity, nonce, ID_TOKEN_LIFETIME);
  }

  String forgedIdToken(MockOidcIdentity identity, TokenForgery forgery) {
    return keys.forge(claims(identity, null, ID_TOKEN_LIFETIME, null), forgery);
  }

  String lastIssuedIdToken() {
    return lastIssuedIdToken.get();
  }

  void defectNextIdToken(IdTokenDefect defect) {
    nextDefect.set(defect);
  }

  private String idToken(MockOidcIdentity identity, String nonce, Duration lifetime) {
    IdTokenDefect defect = nextDefect.getAndSet(null);
    JWTClaimsSet claims = claims(identity, nonce, lifetime, defect);
    String idToken =
        defect == IdTokenDefect.UNPUBLISHED_KEY
            ? keys.signWithUnpublishedKey(claims)
            : keys.sign(claims);
    lastIssuedIdToken.set(idToken);
    return idToken;
  }

  private JWTClaimsSet claims(
      MockOidcIdentity identity, String nonce, Duration lifetime, IdTokenDefect defect) {
    Instant now = Instant.now();
    JWTClaimsSet.Builder claims =
        new JWTClaimsSet.Builder()
            .issuer(issuer)
            .subject(identity.subject())
            .audience(clientId)
            .issueTime(Date.from(now))
            .expirationTime(Date.from(now.plus(lifetime)));
    profile.shapeClaims(identity).forEach(claims::claim);
    if (nonce != null) {
      claims.claim(NONCE, nonce);
    }
    return defect == null ? claims.build() : defect.applyTo(claims, now).build();
  }

  private String rotateRefreshToken(String presentedRefreshToken, MockOidcIdentity holder) {
    refreshTokenHolders.remove(presentedRefreshToken);
    return newRefreshToken(holder);
  }

  private String newRefreshToken(MockOidcIdentity identity) {
    String refreshToken = randomToken();
    refreshTokenHolders.put(refreshToken, identity);
    return refreshToken;
  }

  private TokenResponse tokenResponse(String idToken, String refreshToken, Duration lifetime) {
    return new TokenResponse(randomToken(), BEARER, lifetime.toSeconds(), idToken, refreshToken);
  }

  private String randomToken() {
    byte[] bytes = new byte[RANDOM_TOKEN_BYTES];
    random.nextBytes(bytes);
    return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
  }
}
