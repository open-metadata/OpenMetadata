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
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.doCallRealMethod;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.when;
import static org.openmetadata.schema.settings.SettingsType.AUTHENTICATION_CONFIGURATION;
import static org.openmetadata.schema.settings.SettingsType.AUTHORIZER_CONFIGURATION;

import jakarta.ws.rs.WebApplicationException;
import jakarta.ws.rs.core.SecurityContext;
import jakarta.ws.rs.core.UriInfo;
import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicBoolean;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.catalog.security.client.SamlSSOClientConfig;
import org.openmetadata.catalog.type.IdentityProviderConfig;
import org.openmetadata.catalog.type.ServiceProviderConfig;
import org.openmetadata.schema.api.security.AuthenticationConfiguration;
import org.openmetadata.schema.api.security.AuthorizerConfiguration;
import org.openmetadata.schema.api.security.ClientType;
import org.openmetadata.schema.configuration.SecurityConfiguration;
import org.openmetadata.schema.services.connections.metadata.AuthProvider;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.config.source.SettingsSecrets;
import org.openmetadata.service.exception.AuthenticationException;
import org.openmetadata.service.fernet.Fernet;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.SystemRepository;
import org.openmetadata.service.jdbi3.SystemTokenDAOs.SystemDAO;
import org.openmetadata.service.migration.MigrationValidationClient;
import org.openmetadata.service.resources.settings.SettingsCache;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.auth.SecurityConfigurationManager;

/**
 * What a security configuration save answers when the server cannot apply it, and what it leaves
 * in the database (ADR:2026-11-12-a-security-configuration-save-applies-in-full-or-is-refused).
 * The database is a map behind the real repository; the reload is the boundary that fails.
 */
class SystemResourceSecurityConfigApplyTest {
  private static final String AUTH = AUTHENTICATION_CONFIGURATION.value();
  private static final String AUTHZ = AUTHORIZER_CONFIGURATION.value();
  private static final String FERNET_KEY = "GhtAEzEb5WD6bTLvwa24JA6ePHxfVLDjb8X4hMShmVY=";

  private final Map<String, String> rows = new ConcurrentHashMap<>();
  private final AtomicBoolean databaseDown = new AtomicBoolean();
  private MockedStatic<Entity> entityMock;
  private MockedStatic<MigrationValidationClient> migrationMock;
  private MockedStatic<SettingsCache> settingsCacheMock;
  private MockedStatic<SecurityConfigurationManager> managerMock;
  private SecurityConfigurationManager manager;
  private SystemRepository repository;
  private SystemResource resource;

  @BeforeEach
  void setUp() {
    entityMock = mockStatic(Entity.class);
    migrationMock = mockStatic(MigrationValidationClient.class);
    settingsCacheMock = mockStatic(SettingsCache.class);
    managerMock = mockStatic(SecurityConfigurationManager.class);
    CollectionDAO collectionDAO = mock(CollectionDAO.class);
    SystemDAO dao = inMemoryDao();
    when(collectionDAO.systemDAO()).thenReturn(dao);
    entityMock.when(Entity::getCollectionDAO).thenReturn(collectionDAO);
    migrationMock
        .when(MigrationValidationClient::getInstance)
        .thenReturn(mock(MigrationValidationClient.class));
    repository = new SystemRepository();
    entityMock.when(Entity::getSystemRepository).thenReturn(repository);
    manager = mock(SecurityConfigurationManager.class);
    managerMock.when(SecurityConfigurationManager::getInstance).thenReturn(manager);
    resource = new SystemResource(mock(Authorizer.class));
    rows.put(AUTH, JsonUtils.pojoToJson(authentication(AuthProvider.BASIC, "Basic")));
    rows.put(AUTHZ, JsonUtils.pojoToJson(authorizer()));
  }

  @AfterEach
  void tearDown() {
    managerMock.close();
    settingsCacheMock.close();
    migrationMock.close();
    entityMock.close();
  }

  @Test
  void aSaveTheServerCannotApplyIsPutBackAndRefused() {
    reloadFails(() -> {});

    WebApplicationException refused = assertThrows(WebApplicationException.class, this::save);

    assertEquals(400, refused.getResponse().getStatus(), refused.getMessage());
    assertEquals(AuthProvider.BASIC, storedProvider());
  }

