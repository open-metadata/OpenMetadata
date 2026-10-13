package org.openmetadata.service.security;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.nimbusds.common.contenttype.ContentType;
import com.nimbusds.oauth2.sdk.AuthorizationGrant;
import com.nimbusds.oauth2.sdk.TokenRequest;
import com.nimbusds.oauth2.sdk.auth.ClientSecretBasic;
import com.nimbusds.oauth2.sdk.auth.Secret;
import com.nimbusds.oauth2.sdk.http.HTTPResponse;
import com.nimbusds.oauth2.sdk.id.ClientID;
import java.net.SocketTimeoutException;
import java.net.URI;
import java.util.ArrayList;
import java.util.List;
import java.util.function.Function;
import org.junit.jupiter.api.Test;
import org.openmetadata.service.security.OidcProviderTokenRefresher.Outcome;
import org.openmetadata.service.security.OidcProviderTokenRefresher.Status;
import org.pac4j.core.exception.TechnicalException;

class OidcProviderTokenRefresherTest {

  private static final URI TOKEN_ENDPOINT = URI.create("https://idp.example.com/token");
  private static final Function<AuthorizationGrant, TokenRequest> REQUEST_FACTORY =
      grant ->
          new TokenRequest(
              TOKEN_ENDPOINT,
              new ClientSecretBasic(new ClientID("om-client"), new Secret("om-secret")),
              grant);

  private final List<TokenRequest> sentRequests = new ArrayList<>();

  @Test
  void refresh_successWithRotatedToken_isRenewedAndCarriesTheRotatedTokenAndLifetime() {
    OidcProviderTokenRefresher refresher =
        refresherAnswering(
            jsonResponse(
                200,
                """
                {"access_token":"new-access","token_type":"Bearer","expires_in":300,
                 "refresh_token":"rotated-refresh"}"""));

    Outcome outcome = refresher.refresh("provider-refresh");

    assertEquals(Status.RENEWED, outcome.status());
    assertEquals("rotated-refresh", outcome.rotatedRefreshToken());
    assertEquals(300, outcome.lifetimeSeconds());
  }

  @Test
  void refresh_successWithoutRotation_isRenewedWithNoReplacementToken() {
    OidcProviderTokenRefresher refresher =
        refresherAnswering(
            jsonResponse(200, "{\"access_token\":\"new-access\",\"token_type\":\"Bearer\"}"));

    Outcome outcome = refresher.refresh("provider-refresh");

    assertTrue(outcome.isRenewed());
    assertNull(outcome.rotatedRefreshToken());
    // No expires_in: the provider's schedule is unknown.
    assertEquals(0, outcome.lifetimeSeconds());
  }

  @Test
  void refresh_sendsARefreshTokenGrantToTheTokenEndpoint() {
    OidcProviderTokenRefresher refresher =
        refresherAnswering(
            jsonResponse(200, "{\"access_token\":\"new-access\",\"token_type\":\"Bearer\"}"));

    refresher.refresh("provider-refresh");

    String body = sentRequests.getFirst().toHTTPRequest().getBody();
    assertEquals(TOKEN_ENDPOINT, sentRequests.getFirst().getEndpointURI());
    assertTrue(body.contains("grant_type=refresh_token"), body);
    assertTrue(body.contains("refresh_token=provider-refresh"), body);
  }

  @Test
  void refresh_invalidGrant_isRejected() {
    OidcProviderTokenRefresher refresher =
        refresherAnswering(
            jsonResponse(
                400, "{\"error\":\"invalid_grant\",\"error_description\":\"Session not active\"}"));

    assertEquals(Status.REJECTED, refresher.refresh("provider-refresh").status());
  }

  @Test
  void refresh_invalidToken_isRejected() {
    OidcProviderTokenRefresher refresher =
        refresherAnswering(jsonResponse(401, "{\"error\":\"invalid_token\"}"));

    assertEquals(Status.REJECTED, refresher.refresh("provider-refresh").status());
  }

  @Test
  void refresh_clientConfigurationErrors_areUnavailableNotAVerdictOnTheUser() {
    // Both describe the client, not the user's session; as verdicts they would end every session
    // at its next refresh until the client was fixed.
    assertEquals(
        Status.UNAVAILABLE,
        refresherAnswering(jsonResponse(401, "{\"error\":\"invalid_client\"}"))
            .refresh("provider-refresh")
            .status());
    assertEquals(
        Status.UNAVAILABLE,
        refresherAnswering(jsonResponse(400, "{\"error\":\"unauthorized_client\"}"))
            .refresh("provider-refresh")
            .status());
  }

  @Test
  void refresh_serverErrorWithoutJsonBody_isUnavailable() {
    HTTPResponse response = new HTTPResponse(503);
    response.setEntityContentType(ContentType.TEXT_PLAIN);
    response.setBody("Service Unavailable");

    assertEquals(
        Status.UNAVAILABLE, refresherAnswering(response).refresh("provider-refresh").status());
  }

  @Test
  void refresh_unparseableSuccessBody_isUnavailable() {
    OidcProviderTokenRefresher refresher = refresherAnswering(jsonResponse(200, "not json"));

    assertEquals(Status.UNAVAILABLE, refresher.refresh("provider-refresh").status());
  }

  @Test
  void refresh_networkTimeout_isUnavailable() {
    OidcProviderTokenRefresher refresher =
        new OidcProviderTokenRefresher(
            REQUEST_FACTORY,
            request -> {
              throw new SocketTimeoutException("Read timed out");
            });

    assertEquals(Status.UNAVAILABLE, refresher.refresh("provider-refresh").status());
  }

  @Test
  void refresh_unreachableProviderMetadata_isUnavailable() {
    OidcProviderTokenRefresher refresher =
        new OidcProviderTokenRefresher(
            grant -> {
              throw new TechnicalException("Discovery document unavailable");
            },
            request -> new HTTPResponse(200));

    assertEquals(Status.UNAVAILABLE, refresher.refresh("provider-refresh").status());
  }

  private OidcProviderTokenRefresher refresherAnswering(HTTPResponse response) {
    return new OidcProviderTokenRefresher(
        REQUEST_FACTORY,
        request -> {
          sentRequests.add(request);
          return response;
        });
  }

  private static HTTPResponse jsonResponse(int status, String body) {
    HTTPResponse response = new HTTPResponse(status);
    response.setEntityContentType(ContentType.APPLICATION_JSON);
    response.setBody(body);
    return response;
  }
}
