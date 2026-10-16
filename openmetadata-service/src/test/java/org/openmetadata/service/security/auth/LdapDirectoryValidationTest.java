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
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.unboundid.ldap.listener.InMemoryDirectoryServer;
import com.unboundid.ldap.listener.InMemoryDirectoryServerConfig;
import com.unboundid.ldap.listener.InMemoryListenerConfig;
import com.unboundid.ldap.sdk.LDAPException;
import com.unboundid.ldif.LDIFException;
import java.io.IOException;
import java.net.InetAddress;
import java.net.ServerSocket;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.auth.LdapConfiguration;
import org.openmetadata.schema.system.StepValidation;

/** Runs the Health Check page's LDAP entry against a real, in-process directory. */
class LdapDirectoryValidationTest {
  private static final String BASE_DN = "dc=example,dc=com";
  private static final String USERS_DN = "ou=users," + BASE_DN;
  private static final String LOOKUP_DN = "cn=Directory Manager";
  private static final String LOOKUP_PASSWORD = "lookup-password";
  private static final String LOOPBACK = InetAddress.getLoopbackAddress().getHostAddress();

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
    directory.add("dn: " + USERS_DN, "objectClass: organizationalUnit", "ou: users");
    directory.startListening();
  }

  @AfterAll
  static void stopDirectory() {
    directory.shutDown(true);
  }

  @Test
  void aReachableDirectoryThatAcceptsTheLookupAccountPasses() {
    StepValidation result = LdapDirectoryValidation.validate(ldap(LOOKUP_PASSWORD, USERS_DN));

    assertTrue(result.getPassed(), result.getMessage());
    assertTrue(result.getMessage().contains(LOOPBACK + ":" + directory.getListenPort()));
    assertTrue(result.getMessage().contains(USERS_DN));
  }

  @Test
  void aRejectedLookupAccountFailsAndNamesTheAccount() {
    StepValidation result =
        LdapDirectoryValidation.validate(ldap("not-the-lookup-password", USERS_DN));

    assertFalse(result.getPassed());
    assertTrue(
        result.getMessage().contains("rejected the lookup account '" + LOOKUP_DN + "'"),
        result.getMessage());
  }

  @Test
  void aMissingUserBaseDnFailsAndNamesTheDn() {
    String missingDn = "ou=nobody," + BASE_DN;

    StepValidation result = LdapDirectoryValidation.validate(ldap(LOOKUP_PASSWORD, missingDn));

    assertFalse(result.getPassed());
    assertTrue(
        result.getMessage().contains("user base DN '" + missingDn + "' does not exist"),
        result.getMessage());
  }

  @Test
  void aMalformedUserBaseDnFailsWithTheDirectorysReason() {
    String malformedDn = "not a dn";

    StepValidation result = LdapDirectoryValidation.validate(ldap(LOOKUP_PASSWORD, malformedDn));

    assertFalse(result.getPassed());
    assertTrue(
        result.getMessage().startsWith("Could not read the user base DN '" + malformedDn + "': "),
        result.getMessage());
  }

  @Test
  void anUnreachableDirectoryFailsAndNamesTheAddress() throws IOException {
    int closedPort;
    try (ServerSocket socket = new ServerSocket(0, 1, InetAddress.getLoopbackAddress())) {
      closedPort = socket.getLocalPort();
    }

    StepValidation result =
        LdapDirectoryValidation.validate(ldap(LOOKUP_PASSWORD, USERS_DN).withPort(closedPort));

    assertFalse(result.getPassed());
    assertEquals(
        "Could not connect to " + LOOPBACK + ":" + closedPort + ": Connection refused",
        result.getMessage());
  }

  private static LdapConfiguration ldap(String lookupPassword, String userBaseDn) {
    return new LdapConfiguration()
        .withHost(LOOPBACK)
        .withPort(directory.getListenPort())
        .withDnAdminPrincipal(LOOKUP_DN)
        .withDnAdminPassword(lookupPassword)
        .withUserBaseDN(userBaseDn)
        .withMailAttributeName("mail");
  }
}
