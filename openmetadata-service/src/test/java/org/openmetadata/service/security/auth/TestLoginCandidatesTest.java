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

import java.util.List;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.api.security.AuthenticationConfiguration;
import org.openmetadata.schema.auth.LdapConfiguration;
import org.openmetadata.schema.auth.ldapTrustStoreConfig.HostNameConfig;
import org.openmetadata.schema.auth.ldapTrustStoreConfig.TruststoreConfig;
import org.openmetadata.schema.configuration.SecurityConfiguration;
import org.openmetadata.schema.security.client.OidcClientConfig;
import org.openmetadata.service.secrets.masker.PasswordEntityMasker;

class TestLoginCandidatesTest {
  private static final String MASK = PasswordEntityMasker.PASSWORD_MASK;
  private static final String LIVE_SECRET = "live-client-secret";
  private static final String LIVE_BIND_PASSWORD = "live-bind-password";
  private static final String DISCOVERY =
      "https://idp.example.com/.well-known/openid-configuration";

  @Test
  void restoresAMaskedSecretForTheSameClientAtTheSameProvider() {
    SecurityConfiguration restored =
        TestLoginCandidates.withLiveSecretsRestored(
            oidc(oidcClient(MASK, DISCOVERY)), oidc(oidcClient(LIVE_SECRET, DISCOVERY)));

    assertEquals(LIVE_SECRET, secretOf(restored));
  }

  @Test
  void keepsTheMaskWhenTheCandidatePointsAtAnotherProvider() {
    // Otherwise an admin who cannot read the secret could aim a test at a token endpoint they
    // control and have the server send it there.
    SecurityConfiguration restored =
        TestLoginCandidates.withLiveSecretsRestored(
            oidc(oidcClient(MASK, "https://attacker.example.net/.well-known/openid-configuration")),
            oidc(oidcClient(LIVE_SECRET, DISCOVERY)));

    assertEquals(MASK, secretOf(restored));
  }

  @Test
  void keepsASecretTheAdminTypedIn() {
    SecurityConfiguration restored =
        TestLoginCandidates.withLiveSecretsRestored(
            oidc(oidcClient("a-new-secret", DISCOVERY)), oidc(oidcClient(LIVE_SECRET, DISCOVERY)));

    assertEquals("a-new-secret", secretOf(restored));
  }

  @Test
  void restoresTheBindPasswordOnlyForTheSameBindOnTheSameServer() {
    SecurityConfiguration live = ldap(ldapBind("ldap.example.com", LIVE_BIND_PASSWORD));

    SecurityConfiguration sameServer =
        TestLoginCandidates.withLiveSecretsRestored(ldap(ldapBind("ldap.example.com", MASK)), live);
    SecurityConfiguration otherServer =
        TestLoginCandidates.withLiveSecretsRestored(
            ldap(ldapBind("ldap.attacker.net", MASK)), live);

    assertEquals(LIVE_BIND_PASSWORD, bindPasswordOf(sameServer));
    assertEquals(MASK, bindPasswordOf(otherServer));
  }

  @Test
  void keepsTheBindPasswordMaskedWhenTheCandidateRelaxesCertificateChecks() {
    SecurityConfiguration live =
        ldap(
            withTrustedHosts(ldapBind("ldap.example.com", LIVE_BIND_PASSWORD), "ldap.example.com"));

    SecurityConfiguration unchanged =
        TestLoginCandidates.withLiveSecretsRestored(
            ldap(withTrustedHosts(ldapBind("ldap.example.com", MASK), "ldap.example.com")), live);
    SecurityConfiguration interceptable =
        TestLoginCandidates.withLiveSecretsRestored(
            ldap(withTrustedHosts(ldapBind("ldap.example.com", MASK), "*.attacker.net")), live);

    assertEquals(LIVE_BIND_PASSWORD, bindPasswordOf(unchanged));
    assertEquals(MASK, bindPasswordOf(interceptable));
  }

  @Test
  void neverMutatesTheCandidateItWasGiven() {
    SecurityConfiguration candidate = oidc(oidcClient(MASK, DISCOVERY));

    TestLoginCandidates.withLiveSecretsRestored(
        candidate, oidc(oidcClient(LIVE_SECRET, DISCOVERY)));

    assertEquals(MASK, secretOf(candidate));
  }

  private static OidcClientConfig oidcClient(String secret, String discoveryUri) {
    return new OidcClientConfig()
        .withId("client-id")
        .withSecret(secret)
        .withDiscoveryUri(discoveryUri);
  }

  private static LdapConfiguration ldapBind(String host, String password) {
    return new LdapConfiguration()
        .withHost(host)
        .withPort(636)
        .withDnAdminPrincipal("cn=admin,dc=example,dc=com")
        .withDnAdminPassword(password)
        .withSslEnabled(true);
  }

  private static LdapConfiguration withTrustedHosts(LdapConfiguration ldap, String hostName) {
    return ldap.withTruststoreConfigType(LdapConfiguration.TruststoreConfigType.HOST_NAME)
        .withTrustStoreConfig(
            new TruststoreConfig()
                .withHostNameConfig(
                    new HostNameConfig()
                        .withAllowWildCards(true)
                        .withAcceptableHostNames(List.of(hostName))));
  }

  private static SecurityConfiguration oidc(OidcClientConfig client) {
    return new SecurityConfiguration()
        .withAuthenticationConfiguration(
            new AuthenticationConfiguration().withOidcConfiguration(client));
  }

  private static SecurityConfiguration ldap(LdapConfiguration ldapConfiguration) {
    return new SecurityConfiguration()
        .withAuthenticationConfiguration(
            new AuthenticationConfiguration().withLdapConfiguration(ldapConfiguration));
  }

  private static String secretOf(SecurityConfiguration config) {
    return config.getAuthenticationConfiguration().getOidcConfiguration().getSecret();
  }

  private static String bindPasswordOf(SecurityConfiguration config) {
    return config.getAuthenticationConfiguration().getLdapConfiguration().getDnAdminPassword();
  }
}
