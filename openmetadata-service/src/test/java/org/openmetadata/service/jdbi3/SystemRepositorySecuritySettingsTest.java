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

package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.CALLS_REAL_METHODS;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.doCallRealMethod;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.when;
import static org.openmetadata.schema.settings.SettingsType.AUTHENTICATION_CONFIGURATION;
import static org.openmetadata.schema.settings.SettingsType.AUTHORIZER_CONFIGURATION;

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.ws.rs.BadRequestException;
import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.Function;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.catalog.security.client.SamlSSOClientConfig;
import org.openmetadata.catalog.type.IdentityProviderConfig;
import org.openmetadata.catalog.type.ServiceProviderConfig;
import org.openmetadata.schema.api.configuration.OpenMetadataBaseUrlConfiguration;
import org.openmetadata.schema.api.security.AuthenticationConfiguration;
import org.openmetadata.schema.api.security.AuthorizerConfiguration;
import org.openmetadata.schema.api.security.ClientType;
import org.openmetadata.schema.configuration.ConfigSourceConfiguration;
import org.openmetadata.schema.configuration.ConfigSourceMode;
import org.openmetadata.schema.configuration.SecurityConfiguration;
import org.openmetadata.schema.security.client.OidcClientConfig;
import org.openmetadata.schema.services.connections.metadata.AuthProvider;
import org.openmetadata.schema.settings.Settings;
import org.openmetadata.schema.settings.SettingsType;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.config.source.ConfigSources;
import org.openmetadata.service.config.source.DeploymentConfig;
import org.openmetadata.service.config.source.DeploymentSetting;
import org.openmetadata.service.config.source.DeploymentTemplate;
import org.openmetadata.service.config.source.DualSourceSetting;
import org.openmetadata.service.config.source.SettingsSecrets;
import org.openmetadata.service.exception.PreconditionFailedException;
import org.openmetadata.service.exception.SettingsManagedByEnvironmentException;
import org.openmetadata.service.exception.SystemSettingsException;
import org.openmetadata.service.fernet.Fernet;
import org.openmetadata.service.jdbi3.SystemTokenDAOs.SystemDAO;
import org.openmetadata.service.migration.MigrationValidationClient;
import org.openmetadata.service.resources.settings.SettingsCache;
import org.openmetadata.service.util.ValidationHttpUtil;
import org.openmetadata.service.util.ValidationHttpUtil.HttpResponseData;

class SystemRepositorySecuritySettingsTest {
  private static final String KEY = "GhtAEzEb5WD6bTLvwa24JA6ePHxfVLDjb8X4hMShmVY=";
  private static final String AUTH = AUTHENTICATION_CONFIGURATION.value();
  private static final String AUTHZ = AUTHORIZER_CONFIGURATION.value();
  private static final String SECRET = "oidc-s3cret";
  private static final String IDP_CERTIFICATE = resource("/saml/mock-idp.crt");
  private static final String NOT_A_CERTIFICATE =
      "-----BEGIN CERTIFICATE-----\nnot-a-certificate\n-----END CERTIFICATE-----";
  private static final String OTHER_IDP_CERTIFICATE = resource("/saml/other-idp.crt");
  private static final String EXPIRED_IDP_CERTIFICATE = resource("/saml/expired-idp.crt");
  private static final String CERTIFICATE_FIELD = "samlConfiguration.idp.idpX509Certificate";
  private static final String PEM_BEGIN = "-----BEGIN CERTIFICATE-----";
  private static final String PEM_END = "-----END CERTIFICATE-----";

  private final Map<String, String> rows = new ConcurrentHashMap<>();
  private MockedStatic<Entity> entityMock;
  private MockedStatic<MigrationValidationClient> migrationMock;
  private MockedStatic<SettingsCache> settingsCacheMock;
  private SystemRepository repository;

  @BeforeEach
  void setUp() {
    Fernet.getInstance().setFernetKey(KEY);
    entityMock = mockStatic(Entity.class);
    migrationMock = mockStatic(MigrationValidationClient.class);
    settingsCacheMock = mockStatic(SettingsCache.class);
    CollectionDAO collectionDAO = mock(CollectionDAO.class);
    SystemDAO dao = inMemoryDao();
    when(collectionDAO.systemDAO()).thenReturn(dao);
    entityMock.when(Entity::getCollectionDAO).thenReturn(collectionDAO);
    migrationMock
        .when(MigrationValidationClient::getInstance)
        .thenReturn(mock(MigrationValidationClient.class));
    repository = new SystemRepository();
  }

