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
package org.openmetadata.service.security.auth;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import jakarta.ws.rs.BadRequestException;
import jakarta.ws.rs.WebApplicationException;
import java.io.IOException;
import java.net.URI;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.api.security.AuthenticationConfiguration;
import org.openmetadata.schema.api.security.AuthorizerConfiguration;
import org.openmetadata.schema.api.security.ClientType;
import org.openmetadata.schema.auth.LdapConfiguration;
import org.openmetadata.schema.configuration.SecurityConfiguration;
import org.openmetadata.schema.security.client.OidcClientConfig;
import org.openmetadata.schema.services.connections.metadata.AuthProvider;
import org.openmetadata.schema.system.TestLoginCredentialsRequest;
import org.openmetadata.schema.system.TestLoginResult;
import org.openmetadata.schema.system.TestLoginSession;
import org.openmetadata.schema.system.TestLoginStage;
import org.openmetadata.schema.system.TestLoginStageResult;
import org.openmetadata.schema.system.TestLoginStageStatus;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.security.FakeOidcProvider;

class TestLoginRoundTripTest {
  private static final String ADMIN = "admin";

  private final TestLoginRoundTrip roundTrip = new TestLoginRoundTrip(new TestLoginSessionCache());

  @Test
  void aPublicClientIsSentToTheBrowserFlowItsLiveLoginUses() {
    SecurityConfiguration publicClient =
        candidateFor(AuthProvider.GOOGLE)
            .withAuthenticationConfiguration(
                new AuthenticationConfiguration()
                    .withProvider(AuthProvider.GOOGLE)
                    .withClientType(ClientType.PUBLIC));

    assertThrows(BadRequestException.class, () -> roundTrip.start(ADMIN, publicClient));
  }

  @Test
  void credentialProtocolsAskForCredentialsAndWaitForThem() {
    for (AuthProvider provider : List.of(AuthProvider.LDAP, AuthProvider.BASIC)) {
      TestLoginSession session = roundTrip.start(ADMIN, candidateFor(provider));

      assertTrue(session.getRequiresCredentials(), provider.value());
      assertNull(session.getAuthorizationUrl());
      TestLoginResult pending = roundTrip.result(ADMIN, session.getTestSessionId());
      assertEquals(TestLoginResult.Status.PENDING, pending.getStatus());
      assertEquals(
          TestLoginStageStatus.RUNNING, statusOf(pending, TestLoginStage.CREDENTIALS_VERIFIED));
    }
  }

  @Test
  void anUnreachableProviderStillYieldsASessionWithAFailedTimeline() {
    OidcClientConfig unreachable =
        new OidcClientConfig()
            .withId("client")
            .withSecret("secret")
            .withDiscoveryUri("http://127.0.0.1:1/.well-known/openid-configuration")
            .withCallbackUrl(FakeOidcProvider.CALLBACK_URL)
            .withServerUrl("http://localhost:8585");

    TestLoginSession session =
        roundTrip.start(ADMIN, FakeOidcProvider.securityConfigFor(unreachable));

    assertNull(session.getAuthorizationUrl());
    TestLoginResult result = roundTrip.result(ADMIN, session.getTestSessionId());
    assertEquals(TestLoginResult.Status.FAILED, result.getStatus());
    assertEquals(TestLoginStage.STARTED, result.getStage());
    assertFalse(result.getErrors().isEmpty());
  }

  @Test
  void aScriptSignInAddressFromTheDiscoveryDocumentNeverReachesTheBrowser() throws IOException {
    try (FakeOidcProvider provider = FakeOidcProvider.start()) {
      provider.advertiseAuthorizationEndpoint("javascript:alert(document.domain)//");

      TestLoginSession session =
          roundTrip.start(ADMIN, FakeOidcProvider.securityConfigFor(provider.confidentialClient()));

      assertNull(session.getAuthorizationUrl());
      TestLoginResult result = roundTrip.result(ADMIN, session.getTestSessionId());
      assertEquals(TestLoginResult.Status.FAILED, result.getStatus());
      assertEquals(TestLoginStage.STARTED, result.getStage());
      assertTrue(result.getErrors().getFirst().contains("http or https"));
    }
  }

  @Test
  void onlyWebAddressesAreHandedToTheBrowser() {
    assertEquals(
        URI.create("https://idp.example.com/authorize?x=1"),
        TestLoginRoundTrip.requireWebUrl("https://idp.example.com/authorize?x=1"));
    assertEquals(
        URI.create("http://localhost:8080/sso"),
        TestLoginRoundTrip.requireWebUrl("http://localhost:8080/sso"));
    for (String hostile :
        List.of("javascript:alert(1)", "JavaScript:alert(1)", "data:text/html,x", "/relative")) {
      assertThrows(IllegalArgumentException.class, () -> TestLoginRoundTrip.requireWebUrl(hostile));
    }
  }

