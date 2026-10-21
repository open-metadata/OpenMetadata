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

import at.favre.lib.crypto.bcrypt.BCrypt;
import com.unboundid.ldap.listener.InMemoryDirectoryServer;
import com.unboundid.ldap.listener.InMemoryDirectoryServerConfig;
import com.unboundid.ldap.listener.InMemoryListenerConfig;
import com.unboundid.ldap.sdk.LDAPException;
import com.unboundid.ldif.LDIFException;
import java.net.InetAddress;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.api.security.AuthenticationConfiguration;
import org.openmetadata.schema.api.security.AuthorizerConfiguration;
import org.openmetadata.schema.auth.LdapConfiguration;
import org.openmetadata.schema.configuration.SecurityConfiguration;
import org.openmetadata.schema.entity.teams.AuthenticationMechanism;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.services.connections.metadata.AuthProvider;
import org.openmetadata.schema.system.TestLoginResult;
import org.openmetadata.schema.system.TestLoginStage;
import org.openmetadata.schema.system.TestLoginStageResult;
import org.openmetadata.schema.system.TestLoginStageStatus;

/**
 * Runs the LDAP leg of Test Login against a real, in-process directory: the same bind, user search
 * and group search a login performs, with nothing mocked.
 */
class TestLoginCredentialHandlerTest {
  private static final String BASE_DN = "dc=example,dc=com";
  private static final String LOOKUP_DN = "cn=Directory Manager";
  private static final String LOOKUP_PASSWORD = "lookup-password";
  private static final String ALICE_DN = "uid=alice,ou=users," + BASE_DN;
  private static final String ALICE_PASSWORD = "alice-password";
  private static final String STEWARDS_DN = "cn=stewards,ou=groups," + BASE_DN;

  private static InMemoryDirectoryServer directory;

  @BeforeAll
  static void startDirectory() throws LDAPException, LDIFException {
    InMemoryDirectoryServerConfig config = new InMemoryDirectoryServerConfig(BASE_DN);
    config.addAdditionalBindCredentials(LOOKUP_DN, LOOKUP_PASSWORD);
    config.setListenerConfigs(
        InMemoryListenerConfig.createLDAPConfig(
            "default", InetAddress.getLoopbackAddress(), 0, null));
    config.setSchema(null);
    directory = new InMemoryDirectoryServer(config);
    directory.add("dn: " + BASE_DN, "objectClass: domain", "dc: example");
    directory.add("dn: ou=users," + BASE_DN, "objectClass: organizationalUnit", "ou: users");
    directory.add("dn: ou=groups," + BASE_DN, "objectClass: organizationalUnit", "ou: groups");
    directory.add(
        "dn: " + ALICE_DN,
        "objectClass: inetOrgPerson",
        "uid: alice",
        "cn: Alice",
        "sn: Liddell",
        "mail: alice@example.com",
        "userPassword: " + ALICE_PASSWORD);
    directory.add(
        "dn: " + STEWARDS_DN, "objectClass: groupOfNames", "cn: stewards", "member: " + ALICE_DN);
    directory.startListening();
  }

  @AfterAll
  static void stopDirectory() {
    directory.shutDown(true);
  }

  @Test
  void theRightPasswordResolvesTheIdentityAndItsMappedRoles() {
    TestLoginResult result =
        TestLoginCredentialHandler.verifyLdap(
            candidate(ldap(LOOKUP_PASSWORD), openAuthorizer()),
            "alice@example.com",
            ALICE_PASSWORD);

    assertEquals(TestLoginResult.Status.SUCCESS, result.getStatus(), String.valueOf(result));
    assertEquals("alice@example.com", result.getResolvedEmail());
    assertEquals("alice", result.getResolvedPrincipal());
    assertEquals(List.of("DataSteward"), result.getMappedRoles());
    assertEquals(
        TestLoginStageStatus.PASSED, statusOf(result, TestLoginStage.CREDENTIALS_VERIFIED));
    assertEquals(TestLoginStageStatus.SKIPPED, statusOf(result, TestLoginStage.REDIRECTED));
  }

  @Test
  void aWrongPasswordIsRejectedAtCredentialVerification() {
    TestLoginResult result =
        TestLoginCredentialHandler.verifyLdap(
            candidate(ldap(LOOKUP_PASSWORD), openAuthorizer()), "alice@example.com", "wrong");

    assertEquals(TestLoginResult.Status.FAILED, result.getStatus());
    assertEquals(TestLoginStage.CREDENTIALS_VERIFIED, result.getStage());
    assertTrue(result.getErrors().getFirst().contains("rejected the password"));
  }