  @AfterEach
  void tearDown() {
    ConfigSources.install(null);
    settingsCacheMock.close();
    migrationMock.close();
    entityMock.close();
  }

  @Test
  void storesAuthenticationSecretsEncryptedAndReadsThemBackInClear() {
    repository.createOrUpdate(authenticationSettings(authentication(5)));
    rows.put(AUTHZ, JsonUtils.pojoToJson(authorizer()));

    String storedSecret =
        JsonUtils.readTree(rows.get(AUTH)).at("/oidcConfiguration/secret").asText();
    StoredSecurityConfiguration stored = repository.getStoredSecurityConfiguration();

    assertTrue(Fernet.isTokenized(storedSecret));
    assertEquals(
        SECRET,
        stored.configuration().getAuthenticationConfiguration().getOidcConfiguration().getSecret());
    assertEquals(rows.get(AUTH), stored.authenticationJson());
  }

  @Test
  void reportsNoStoredSecurityConfigurationWhileARowIsMissing() {
    repository.createOrUpdate(authenticationSettings(authentication(5)));

    assertNull(repository.getStoredSecurityConfiguration());
  }

  /** In ENV mode the deployment owns publicKeyUrls; replacing them made every save a 409. */
  @Test
  void discoveryKeepsPublicKeyUrlsTheDeploymentOwns() throws Exception {
    String idpKeys = "https://idp.example/jwks";
    try (MockedStatic<ValidationHttpUtil> http =
        mockStatic(ValidationHttpUtil.class, CALLS_REAL_METHODS)) {
      http.when(() -> ValidationHttpUtil.safeGet(anyString()))
          .thenReturn(new HttpResponseData(200, "{\"jwks_uri\":\"" + idpKeys + "\"}"));
      AuthenticationConfiguration discovered = confidentialClient();
      repository.syncPublicKeyUrlsFromDiscovery(discovered);
      assertEquals(List.of(idpKeys), discovered.getPublicKeyUrls());

      List<String> deploymentKeys =
          List.of("http://localhost:8585/api/v1/system/config/jwks", idpKeys);
      AuthenticationConfiguration owned = confidentialClient().withPublicKeyUrls(deploymentKeys);
      try (AutoCloseable env =
          ConfigSources.overrideForTest(AUTHENTICATION_CONFIGURATION, ConfigSourceMode.ENV)) {
        repository.syncPublicKeyUrlsFromDiscovery(owned);
      }
      assertEquals(deploymentKeys, owned.getPublicKeyUrls());
    }
  }

  private static AuthenticationConfiguration confidentialClient() {
    return new AuthenticationConfiguration()
        .withProvider(AuthProvider.CUSTOM_OIDC)
        .withClientType(ClientType.CONFIDENTIAL)
        .withPublicKeyUrls(List.of("https://stale.example/jwks"))
        .withOidcConfiguration(
            new OidcClientConfig()
                .withId("om")
                .withDiscoveryUri("https://idp.example/.well-known/openid-configuration"));
  }

  @Test
  void refusesToWriteSecurityChangedSinceItWasRead() {
    repository.createOrUpdate(authenticationSettings(authentication(5)));
    rows.put(AUTHZ, JsonUtils.pojoToJson(authorizer()));
    StoredSecurityConfiguration read = repository.getStoredSecurityConfiguration();
    repository.createOrUpdate(authenticationSettings(authentication(6)));

    SecurityConfiguration update = securityWith(authentication(7));
    assertThrows(
        PreconditionFailedException.class,
        () -> repository.updateSecurityConfigurationIfCurrent(update, read));

    assertEquals(6, storedAuthentication().getMaxActiveSessionsPerUser());
  }

  @Test
  void writesSecurityUnchangedSinceItWasRead() {
    repository.createOrUpdate(authenticationSettings(authentication(5)));
    rows.put(AUTHZ, JsonUtils.pojoToJson(authorizer()));

    repository.updateSecurityConfigurationIfCurrent(
        securityWith(authentication(7)), repository.getStoredSecurityConfiguration());

    assertEquals(7, storedAuthentication().getMaxActiveSessionsPerUser());
  }

