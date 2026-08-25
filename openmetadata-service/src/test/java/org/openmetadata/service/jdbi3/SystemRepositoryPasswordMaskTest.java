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
package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.when;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.MockedStatic;
import org.openmetadata.schema.api.security.AuthenticationConfiguration;
import org.openmetadata.schema.auth.LdapConfiguration;
import org.openmetadata.schema.email.SmtpSettings;
import org.openmetadata.schema.security.client.OidcClientConfig;
import org.openmetadata.schema.settings.Settings;
import org.openmetadata.schema.settings.SettingsType;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.CollectionDAO.SystemDAO;
import org.openmetadata.service.migration.MigrationValidationClient;
import org.openmetadata.service.resources.settings.SettingsCache;
import org.openmetadata.service.secrets.masker.PasswordEntityMasker;

class SystemRepositoryPasswordMaskTest {

  private MockedStatic<Entity> entityMock;
  private MockedStatic<MigrationValidationClient> migrationMock;
  private MockedStatic<SettingsCache> settingsCacheMock;
  private SystemDAO systemDAO;
  private SystemRepository systemRepository;

  @BeforeEach
  void setup() {
    entityMock = mockStatic(Entity.class);
    migrationMock = mockStatic(MigrationValidationClient.class);
    settingsCacheMock = mockStatic(SettingsCache.class);

    CollectionDAO collectionDAO = mock(CollectionDAO.class);
    systemDAO = mock(SystemDAO.class);
    when(collectionDAO.systemDAO()).thenReturn(systemDAO);
    entityMock.when(Entity::getCollectionDAO).thenReturn(collectionDAO);
    migrationMock
        .when(MigrationValidationClient::getInstance)
        .thenReturn(mock(MigrationValidationClient.class));

    systemRepository = new SystemRepository();
  }

  @AfterEach
  void tearDown() {
    settingsCacheMock.close();
    migrationMock.close();
    entityMock.close();
  }

  // ── Email / SMTP tests ────────────────────────────────────────────────────

  @Test
  void testEmailPasswordMaskIsRestoredOnUpdate() {
    String realPassword = "real-smtp-password";
    SmtpSettings storedConfig = smtpSettingsWithPassword(realPassword);
    when(systemDAO.getConfigWithKey(SettingsType.EMAIL_CONFIGURATION.value()))
        .thenReturn(settingsWithConfigValue(SettingsType.EMAIL_CONFIGURATION, storedConfig));

    ArgumentCaptor<String> jsonCaptor = ArgumentCaptor.forClass(String.class);
    when(systemDAO.insertSettings(anyString(), jsonCaptor.capture())).thenReturn(null);

    SmtpSettings incoming = smtpSettingsWithPassword(PasswordEntityMasker.PASSWORD_MASK);
    systemRepository.updateSetting(
        settingsWithConfigValue(SettingsType.EMAIL_CONFIGURATION, incoming));

    String storedJson = jsonCaptor.getValue();
    assertNotNull(storedJson, "JSON must be stored");
    assertFalse(
        storedJson.contains(PasswordEntityMasker.PASSWORD_MASK),
        "Stored JSON must not contain the mask '" + PasswordEntityMasker.PASSWORD_MASK + "'");
  }

  @Test
  void testEmailNewPasswordIsStoredAsProvided() {
    String newPassword = "brand-new-smtp-password";
    when(systemDAO.getConfigWithKey(SettingsType.EMAIL_CONFIGURATION.value())).thenReturn(null);

    ArgumentCaptor<String> jsonCaptor = ArgumentCaptor.forClass(String.class);
    when(systemDAO.insertSettings(anyString(), jsonCaptor.capture())).thenReturn(null);

    SmtpSettings incoming = smtpSettingsWithPassword(newPassword);
    systemRepository.updateSetting(
        settingsWithConfigValue(SettingsType.EMAIL_CONFIGURATION, incoming));

    String storedJson = jsonCaptor.getValue();
    assertNotNull(storedJson);
    assertFalse(
        storedJson.contains(PasswordEntityMasker.PASSWORD_MASK),
        "Stored JSON must not contain the mask when user typed a real password");
  }

