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
package org.openmetadata.service.resources.system;

import static org.junit.jupiter.api.Assertions.assertEquals;

import org.junit.jupiter.api.Test;
import org.openmetadata.schema.api.security.AuthenticationConfiguration;
import org.openmetadata.schema.auth.LdapConfiguration;
import org.openmetadata.schema.configuration.SecurityConfiguration;
import org.openmetadata.schema.security.client.OidcClientConfig;
import org.openmetadata.service.secrets.masker.PasswordEntityMasker;

class SystemResourceSecurityConfigTest {
  private static final String OIDC_SECRET = "oidc-secret";
  private static final String LDAP_PASSWORD = "ldap-password";

  @Test
  void preservesMaskedOidcAndLdapSecrets() {
    SecurityConfiguration original = securityConfiguration(OIDC_SECRET, LDAP_PASSWORD);
    SecurityConfiguration updated =
        securityConfiguration(
            PasswordEntityMasker.PASSWORD_MASK, PasswordEntityMasker.PASSWORD_MASK);

    SystemResource.preserveMaskedSecuritySecrets(updated, original);

    assertEquals(OIDC_SECRET, oidcSecret(updated));
    assertEquals(LDAP_PASSWORD, ldapPassword(updated));
  }

  @Test
  void keepsReplacementOidcAndLdapSecrets() {
    SecurityConfiguration original = securityConfiguration(OIDC_SECRET, LDAP_PASSWORD);
    SecurityConfiguration updated = securityConfiguration("new-oidc-secret", "new-ldap-password");

    SystemResource.preserveMaskedSecuritySecrets(updated, original);

    assertEquals("new-oidc-secret", oidcSecret(updated));
    assertEquals("new-ldap-password", ldapPassword(updated));
  }

  private SecurityConfiguration securityConfiguration(String oidcSecret, String ldapPassword) {
    AuthenticationConfiguration authentication =
        new AuthenticationConfiguration()
            .withOidcConfiguration(new OidcClientConfig().withSecret(oidcSecret))
            .withLdapConfiguration(new LdapConfiguration().withDnAdminPassword(ldapPassword));
    return new SecurityConfiguration().withAuthenticationConfiguration(authentication);
  }

  private String oidcSecret(SecurityConfiguration configuration) {
    return configuration.getAuthenticationConfiguration().getOidcConfiguration().getSecret();
  }

  private String ldapPassword(SecurityConfiguration configuration) {
    return configuration
        .getAuthenticationConfiguration()
        .getLdapConfiguration()
        .getDnAdminPassword();
  }
}
