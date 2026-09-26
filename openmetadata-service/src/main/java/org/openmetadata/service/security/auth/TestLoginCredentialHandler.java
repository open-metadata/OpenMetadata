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

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.service.resources.teams.UserResource.USER_PROTECTED_FIELDS;

import com.fasterxml.jackson.core.type.TypeReference;
import com.unboundid.ldap.sdk.Filter;
import com.unboundid.ldap.sdk.LDAPConnection;
import com.unboundid.ldap.sdk.LDAPConnectionOptions;
import com.unboundid.ldap.sdk.LDAPException;
import com.unboundid.ldap.sdk.ResultCode;
import com.unboundid.ldap.sdk.SearchRequest;
import com.unboundid.ldap.sdk.SearchResultEntry;
import com.unboundid.ldap.sdk.SearchScope;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.security.AuthenticationConfiguration;
import org.openmetadata.schema.auth.LdapConfiguration;
import org.openmetadata.schema.configuration.SecurityConfiguration;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.system.TestLoginProtocol;
import org.openmetadata.schema.system.TestLoginResult;
import org.openmetadata.schema.system.TestLoginStage;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.util.EntityUtil;

/**
 * The credential-based leg of a Test Login: LDAP and Basic.
 *
 * <p>It follows the same steps as {@link LdapAuthenticator} and {@link BasicAuthenticator} against
 * the CANDIDATE configuration, but deliberately stops short of everything login does afterwards: it
 * never provisions or updates a user, never issues a token, and never records a failed attempt —
 * a mistyped password in a test must not count towards locking a real account. Because of that last
 * point, every test accepts exactly one attempt and the caller rate-limits attempts per admin.
 */
@Slf4j
final class TestLoginCredentialHandler {
  private static final int DIRECTORY_TIMEOUT_MILLIS = 5_000;
  private static final Set<String> BASIC_USER_FIELDS =
      Set.of(USER_PROTECTED_FIELDS, "roles", "teams");

  /** Which stage failed and why; lets one try block attribute every directory failure. */
  private static final class StageFailure extends RuntimeException {
    private final TestLoginStage stage;

    private StageFailure(TestLoginStage stage, String message) {
      super(message);
      this.stage = stage;
    }
  }

  private record DirectoryUser(String dn, String email) {}

  private TestLoginCredentialHandler() {}

  static TestLoginResult verifyLdap(
      SecurityConfiguration candidate, String email, String password) {
    TestLoginStageRecorder recorder = TestLoginStageRecorder.forProtocol(TestLoginProtocol.LDAP);
    TestLoginResult result;
    try {
      result = verifyAgainstDirectory(candidate, email, password, recorder);
    } catch (StageFailure failure) {
      recorder.fail(failure.stage, failure.getMessage());
      result = TestLoginService.failure(TestLoginProtocol.LDAP, recorder);
    }
    return result;
  }

  private static TestLoginResult verifyAgainstDirectory(
      SecurityConfiguration candidate,
      String email,
      String password,
      TestLoginStageRecorder recorder) {
    AuthenticationConfiguration authConfig = candidate.getAuthenticationConfiguration();
    LdapConfiguration ldap = authConfig.getLdapConfiguration();
    try (LDAPConnection lookup = connectAsLookupAccount(ldap)) {
      recorder.pass(TestLoginStage.STARTED);
      DirectoryUser user = findDirectoryUser(lookup, authConfig, email);
      bindAsUser(ldap, user, password);
      recorder.pass(TestLoginStage.CREDENTIALS_VERIFIED, user.dn());
      return TestLoginService.resolveCredentialIdentity(
          candidate,
          TestLoginProtocol.LDAP,
          new TestLoginService.ResolvedCredentialIdentity(
              localPartOf(user.email()),
              user.email(),
              mappedRoleNames(lookup, ldap, user.dn()),
              List.of()),
          recorder);
    }
  }