  @Test
  void aConfidentialRoundTripCompletesThroughTheCallbackAndIgnoresAReplay() throws IOException {
    try (FakeOidcProvider provider = FakeOidcProvider.start()) {
      TestLoginSession session =
          roundTrip.start(ADMIN, FakeOidcProvider.securityConfigFor(provider.confidentialClient()));
      Map<String, String> query =
          FakeOidcProvider.queryOf(session.getAuthorizationUrl().toString());
      String marker = query.get("state");
      String testSessionId = TestLoginSessionCache.sessionIdFromMarker(marker).orElseThrow();

      assertEquals(session.getTestSessionId(), testSessionId);
      assertEquals(
          TestLoginResult.Status.PENDING, roundTrip.result(ADMIN, testSessionId).getStatus());

      provider.issueIdToken(query.get("nonce"), "alice@example.com");
      roundTrip.completeOidcCallback(testSessionId, callback("code-1", marker));
      TestLoginResult completed = roundTrip.result(ADMIN, testSessionId);
      assertEquals(TestLoginResult.Status.SUCCESS, completed.getStatus(), completed.toString());

      provider.issueIdToken(query.get("nonce"), "mallory@example.com");
      roundTrip.completeOidcCallback(testSessionId, callback("code-2", marker));
      assertEquals("alice@example.com", roundTrip.result(ADMIN, testSessionId).getResolvedEmail());
    }
  }

  @Test
  void onlyTheAdminWhoStartedATestCanReadIt() {
    TestLoginSession session = roundTrip.start(ADMIN, candidateFor(AuthProvider.LDAP));

    assertThrows(
        EntityNotFoundException.class,
        () -> roundTrip.result("another-admin", session.getTestSessionId()));
  }

  @Test
  void aCredentialTestCompletesOnceAndThenRefusesAnotherAttempt() {
    TestLoginSession session = roundTrip.start(ADMIN, unreachableLdap());

    TestLoginResult first = roundTrip.submitCredentials(ADMIN, credentialsFor(session));

    assertEquals(TestLoginResult.Status.FAILED, first.getStatus());
    assertThrows(
        BadRequestException.class,
        () -> roundTrip.submitCredentials(ADMIN, credentialsFor(session)));
  }

  @Test
  void credentialAttemptsAreCappedPerAdminWithoutAffectingOtherAdmins() {
    for (int i = 0; i < TestLoginRoundTrip.MAX_CREDENTIAL_TESTS_PER_WINDOW; i++) {
      roundTrip.submitCredentials(ADMIN, credentialsFor(roundTrip.start(ADMIN, unreachableLdap())));
    }
    TestLoginSession oneTooMany = roundTrip.start(ADMIN, unreachableLdap());

    WebApplicationException refused =
        assertThrows(
            WebApplicationException.class,
            () -> roundTrip.submitCredentials(ADMIN, credentialsFor(oneTooMany)));

    assertEquals(429, refused.getResponse().getStatus());
    TestLoginSession otherAdmins = roundTrip.start("another-admin", unreachableLdap());
    assertEquals(
        TestLoginResult.Status.FAILED,
        roundTrip.submitCredentials("another-admin", credentialsFor(otherAdmins)).getStatus());
  }

  @Test
  void aTestThatIsNotWaitingForCredentialsRefusesThem() {
    OidcClientConfig unreachable =
        new OidcClientConfig()
            .withId("client")
            .withSecret("secret")
            .withDiscoveryUri("http://127.0.0.1:1/.well-known/openid-configuration")
            .withCallbackUrl(FakeOidcProvider.CALLBACK_URL);
    TestLoginSession oidc = roundTrip.start(ADMIN, FakeOidcProvider.securityConfigFor(unreachable));

    assertThrows(
        BadRequestException.class, () -> roundTrip.submitCredentials(ADMIN, credentialsFor(oidc)));
  }

  @Test
  void aCallbackForAnUnknownTestChangesNothing() {
    roundTrip.completeOidcCallback("no-such-test", callback("code", "omtest:no-such-test"));

    assertThrows(EntityNotFoundException.class, () -> roundTrip.result(ADMIN, "no-such-test"));
  }

  /** An LDAP candidate whose directory refuses connections, so every attempt fails fast. */
  private static SecurityConfiguration unreachableLdap() {
    return candidateFor(AuthProvider.LDAP)
        .withAuthenticationConfiguration(
            new AuthenticationConfiguration()
                .withProvider(AuthProvider.LDAP)
                .withLdapConfiguration(
                    new LdapConfiguration()
                        .withHost("127.0.0.1")
                        .withPort(1)
                        .withDnAdminPrincipal("cn=lookup")
                        .withDnAdminPassword("lookup-password")));
  }

  private static TestLoginCredentialsRequest credentialsFor(TestLoginSession session) {
    return new TestLoginCredentialsRequest()
        .withTestSessionId(session.getTestSessionId())
        .withEmail("alice@example.com")
        .withPassword("alice-password");
  }

  private static SecurityConfiguration candidateFor(AuthProvider provider) {
    return new SecurityConfiguration()
        .withAuthenticationConfiguration(new AuthenticationConfiguration().withProvider(provider))
        .withAuthorizerConfiguration(new AuthorizerConfiguration());
  }

  private static Map<String, List<String>> callback(String code, String state) {
    return Map.of("code", List.of(code), "state", List.of(state));
  }

  private static TestLoginStageStatus statusOf(TestLoginResult result, TestLoginStage stage) {
    return result.getStages().stream()
        .filter(stageResult -> stageResult.getStage() == stage)
        .map(TestLoginStageResult::getStatus)
        .findFirst()
        .orElseThrow();
  }
}
