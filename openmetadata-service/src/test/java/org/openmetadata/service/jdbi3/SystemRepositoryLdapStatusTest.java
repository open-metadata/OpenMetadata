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
package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertNotNull;

import java.io.IOException;
import java.net.InetAddress;
import java.net.ServerSocket;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.api.security.AuthenticationConfiguration;
import org.openmetadata.schema.auth.LdapConfiguration;
import org.openmetadata.schema.services.connections.metadata.AuthProvider;
import org.openmetadata.schema.system.StepValidation;
import org.openmetadata.schema.system.ValidationResponse;

/** The Health Check page reports on the LDAP directory only when LDAP is the login provider. */
class SystemRepositoryLdapStatusTest {
  private static final String LDAP_KEY = "LDAP";

  @Test
  void theStatusReportsOnTheDirectoryWhenLdapIsTheProvider() throws IOException {
    ValidationResponse validation = new ValidationResponse();

    SystemRepository.addLdapValidation(validation, withProvider(AuthProvider.LDAP));

    StepValidation ldapEntry =
        assertInstanceOf(StepValidation.class, validation.getAdditionalProperties().get(LDAP_KEY));
    assertFalse(ldapEntry.getPassed(), "nothing listens on the configured port");
    assertNotNull(ldapEntry.getDescription());
  }

  @Test
  void theStatusSaysNothingAboutLdapUnderAnotherProvider() throws IOException {
    ValidationResponse validation = new ValidationResponse();

    // Switching away from LDAP can leave its settings saved; they must not bring the entry back.
    SystemRepository.addLdapValidation(validation, withProvider(AuthProvider.BASIC));
    SystemRepository.addLdapValidation(validation, null);

    assertFalse(validation.getAdditionalProperties().containsKey(LDAP_KEY));
  }

  private static AuthenticationConfiguration withProvider(AuthProvider provider)
      throws IOException {
    return new AuthenticationConfiguration()
        .withProvider(provider)
        .withLdapConfiguration(
            new LdapConfiguration()
                .withHost(InetAddress.getLoopbackAddress().getHostAddress())
                .withPort(closedLoopbackPort())
                .withDnAdminPrincipal("cn=lookup")
                .withDnAdminPassword("lookup-password")
                .withUserBaseDN("ou=users,dc=example,dc=com")
                .withMailAttributeName("mail"));
  }

  private static int closedLoopbackPort() throws IOException {
    try (ServerSocket socket = new ServerSocket(0, 1, InetAddress.getLoopbackAddress())) {
      return socket.getLocalPort();
    }
  }
}
