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
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.when;

import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.schema.api.security.AuthenticationConfiguration;
import org.openmetadata.schema.configuration.SecurityConfiguration;
import org.openmetadata.schema.services.connections.metadata.AuthProvider;
import org.openmetadata.schema.system.FieldError;
import org.openmetadata.schema.system.SecurityValidationResponse;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.CollectionDAO.SystemDAO;
import org.openmetadata.service.migration.MigrationValidationClient;
import org.openmetadata.service.resources.settings.SettingsCache;

/**
 * openmetadata.yaml sets providerName for custom OIDC only and leaves it empty for every other
 * provider, so a configuration seeded from the deployment stores it empty. Only custom OIDC's
 * sign-in button shows it.
 */
class SystemRepositoryProviderNameTest {
  private static final String PROVIDER_NAME_FIELD = "authenticationConfiguration.providerName";

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
    when(collectionDAO.systemDAO()).thenReturn(mock(SystemDAO.class));
    entityMock.when(Entity::getCollectionDAO).thenReturn(collectionDAO);
    migrationMock
        .when(MigrationValidationClient::getInstance)
        .thenReturn(mock(MigrationValidationClient.class));
    repository = new SystemRepository();
  }

  @AfterEach
  void tearDown() {
    settingsCacheMock.close();
    migrationMock.close();
    entityMock.close();
  }

  @Test
  void anEmptyProviderNameIsAcceptedForAProviderThatDoesNotShowIt() {
    for (final AuthProvider provider : List.of(AuthProvider.SAML, AuthProvider.LDAP)) {
      assertFalse(reportsProviderName(validate(provider)), provider.value());
    }
  }

  @Test
  void anEmptyProviderNameIsStillRefusedForCustomOidc() {
    assertTrue(reportsProviderName(validate(AuthProvider.CUSTOM_OIDC)));
  }

  private SecurityValidationResponse validate(final AuthProvider provider) {
    final AuthenticationConfiguration authentication =
        new AuthenticationConfiguration()
            .withProvider(provider)
            .withProviderName("")
            .withAuthority("http://localhost:1")
            .withJwtPrincipalClaims(List.of("email"));
    return repository.validateSecurityConfiguration(
        new SecurityConfiguration().withAuthenticationConfiguration(authentication), null, "admin");
  }

  private static boolean reportsProviderName(final SecurityValidationResponse response) {
    final List<FieldError> errors = response.getErrors() == null ? List.of() : response.getErrors();
    return errors.stream().anyMatch(error -> PROVIDER_NAME_FIELD.equals(error.getField()));
  }
}