  /**
   * Secrets are encrypted afresh on every write, so only the JSON a write returns matches what it
   * stored: putting the previous configuration back compares with it and undoes only that write.
   */
  @Test
  void aWriteReturnsWhatItStoredSoItCanBePutBackOverExactlyThat() {
    repository.createOrUpdate(authenticationSettings(authentication(5)));
    rows.put(AUTHZ, JsonUtils.pojoToJson(authorizer()));
    StoredSecurityConfiguration before = repository.getStoredSecurityConfiguration();

    StoredSecurityConfiguration written =
        repository.updateSecurityConfigurationIfCurrent(securityWith(authentication(7)), before);

    assertEquals(rows.get(AUTH), written.authenticationJson());
    assertEquals(rows.get(AUTHZ), written.authorizerJson());
    repository.updateSecurityConfigurationIfCurrent(before.configuration(), written);
    assertEquals(5, storedAuthentication().getMaxActiveSessionsPerUser());
  }

  @Test
  void storingWithoutRowsToCompareWithWritesBothAndReturnsThem() {
    StoredSecurityConfiguration written =
        repository.storeSecurityConfiguration(securityWith(authentication(7)));

    assertEquals(rows.get(AUTH), written.authenticationJson());
    assertEquals(rows.get(AUTHZ), written.authorizerJson());
    assertEquals(7, storedAuthentication().getMaxActiveSessionsPerUser());
  }

  @Test
  void envModeRejectionsReachTheCallerInsteadOfAnErrorResponse() throws Exception {
    repository.createOrUpdate(authenticationSettings(authentication(5)));
    rows.put(AUTHZ, JsonUtils.pojoToJson(authorizer()));
    installAuthenticationDeployment();
    try (AutoCloseable env =
        ConfigSources.overrideForTest(AUTHENTICATION_CONFIGURATION, ConfigSourceMode.ENV)) {
      Settings managedFieldChange = authenticationSettings(authentication(9));
      assertThrows(
          SettingsManagedByEnvironmentException.class,
          () -> repository.createOrUpdate(managedFieldChange));
      assertThrows(
          SettingsManagedByEnvironmentException.class,
          () -> repository.createNewSetting(authenticationSettings(authentication(9))));
      assertThrows(
          SettingsManagedByEnvironmentException.class,
          () -> repository.assertSecurityConfigurationWritable(securityWith(authentication(9))));
    }
    assertEquals(5, storedAuthentication().getMaxActiveSessionsPerUser());
  }

  @Test
  void validatesAReconciledValueLikeAnApiWrite() {
    JsonNode invalidUrl =
        JsonUtils.valueToTree(new OpenMetadataBaseUrlConfiguration().withOpenMetadataUrl("nope"));

    assertThrows(
        SystemSettingsException.class,
        () ->
            repository.prepareReconciled(
                SettingsType.OPEN_METADATA_BASE_URL_CONFIGURATION, invalidUrl, null));
  }

  @Test
  void preparesReconciledAndSeededAuthenticationWithSecretsEncrypted() {
    JsonNode value = JsonUtils.valueToTree(authentication(5));

    for (String prepared :
        List.of(
            repository.prepareReconciled(AUTHENTICATION_CONFIGURATION, value, value),
            repository.prepareSeed(AUTHENTICATION_CONFIGURATION, value))) {
      assertTrue(
          Fernet.isTokenized(
              JsonUtils.readTree(prepared).at("/oidcConfiguration/secret").asText()));
    }
  }

  @Test
  void refusesAReconciledOrSeededIdpCertificateThatASaveWouldRefuse() {
    final JsonNode unusable = JsonUtils.valueToTree(saml(NOT_A_CERTIFICATE));
    final JsonNode usable = JsonUtils.valueToTree(saml(IDP_CERTIFICATE));

    final BadRequestException reconciled =
        assertThrows(
            BadRequestException.class,
            () -> repository.prepareReconciled(AUTHENTICATION_CONFIGURATION, unusable, usable));
    assertTrue(reconciled.getMessage().contains(CERTIFICATE_FIELD));
    assertThrows(
        BadRequestException.class,
        () -> repository.prepareSeed(AUTHENTICATION_CONFIGURATION, unusable));
  }

