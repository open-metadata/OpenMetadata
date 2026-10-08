/*
 *  Copyright 2025 Collate.
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
package org.openmetadata.service.security;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import com.nimbusds.jwt.JWT;
import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.oauth2.sdk.AuthorizationCodeGrant;
import com.nimbusds.oauth2.sdk.TokenRequest;
import com.nimbusds.oauth2.sdk.pkce.CodeVerifier;
import com.nimbusds.oauth2.sdk.token.RefreshToken;
import com.nimbusds.openid.connect.sdk.AuthenticationErrorResponse;
import com.nimbusds.openid.connect.sdk.AuthenticationResponse;
import com.nimbusds.openid.connect.sdk.AuthenticationResponseParser;
import com.nimbusds.openid.connect.sdk.AuthenticationSuccessResponse;
import java.net.URI;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.TreeMap;
import java.util.concurrent.TimeUnit;
import lombok.SneakyThrows;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.configuration.SecurityConfiguration;
import org.openmetadata.schema.security.client.OidcClientConfig;
import org.openmetadata.schema.system.TestLoginProtocol;
import org.openmetadata.schema.system.TestLoginResult;
import org.openmetadata.schema.system.TestLoginStage;
import org.openmetadata.service.security.auth.TestLoginHandshake;
import org.openmetadata.service.security.auth.TestLoginService;
import org.openmetadata.service.security.auth.TestLoginStageRecorder;
import org.pac4j.core.exception.TechnicalException;
import org.pac4j.oidc.client.OidcClient;
import org.pac4j.oidc.config.OidcConfiguration;
import org.pac4j.oidc.credentials.OidcCredentials;

/**
 * The confidential-client OIDC leg of a Test Login. It sends the admin to the CANDIDATE provider
 * and, on the callback, redeems the code with the candidate's own client credentials — the same
 * steps {@link AuthenticationCodeFlowHandler} takes for a real login, built from the same
 * package-private helpers so the two cannot drift. It stops where the live handler starts writing:
 * it never provisions a user, issues a token, or touches the live client, session store or config.
 * It does renew the test sign-in once with the provider's refresh token, as every live session
 * refresh does, because a provider that cannot do that sends users back to sign in each time their
 * ID token expires.
 *
 * <p>Public clients are not handled here. Their live login redeems the code in the browser, so
 * their test does too, through the {@code validate-token} endpoint.
 */
@Slf4j
public final class TestLoginOidcHandler {
  private static final String PROMPT_NONE = "none";

  /** Where to send the admin, and what the callback must verify when they come back. */
  public record Authorization(String authorizationUrl, TestLoginHandshake.Oidc handshake) {}

  private record ReceivedCallback(
      OidcConfiguration configuration, AuthenticationSuccessResponse response) {}

  private record RedeemedCallback(
      ReceivedCallback received, OidcCredentials credentials, Map<String, Object> claims) {}

  private static final String NO_REFRESH_TOKEN =
      "The identity provider issued no refresh token, so OpenMetadata cannot renew sessions: users "
          + "will be sent back to the provider whenever their ID token expires. Request the "
          + "offline_access scope (Okta, Microsoft Entra ID, Auth0) or allow refresh tokens for this "
          + "client; Google issues one only when the user is shown its consent screen.";
  private static final String REFRESH_REJECTED =
      "The identity provider refused the refresh token it had just issued, so OpenMetadata cannot "
          + "renew sessions.";
  private static final String REFRESH_UNANSWERED =
      "The identity provider did not renew the session with its refresh token. Check that this "
          + "client is allowed the refresh_token grant.";
  private static final String NO_USABLE_ID_TOKEN =
      "The identity provider renewed the session without an ID token that lasts more than a "
          + "minute; OpenMetadata needs one to hand to the browser. Check that the openid scope is "
          + "requested.";

  private TestLoginOidcHandler() {}

  /** Builds the authorization request for the candidate, carrying the Test Login marker as state. */
  public static Authorization authorize(OidcClientConfig candidate, String marker) {
    OidcConfiguration configuration = clientFor(candidate).getConfiguration();
    Map<String, String> params = AuthenticationCodeFlowHandler.buildLoginParams(configuration);
    params.put(OidcConfiguration.REDIRECT_URI, candidate.getCallbackUrl());
    AuthenticationCodeFlowHandler.PendingLoginContext context =
        AuthenticationCodeFlowHandler.addStateAndNonceParameters(configuration, params);
    // The marker is how the shared /callback tells a test from a real login, so it is always sent,
    // even when the candidate disables state.
    params.put(OidcConfiguration.STATE, marker);
    addInteractivePromptAndMaxAge(candidate, params);
    return new Authorization(
        AuthenticationCodeFlowHandler.buildLoginAuthenticationRequestUrl(configuration, params),
        new TestLoginHandshake.Oidc(
            context.nonce(), context.pkceVerifier(), candidate.getCallbackUrl()));
  }

