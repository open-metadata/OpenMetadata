/*
 *  Copyright 2026 Collate
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
import static org.mockito.Mockito.mockStatic;

import com.unboundid.ldap.listener.InMemoryDirectoryServer;
import com.unboundid.ldap.listener.InMemoryDirectoryServerConfig;
import com.unboundid.ldap.listener.InMemoryListenerConfig;
import com.unboundid.ldap.sdk.LDAPConnection;
import com.unboundid.ldap.sdk.LDAPConnectionPool;
import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.net.InetAddress;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.schema.api.security.AuthorizerConfiguration;
import org.openmetadata.schema.auth.LdapConfiguration;
import org.openmetadata.schema.entity.teams.User;

/** A login re-applies the directory's admin group to an existing account, demotions included. */
class LdapRoleSyncTest {
  private static final String BASE_DN = "dc=example,dc=com";
  private static final String ADMINS = "cn=om-admins,ou=groups," + BASE_DN;
  private static final String STAFF = "cn=staff,ou=groups," + BASE_DN;

  private static InMemoryDirectoryServer directory;
  private final LdapAuthenticator authenticator = new LdapAuthenticator();
  private LDAPConnectionPool pool;
  private MockedStatic<SecurityConfigurationManager> securityConfig;
  private Set<String> adminPrincipals = Set.of();

  @BeforeAll
  static void startDirectory() throws Exception {
    InMemoryDirectoryServerConfig config = new InMemoryDirectoryServerConfig(BASE_DN);
    config.setListenerConfigs(
        InMemoryListenerConfig.createLDAPConfig(
            "default", InetAddress.getLoopbackAddress(), 0, null));
    config.setSchema(null);
    directory = new InMemoryDirectoryServer(config);
    directory.add("dn: " + BASE_DN, "objectClass: domain", "dc: example");
    directory.add("dn: ou=users," + BASE_DN, "objectClass: organizationalUnit", "ou: users");
    directory.add("dn: ou=groups," + BASE_DN, "objectClass: organizationalUnit", "ou: groups");
    for (String uid : List.of("ann", "bob", "dave")) {
      directory.add("dn: " + userDn(uid), "objectClass: inetOrgPerson", "uid: " + uid);
    }
    directory.add("dn: " + ADMINS, "objectClass: groupOfNames", "member: " + userDn("ann"));
    directory.add("dn: " + STAFF, "objectClass: groupOfNames", "member: " + userDn("dave"));
    directory.startListening();
  }

  @AfterAll
  static void stopDirectory() {
    directory.shutDown(true);
  }

  @BeforeEach
  void setUp() throws Exception {
    setField(
        "ldapConfiguration",
        new LdapConfiguration()
            .withGroupBaseDN("ou=groups," + BASE_DN)
            .withGroupAttributeName("objectClass")
            .withGroupAttributeValue("groupOfNames")
            .withGroupMemberAttributeName("member")
            .withAllAttributeName("*")
            .withRoleAdminName("Admin")
            .withAuthRolesMapping("{\"" + ADMINS + "\":[\"Admin\"]}")
            .withAuthReassignRoles(Set.of("Admin")));
    pool =
        new LDAPConnectionPool(
            new LDAPConnection(
                InetAddress.getLoopbackAddress().getHostAddress(), directory.getListenPort()),
            1);
    setField("ldapLookupConnectionPool", pool);
    securityConfig = mockStatic(SecurityConfigurationManager.class);
    securityConfig
        .when(SecurityConfigurationManager::getCurrentAuthzConfig)
        .thenAnswer(
            invocation ->
                new AuthorizerConfiguration()
                    .withAdminPrincipals(adminPrincipals)
                    .withAllowedDomains(new HashSet<>())
                    .withAllowedEmailDomains(Set.of()));
  }

  @AfterEach
  void tearDown() {
    securityConfig.close();
    pool.close();
  }

  @Test
  void anAdminInNoGroupAnyMoreIsDemoted() throws Exception {
    User bob = admin("bob");

    assertTrue(sync("bob", bob));
    assertFalse(bob.getIsAdmin());
  }

  @Test
  void anAdminLeftOnlyInAnUnmappedGroupIsDemoted() throws Exception {
    User dave = admin("dave");

    assertTrue(sync("dave", dave));
    assertFalse(dave.getIsAdmin());
  }

  @Test
  void aMemberOfTheAdminGroupStaysAdmin() throws Exception {
    User ann = admin("ann");

    assertFalse(sync("ann", ann));
    assertTrue(ann.getIsAdmin());
  }

  @Test
  void aConfiguredAdminOutsideTheAdminGroupStaysAdmin() throws Exception {
    adminPrincipals = Set.of("dave");
    User dave = admin("dave");

    assertFalse(sync("dave", dave));
    assertEquals(Boolean.TRUE, dave.getIsAdmin());
  }

  private static User admin(String name) {
    return new User().withName(name).withEmail(name + "@example.com").withIsAdmin(true);
  }

  private boolean sync(String uid, User user) throws Exception {
    Method sync =
        LdapAuthenticator.class.getDeclaredMethod("syncLdapRoles", String.class, User.class);
    sync.setAccessible(true);
    return (boolean) sync.invoke(authenticator, userDn(uid), user);
  }

  private static String userDn(String uid) {
    return "uid=" + uid + ",ou=users," + BASE_DN;
  }

  private void setField(String name, Object value) throws Exception {
    Field field = LdapAuthenticator.class.getDeclaredField(name);
    field.setAccessible(true);
    field.set(authenticator, value);
  }
}