  @Test
  void preparesAUsableOrUnchangedIdpCertificate() {
    final JsonNode unusable = JsonUtils.valueToTree(saml(NOT_A_CERTIFICATE));
    final JsonNode usable = JsonUtils.valueToTree(saml(IDP_CERTIFICATE));

    assertDoesNotThrow(() -> repository.prepareSeed(AUTHENTICATION_CONFIGURATION, usable));
    assertDoesNotThrow(
        () -> repository.prepareReconciled(AUTHENTICATION_CONFIGURATION, usable, unusable));
    assertDoesNotThrow(
        () -> repository.prepareReconciled(AUTHENTICATION_CONFIGURATION, unusable, unusable));
  }

  /**
   * Every way that writes the authentication configuration, and the JSON it leaves to be stored.
   * They all pass the same step before the database, so they all check the IdP certificate.
   */
  private Map<String, Function<AuthenticationConfiguration, String>> writePaths() {
    final Map<String, Function<AuthenticationConfiguration, String>> paths = new LinkedHashMap<>();
    paths.put("createOrUpdate (update-security-config, settings API)", this::createOrUpdate);
    paths.put("createNewSetting (seeds)", this::createNewSetting);
    paths.put("updateSetting (seeding, migrations)", this::updateSetting);
    paths.put("replaceSettingIfCurrent (adopt-deployment-config)", this::replaceSettingIfCurrent);
    paths.put(
        "updateSecurityConfigurationIfCurrent (security PUT and PATCH)",
        this::updateSecurityConfigurationIfCurrent);
    paths.put(
        "storeSecurityConfiguration (security PUT and PATCH without a stored row)",
        this::storeSecurityConfiguration);
    paths.put("prepareReconciled (deployment reconcile)", this::prepareReconciled);
    return paths;
  }

  private String createOrUpdate(final AuthenticationConfiguration config) {
    return written(() -> repository.createOrUpdate(authenticationSettings(config)));
  }

  private String createNewSetting(final AuthenticationConfiguration config) {
    return written(() -> repository.createNewSetting(authenticationSettings(config)));
  }

  private String updateSetting(final AuthenticationConfiguration config) {
    return written(() -> repository.updateSetting(authenticationSettings(config)));
  }

  private String replaceSettingIfCurrent(final AuthenticationConfiguration config) {
    return written(
        () -> repository.replaceSettingIfCurrent(authenticationSettings(config), rows.get(AUTH)));
  }

  private String updateSecurityConfigurationIfCurrent(final AuthenticationConfiguration config) {
    return written(
        () ->
            repository.updateSecurityConfigurationIfCurrent(
                securityWith(config), repository.getStoredSecurityConfiguration()));
  }

  private String storeSecurityConfiguration(final AuthenticationConfiguration config) {
    return written(() -> repository.storeSecurityConfiguration(securityWith(config)));
  }

  /** The reconciler stores what this returns; it is checked against the decrypted stored row. */
  private String prepareReconciled(final AuthenticationConfiguration config) {
    return repository.prepareReconciled(
        AUTHENTICATION_CONFIGURATION,
        JsonUtils.valueToTree(config),
        SettingsSecrets.decrypted(
            AUTHENTICATION_CONFIGURATION, JsonUtils.readTree(rows.get(AUTH))));
  }

  private String written(final Runnable write) {
    write.run();
    return rows.get(AUTH);
  }

  private void storeSaml(final String idpCertificate) {
    rows.clear();
    rows.put(
        AUTH,
        JsonUtils.pojoToJson(
            SettingsSecrets.encrypted(
                AUTHENTICATION_CONFIGURATION, JsonUtils.valueToTree(saml(idpCertificate)))));
    rows.put(AUTHZ, JsonUtils.pojoToJson(authorizer()));
  }

  private static String certificateIn(final String storedJson) {
    return JsonUtils.readTree(storedJson).at("/samlConfiguration/idp/idpX509Certificate").asText();
  }

