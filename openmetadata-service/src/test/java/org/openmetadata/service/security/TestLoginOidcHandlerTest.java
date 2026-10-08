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

import static java.nio.charset.StandardCharsets.UTF_8;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import java.time.Duration;
import java.util.Base64;
import java.util.List;
import java.util.Map;
import java.util.function.Consumer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.system.TestLoginResult;
import org.openmetadata.schema.system.TestLoginStage;
import org.openmetadata.schema.system.TestLoginStageResult;
import org.openmetadata.schema.system.TestLoginStageStatus;

class TestLoginOidcHandlerTest {
  private static final String MARKER = "omtest:session-abc";

  private FakeOidcProvider provider;

  @BeforeEach
  void startProvider() throws IOException {
    provider = FakeOidcProvider.start();
  }

  @AfterEach
  void stopProvider() {
    provider.close();
  }

  @Test
  void authorizeTargetsTheCandidateProviderAndCarriesTheMarkerAsState() {
    TestLoginOidcHandler.Authorization authorization =
        TestLoginOidcHandler.authorize(provider.confidentialClient(), MARKER);
    String url = authorization.authorizationUrl();
    Map<String, String> query = FakeOidcProvider.queryOf(url);

    assertTrue(url.startsWith(provider.issuer() + "/authorize?"), url);
    assertEquals(MARKER, query.get("state"));
    assertEquals(FakeOidcProvider.CLIENT_ID, query.get("client_id"));
    assertEquals(FakeOidcProvider.CALLBACK_URL, query.get("redirect_uri"));
    assertEquals("code", query.get("response_type"));
    assertEquals("S256", query.get("code_challenge_method"));
    assertEquals(authorization.handshake().nonce(), query.get("nonce"));
    assertNotNull(authorization.handshake().codeVerifier());
    assertEquals(FakeOidcProvider.CALLBACK_URL, authorization.handshake().redirectUri());
  }

  @Test
  void authorizeDropsPromptNoneButKeepsADeliberatePrompt() {
    Map<String, String> silent =
        FakeOidcProvider.queryOf(
            TestLoginOidcHandler.authorize(provider.confidentialClient().withPrompt("none"), MARKER)
                .authorizationUrl());
    Map<String, String> forced =
        FakeOidcProvider.queryOf(
            TestLoginOidcHandler.authorize(
                    provider.confidentialClient().withPrompt("login"), MARKER)
                .authorizationUrl());

    assertFalse(silent.containsKey("prompt"));
    assertEquals("login", forced.get("prompt"));
  }

  @Test
  void authorizeIgnoresMaxAgeZeroAsTheLiveLoginDoes() {
    Map<String, String> forcedReauthentication =
        FakeOidcProvider.queryOf(
            TestLoginOidcHandler.authorize(provider.confidentialClient().withMaxAge("0"), MARKER)
                .authorizationUrl());
    Map<String, String> bounded =
        FakeOidcProvider.queryOf(
            TestLoginOidcHandler.authorize(
                    provider.confidentialClient().withMaxAge(" 3600 ").withPrompt(" login "),
                    MARKER)
                .authorizationUrl());

    assertFalse(forcedReauthentication.containsKey("max_age"));
    assertEquals("3600", bounded.get("max_age"));
    assertEquals("login", bounded.get("prompt"));
  }

  @Test
  void completeRedeemsTheCodeWithTheCandidateSecretAndPkceVerifier() {
    TestLoginOidcHandler.Authorization authorization =
        TestLoginOidcHandler.authorize(provider.confidentialClient(), MARKER);
    provider.issueIdTokenWithRefreshToken(authorization.handshake().nonce(), "alice@example.com");

    TestLoginResult result =
        TestLoginOidcHandler.complete(
            FakeOidcProvider.securityConfigFor(provider.confidentialClient()),
            authorization.handshake(),
            callback("code", "authorization-code-1"));

    assertEquals(TestLoginResult.Status.SUCCESS, result.getStatus(), String.valueOf(result));
    assertEquals("alice@example.com", result.getResolvedEmail());
    assertEquals("authorization-code-1", provider.lastTokenRequest().get("code"));
    assertEquals(
        authorization.handshake().codeVerifier(), provider.lastTokenRequest().get("code_verifier"));
    assertEquals(
        "Basic "
            + Base64.getEncoder()
                .encodeToString(
                    (FakeOidcProvider.CLIENT_ID + ":" + FakeOidcProvider.CLIENT_SECRET)
                        .getBytes(UTF_8)),
        provider.lastTokenAuthorization());
    assertEquals(TestLoginStageStatus.PASSED, statusOf(result, TestLoginStage.TOKEN_VALIDATED));
  }

  /** Every live session refresh redeems the provider's refresh token for its next ID token. */
  @Test
  void completeRenewsTheSessionWithTheProvidersRefreshToken() {
    TestLoginResult result = completeAfter(this::issuingARefreshToken);

    assertEquals(TestLoginResult.Status.SUCCESS, result.getStatus(), String.valueOf(result));
    assertEquals(TestLoginStageStatus.PASSED, statusOf(result, TestLoginStage.TOKEN_REFRESHED));
    assertEquals("refresh_token", provider.lastRefreshRequest().get("grant_type"));
    assertEquals(
        FakeOidcProvider.REFRESH_TOKEN, provider.lastRefreshRequest().get("refresh_token"));
  }