  @Test
  void anUnknownEmailNamesTheAttributeThatWasSearched() {
    TestLoginResult result =
        TestLoginCredentialHandler.verifyLdap(
            candidate(ldap(LOOKUP_PASSWORD), openAuthorizer()), "nobody@example.com", "any");

    assertEquals(TestLoginResult.Status.FAILED, result.getStatus());
    assertEquals(TestLoginStage.CREDENTIALS_VERIFIED, result.getStage());
    assertTrue(result.getErrors().getFirst().contains("mail=nobody@example.com"));
  }

  @Test
  void aWrongLookupAccountPasswordFailsBeforeAnyUserIsSearched() {
    TestLoginResult result =
        TestLoginCredentialHandler.verifyLdap(
            candidate(ldap("not-the-lookup-password"), openAuthorizer()),
            "alice@example.com",
            ALICE_PASSWORD);

    assertEquals(TestLoginResult.Status.FAILED, result.getStatus());
    assertEquals(TestLoginStage.STARTED, result.getStage());
    assertEquals(
        TestLoginStageStatus.PENDING, statusOf(result, TestLoginStage.CREDENTIALS_VERIFIED));
  }

  @Test
  void theDomainRuleLoginAppliesStillReportsWhoWasRejected() {
    AuthorizerConfiguration restricted =
        openAuthorizer().withAllowedEmailDomains(Set.of("other.org"));

    TestLoginResult result =
        TestLoginCredentialHandler.verifyLdap(
            candidate(ldap(LOOKUP_PASSWORD), restricted), "alice@example.com", ALICE_PASSWORD);

    assertEquals(TestLoginResult.Status.FAILED, result.getStatus());
    assertEquals("alice@example.com", result.getResolvedEmail());
    assertEquals(TestLoginStage.DOMAIN_CHECKED, result.getStage());
    assertFalse(result.getDomainCheck().getPassed());
  }

  @Test
  void anUnreachableDirectoryFailsTheTestAtTheStart() {
    LdapConfiguration unreachable = ldap(LOOKUP_PASSWORD).withPort(1);

    TestLoginResult result =
        TestLoginCredentialHandler.verifyLdap(
            candidate(unreachable, openAuthorizer()), "alice@example.com", ALICE_PASSWORD);

    assertEquals(TestLoginResult.Status.FAILED, result.getStatus());
    assertEquals(TestLoginStage.STARTED, result.getStage());
  }

  @Test
  void theBasicPasswordCheckNeverTouchesAccountLockout() {
    User user =
        new User()
            .withName("alice")
            .withAuthenticationMechanism(
                new AuthenticationMechanism()
                    .withConfig(
                        new LinkedHashMap<>(
                            Map.of(
                                "password",
                                BCrypt.withDefaults().hashToString(4, "s3cret".toCharArray())))));

    assertTrue(BasicAuthenticator.matchesStoredPassword(user, "s3cret"));
    assertFalse(BasicAuthenticator.matchesStoredPassword(user, "wrong"));
    assertFalse(BasicAuthenticator.matchesStoredPassword(new User().withName("sso-only"), "any"));
  }

  private static LdapConfiguration ldap(String lookupPassword) {
    return new LdapConfiguration()
        .withHost("127.0.0.1")
        .withPort(directory.getListenPort())
        .withDnAdminPrincipal(LOOKUP_DN)
        .withDnAdminPassword(lookupPassword)
        .withUserBaseDN("ou=users," + BASE_DN)
        .withMailAttributeName("mail")
        .withGroupBaseDN("ou=groups," + BASE_DN)
        .withGroupAttributeName("objectClass")
        .withGroupAttributeValue("groupOfNames")
        .withGroupMemberAttributeName("member")
        .withAllAttributeName("*")
        .withAuthRolesMapping("{\"" + STEWARDS_DN + "\":[\"DataSteward\"]}")
        .withSslEnabled(false);
  }

  private static AuthorizerConfiguration openAuthorizer() {
    return new AuthorizerConfiguration()
        .withPrincipalDomain("example.com")
        .withEnforcePrincipalDomain(false)
        .withAllowedDomains(new HashSet<>());
  }

  private static SecurityConfiguration candidate(
      LdapConfiguration ldap, AuthorizerConfiguration authz) {
    return new SecurityConfiguration()
        .withAuthenticationConfiguration(
            new AuthenticationConfiguration()
                .withProvider(AuthProvider.LDAP)
                .withLdapConfiguration(ldap))
        .withAuthorizerConfiguration(authz);
  }

  private static TestLoginStageStatus statusOf(TestLoginResult result, TestLoginStage stage) {
    return result.getStages().stream()
        .filter(stageResult -> stageResult.getStage() == stage)
        .map(TestLoginStageResult::getStatus)
        .findFirst()
        .orElseThrow();
  }
}