  /**
   * Completes the test from the provider's callback: validates the response, redeems the code with
   * the candidate's client credentials and PKCE verifier, checks the nonce, then resolves the
   * identity through the live login callback's resolver.
   */
  public static TestLoginResult complete(
      SecurityConfiguration candidate,
      TestLoginHandshake.Oidc handshake,
      Map<String, List<String>> callbackParameters) {
    TestLoginStageRecorder recorder = TestLoginStageRecorder.forProtocol(TestLoginProtocol.OIDC);
    recorder.pass(TestLoginStage.STARTED);
    recorder.pass(TestLoginStage.REDIRECTED);
    OidcClientConfig clientConfig =
        candidate.getAuthenticationConfiguration().getOidcConfiguration();
    return receive(clientConfig, handshake, callbackParameters, recorder)
        .flatMap(received -> redeem(received, handshake, recorder))
        .map(redeemed -> renewThenResolve(candidate, redeemed, recorder))
        .orElseGet(() -> TestLoginService.failure(TestLoginProtocol.OIDC, recorder));
  }

  /** A failed renewal still resolves the identity, so the admin sees everything that went wrong. */
  private static TestLoginResult renewThenResolve(
      SecurityConfiguration candidate, RedeemedCallback redeemed, TestLoginStageRecorder recorder) {
    checkSessionRenewal(redeemed.received().configuration(), redeemed.credentials(), recorder);
    return TestLoginService.resolveOidcCallbackIdentity(candidate, redeemed.claims(), recorder);
  }

  private static void checkSessionRenewal(
      OidcConfiguration configuration,
      OidcCredentials credentials,
      TestLoginStageRecorder recorder) {
    RefreshToken refreshToken = credentials.toRefreshToken();
    if (refreshToken == null) {
      recorder.fail(TestLoginStage.TOKEN_REFRESHED, NO_REFRESH_TOKEN);
    } else {
      recordRenewal(refresherFor(configuration).refresh(refreshToken.getValue()), recorder);
    }
  }

  private static void recordRenewal(
      OidcProviderTokenRefresher.Outcome outcome, TestLoginStageRecorder recorder) {
    long expiresAt = AuthenticationCodeFlowHandler.idTokenExpiresAt(outcome.idToken());
    if (outcome.isRejected()) {
      recorder.fail(TestLoginStage.TOKEN_REFRESHED, REFRESH_REJECTED);
    } else if (!outcome.isRenewed()) {
      recorder.fail(TestLoginStage.TOKEN_REFRESHED, REFRESH_UNANSWERED);
    } else if (!AuthenticationCodeFlowHandler.outlivesBrowserRenewal(expiresAt)) {
      recorder.fail(TestLoginStage.TOKEN_REFRESHED, NO_USABLE_ID_TOKEN);
    } else {
      recorder.pass(
          TestLoginStage.TOKEN_REFRESHED,
          String.format(
              "The identity provider renewed the session: its new ID token is valid for %d minutes.",
              TimeUnit.MILLISECONDS.toMinutes(expiresAt - System.currentTimeMillis())));
    }
  }

  /**
   * The same grant, client authentication and endpoint the live session refresh uses. Built inside
   * the request factory so a failure becomes the refresher's no-verdict outcome, not a 500.
   */
  private static OidcProviderTokenRefresher refresherFor(OidcConfiguration configuration) {
    return new OidcProviderTokenRefresher(
        grant ->
            AuthenticationCodeFlowHandler.createTokenRequest(
                configuration,
                AuthenticationCodeFlowHandler.getClientAuthentication(configuration),
                grant),
        request -> AuthenticationCodeFlowHandler.executeTokenHttpRequest(configuration, request));
  }

  private static Optional<ReceivedCallback> receive(
      OidcClientConfig clientConfig,
      TestLoginHandshake.Oidc handshake,
      Map<String, List<String>> callbackParameters,
      TestLoginStageRecorder recorder) {
    Optional<ReceivedCallback> received = Optional.empty();
    try {
      OidcConfiguration configuration = clientFor(clientConfig).getConfiguration();
      AuthenticationSuccessResponse response =
          requireSuccess(
              AuthenticationResponseParser.parse(
                  new URI(handshake.redirectUri()), callbackParameters));
      AuthenticationCodeFlowHandler.validateResponseIssuer(configuration, response);
      received = Optional.of(new ReceivedCallback(configuration, response));
      recorder.pass(TestLoginStage.TOKEN_RECEIVED);
    } catch (Exception e) {
      // pac4j and nimbus signal discovery, parse and protocol failures with checked and unchecked
      // exceptions alike; every one of them must reach the admin as a typed result, not a 500.
      LOG.debug("Test login OIDC callback was not a usable authorization response", e);
      recorder.fail(
          TestLoginStage.TOKEN_RECEIVED,
          "The identity provider did not return a usable sign-in response: "
              + TestLoginService.rootMessage(e));
    }
    return received;
  }