  @Test
  void testEmailMaskedPasswordWithNoStoredConfigDoesNotThrow() {
    when(systemDAO.getConfigWithKey(SettingsType.EMAIL_CONFIGURATION.value())).thenReturn(null);
    when(systemDAO.insertSettings(anyString(), anyString())).thenReturn(null);

    SmtpSettings incoming = smtpSettingsWithPassword(PasswordEntityMasker.PASSWORD_MASK);
    systemRepository.updateSetting(
        settingsWithConfigValue(SettingsType.EMAIL_CONFIGURATION, incoming));
  }

  // ── Authentication / LDAP tests ───────────────────────────────────────────

  @Test
  void testLdapPasswordMaskIsRestoredOnUpdate() {
    String realLdapPassword = "real-ldap-admin-password";
    AuthenticationConfiguration storedAuth = authConfigWithLdapPassword(realLdapPassword);
    when(systemDAO.getConfigWithKey(SettingsType.AUTHENTICATION_CONFIGURATION.value()))
        .thenReturn(
            settingsWithConfigValue(SettingsType.AUTHENTICATION_CONFIGURATION, storedAuth));

    ArgumentCaptor<String> jsonCaptor = ArgumentCaptor.forClass(String.class);
    when(systemDAO.insertSettings(
            eq(SettingsType.AUTHENTICATION_CONFIGURATION.value()), jsonCaptor.capture()))
        .thenReturn(null);

    AuthenticationConfiguration incoming =
        authConfigWithLdapPassword(PasswordEntityMasker.PASSWORD_MASK);
    systemRepository.updateSetting(
        settingsWithConfigValue(SettingsType.AUTHENTICATION_CONFIGURATION, incoming));

    String storedJson = jsonCaptor.getValue();
    assertNotNull(storedJson);
    assertFalse(
        storedJson.contains(PasswordEntityMasker.PASSWORD_MASK),
        "Stored JSON must not contain the mask for LDAP admin password");
  }

  @Test
  void testLdapPasswordMaskWithNoStoredConfigDoesNotThrow() {
    when(systemDAO.getConfigWithKey(SettingsType.AUTHENTICATION_CONFIGURATION.value()))
        .thenReturn(null);
    when(systemDAO.insertSettings(anyString(), anyString())).thenReturn(null);

    AuthenticationConfiguration incoming =
        authConfigWithLdapPassword(PasswordEntityMasker.PASSWORD_MASK);
    systemRepository.updateSetting(
        settingsWithConfigValue(SettingsType.AUTHENTICATION_CONFIGURATION, incoming));
  }

  // ── Authentication / OIDC tests ───────────────────────────────────────────

  @Test
  void testOidcSecretMaskIsRestoredOnUpdate() {
    String realSecret = "real-oidc-client-secret";
    AuthenticationConfiguration storedAuth = authConfigWithOidcSecret(realSecret);
    when(systemDAO.getConfigWithKey(SettingsType.AUTHENTICATION_CONFIGURATION.value()))
        .thenReturn(
            settingsWithConfigValue(SettingsType.AUTHENTICATION_CONFIGURATION, storedAuth));

    ArgumentCaptor<String> jsonCaptor = ArgumentCaptor.forClass(String.class);
    when(systemDAO.insertSettings(
            eq(SettingsType.AUTHENTICATION_CONFIGURATION.value()), jsonCaptor.capture()))
        .thenReturn(null);

    AuthenticationConfiguration incoming =
        authConfigWithOidcSecret(PasswordEntityMasker.PASSWORD_MASK);
    systemRepository.updateSetting(
        settingsWithConfigValue(SettingsType.AUTHENTICATION_CONFIGURATION, incoming));

    String storedJson = jsonCaptor.getValue();
    assertNotNull(storedJson);
    assertFalse(
        storedJson.contains(PasswordEntityMasker.PASSWORD_MASK),
        "Stored JSON must not contain the mask for OIDC client secret");
  }

  @Test
  void testOidcSecretMaskWithNoStoredConfigDoesNotThrow() {
    when(systemDAO.getConfigWithKey(SettingsType.AUTHENTICATION_CONFIGURATION.value()))
        .thenReturn(null);
    when(systemDAO.insertSettings(anyString(), anyString())).thenReturn(null);

    AuthenticationConfiguration incoming =
        authConfigWithOidcSecret(PasswordEntityMasker.PASSWORD_MASK);
    systemRepository.updateSetting(
        settingsWithConfigValue(SettingsType.AUTHENTICATION_CONFIGURATION, incoming));
  }

