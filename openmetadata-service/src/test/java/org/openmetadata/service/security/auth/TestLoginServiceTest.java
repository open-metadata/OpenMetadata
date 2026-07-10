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
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.auth0.jwt.JWT;
import com.auth0.jwt.JWTCreator;
import com.auth0.jwt.algorithms.Algorithm;
import com.auth0.jwt.interfaces.Claim;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.api.security.AuthenticationConfiguration;
import org.openmetadata.schema.api.security.AuthorizerConfiguration;
import org.openmetadata.schema.system.TestLoginResult;

/**
 * Unit tests for the dry-run identity resolution used by the SSO Test Login feature. Covers the
 * claim shapes produced by the OIDC providers OpenMetadata supports (Google, Okta, Azure, Auth0,
 * AWS Cognito, Custom OIDC), domain enforcement, role/team mapping, and failure paths — all without
 * any network, persistence, or session side effects.
 */
class TestLoginServiceTest {

  private static Map<String, Claim> claims(Map<String, Object> values) {
    JWTCreator.Builder builder = JWT.create();
    for (Map.Entry<String, Object> entry : values.entrySet()) {
      Object value = entry.getValue();
      if (value instanceof String s) {
        builder.withClaim(entry.getKey(), s);
      } else if (value instanceof Boolean b) {
        builder.withClaim(entry.getKey(), b);
      } else if (value instanceof String[] arr) {
        builder.withArrayClaim(entry.getKey(), arr);
      }
    }
    String token = builder.sign(Algorithm.HMAC256("unit-test-secret"));
    return JWT.decode(token).getClaims();
  }

  private static AuthenticationConfiguration authConfig(
      List<String> principalClaims, List<String> mapping, String teamClaim) {
    return new AuthenticationConfiguration()
        .withJwtPrincipalClaims(principalClaims)
        .withJwtPrincipalClaimsMapping(mapping == null ? new ArrayList<>() : mapping)
        .withJwtTeamClaimMapping(teamClaim);
  }

  private static AuthorizerConfiguration authzConfig(
      String principalDomain, boolean enforce, boolean useRolesFromProvider) {
    return new AuthorizerConfiguration()
        .withPrincipalDomain(principalDomain)
        .withAllowedDomains(new HashSet<>())
        .withEnforcePrincipalDomain(enforce)
        .withUseRolesFromProvider(useRolesFromProvider);
  }

  @Test
  void resolvesPrincipalAndEmailFromEmailClaim() {
    TestLoginResult result =
        TestLoginService.resolveIdentityFromClaims(
            authConfig(List.of("email"), null, null),
            authzConfig("example.com", false, false),
            claims(Map.of("email", "Alice@Example.com")));

    assertEquals(TestLoginResult.Status.SUCCESS, result.getStatus());
    assertEquals("alice", result.getResolvedPrincipal());
    assertEquals("alice@example.com", result.getResolvedEmail());
  }

  @Test
  void mapsRolesFromProviderWhenEnabled() {
    TestLoginResult result =
        TestLoginService.resolveIdentityFromClaims(
            authConfig(List.of("email"), null, null),
            authzConfig("example.com", false, true),
            claims(
                Map.of(
                    "email",
                    "okta-user@example.com",
                    "roles",
                    new String[] {"DataConsumer", "DataSteward"})));

    assertEquals(TestLoginResult.Status.SUCCESS, result.getStatus());
    assertTrue(result.getMappedRoles().containsAll(List.of("DataConsumer", "DataSteward")));
  }

  @Test
  void doesNotMapRolesWhenUseRolesFromProviderDisabled() {
    TestLoginResult result =
        TestLoginService.resolveIdentityFromClaims(
            authConfig(List.of("email"), null, null),
            authzConfig("example.com", false, false),
            claims(Map.of("email", "user@example.com", "roles", new String[] {"Admin"})));

    assertTrue(result.getMappedRoles().isEmpty());
  }

  @Test
  void mapsTeamsFromTeamClaim() {
    TestLoginResult result =
        TestLoginService.resolveIdentityFromClaims(
            authConfig(List.of("email"), null, "groups"),
            authzConfig("example.com", false, false),
            claims(
                Map.of(
                    "email", "user@example.com", "groups", new String[] {"engineering", "data"})));

    assertTrue(result.getMappedTeams().containsAll(List.of("engineering", "data")));
  }

  @Test
  void passesDomainEnforcementForMatchingDomain() {
    TestLoginResult result =
        TestLoginService.resolveIdentityFromClaims(
            authConfig(List.of("email"), null, null),
            authzConfig("example.com", true, false),
            claims(Map.of("email", "user@example.com")));

    assertEquals(TestLoginResult.Status.SUCCESS, result.getStatus());
    assertTrue(result.getDomainCheck().getEnforced());
    assertTrue(result.getDomainCheck().getPassed());
    assertEquals("example.com", result.getDomainCheck().getResolvedDomain());
  }

  @Test
  void failsDomainEnforcementForNonMatchingDomain() {
    TestLoginResult result =
        TestLoginService.resolveIdentityFromClaims(
            authConfig(List.of("email"), null, null),
            authzConfig("example.com", true, false),
            claims(Map.of("email", "intruder@evil.com")));

    assertEquals(TestLoginResult.Status.FAILED, result.getStatus());
    assertFalse(result.getDomainCheck().getPassed());
    assertEquals("evil.com", result.getDomainCheck().getResolvedDomain());
    assertFalse(result.getErrors().isEmpty());
  }

  @Test
  void resolvesViaPrincipalClaimsMapping() {
    TestLoginResult result =
        TestLoginService.resolveIdentityFromClaims(
            authConfig(
                List.of("email"), List.of("username:preferred_username", "email:email"), null),
            authzConfig("corp.com", false, false),
            claims(Map.of("preferred_username", "Bob@corp.com", "email", "bob@corp.com")));

    assertEquals(TestLoginResult.Status.SUCCESS, result.getStatus());
    assertEquals("bob", result.getResolvedPrincipal());
    assertEquals("bob@corp.com", result.getResolvedEmail());
  }

  @Test
  void skipsMalformedClaimsMappingEntryWithoutThrowing() {
    TestLoginResult result =
        TestLoginService.resolveIdentityFromClaims(
            authConfig(
                List.of("email"),
                List.of("username:preferred_username", "email:email", "garbage-no-colon"),
                null),
            authzConfig("corp.com", false, false),
            claims(Map.of("preferred_username", "Bob@corp.com", "email", "bob@corp.com")));

    assertEquals(TestLoginResult.Status.SUCCESS, result.getStatus());
    assertEquals("bob", result.getResolvedPrincipal());
  }

  @Test
  void failsWhenNoConfiguredClaimIsPresent() {
    TestLoginResult result =
        TestLoginService.resolveIdentityFromClaims(
            authConfig(List.of("email"), null, null),
            authzConfig("example.com", false, false),
            claims(Map.of("sub", "1234567890")));

    assertEquals(TestLoginResult.Status.FAILED, result.getStatus());
    assertEquals("CLAIMS_EXTRACTED", result.getStage());
    assertFalse(result.getErrors().isEmpty());
  }
}
