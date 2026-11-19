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
import java.util.Set;
import org.openmetadata.schema.configuration.SecurityConfiguration;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.system.TestLoginProtocol;
import org.openmetadata.schema.system.TestLoginResult;
import org.openmetadata.schema.system.TestLoginStage;
import org.openmetadata.schema.system.TestLoginStageStatus;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.UserRepository;
import org.openmetadata.service.security.AuthenticationException;

/** Read-only admission checks after identity resolution; never provisions an account. */
final class TestLoginAccountChecks {
  private TestLoginAccountChecks() {}

  static TestLoginResult check(
      SecurityConfiguration candidate, TestLoginResult result, UserRepository users) {
    if (result.getStatus() != TestLoginResult.Status.SUCCESS
        || result.getProtocol() == TestLoginProtocol.BASIC) {
      return result;
    }
    try {
      requireAdmitted(candidate, result, users);
    } catch (AuthenticationException e) {
      result.withStatus(TestLoginResult.Status.FAILED);
      List<String> errors = new ArrayList<>(result.getErrors());
      errors.add(e.getMessage());
      result.setErrors(errors);
      result.getStages().stream()
          .filter(stage -> stage.getStage() == TestLoginStage.IDENTITY_RESOLVED)
          .forEach(
              stage -> stage.withStatus(TestLoginStageStatus.FAILED).withMessage(e.getMessage()));
    }
    return result;
  }

  private static void requireAdmitted(
      SecurityConfiguration candidate, TestLoginResult result, UserRepository users) {
    boolean emailFirst = result.getProtocol() == TestLoginProtocol.LDAP;
    try {
      User user =
          emailFirst
              ? users.getByEmail(null, result.getResolvedEmail(), users.getAuthUpdateFields())
              : users.getByName(
                  null,
                  result.getResolvedPrincipal(),
                  users.getAuthUpdateFields(),
                  Include.NON_DELETED,
                  false);
      if (Boolean.TRUE.equals(user.getIsBot()) || Boolean.TRUE.equals(user.getDeleted())) {
        throw new AuthenticationException("This account cannot sign in interactively.");
      }
      result.setResolvedPrincipal(user.getName());
    } catch (EntityNotFoundException e) {
      requireSignupAllowed(candidate, result, emailFirst);
    }
  }

  private static void requireSignupAllowed(
      SecurityConfiguration candidate, TestLoginResult result, boolean emailFirst) {
    if (!Boolean.TRUE.equals(candidate.getAuthenticationConfiguration().getEnableSelfSignup())) {
      throw new AuthenticationException(
          "User not registered. Contact administrator to create an account.");
    }
    // 2.0 gates new LDAP/SAML users only on self-signup. Confidential OIDC additionally
    // checks registration domains; preserve that branch's admission semantics.
    Set<String> allowed =
        candidate.getAuthorizerConfiguration().getAllowedEmailRegistrationDomains();
    String domain = result.getResolvedEmail().substring(result.getResolvedEmail().indexOf('@') + 1);
    if (result.getProtocol() == TestLoginProtocol.OIDC
        && !nullOrEmpty(allowed)
        && !allowed.contains("all")
        && allowed.stream().noneMatch(domain::equalsIgnoreCase)) {
      throw new AuthenticationException("Email domain not allowed for self-signup.");
    }
  }
}
