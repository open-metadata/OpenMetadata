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
package org.openmetadata.service.util;

import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.unboundid.ldap.sdk.LDAPConnectionOptions;
import java.util.Locale;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.auth.LdapConfiguration;
import org.openmetadata.schema.auth.ldapTrustStoreConfig.TrustAllConfig;
import org.openmetadata.schema.auth.ldapTrustStoreConfig.TruststoreConfig;

class LdapUtilTest {

  @Test
  void sslWithoutATrustStoreTypeIsRefusedWithTheReason() {
    LdapConfiguration ldaps = new LdapConfiguration().withSslEnabled(true);

    IllegalArgumentException refused =
        assertThrows(
            IllegalArgumentException.class,
            () -> new LdapUtil().getLdapSSLConnection(ldaps, new LDAPConnectionOptions()));

    assertTrue(
        refused.getMessage().toLowerCase(Locale.ROOT).contains("trust store"),
        refused.getMessage());
  }

  @Test
  void aTrustStoreTypeWithoutItsSettingsIsRefusedWithTheReason() {
    LdapConfiguration ldaps =
        new LdapConfiguration()
            .withSslEnabled(true)
            .withTruststoreConfigType(LdapConfiguration.TruststoreConfigType.TRUST_ALL)
            .withTrustStoreConfig(new TruststoreConfig());

    IllegalArgumentException refused =
        assertThrows(
            IllegalArgumentException.class,
            () -> new LdapUtil().getLdapSSLConnection(ldaps, new LDAPConnectionOptions()));

    assertTrue(refused.getMessage().contains("trust store settings"), refused.getMessage());
  }

  @Test
  void aCompleteTrustStoreBuildsATrustManager() {
    LdapConfiguration ldaps =
        new LdapConfiguration()
            .withSslEnabled(true)
            .withTruststoreConfigType(LdapConfiguration.TruststoreConfigType.TRUST_ALL)
            .withTrustStoreConfig(
                new TruststoreConfig()
                    .withTrustAllConfig(new TrustAllConfig().withExamineValidityDates(true)));

    assertNotNull(new LdapUtil().getLdapSSLConnection(ldaps, new LDAPConnectionOptions()));
  }
}
