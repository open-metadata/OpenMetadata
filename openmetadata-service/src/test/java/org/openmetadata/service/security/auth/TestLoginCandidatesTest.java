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
import org.openmetadata.catalog.security.client.SamlSSOClientConfig;
import org.openmetadata.catalog.type.IdentityProviderConfig;
import org.openmetadata.catalog.type.SamlSecurityConfig;
import org.openmetadata.catalog.type.ServiceProviderConfig;
import org.openmetadata.schema.api.security.AuthenticationConfiguration;
import org.openmetadata.schema.auth.LdapConfiguration;
import org.openmetadata.schema.auth.ldapTrustStoreConfig.CustomTrustManagerConfig;
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

  @Test
  void restoresTheTrustStorePasswordAndThenTheBindPasswordForTheSameTrustStore() {
    // The bind check compares the whole trust store setup, so a masked trust store password must
    // be restored first or the bind password is never restored either.
    SecurityConfiguration live =
        ldap(
            withCustomTrustStore(
                ldapBind("ldap.example.com", LIVE_BIND_PASSWORD), "/certs/ldap.jks", "store-pass"));

    SecurityConfiguration restored =
        TestLoginCandidates.withLiveSecretsRestored(
            ldap(withCustomTrustStore(ldapBind("ldap.example.com", MASK), "/certs/ldap.jks", MASK)),
            live);

    assertEquals("store-pass", trustStorePasswordOf(restored));
    assertEquals(LIVE_BIND_PASSWORD, bindPasswordOf(restored));
  }

  @Test
  void keepsTheTrustStorePasswordMaskedForAnotherTrustStoreFile() {
    SecurityConfiguration live =
        ldap(
            withCustomTrustStore(
                ldapBind("ldap.example.com", LIVE_BIND_PASSWORD), "/certs/ldap.jks", "store-pass"));

    SecurityConfiguration restored =
        TestLoginCandidates.withLiveSecretsRestored(
            ldap(withCustomTrustStore(ldapBind("ldap.example.com", MASK), "/tmp/other.jks", MASK)),
            live);

    assertEquals(MASK, trustStorePasswordOf(restored));
    assertEquals(MASK, bindPasswordOf(restored));
  }

  @Test
  void restoresTheSamlPrivateKeyAndKeyStorePasswordOnlyForTheSameProviders() {
    SecurityConfiguration live = saml(samlConfig("https://idp.example.com", "live-key", "ks-pass"));

    SecurityConfiguration sameIdp =
        TestLoginCandidates.withLiveSecretsRestored(
            saml(samlConfig("https://idp.example.com", MASK, MASK)), live);
    SecurityConfiguration otherIdp =
        TestLoginCandidates.withLiveSecretsRestored(
            saml(samlConfig("https://idp.attacker.net", MASK, MASK)), live);

    assertEquals("live-key", samlOf(sameIdp).getSp().getSpPrivateKey());
    assertEquals("ks-pass", samlOf(sameIdp).getSecurity().getKeyStorePassword());
    assertEquals(MASK, samlOf(otherIdp).getSp().getSpPrivateKey());
    assertEquals(MASK, samlOf(otherIdp).getSecurity().getKeyStorePassword());
  }

  private static LdapConfiguration withCustomTrustStore(
      LdapConfiguration ldap, String path, String password) {
    return ldap.withTruststoreConfigType(LdapConfiguration.TruststoreConfigType.CUSTOM_TRUST_STORE)
        .withTrustStoreConfig(
            new TruststoreConfig()
                .withCustomTrustManagerConfig(
                    new CustomTrustManagerConfig()
                        .withTrustStoreFilePath(path)
                        .withTrustStoreFilePassword(password)
                        .withTrustStoreFileFormat("JKS")));
  }

  private static SamlSSOClientConfig samlConfig(
      String idpEntityId, String privateKey, String keyStorePassword) {
    return new SamlSSOClientConfig()
        .withIdp(
            new IdentityProviderConfig()
                .withEntityId(idpEntityId)
                .withSsoLoginUrl(idpEntityId + "/sso"))
        .withSp(
            new ServiceProviderConfig()
                .withEntityId("https://om.example.com/api/v1/saml/metadata")
                .withSpPrivateKey(privateKey))
        .withSecurity(
            new SamlSecurityConfig()
                .withKeyStoreFilePath("/certs/saml.jks")
                .withKeyStoreAlias("om")
                .withKeyStorePassword(keyStorePassword));
  }

  private static SecurityConfiguration saml(SamlSSOClientConfig samlConfiguration) {
    return new SecurityConfiguration()
        .withAuthenticationConfiguration(
            new AuthenticationConfiguration().withSamlConfiguration(samlConfiguration));
  }

  private static SamlSSOClientConfig samlOf(SecurityConfiguration config) {
    return config.getAuthenticationConfiguration().getSamlConfiguration();
  }

  private static String trustStorePasswordOf(SecurityConfiguration config) {
    return config
        .getAuthenticationConfiguration()
        .getLdapConfiguration()
        .getTrustStoreConfig()
        .getCustomTrustManagerConfig()
        .getTrustStoreFilePassword();
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
