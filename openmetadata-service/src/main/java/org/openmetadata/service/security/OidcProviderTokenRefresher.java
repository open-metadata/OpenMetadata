package org.openmetadata.service.security;

import com.nimbusds.oauth2.sdk.AuthorizationGrant;
import com.nimbusds.oauth2.sdk.ErrorObject;
import com.nimbusds.oauth2.sdk.OAuth2Error;
import com.nimbusds.oauth2.sdk.ParseException;
import com.nimbusds.oauth2.sdk.RefreshTokenGrant;
import com.nimbusds.oauth2.sdk.SerializeException;
import com.nimbusds.oauth2.sdk.TokenRequest;
import com.nimbusds.oauth2.sdk.TokenResponse;
import com.nimbusds.oauth2.sdk.http.HTTPResponse;
import com.nimbusds.oauth2.sdk.token.BearerTokenError;
import com.nimbusds.oauth2.sdk.token.RefreshToken;
import com.nimbusds.oauth2.sdk.token.Tokens;
import com.nimbusds.openid.connect.sdk.OIDCTokenResponseParser;
import java.io.IOException;
import java.util.Set;
import java.util.function.Function;
import lombok.extern.slf4j.Slf4j;
import org.pac4j.core.exception.TechnicalException;

/**
 * Redeems the provider refresh token a confidential OIDC session captured at login. A rejected grant
 * is a verdict: the provider signed the user out (where its refresh tokens are bound to its
 * session, as Keycloak's are), the session reached its maximum, the user was disabled, or the token
 * was revoked. A successful grant is not the opposite verdict. Entra ID refresh tokens, for one,
 * survive single sign-out, so success only renews the provider's tokens; it never extends the
 * OpenMetadata session.
 */
@Slf4j
public class OidcProviderTokenRefresher {

  /**
   * Token-endpoint errors (RFC 6749 section 5.2) that are a verdict on the grant itself.
   * {@code unauthorized_client} is not one: it says the client may not use the grant type, a
   * configuration problem that would otherwise end every session at its next refresh.
   */
  private static final Set<String> REJECTED_GRANT_ERRORS =
      Set.of(OAuth2Error.INVALID_GRANT_CODE, BearerTokenError.INVALID_TOKEN.getCode());

  public enum Status {
    RENEWED,
    REJECTED,
    UNAVAILABLE
  }

  /**
   * @param rotatedRefreshToken the replacement refresh token when the provider rotates on use,
   *     otherwise {@code null}
   * @param lifetimeSeconds the renewed access token's {@code expires_in}, or 0 when the provider
   *     did not say
   */
  public record Outcome(Status status, String rotatedRefreshToken, long lifetimeSeconds) {
    static Outcome renewed(String rotatedRefreshToken, long lifetimeSeconds) {
      return new Outcome(Status.RENEWED, rotatedRefreshToken, lifetimeSeconds);
    }

    static Outcome of(Status status) {
      return new Outcome(status, null, 0);
    }

    public boolean isRenewed() {
      return status == Status.RENEWED;
    }

    public boolean isRejected() {
      return status == Status.REJECTED;
    }
  }

  @FunctionalInterface
  public interface TokenEndpoint {
    HTTPResponse send(TokenRequest request) throws IOException;
  }

  private final Function<AuthorizationGrant, TokenRequest> tokenRequestFactory;
  private final TokenEndpoint tokenEndpoint;

  public OidcProviderTokenRefresher(
      Function<AuthorizationGrant, TokenRequest> tokenRequestFactory, TokenEndpoint tokenEndpoint) {
    this.tokenRequestFactory = tokenRequestFactory;
    this.tokenEndpoint = tokenEndpoint;
  }

  /**
   * Any failure to reach or understand the provider, and any error that is not a verdict on the
   * grant, is {@link Status#UNAVAILABLE}: a provider outage or misconfiguration must not end
   * sessions.
   */
  public Outcome refresh(String providerRefreshToken) {
    try {
      TokenRequest request =
          tokenRequestFactory.apply(new RefreshTokenGrant(new RefreshToken(providerRefreshToken)));
      return toOutcome(OIDCTokenResponseParser.parse(tokenEndpoint.send(request)));
    } catch (IOException | ParseException | TechnicalException | SerializeException e) {
      LOG.warn("Identity provider token endpoint unavailable for refresh: {}", e.getMessage());
      return Outcome.of(Status.UNAVAILABLE);
    }
  }

  private static Outcome toOutcome(TokenResponse response) {
    if (response.indicatesSuccess()) {
      Tokens tokens = response.toSuccessResponse().getTokens();
      RefreshToken rotated = tokens.getRefreshToken();
      return Outcome.renewed(
          rotated == null ? null : rotated.getValue(), tokens.getAccessToken().getLifetime());
    }
    ErrorObject error = response.toErrorResponse().getErrorObject();
    // A non-JSON error body (a proxy's 502/503 page) parses with no error code at all.
    String errorCode = error == null ? null : error.getCode();
    boolean isRejected = errorCode != null && REJECTED_GRANT_ERRORS.contains(errorCode);
    LOG.info(
        "Identity provider refused the refresh-token grant: status={}, error={}",
        error == null ? null : error.getHTTPStatusCode(),
        errorCode);
    return Outcome.of(isRejected ? Status.REJECTED : Status.UNAVAILABLE);
  }
}
