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
package org.openmetadata.service.security.saml;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.openmetadata.catalog.security.client.SamlSSOClientConfig;
import org.openmetadata.catalog.type.IdentityProviderConfig;
import org.openmetadata.catalog.type.SamlSecurityConfig;
import org.openmetadata.catalog.type.ServiceProviderConfig;
import org.openmetadata.schema.api.security.AuthenticationConfiguration;
import org.openmetadata.schema.api.security.AuthorizerConfiguration;
import org.openmetadata.schema.configuration.SecurityConfiguration;
import org.openmetadata.schema.services.connections.metadata.AuthProvider;
import org.openmetadata.schema.system.TestLoginResult;
import org.openmetadata.schema.system.TestLoginStage;
import org.openmetadata.schema.system.TestLoginStageResult;
import org.openmetadata.schema.system.TestLoginStageStatus;
import org.openmetadata.service.security.FakeOidcProvider;

/**
 * Runs the SAML leg of Test Login against genuinely signed responses from {@link MockSamlIdp}, so
 * OneLogin's real signature and response validation decide the outcome.
 */
class TestLoginSamlHandlerTest {
  private static final String IDP_ENTITY_ID = "https://idp.example.com/metadata";
  private static final String IDP_SSO_URL = "https://idp.example.com/sso";
  private static final String SP_ENTITY_ID = "https://om.example.com/saml";
  private static final String ACS_URL = "https://om.example.com/api/v1/saml/acs";
  private static final String MARKER = "omtest:session-abc";

  private final MockSamlIdp idp = new MockSamlIdp(IDP_ENTITY_ID);

  @Test
  void authorizeBuildsAnAuthnRequestForTheCandidateIdpCarryingTheMarker() {
    String url = TestLoginSamlHandler.authorize(candidateSaml(), MARKER);
    Map<String, String> query = FakeOidcProvider.queryOf(url);

    assertTrue(url.startsWith(IDP_SSO_URL + "?"), url);
    assertEquals(MARKER, query.get("RelayState"));
    assertTrue(query.containsKey("SAMLRequest"));
  }

  @Test
  void aSignedResponseFromTheCandidateIdpResolvesTheIdentity() {
    TestLoginResult result =
        TestLoginSamlHandler.complete(
            candidate(),
            postedResponse(idp.signedResponse("alice@example.com", ACS_URL, SP_ENTITY_ID)),
            mock(HttpServletResponse.class));

    assertEquals(TestLoginResult.Status.SUCCESS, result.getStatus(), String.valueOf(result));
    assertEquals("alice@example.com", result.getResolvedEmail());
    assertEquals("alice", result.getResolvedPrincipal());
    assertEquals(TestLoginStageStatus.PASSED, statusOf(result, TestLoginStage.TOKEN_VALIDATED));
  }

  @Test
  void anUnsignedResponseIsRejectedAtTokenValidation() {
    TestLoginResult result =
        TestLoginSamlHandler.complete(
            candidate(),
            postedResponse(idp.unsignedResponse("alice@example.com", ACS_URL, SP_ENTITY_ID)),
            mock(HttpServletResponse.class));

    assertEquals(TestLoginResult.Status.FAILED, result.getStatus());
    assertEquals(TestLoginStage.TOKEN_VALIDATED, result.getStage());
  }

  @Test
  void aPostWithoutASamlResponseFailsWhereTheResponseShouldHaveArrived() {
    HttpServletRequest emptyPost = mock(HttpServletRequest.class);

    TestLoginResult result =
        TestLoginSamlHandler.complete(candidate(), emptyPost, mock(HttpServletResponse.class));

    assertEquals(TestLoginResult.Status.FAILED, result.getStatus());
    assertEquals(TestLoginStage.TOKEN_RECEIVED, result.getStage());
  }

  private SamlSSOClientConfig candidateSaml() {
    return new SamlSSOClientConfig()
        .withIdp(
            new IdentityProviderConfig()
                .withEntityId(IDP_ENTITY_ID)
                .withSsoLoginUrl(IDP_SSO_URL)
                .withIdpX509Certificate(idp.idpCertificatePem()))
        .withSp(
            new ServiceProviderConfig()
                .withEntityId(SP_ENTITY_ID)
                .withAcs(ACS_URL)
                .withCallback("https://om.example.com/saml/callback"))
        .withSecurity(new SamlSecurityConfig());
  }

  private SecurityConfiguration candidate() {
    return new SecurityConfiguration()
        .withAuthenticationConfiguration(
            new AuthenticationConfiguration()
                .withProvider(AuthProvider.SAML)
                .withSamlConfiguration(candidateSaml())
                .withJwtPrincipalClaims(List.of("email")))
        .withAuthorizerConfiguration(
            new AuthorizerConfiguration()
                .withPrincipalDomain("example.com")
                .withEnforcePrincipalDomain(false)
                .withAllowedDomains(new HashSet<>()));
  }

  /** The request the identity provider's auto-submitting form posts to the ACS. */
  private static HttpServletRequest postedResponse(String base64Response) {
    HttpServletRequest request = mock(HttpServletRequest.class);
    when(request.getParameter("SAMLResponse")).thenReturn(base64Response);
    when(request.getParameterMap())
        .thenReturn(
            Map.of(
                "SAMLResponse", new String[] {base64Response},
                "RelayState", new String[] {MARKER}));
    when(request.getRequestURL()).thenReturn(new StringBuffer(ACS_URL));
    return request;
  }

  private static TestLoginStageStatus statusOf(TestLoginResult result, TestLoginStage stage) {
    return result.getStages().stream()
        .filter(stageResult -> stageResult.getStage() == stage)
        .map(TestLoginStageResult::getStatus)
        .findFirst()
        .orElseThrow();
  }
}