  private static AuthenticationSuccessResponse requireSuccess(AuthenticationResponse response) {
    if (response instanceof AuthenticationErrorResponse errorResponse) {
      // The provider's own error code (access_denied, invalid_scope, …) is the diagnosis.
      throw new TechnicalException(
          String.format(
              "The identity provider returned '%s': %s",
              errorResponse.getErrorObject().getCode(),
              errorResponse.getErrorObject().getDescription()));
    }
    return (AuthenticationSuccessResponse) response;
  }

  private static Optional<RedeemedCallback> redeem(
      ReceivedCallback received,
      TestLoginHandshake.Oidc handshake,
      TestLoginStageRecorder recorder) {
    Optional<RedeemedCallback> redeemed = Optional.empty();
    try {
      OidcCredentials credentials = credentialsFor(received, handshake);
      redeemed =
          Optional.of(
              new RedeemedCallback(
                  received, credentials, claimsFrom(idTokenOf(credentials), received, handshake)));
      recorder.pass(TestLoginStage.TOKEN_VALIDATED);
    } catch (Exception e) {
      // The token exchange helpers are @SneakyThrows (IOException, nimbus ParseException).
      LOG.debug("Test login could not redeem the OIDC authorization code", e);
      recorder.fail(
          TestLoginStage.TOKEN_VALIDATED,
          "Could not redeem the authorization code with the candidate client credentials: "
              + TestLoginService.rootMessage(e));
    }
    return redeemed;
  }

  /** Mirrors the live callback: redeem the code when there is one, else use the returned token. */
  private static OidcCredentials credentialsFor(
      ReceivedCallback received, TestLoginHandshake.Oidc handshake) {
    OidcCredentials credentials =
        AuthenticationCodeFlowHandler.buildCredentials(received.response());
    if (credentials.getCode() != null) {
      redeemCode(received.configuration(), credentials, handshake);
    }
    return credentials;
  }

  private static JWT idTokenOf(OidcCredentials credentials) {
    JWT idToken = credentials.toIdToken();
    if (idToken == null) {
      throw new TechnicalException("ID token not returned by OIDC provider");
    }
    return idToken;
  }

  @SneakyThrows
  private static void redeemCode(
      OidcConfiguration configuration,
      OidcCredentials credentials,
      TestLoginHandshake.Oidc handshake) {
    CodeVerifier verifier =
        nullOrEmpty(handshake.codeVerifier()) ? null : new CodeVerifier(handshake.codeVerifier());
    TokenRequest request =
        AuthenticationCodeFlowHandler.createTokenRequest(
            configuration,
            AuthenticationCodeFlowHandler.getClientAuthentication(configuration),
            new AuthorizationCodeGrant(
                credentials.toAuthorizationCode(), new URI(handshake.redirectUri()), verifier));
    AuthenticationCodeFlowHandler.populateCredentialsFromTokenResponse(
        AuthenticationCodeFlowHandler.parseTokenResponseFromHttpResponse(
            AuthenticationCodeFlowHandler.executeTokenHttpRequest(configuration, request)),
        credentials);
  }

  @SneakyThrows
  private static Map<String, Object> claimsFrom(
      JWT idToken, ReceivedCallback received, TestLoginHandshake.Oidc handshake) {
    JWTClaimsSet claimsSet = idToken.getJWTClaimsSet();
    AuthenticationCodeFlowHandler.validateNonceIfRequired(
        received.configuration(), handshake.nonce(), claimsSet);
    Map<String, Object> claims = new TreeMap<>(String.CASE_INSENSITIVE_ORDER);
    claims.putAll(claimsSet.getClaims());
    return claims;
  }

  /**
   * A test popup is a fresh, interactive sign-in, so prompt=none could only come back as
   * login_required — the same reasoning the live handler applies to the MCP flow. Every other
   * prompt value is deliberate admin policy and is kept. Both values are read as the live login
   * reads them, so a max_age=0 the live login ignores does not force a fresh login here either.
   */
  private static void addInteractivePromptAndMaxAge(
      OidcClientConfig candidate, Map<String, String> params) {
    String prompt = AuthenticationCodeFlowHandler.normalizePrompt(candidate.getPrompt());
    if (prompt != null && !PROMPT_NONE.equalsIgnoreCase(prompt)) {
      params.put(OidcConfiguration.PROMPT, prompt);
    }
    String maxAge = AuthenticationCodeFlowHandler.normalizeMaxAge(candidate.getMaxAge());
    if (maxAge != null) {
      params.put(OidcConfiguration.MAX_AGE, maxAge);
    }
  }

  private static OidcClient clientFor(OidcClientConfig candidate) {
    OidcClient client = AuthenticationCodeFlowHandler.buildOidcClient(candidate);
    client.setCallbackUrl(candidate.getCallbackUrl());
    client.getConfiguration().ensuresMetadataResolverInitialized();
    return client;
  }
}
