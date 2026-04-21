/*
 *  Copyright 2025 Collate
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

import com.unboundid.ldap.listener.InMemoryDirectoryServer;
import com.unboundid.ldap.listener.InMemoryDirectoryServerConfig;
import com.unboundid.ldap.listener.InMemoryListenerConfig;
import com.unboundid.ldap.sdk.Entry;
import java.util.Map;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.auth.LdapConfiguration;

/**
 * Unit tests for {@link TestLdapHandler}. Uses UnboundID's
 * {@link InMemoryDirectoryServer} — a real LDAP server running in-process,
 * so we exercise the actual bind/search/attribute-read paths without mocks.
 *
 * <p>Directory tree seeded in {@link #setUp()}:
 * <pre>
 *   dc=company,dc=com
 *   ├─ cn=admin (password: admin-pass)
 *   └─ ou=users
 *      ├─ cn=alice         (mail: alice@company.com, password: alice-pass)
 *      └─ cn=bob-no-mail   (no mail attribute, password: bob-pass)
 * </pre>
 */
class TestLdapHandlerTest {

  private static final String BASE_DN = "dc=company,dc=com";
  private static final String ADMIN_DN = "cn=admin," + BASE_DN;
  private static final String ADMIN_PASSWORD = "admin-pass";
  private static final String USER_BASE_DN = "ou=users," + BASE_DN;
  private static final String ALICE_DN = "cn=alice," + USER_BASE_DN;
  private static final String ALICE_PASSWORD = "alice-pass";
  private static final String ALICE_EMAIL = "alice@company.com";

  private InMemoryDirectoryServer server;
  private int port;

  @BeforeEach
  void setUp() throws Exception {
    InMemoryDirectoryServerConfig config = new InMemoryDirectoryServerConfig(BASE_DN);
    config.addAdditionalBindCredentials(ADMIN_DN, ADMIN_PASSWORD);
    config.setListenerConfigs(InMemoryListenerConfig.createLDAPConfig("default", 0));
    config.setSchema(null); // Allow arbitrary schema for test simplicity

    server = new InMemoryDirectoryServer(config);
    server.add(
        new Entry(
            "dn: " + BASE_DN, "objectClass: top", "objectClass: domain", "dc: company"));
    server.add(
        new Entry(
            "dn: " + USER_BASE_DN,
            "objectClass: top",
            "objectClass: organizationalUnit",
            "ou: users"));
    server.add(
        new Entry(
            "dn: " + ALICE_DN,
            "objectClass: top",
            "objectClass: inetOrgPerson",
            "cn: alice",
            "sn: Smith",
            "mail: " + ALICE_EMAIL,
            "userPassword: " + ALICE_PASSWORD));
    server.add(
        new Entry(
            "dn: cn=bob-no-mail," + USER_BASE_DN,
            "objectClass: top",
            "objectClass: inetOrgPerson",
            "cn: bob-no-mail",
            "sn: NoMail",
            "userPassword: bob-pass"));

    server.startListening();
    port = server.getListenPort();
  }

  @AfterEach
  void tearDown() {
    if (server != null) {
      server.shutDown(true);
    }
  }

  private LdapConfiguration buildLdapConfig() {
    return new LdapConfiguration()
        .withHost("localhost")
        .withPort(port)
        .withDnAdminPrincipal(ADMIN_DN)
        .withDnAdminPassword(ADMIN_PASSWORD)
        .withUserBaseDN(USER_BASE_DN)
        .withMailAttributeName("mail")
        .withSslEnabled(false);
  }

  // ---------- Input validation ----------

  @Test
  void handleLdapTestLogin_nullConfig_returnsError() {
    Map<String, Object> result =
        TestLdapHandler.handleLdapTestLogin(null, ALICE_EMAIL, ALICE_PASSWORD);

    assertEquals(false, result.get("success"));
    assertTrue(((String) result.get("error")).contains("LDAP configuration is required"));
  }

  @Test
  void handleLdapTestLogin_emptyEmail_returnsError() {
    Map<String, Object> result =
        TestLdapHandler.handleLdapTestLogin(buildLdapConfig(), "", ALICE_PASSWORD);

    assertEquals(false, result.get("success"));
    assertTrue(((String) result.get("error")).contains("Email and password are required"));
  }

  @Test
  void handleLdapTestLogin_emptyPassword_returnsError() {
    Map<String, Object> result =
        TestLdapHandler.handleLdapTestLogin(buildLdapConfig(), ALICE_EMAIL, "");

    assertEquals(false, result.get("success"));
    assertTrue(((String) result.get("error")).contains("Email and password are required"));
  }