  @Test
  void everyWritePathRefusesANewUnusableCertificateAndKeepsTheStoredValue() {
    for (final Map.Entry<String, Function<AuthenticationConfiguration, String>> path :
        writePaths().entrySet()) {
      for (final String unusable : List.of(NOT_A_CERTIFICATE, EXPIRED_IDP_CERTIFICATE)) {
        storeSaml(IDP_CERTIFICATE);
        final String before = rows.get(AUTH);

        final BadRequestException refused =
            assertThrows(
                BadRequestException.class,
                () -> path.getValue().apply(saml(unusable)),
                path.getKey());

        assertTrue(refused.getMessage().contains(CERTIFICATE_FIELD), path.getKey());
        assertEquals(before, rows.get(AUTH), path.getKey());
      }
    }
  }

  /**
   * The layouts the server cannot read at startup, which the 2.0.10 migration rewrites in stored
   * rows, are refused when they come in as a new certificate.
   */
  @Test
  void everyWritePathRefusesANewCertificateInALayoutTheServerCannotRead() {
    for (final Map.Entry<String, Function<AuthenticationConfiguration, String>> path :
        writePaths().entrySet()) {
      for (final String oldLayout :
          List.of(singleLine(OTHER_IDP_CERTIFICATE), spacesForLineBreaks(OTHER_IDP_CERTIFICATE))) {
        storeSaml(IDP_CERTIFICATE);
        final String before = rows.get(AUTH);

        final BadRequestException refused =
            assertThrows(
                BadRequestException.class,
                () -> path.getValue().apply(saml(oldLayout)),
                path.getKey());

        assertEquals(400, refused.getResponse().getStatus(), path.getKey());
        assertTrue(refused.getMessage().contains(CERTIFICATE_FIELD), path.getKey());
        assertEquals(before, rows.get(AUTH), path.getKey());
      }
    }
  }

  @Test
  void everyWritePathAcceptsTheStoredExpiredCertificateUnchanged() {
    for (final Map.Entry<String, Function<AuthenticationConfiguration, String>> path :
        writePaths().entrySet()) {
      storeSaml(EXPIRED_IDP_CERTIFICATE);

      final String stored = path.getValue().apply(saml(EXPIRED_IDP_CERTIFICATE));

      assertEquals(EXPIRED_IDP_CERTIFICATE, certificateIn(stored), path.getKey());
    }
  }

  @Test
  void everyWritePathStoresAUsableNewCertificate() {
    for (final Map.Entry<String, Function<AuthenticationConfiguration, String>> path :
        writePaths().entrySet()) {
      storeSaml(IDP_CERTIFICATE);

      final String stored = path.getValue().apply(saml(OTHER_IDP_CERTIFICATE));

      assertEquals(OTHER_IDP_CERTIFICATE, certificateIn(stored), path.getKey());
    }
  }

  /** A first start has nothing stored, so the seed always checks the certificate. */
  @Test
  void aSeedChecksTheCertificate() {
    final JsonNode unusable = JsonUtils.valueToTree(saml(EXPIRED_IDP_CERTIFICATE));

    final BadRequestException refused =
        assertThrows(
            BadRequestException.class,
            () -> repository.prepareSeed(AUTHENTICATION_CONFIGURATION, unusable));

    assertTrue(refused.getMessage().contains(CERTIFICATE_FIELD));
    assertEquals(
        IDP_CERTIFICATE,
        certificateIn(
            repository.prepareSeed(
                AUTHENTICATION_CONFIGURATION, JsonUtils.valueToTree(saml(IDP_CERTIFICATE)))));
  }

  @Test
  void refusesToPrepareASettingThatOnlyLivesInTheDatabase() {
    JsonNode value = JsonUtils.readTree("{}");

    assertThrows(
        IllegalArgumentException.class,
        () -> repository.prepareSeed(SettingsType.SEARCH_SETTINGS, value));
  }

  private void installAuthenticationDeployment() {
    DeploymentTemplate template =
        DeploymentTemplate.parse(
            """
            authenticationConfiguration:
              maxActiveSessionsPerUser: ${AUTHENTICATION_MAX_ACTIVE_SESSIONS_PER_USER:-5}
            """,
            "/authenticationConfiguration");
    DeploymentSetting setting =
        new DeploymentSetting(
            DualSourceSetting.AUTHENTICATION, JsonUtils.valueToTree(authentication(5)), template);
    ConfigSources.install(DeploymentConfig.of(List.of(setting), new ConfigSourceConfiguration()));
  }

