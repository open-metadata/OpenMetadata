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

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import jakarta.ws.rs.BadRequestException;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.api.security.AuthenticationConfiguration;
import org.openmetadata.schema.api.security.ClientType;
import org.openmetadata.schema.auth.LdapConfiguration;
import org.openmetadata.schema.security.client.OidcClientConfig;
import org.openmetadata.schema.services.connections.metadata.AuthProvider;

class ActiveProviderValidatorTest {

  @Test
  void ignoresAnIncompleteBlockOfAnInactiveProviderAndKeepsIt() {
    LdapConfiguration leftover = new LdapConfiguration().withHost("ldap.example.invalid");
    AuthenticationConfiguration saml =
        configuration(AuthProvider.SAML).withLdapConfiguration(leftover);

    assertDoesNotThrow(() -> ActiveProviderValidator.validate(saml, saml));

    assertSame(leftover, saml.getLdapConfiguration());
  }

  @Test
  void rejectsAnIncompleteBlockOfTheActiveProvider() {
    LdapConfiguration incomplete = new LdapConfiguration().withHost("ldap.example.invalid");
    AuthenticationConfiguration ldap =
        configuration(AuthProvider.LDAP).withLdapConfiguration(incomplete);

    BadRequestException rejected =
        assertThrows(BadRequestException.class, () -> ActiveProviderValidator.validate(ldap, ldap));

    assertTrue(rejected.getMessage().contains("Invalid security configuration"));
    assertSame(incomplete, ldap.getLdapConfiguration());
  }

  @Test
  void validatesTheOidcBlockOnlyForAConfidentialClient() {
    AuthenticationConfiguration publicClient =
        configuration(AuthProvider.GOOGLE)
            .withClientType(ClientType.PUBLIC)
            .withOidcConfiguration(new OidcClientConfig());
    AuthenticationConfiguration confidentialClient =
        configuration(AuthProvider.GOOGLE)
            .withClientType(ClientType.CONFIDENTIAL)
            .withOidcConfiguration(new OidcClientConfig());

    assertDoesNotThrow(() -> ActiveProviderValidator.validate(publicClient, publicClient));
    assertThrows(
        BadRequestException.class,
        () -> ActiveProviderValidator.validate(confidentialClient, confidentialClient));
  }

  @Test
  void stillRejectsAMissingProvider() {
    AuthenticationConfiguration withoutProvider = configuration(null);

    assertThrows(
        BadRequestException.class,
        () -> ActiveProviderValidator.validate(withoutProvider, withoutProvider));
  }

  private static AuthenticationConfiguration configuration(AuthProvider provider) {
    return new AuthenticationConfiguration().withProvider(provider).withProviderName("test");
  }
}