  @Test
  void handleLdapTestLogin_missingHost_returnsError() {
    LdapConfiguration config = buildLdapConfig().withHost(null);

    Map<String, Object> result =
        TestLdapHandler.handleLdapTestLogin(config, ALICE_EMAIL, ALICE_PASSWORD);

    assertEquals(false, result.get("success"));
    assertTrue(((String) result.get("error")).contains("missing required fields"));
  }

  @Test
  void handleLdapTestLogin_missingMailAttributeName_returnsError() {
    LdapConfiguration config = buildLdapConfig().withMailAttributeName(null);

    Map<String, Object> result =
        TestLdapHandler.handleLdapTestLogin(config, ALICE_EMAIL, ALICE_PASSWORD);

    assertEquals(false, result.get("success"));
    assertTrue(((String) result.get("error")).contains("missing required fields"));
  }

  // ---------- Happy path ----------

  @Test
  void handleLdapTestLogin_validCredentials_returnsSuccessWithDerivedFields() {
    Map<String, Object> result =
        TestLdapHandler.handleLdapTestLogin(buildLdapConfig(), ALICE_EMAIL, ALICE_PASSWORD);

    assertEquals(true, result.get("success"));
    assertEquals(ALICE_EMAIL, result.get("email"));
    assertEquals("alice", result.get("username"));
    assertEquals("company.com", result.get("derivedPrincipalDomain"));
    assertEquals(ALICE_EMAIL, result.get("suggestedAdminPrincipal"));
  }

  // ---------- Failure paths ----------

  @Test
  void handleLdapTestLogin_wrongAdminPassword_returnsError() {
    LdapConfiguration config = buildLdapConfig().withDnAdminPassword("wrong-admin-pass");

    Map<String, Object> result =
        TestLdapHandler.handleLdapTestLogin(config, ALICE_EMAIL, ALICE_PASSWORD);

    assertEquals(false, result.get("success"));
    assertTrue(((String) result.get("error")).contains("LDAP test failed"));
  }

  @Test
  void handleLdapTestLogin_userNotFound_returnsError() {
    Map<String, Object> result =
        TestLdapHandler.handleLdapTestLogin(
            buildLdapConfig(), "nobody@company.com", ALICE_PASSWORD);

    assertEquals(false, result.get("success"));
    assertTrue(((String) result.get("error")).contains("not found"));
  }

  @Test
  void handleLdapTestLogin_wrongUserPassword_returnsInvalidCredentialsError() {
    Map<String, Object> result =
        TestLdapHandler.handleLdapTestLogin(
            buildLdapConfig(), ALICE_EMAIL, "wrong-alice-password");

    assertEquals(false, result.get("success"));
    assertEquals("Invalid username or password", result.get("error"));
  }

  @Test
  void handleLdapTestLogin_wrongUserBaseDN_userNotFound() {
    LdapConfiguration config =
        buildLdapConfig().withUserBaseDN("ou=nonexistent," + BASE_DN);

    Map<String, Object> result =
        TestLdapHandler.handleLdapTestLogin(config, ALICE_EMAIL, ALICE_PASSWORD);

    assertEquals(false, result.get("success"));
    assertTrue(((String) result.get("error")).contains("LDAP test failed"));
  }

  @Test
  void handleLdapTestLogin_wrongMailAttributeName_userNotFound() {
    LdapConfiguration config = buildLdapConfig().withMailAttributeName("emailAddress");

    Map<String, Object> result =
        TestLdapHandler.handleLdapTestLogin(config, ALICE_EMAIL, ALICE_PASSWORD);

    assertEquals(false, result.get("success"));
    assertTrue(((String) result.get("error")).contains("not found"));
  }

  // ---------- Edge case: user exists but no mail attribute ----------

  @Test
  void handleLdapTestLogin_userFoundByDifferentAttribute_returnsError() {
    // "bob-no-mail" has no mail attribute — search by mail=... won't find him.
    Map<String, Object> result =
        TestLdapHandler.handleLdapTestLogin(buildLdapConfig(), "bob@company.com", "bob-pass");

    assertEquals(false, result.get("success"));
    assertTrue(((String) result.get("error")).contains("not found"));
  }

  // ---------- Unreachable server ----------

  @Test
  void handleLdapTestLogin_serverUnreachable_returnsError() {
    LdapConfiguration config = buildLdapConfig().withHost("localhost").withPort(1);

    Map<String, Object> result =
        TestLdapHandler.handleLdapTestLogin(config, ALICE_EMAIL, ALICE_PASSWORD);

    assertEquals(false, result.get("success"));
    assertFalse(((String) result.get("error")).isEmpty());
  }
}