  private AuthenticationConfiguration storedAuthentication() {
    return repository
        .getStoredSecurityConfiguration()
        .configuration()
        .getAuthenticationConfiguration();
  }

  private static SecurityConfiguration securityWith(AuthenticationConfiguration authentication) {
    return new SecurityConfiguration()
        .withAuthenticationConfiguration(authentication)
        .withAuthorizerConfiguration(authorizer());
  }

  private static Settings authenticationSettings(AuthenticationConfiguration authentication) {
    return new Settings()
        .withConfigType(AUTHENTICATION_CONFIGURATION)
        .withConfigValue(authentication);
  }

  private static AuthenticationConfiguration saml(final String idpCertificate) {
    return new AuthenticationConfiguration()
        .withProvider(AuthProvider.SAML)
        .withProviderName("SAML")
        .withSamlConfiguration(
            new SamlSSOClientConfig()
                .withIdp(
                    new IdentityProviderConfig()
                        .withEntityId("https://idp.example.com/metadata")
                        .withSsoLoginUrl("https://idp.example.com/sso")
                        .withIdpX509Certificate(idpCertificate))
                .withSp(
                    new ServiceProviderConfig()
                        .withEntityId("http://localhost:8585/api/v1/saml/metadata")
                        .withAcs("http://localhost:8585/api/v1/saml/acs")
                        .withCallback("http://localhost:8585/saml/callback")));
  }

  /** The PEM markers and body on one line, as the old save check accepted. */
  private static String singleLine(final String pem) {
    final String body = pem.replace(PEM_BEGIN, "").replace(PEM_END, "").replaceAll("\\s+", "");
    return PEM_BEGIN + body + PEM_END;
  }

  /** Spaces where the line breaks belong, as a value pasted into a single-line field becomes. */
  private static String spacesForLineBreaks(final String pem) {
    return pem.strip().replace("\n", " ");
  }

  private static String resource(final String path) {
    try (InputStream stream =
        SystemRepositorySecuritySettingsTest.class.getResourceAsStream(path)) {
      return new String(stream.readAllBytes(), StandardCharsets.US_ASCII);
    } catch (IOException e) {
      throw new UncheckedIOException(e);
    }
  }

  private static AuthenticationConfiguration authentication(int maxActiveSessionsPerUser) {
    return new AuthenticationConfiguration()
        .withProvider(AuthProvider.GOOGLE)
        .withProviderName("Google")
        .withMaxActiveSessionsPerUser(maxActiveSessionsPerUser)
        .withOidcConfiguration(new OidcClientConfig().withId("om").withSecret(SECRET));
  }

  private static AuthorizerConfiguration authorizer() {
    return new AuthorizerConfiguration()
        .withClassName("org.openmetadata.service.security.DefaultAuthorizer")
        .withContainerRequestFilter("org.openmetadata.service.security.JwtFilter")
        .withAdminPrincipals(Set.of("admin"))
        .withPrincipalDomain("open-metadata.org")
        .withEnableSecureSocketConnection(false);
  }

  private SystemDAO inMemoryDao() {
    SystemDAO dao = mock(SystemDAO.class);
    when(dao.getConfigJsonWithKey(anyString())).thenAnswer(i -> rows.get(i.<String>getArgument(0)));
    doAnswer(i -> rows.put(i.getArgument(0), i.getArgument(1)))
        .when(dao)
        .insertSettings(anyString(), anyString());
    when(dao.updateSettingsIfCurrent(anyString(), anyString(), anyString()))
        .thenAnswer(
            i -> rows.replace(i.getArgument(0), i.getArgument(1), i.getArgument(2)) ? 1 : 0);
    doCallRealMethod().when(dao).updateSecuritySettingsIfCurrent(any(), any());
    when(dao.getConfigWithKey(anyString()))
        .thenAnswer(
            i -> {
              final String json = rows.get(i.<String>getArgument(0));
              return json == null
                  ? null
                  : CollectionDAO.SettingsRowMapper.getSettings(
                      SettingsType.fromValue(i.getArgument(0)), json);
            });
    return dao;
  }
}