  /** Without one the session ends with its first ID token; the identity is still reported. */
  @Test
  void aProviderThatIssuesNoRefreshTokenFailsTheRefreshStage() {
    TestLoginResult result =
        completeAfter(nonce -> provider.issueIdToken(nonce, "alice@example.com"));

    assertEquals(TestLoginResult.Status.FAILED, result.getStatus());
    assertEquals(TestLoginStageStatus.FAILED, statusOf(result, TestLoginStage.TOKEN_REFRESHED));
    assertTrue(result.getErrors().getFirst().contains("offline_access"), String.valueOf(result));
    assertEquals("alice@example.com", result.getResolvedEmail());
    assertTrue(provider.lastRefreshRequest().isEmpty());
  }

  @Test
  void aRefreshTokenTheProviderRejectsFailsTheRefreshStage() {
    TestLoginResult result =
        completeAfter(
            nonce -> {
              issuingARefreshToken(nonce);
              provider.rejectRefreshTokens(400, "invalid_grant");
            });

    assertEquals(TestLoginResult.Status.FAILED, result.getStatus());
    assertEquals(TestLoginStageStatus.FAILED, statusOf(result, TestLoginStage.TOKEN_REFRESHED));
  }

  /** The browser needs the renewed ID token; a renewal without one cannot extend its session. */
  @Test
  void aRenewalWithoutAnIdTokenFailsTheRefreshStage() {
    TestLoginResult result =
        completeAfter(
            nonce -> {
              issuingARefreshToken(nonce);
              provider.renewWithoutIdToken();
            });

    assertEquals(TestLoginResult.Status.FAILED, result.getStatus());
    assertEquals(TestLoginStageStatus.FAILED, statusOf(result, TestLoginStage.TOKEN_REFRESHED));
  }

  /** The browser renews a minute before expiry, so a shorter-lived token would loop. */
  @Test
  void aRenewedIdTokenAboutToExpireFailsTheRefreshStage() {
    TestLoginResult result =
        completeAfter(
            nonce -> {
              issuingARefreshToken(nonce);
              provider.renewWithIdTokenValidFor(Duration.ofSeconds(30));
            });

    assertEquals(TestLoginResult.Status.FAILED, result.getStatus());
    assertEquals(TestLoginStageStatus.FAILED, statusOf(result, TestLoginStage.TOKEN_REFRESHED));
  }

  private void issuingARefreshToken(String nonce) {
    provider.issueIdTokenWithRefreshToken(nonce, "alice@example.com");
  }

  /** Runs a Test Login whose token endpoint {@code stubProvider} prepared for the login's nonce. */
  private TestLoginResult completeAfter(Consumer<String> stubProvider) {
    TestLoginOidcHandler.Authorization authorization =
        TestLoginOidcHandler.authorize(provider.confidentialClient(), MARKER);
    stubProvider.accept(authorization.handshake().nonce());
    return TestLoginOidcHandler.complete(
        FakeOidcProvider.securityConfigFor(provider.confidentialClient()),
        authorization.handshake(),
        callback("code", "authorization-code-1"));
  }

  @Test
  void aNonceThatDoesNotMatchTheRequestFailsTokenValidation() {
    TestLoginOidcHandler.Authorization authorization =
        TestLoginOidcHandler.authorize(provider.confidentialClient(), MARKER);
    provider.issueIdToken("a-nonce-from-some-other-login", "alice@example.com");

    TestLoginResult result =
        TestLoginOidcHandler.complete(
            FakeOidcProvider.securityConfigFor(provider.confidentialClient()),
            authorization.handshake(),
            callback("code", "authorization-code-1"));

    assertEquals(TestLoginResult.Status.FAILED, result.getStatus());
    assertEquals(TestLoginStage.TOKEN_VALIDATED, result.getStage());
    assertEquals(TestLoginStageStatus.FAILED, statusOf(result, TestLoginStage.TOKEN_VALIDATED));
  }

  @Test
  void anIdentityProviderErrorIsReportedWithTheProvidersOwnCode() {
    TestLoginOidcHandler.Authorization authorization =
        TestLoginOidcHandler.authorize(provider.confidentialClient(), MARKER);

    TestLoginResult result =
        TestLoginOidcHandler.complete(
            FakeOidcProvider.securityConfigFor(provider.confidentialClient()),
            authorization.handshake(),
            Map.of(
                "error", List.of("access_denied"),
                "error_description", List.of("The user cancelled the sign-in"),
                "state", List.of(MARKER)));

    assertEquals(TestLoginResult.Status.FAILED, result.getStatus());
    assertEquals(TestLoginStage.TOKEN_RECEIVED, result.getStage());
    assertTrue(
        result.getErrors().getFirst().contains("access_denied"), result.getErrors().getFirst());
  }

  @Test
  void aRejectedTokenRequestIsReportedWithTheProvidersError() {
    TestLoginOidcHandler.Authorization authorization =
        TestLoginOidcHandler.authorize(provider.confidentialClient(), MARKER);
    provider.rejectTokenRequests(401, "invalid_client", "Client authentication failed");

    TestLoginResult result =
        TestLoginOidcHandler.complete(
            FakeOidcProvider.securityConfigFor(provider.confidentialClient()),
            authorization.handshake(),
            callback("code", "authorization-code-1"));

    assertEquals(TestLoginResult.Status.FAILED, result.getStatus());
    assertEquals(TestLoginStage.TOKEN_VALIDATED, result.getStage());
    assertTrue(
        result.getErrors().getFirst().contains("invalid_client"), result.getErrors().getFirst());
  }

  private static Map<String, List<String>> callback(String name, String value) {
    return Map.of(name, List.of(value), "state", List.of(MARKER));
  }

  private static TestLoginStageStatus statusOf(TestLoginResult result, TestLoginStage stage) {
    return result.getStages().stream()
        .filter(stageResult -> stageResult.getStage() == stage)
        .map(TestLoginStageResult::getStatus)
        .findFirst()
        .orElseThrow();
  }
}
