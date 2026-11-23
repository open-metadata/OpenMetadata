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

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.when;
import static org.openmetadata.schema.settings.SettingsType.AUTHORIZER_CONFIGURATION;

import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.schema.api.security.AuthorizerConfiguration;
import org.openmetadata.schema.settings.Settings;
import org.openmetadata.schema.settings.SettingsType;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.CustomExceptionMessage;
import org.openmetadata.service.jdbi3.SystemTokenDAOs.SettingsRowMapper;
import org.openmetadata.service.jdbi3.SystemTokenDAOs.SystemDAO;
import org.openmetadata.service.migration.MigrationValidationClient;
import org.openmetadata.service.resources.settings.SettingsCache;

/**
 * A setting {@code createOrUpdate} cannot store is thrown, so a caller such as the {@code
 * update-security-config} command cannot report it as stored. The rows are a map behind the real
 * repository.
 */
class SystemRepositoryFailedWriteTest {
  private static final String AUTHZ = AUTHORIZER_CONFIGURATION.value();

  private final Map<String, String> rows = new ConcurrentHashMap<>();
  private MockedStatic<Entity> entityMock;
  private MockedStatic<MigrationValidationClient> migrationMock;
  private MockedStatic<SettingsCache> settingsCacheMock;
  private SystemRepository repository;

  @BeforeEach
  void setUp() {
    entityMock = mockStatic(Entity.class);
    migrationMock = mockStatic(MigrationValidationClient.class);
    settingsCacheMock = mockStatic(SettingsCache.class);
    final CollectionDAO collectionDAO = mock(CollectionDAO.class);
    final SystemDAO dao = inMemoryDao();
    when(collectionDAO.systemDAO()).thenReturn(dao);
    entityMock.when(Entity::getCollectionDAO).thenReturn(collectionDAO);
    migrationMock
        .when(MigrationValidationClient::getInstance)
        .thenReturn(mock(MigrationValidationClient.class));
    repository = new SystemRepository();
    rows.put(
        AUTHZ, JsonUtils.pojoToJson(authorizer("admin").withEnableSecureSocketConnection(false)));
  }

  @AfterEach
  void tearDown() {
    settingsCacheMock.close();
    migrationMock.close();
    entityMock.close();
  }

  @Test
  void storesAValidSetting() {
    repository.createOrUpdate(
        authorizerSettings(authorizer("new-admin").withEnableSecureSocketConnection(false)));

    assertEquals(Set.of("new-admin"), storedAuthorizer().getAdminPrincipals());
  }

  /** {@code enableSecureSocketConnection} is required, so the write step refuses the value. */
  @Test
  void aWriteThatFailsIsThrownAndStoresNothing() {
    final String before = rows.get(AUTHZ);
    final Settings incomplete = authorizerSettings(authorizer("new-admin"));

    final CustomExceptionMessage failed =
        assertThrows(CustomExceptionMessage.class, () -> repository.createOrUpdate(incomplete));

    assertEquals(500, failed.getResponse().getStatus());
    assertEquals(before, rows.get(AUTHZ));
  }

  private AuthorizerConfiguration storedAuthorizer() {
    return JsonUtils.readValue(rows.get(AUTHZ), AuthorizerConfiguration.class);
  }

  private static Settings authorizerSettings(final AuthorizerConfiguration authorizer) {
    return new Settings().withConfigType(AUTHORIZER_CONFIGURATION).withConfigValue(authorizer);
  }

  private static AuthorizerConfiguration authorizer(final String admin) {
    return new AuthorizerConfiguration()
        .withClassName("org.openmetadata.service.security.DefaultAuthorizer")
        .withContainerRequestFilter("org.openmetadata.service.security.JwtFilter")
        .withAdminPrincipals(Set.of(admin))
        .withPrincipalDomain("open-metadata.org")
        .withEnforcePrincipalDomain(false);
  }

  private SystemDAO inMemoryDao() {
    final SystemDAO dao = mock(SystemDAO.class);
    when(dao.getConfigJsonWithKey(anyString())).thenAnswer(i -> rows.get(i.<String>getArgument(0)));
    when(dao.getConfigWithKey(anyString()))
        .thenAnswer(
            i -> {
              final String json = rows.get(i.<String>getArgument(0));
              return json == null
                  ? null
                  : SettingsRowMapper.getSettings(SettingsType.fromValue(i.getArgument(0)), json);
            });
    doAnswer(i -> rows.put(i.getArgument(0), i.getArgument(1)))
        .when(dao)
        .insertSettings(anyString(), anyString());
    return dao;
  }
}
