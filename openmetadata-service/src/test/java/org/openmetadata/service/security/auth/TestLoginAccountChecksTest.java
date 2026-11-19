/*
 *  Copyright 2026 Collate.
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
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.api.security.AuthenticationConfiguration;
import org.openmetadata.schema.api.security.AuthorizerConfiguration;
import org.openmetadata.schema.configuration.SecurityConfiguration;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.system.TestLoginProtocol;
import org.openmetadata.schema.system.TestLoginResult;
import org.openmetadata.schema.system.TestLoginStage;
import org.openmetadata.schema.system.TestLoginStageResult;
import org.openmetadata.schema.system.TestLoginStageStatus;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.UserRepository;
import org.openmetadata.service.security.AuthenticationException;

class TestLoginAccountChecksTest {
  private final UserRepository users = mock(UserRepository.class);
  private final SecurityConfiguration candidate =
      new SecurityConfiguration()
          .withAuthenticationConfiguration(
              new AuthenticationConfiguration().withEmailClaim("email").withEnableSelfSignup(false))
          .withAuthorizerConfiguration(
              new AuthorizerConfiguration()
                  .withAllowedEmailRegistrationDomains(Set.of("example.com")));

  @BeforeEach
  void missingAccount() {
    when(users.getActiveUserByEmailForAuth(anyString(), any()))
        .thenThrow(EntityNotFoundException.byMessage("missing"));
    when(users.getUserByNameForAuthUpdate(anyString()))
        .thenThrow(EntityNotFoundException.byMessage("missing"));
  }

  @Test
  void anUnregisteredAccountCannotPassWithSignupDisabled() {
    for (TestLoginProtocol protocol :
        List.of(TestLoginProtocol.LDAP, TestLoginProtocol.OIDC, TestLoginProtocol.SAML)) {
      assertEquals(
          TestLoginResult.Status.FAILED,
          TestLoginAccountChecks.check(candidate, success(protocol), users).getStatus());
    }
  }

  @Test
  void signupChecksRegistrationDomainsForLdapAndOidc() {
    candidate.getAuthenticationConfiguration().setEnableSelfSignup(true);
    for (TestLoginProtocol protocol :
        List.of(TestLoginProtocol.LDAP, TestLoginProtocol.OIDC, TestLoginProtocol.SAML)) {
      assertEquals(
          TestLoginResult.Status.SUCCESS,
          TestLoginAccountChecks.check(candidate, success(protocol), users).getStatus());
      assertEquals(
          TestLoginResult.Status.FAILED,
          TestLoginAccountChecks.check(
                  candidate, success(protocol).withResolvedEmail("alice@elsewhere.com"), users)
              .getStatus());
    }
  }

  @Test
  void existingAccountsDoNotNeedSignupAndKeepTheirStoredName() {
    doReturn(new User().withName("stored-name"))
        .when(users)
        .getActiveUserByEmailForAuth(anyString(), any());
    TestLoginResult result =
        TestLoginAccountChecks.check(candidate, success(TestLoginProtocol.LDAP), users);
    assertEquals(TestLoginResult.Status.SUCCESS, result.getStatus());
    assertEquals("stored-name", result.getResolvedPrincipal());
  }

  @Test
  void legacyOidcUsesUsernameAndStillChecksRegistrationDomains() {
    candidate
        .getAuthenticationConfiguration()
        .withJwtPrincipalClaimsMapping(List.of("username:sub"))
        .withEnableSelfSignup(true);
    doReturn(new User().withName("alice")).when(users).getUserByNameForAuthUpdate("alice");
    assertEquals(
        TestLoginResult.Status.SUCCESS,
        TestLoginAccountChecks.check(candidate, success(TestLoginProtocol.OIDC), users)
            .getStatus());
    assertEquals(
        TestLoginResult.Status.FAILED,
        TestLoginAccountChecks.check(
                candidate,
                success(TestLoginProtocol.OIDC)
                    .withResolvedPrincipal("new")
                    .withResolvedEmail("new@elsewhere.com"),
                users)
            .getStatus());
  }

  @Test
  void aDeactivatedOrBotAccountNeverPasses() {
    doThrow(new AuthenticationException("deactivated"))
        .when(users)
        .getActiveUserByEmailForAuth(anyString(), any());
    assertEquals(
        TestLoginResult.Status.FAILED,
        TestLoginAccountChecks.check(candidate, success(TestLoginProtocol.LDAP), users)
            .getStatus());
    doReturn(new User().withIsBot(true))
        .when(users)
        .getActiveUserByEmailForAuth(anyString(), any());
    assertEquals(
        TestLoginResult.Status.FAILED,
        TestLoginAccountChecks.check(candidate, success(TestLoginProtocol.OIDC), users)
            .getStatus());
  }

  @Test
  void oidcFallbackUsesTheResolvedUsernameInsteadOfTheConfiguredEmailFlow() {
    candidate
        .getAuthenticationConfiguration()
        .withEmailClaim("mail")
        .withJwtPrincipalClaims(List.of("preferred_username"));
    doReturn(new User().withName("alice").withEmail("different@example.com"))
        .when(users)
        .getUserByNameForAuthUpdate("alice");
    assertEquals(
        TestLoginResult.Status.SUCCESS,
        resolveOidc(Map.of("preferred_username", "alice@example.com")).getStatus());
    doThrow(EntityNotFoundException.byMessage("missing"))
        .when(users)
        .getUserByNameForAuthUpdate("alice");
    doReturn(new User().withName("someone-else"))
        .when(users)
        .getActiveUserByEmailForAuth(anyString(), any());
    assertEquals(
        TestLoginResult.Status.FAILED,
        resolveOidc(Map.of("preferred_username", "alice@example.com")).getStatus());
  }

  @Test
  void oidcSubjectBindingRejectsReassignedAddressesWithoutMutatingTheAccount() {
    User account = new User().withName("alice").withIdentityProviderSubject("subject-a");
    doReturn(account).when(users).getActiveUserByEmailForAuth(anyString(), any());
    assertEquals(
        TestLoginResult.Status.FAILED,
        resolveOidc(Map.of("email", "alice@example.com", "sub", "subject-b")).getStatus());
    assertEquals("subject-a", account.getIdentityProviderSubject());
    assertEquals(
        TestLoginResult.Status.SUCCESS,
        resolveOidc(Map.of("email", "alice@example.com", "sub", "subject-a")).getStatus());
    account.setIdentityProviderSubject(null);
    assertEquals(
        TestLoginResult.Status.SUCCESS,
        resolveOidc(Map.of("email", "alice@example.com", "sub", "subject-b")).getStatus());
    assertNull(account.getIdentityProviderSubject());
  }

  private TestLoginResult resolveOidc(Map<String, Object> claims) {
    return TestLoginService.resolveOidcCallbackIdentity(
        candidate,
        claims,
        TestLoginStageRecorder.forProtocol(TestLoginProtocol.OIDC),
        identity -> TestLoginAccountChecks.admitOidc(candidate, identity, users));
  }

  private static TestLoginResult success(TestLoginProtocol protocol) {
    return new TestLoginResult()
        .withProtocol(protocol)
        .withStatus(TestLoginResult.Status.SUCCESS)
        .withResolvedEmail("alice@example.com")
        .withResolvedPrincipal("alice")
        .withErrors(List.of())
        .withStages(
            List.of(
                new TestLoginStageResult()
                    .withStage(TestLoginStage.IDENTITY_RESOLVED)
                    .withStatus(TestLoginStageStatus.PASSED)));
  }
}
