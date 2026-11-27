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

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import java.util.ArrayList;
import java.util.List;
import org.openmetadata.schema.api.security.AuthenticationConfiguration;
import org.openmetadata.schema.configuration.SecurityConfiguration;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.system.TestLoginProtocol;
import org.openmetadata.schema.system.TestLoginResult;
import org.openmetadata.schema.system.TestLoginStage;
import org.openmetadata.schema.system.TestLoginStageStatus;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.UserRepository;
import org.openmetadata.service.security.AuthenticationException;
import org.openmetadata.service.security.EmailFirstUserProvisioner;
import org.openmetadata.service.security.SecurityUtil;

/** Read-only admission checks after identity resolution; never provisions an account. */
final class TestLoginAccountChecks {
  private TestLoginAccountChecks() {}

  static TestLoginResult check(
      final SecurityConfiguration candidate,
      final TestLoginResult result,
      final UserRepository users) {
    if (result.getStatus() != TestLoginResult.Status.SUCCESS
        || result.getProtocol() == TestLoginProtocol.BASIC) {
      return result;
    }
    try {
      requireAdmitted(candidate, result, users);
    } catch (AuthenticationException e) {
      result.withStatus(TestLoginResult.Status.FAILED);
      final List<String> errors = new ArrayList<>(result.getErrors());
      errors.add(e.getMessage());
      result.setErrors(errors);
      result.getStages().stream()
          .filter(stage -> stage.getStage() == TestLoginStage.IDENTITY_RESOLVED)
          .forEach(
              stage -> stage.withStatus(TestLoginStageStatus.FAILED).withMessage(e.getMessage()));
    }
    return result;
  }

  static String admitOidc(
      final SecurityConfiguration candidate,
      final TestLoginService.ResolvedAccountIdentity identity,
      final UserRepository users) {
    try {
      final User user =
          identity.emailFirstFlow()
              ? users.getActiveUserByEmailForAuth(identity.email(), users.getAuthUpdateFields())
              : users.getUserByNameForAuthUpdate(identity.userName());
      requireInteractiveAccount(user);
      if (identity.emailFirstFlow()
          && EmailFirstUserProvisioner.hasConflictingSubject(user, identity.subject())) {
        throw new AuthenticationException(
            "Email is already bound to a different identity-provider subject. Contact your administrator.");
      }
      return user.getName();
    } catch (EntityNotFoundException e) {
      requireSignupAllowed(
          candidate, TestLoginProtocol.OIDC, identity.email(), identity.emailFirstFlow());
      return identity.userName();
    }
  }

  private static void requireInteractiveAccount(final User user) {
    if (Boolean.TRUE.equals(user.getIsBot()) || Boolean.TRUE.equals(user.getDeleted())) {
      throw new AuthenticationException("This account cannot sign in interactively.");
    }
  }

  private static void requireAdmitted(
      final SecurityConfiguration candidate,
      final TestLoginResult result,
      final UserRepository users) {
    final boolean emailFirst =
        usesEmailLookup(candidate.getAuthenticationConfiguration(), result.getProtocol());
    try {
      final User user =
          emailFirst
              ? users.getActiveUserByEmailForAuth(
                  result.getResolvedEmail(), users.getAuthUpdateFields())
              : users.getUserByNameForAuthUpdate(result.getResolvedPrincipal());
      requireInteractiveAccount(user);
      result.setResolvedPrincipal(user.getName());
    } catch (EntityNotFoundException e) {
      requireSignupAllowed(candidate, result.getProtocol(), result.getResolvedEmail(), emailFirst);
    }
  }

  private static boolean usesEmailLookup(
      final AuthenticationConfiguration auth, final TestLoginProtocol protocol) {
    return protocol == TestLoginProtocol.LDAP
        || (!nullOrEmpty(auth.getEmailClaim()) && nullOrEmpty(auth.getJwtPrincipalClaimsMapping()));
  }

  private static void requireSignupAllowed(
      final SecurityConfiguration candidate,
      final TestLoginProtocol protocol,
      final String email,
      final boolean emailFirst) {
    if (!Boolean.TRUE.equals(candidate.getAuthenticationConfiguration().getEnableSelfSignup())) {
      throw new AuthenticationException(
          "User not registered. Contact administrator to create an account.");
    }
    // The legacy SAML handler only gates self-signup; email-first SAML, LDAP and OIDC also
    // enforce registration domains. Existing accounts are not subject to the signup allow-list.
    if ((emailFirst || protocol == TestLoginProtocol.OIDC)
        && !SecurityUtil.isEmailRegistrationDomainAllowed(
            email, candidate.getAuthorizerConfiguration().getAllowedEmailRegistrationDomains())) {
      throw new AuthenticationException("Email domain not allowed for self-signup.");
    }
  }
}