  // ── prepareFetchedSettings masking tests ──────────────────────────────────

  @Test
  void testLdapPasswordIsMaskedInFetchedSettings() {
    String realLdapPassword = "real-ldap-admin-password";
    AuthenticationConfiguration authConfig = authConfigWithLdapPassword(realLdapPassword);
    Settings settings =
        settingsWithConfigValue(SettingsType.AUTHENTICATION_CONFIGURATION, authConfig);
    when(systemDAO.getConfigWithKey(SettingsType.AUTHENTICATION_CONFIGURATION.value()))
        .thenReturn(settings);

    Settings fetched =
        systemRepository.getConfigWithKey(SettingsType.AUTHENTICATION_CONFIGURATION.value());

    assertNotNull(fetched);
    AuthenticationConfiguration fetchedAuth =
        JsonUtils.convertValue(fetched.getConfigValue(), AuthenticationConfiguration.class);
    assertNotNull(fetchedAuth.getLdapConfiguration());
    org.junit.jupiter.api.Assertions.assertEquals(
        PasswordEntityMasker.PASSWORD_MASK,
        fetchedAuth.getLdapConfiguration().getDnAdminPassword(),
        "Fetched LDAP admin password must be masked");
  }

  @Test
  void testOidcSecretIsMaskedInFetchedSettings() {
    String realSecret = "real-oidc-client-secret";
    AuthenticationConfiguration authConfig = authConfigWithOidcSecret(realSecret);
    Settings settings =
        settingsWithConfigValue(SettingsType.AUTHENTICATION_CONFIGURATION, authConfig);
    when(systemDAO.getConfigWithKey(SettingsType.AUTHENTICATION_CONFIGURATION.value()))
        .thenReturn(settings);

    Settings fetched =
        systemRepository.getConfigWithKey(SettingsType.AUTHENTICATION_CONFIGURATION.value());

    assertNotNull(fetched);
    AuthenticationConfiguration fetchedAuth =
        JsonUtils.convertValue(fetched.getConfigValue(), AuthenticationConfiguration.class);
    assertNotNull(fetchedAuth.getOidcConfiguration());
    org.junit.jupiter.api.Assertions.assertEquals(
        PasswordEntityMasker.PASSWORD_MASK,
        fetchedAuth.getOidcConfiguration().getSecret(),
        "Fetched OIDC client secret must be masked");
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private static SmtpSettings smtpSettingsWithPassword(String password) {
    return new SmtpSettings()
        .withPassword(password)
        .withSenderMail("test@example.com")
        .withServerEndpoint("smtp.example.com")
        .withServerPort(587)
        .withTransportationStrategy(SmtpSettings.TransportationStrategy.SMTP_TLS);
  }

  private static AuthenticationConfiguration authConfigWithLdapPassword(String dnAdminPassword) {
    LdapConfiguration ldapConfig =
        new LdapConfiguration()
            .withHost("ldap.example.com")
            .withPort(389)
            .withDnAdminPrincipal("cn=admin,dc=example,dc=com")
            .withDnAdminPassword(dnAdminPassword)
            .withUserBaseDN("ou=users,dc=example,dc=com")
            .withMailAttributeName("mail");
    return new AuthenticationConfiguration()
        .withProvider(
            org.openmetadata.schema.services.connections.metadata.AuthProvider.LDAP)
        .withProviderName("ldap")
        .withJwtPrincipalClaims(java.util.List.of("email"))
        .withLdapConfiguration(ldapConfig);
  }

  private static AuthenticationConfiguration authConfigWithOidcSecret(String secret) {
    OidcClientConfig oidcConfig = new OidcClientConfig().withSecret(secret);
    return new AuthenticationConfiguration()
        .withProvider(
            org.openmetadata.schema.services.connections.metadata.AuthProvider.GOOGLE)
        .withProviderName("google")
        .withJwtPrincipalClaims(java.util.List.of("email"))
        .withOidcConfiguration(oidcConfig);
  }

  private static Settings settingsWithConfigValue(SettingsType type, Object configValue) {
    return new Settings().withConfigType(type).withConfigValue(configValue);
  }
}