  private static LDAPConnection connectAsLookupAccount(LdapConfiguration ldap) {
    LDAPConnection connection = null;
    try {
      connection = LdapAuthenticator.openConnection(ldap, boundedTimeouts());
      connection.bind(ldap.getDnAdminPrincipal(), ldap.getDnAdminPassword());
      return connection;
    } catch (Exception e) {
      // LDAPException for connect/bind failures, GeneralSecurityException for the TLS setup.
      if (connection != null) {
        connection.close();
      }
      throw new StageFailure(
          TestLoginStage.STARTED,
          String.format(
              "Could not connect to %s:%s and bind as the lookup account '%s': %s",
              ldap.getHost(),
              ldap.getPort(),
              ldap.getDnAdminPrincipal(),
              TestLoginService.rootMessage(e)));
    }
  }

  /** Mirrors login: exactly one entry under the user base DN must carry the entered email. */
  private static DirectoryUser findDirectoryUser(
      LDAPConnection lookup, AuthenticationConfiguration authConfig, String email) {
    LdapConfiguration ldap = authConfig.getLdapConfiguration();
    String emailAttribute = LdapAuthenticator.emailAttributeFor(authConfig, ldap);
    List<SearchResultEntry> entries;
    try {
      entries =
          lookup
              .search(
                  new SearchRequest(
                      ldap.getUserBaseDN(),
                      SearchScope.SUB,
                      Filter.createEqualityFilter(emailAttribute, email),
                      emailAttribute))
              .getSearchEntries();
    } catch (LDAPException e) {
      throw credentialFailure("The user search failed: " + TestLoginService.rootMessage(e));
    }
    return requireSingleMatch(entries, emailAttribute, email);
  }

  private static DirectoryUser requireSingleMatch(
      List<SearchResultEntry> entries, String emailAttribute, String email) {
    if (entries.size() != 1) {
      throw credentialFailure(
          entries.isEmpty()
              ? String.format("No entry under the user base DN has %s=%s.", emailAttribute, email)
              : String.format(
                  "%d entries have %s=%s; login requires exactly one.",
                  entries.size(), emailAttribute, email));
    }
    SearchResultEntry entry = entries.getFirst();
    String directoryEmail = entry.getAttributeValue(emailAttribute);
    if (directoryEmail == null || !directoryEmail.equalsIgnoreCase(email)) {
      throw credentialFailure(
          String.format("Entry '%s' has no matching %s attribute.", entry.getDN(), emailAttribute));
    }
    return new DirectoryUser(entry.getDN(), directoryEmail.toLowerCase(Locale.ROOT));
  }

  private static void bindAsUser(LdapConfiguration ldap, DirectoryUser user, String password) {
    try (LDAPConnection connection = LdapAuthenticator.openConnection(ldap, boundedTimeouts())) {
      connection.bind(user.dn(), password);
    } catch (LDAPException e) {
      throw credentialFailure(
          e.getResultCode() == ResultCode.INVALID_CREDENTIALS
              ? String.format("The directory rejected the password for '%s'.", user.dn())
              : "Binding as the user failed: " + TestLoginService.rootMessage(e));
    } catch (Exception e) {
      throw credentialFailure("Binding as the user failed: " + TestLoginService.rootMessage(e));
    }
  }

  /** The role names the user's directory groups map to, as a first login would assign them. */
  private static List<String> mappedRoleNames(
      LDAPConnection lookup, LdapConfiguration ldap, String userDn) {
    Map<String, List<String>> roleMapping = roleMappingOf(ldap);
    if (nullOrEmpty(roleMapping)) {
      return List.of();
    }
    return searchGroupDns(lookup, ldap, userDn).stream()
        .flatMap(groupDn -> listOrEmpty(roleMapping.get(groupDn)).stream())
        .distinct()
        .toList();
  }