  /** The database keeps the refused save, so answering "not saved" would hide it from the admin. */
  @Test
  void aFailedPutBackIsAServerErrorThatSaysSo() {
    reloadFails(() -> databaseDown.set(true));

    WebApplicationException failed = assertThrows(WebApplicationException.class, this::save);

    assertEquals(500, failed.getResponse().getStatus(), failed.getMessage());
    assertTrue(
        failed.getMessage().contains("putting the previous one back failed"), failed.getMessage());
    databaseDown.set(false);
    assertEquals(AuthProvider.GOOGLE, storedProvider());
  }

  @Test
  void aSaveMadeWhileTheRefusedOneWasAppliedIsKept() {
    String savedMeanwhile =
        JsonUtils.pojoToJson(authentication(AuthProvider.AZURE, "Saved meanwhile"));
    reloadFails(() -> rows.put(AUTH, savedMeanwhile));

    WebApplicationException conflict = assertThrows(WebApplicationException.class, this::save);

    assertEquals(412, conflict.getResponse().getStatus(), conflict.getMessage());
    assertTrue(conflict.getMessage().contains("could not be applied"), conflict.getMessage());
    assertEquals(savedMeanwhile, rows.get(AUTH));
  }

  /**
   * The rows go back as they were read. Checking them again against the refused save would refuse
   * an IdP certificate that was accepted and has expired since, and leave the refused save stored.
   */
  @Test
  void aRefusedSaveOverAnExpiredIdpCertificatePutsTheRowsBackAsTheyWere() {
    Fernet.getInstance().setFernetKey(FERNET_KEY);
    rows.put(
        AUTH,
        JsonUtils.pojoToJson(
            SettingsSecrets.encrypted(
                AUTHENTICATION_CONFIGURATION,
                JsonUtils.valueToTree(saml(resource("/saml/expired-idp.crt"))))));
    final String authenticationBefore = rows.get(AUTH);
    final String authorizerBefore = rows.get(AUTHZ);
    reloadFails(() -> {});

    final WebApplicationException refused = assertThrows(WebApplicationException.class, this::save);

    assertEquals(400, refused.getResponse().getStatus(), refused.getMessage());
    assertEquals(authenticationBefore, rows.get(AUTH));
    assertEquals(authorizerBefore, rows.get(AUTHZ));
  }

  private void save() {
    SecurityConfiguration refused =
        new SecurityConfiguration()
            .withAuthenticationConfiguration(authentication(AuthProvider.GOOGLE, "Google"))
            .withAuthorizerConfiguration(authorizer());
    resource.updateSecurityConfig(mock(UriInfo.class), mock(SecurityContext.class), refused);
  }

  /** The server cannot apply what was stored; {@code meanwhile} runs while it tries. */
  private void reloadFails(Runnable meanwhile) {
    doAnswer(
            invocation -> {
              meanwhile.run();
              throw new AuthenticationException(
                  "Failed to reload security system",
                  new IllegalStateException("the directory refused the bind"));
            })
        .when(manager)
        .reloadSecuritySystem();
  }

  private AuthProvider storedProvider() {
    return repository
        .getStoredSecurityConfiguration()
        .configuration()
        .getAuthenticationConfiguration()
        .getProvider();
  }

  private static AuthenticationConfiguration authentication(AuthProvider provider, String name) {
    return new AuthenticationConfiguration()
        .withProvider(provider)
        .withProviderName(name)
        .withClientType(ClientType.PUBLIC);
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
                        .withCallback("http://localhost:8585/saml/callback")
                        .withSpPrivateKey(resource("/saml/mock-idp-pkcs8.key"))));
  }

  private static String resource(final String path) {
    try (InputStream stream =
        SystemResourceSecurityConfigApplyTest.class.getResourceAsStream(path)) {
      return new String(stream.readAllBytes(), StandardCharsets.US_ASCII);
    } catch (IOException e) {
      throw new UncheckedIOException(e);
    }
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
    doAnswer(
            i -> {
              requireDatabase();
              return rows.put(i.getArgument(0), i.getArgument(1));
            })
        .when(dao)
        .insertSettings(anyString(), anyString());
    when(dao.updateSettingsIfCurrent(anyString(), anyString(), anyString()))
        .thenAnswer(
            i -> {
              requireDatabase();
              return rows.replace(i.getArgument(0), i.getArgument(1), i.getArgument(2)) ? 1 : 0;
            });
    doCallRealMethod().when(dao).updateSecuritySettingsIfCurrent(any(), any());
    return dao;
  }

  private void requireDatabase() {
    if (databaseDown.get()) {
      throw new IllegalStateException("The database connection was lost");
    }
  }
}