  private static Map<String, List<String>> roleMappingOf(LdapConfiguration ldap) {
    if (nullOrEmpty(ldap.getAuthRolesMapping())) {
      return Map.of();
    }
    return JsonUtils.readValue(
        ldap.getAuthRolesMapping(), new TypeReference<Map<String, List<String>>>() {});
  }

  private static List<String> searchGroupDns(
      LDAPConnection lookup, LdapConfiguration ldap, String userDn) {
    try {
      Filter groupFilter =
          Filter.createANDFilter(
              Filter.createEqualityFilter(
                  ldap.getGroupAttributeName(), ldap.getGroupAttributeValue()),
              LdapAuthenticator.buildGroupMemberFilter(ldap, userDn));
      return lookup
          .search(
              new SearchRequest(
                  ldap.getGroupBaseDN(), SearchScope.SUB, groupFilter, ldap.getAllAttributeName()))
          .getSearchEntries()
          .stream()
          .map(SearchResultEntry::getDN)
          .toList();
    } catch (LDAPException | RuntimeException e) {
      // RuntimeException covers group settings the mapping needs but the candidate leaves unset.
      throw new StageFailure(
          TestLoginStage.ROLES_MAPPED,
          "The group search for role mapping failed: " + TestLoginService.rootMessage(e));
    }
  }

  /** Mirrors Basic login: an active, non-bot account whose stored password matches. */
  static TestLoginResult verifyBasic(
      SecurityConfiguration candidate, String email, String password) {
    TestLoginStageRecorder recorder = TestLoginStageRecorder.forProtocol(TestLoginProtocol.BASIC);
    recorder.pass(TestLoginStage.STARTED);
    TestLoginResult result;
    try {
      User user = requireMatchingAccount(email, password);
      recorder.pass(TestLoginStage.CREDENTIALS_VERIFIED, user.getName());
      result =
          TestLoginService.resolveCredentialIdentity(
              candidate,
              TestLoginProtocol.BASIC,
              new TestLoginService.ResolvedCredentialIdentity(
                  user.getName(),
                  user.getEmail(),
                  namesOf(user.getRoles()),
                  namesOf(user.getTeams())),
              recorder);
    } catch (StageFailure failure) {
      recorder.fail(failure.stage, failure.getMessage());
      result = TestLoginService.failure(TestLoginProtocol.BASIC, recorder);
    }
    return result;
  }

  private static User requireMatchingAccount(String email, String password) {
    User user;
    try {
      user =
          Entity.getUserRepository()
              .getActiveUserByEmailForAuth(
                  email,
                  new EntityUtil.Fields(BASIC_USER_FIELDS, "authenticationMechanism,roles,teams"));
    } catch (RuntimeException e) {
      // Not found, deactivated, or duplicate-email collision: login would refuse all three.
      LOG.debug("Test login found no usable account for {}", email, e);
      throw credentialFailure("No active account is registered for " + email + ".");
    }
    if (Boolean.TRUE.equals(user.getIsBot())
        || !BasicAuthenticator.matchesStoredPassword(user, password)) {
      throw credentialFailure("The email or password was not accepted for " + email + ".");
    }
    return user;
  }

  private static StageFailure credentialFailure(String message) {
    return new StageFailure(TestLoginStage.CREDENTIALS_VERIFIED, message);
  }

  private static List<String> namesOf(List<EntityReference> references) {
    return listOrEmpty(references).stream().map(EntityReference::getName).toList();
  }

  private static LDAPConnectionOptions boundedTimeouts() {
    // An unreachable candidate directory must fail the test quickly, not hold the request thread.
    LDAPConnectionOptions options = new LDAPConnectionOptions();
    options.setConnectTimeoutMillis(DIRECTORY_TIMEOUT_MILLIS);
    options.setResponseTimeoutMillis(DIRECTORY_TIMEOUT_MILLIS);
    return options;
  }

  private static String localPartOf(String email) {
    return email.contains("@") ? email.substring(0, email.indexOf('@')) : email;
  }
}
