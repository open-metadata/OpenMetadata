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
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.when;

import jakarta.ws.rs.core.SecurityContext;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.schema.configuration.GlossaryTermRelationSettings;
import org.openmetadata.schema.configuration.GlossaryTermRelationType;
import org.openmetadata.schema.settings.Settings;
import org.openmetadata.schema.settings.SettingsType;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.SystemRepository;
import org.openmetadata.service.resources.settings.SettingsCache;
import org.openmetadata.service.security.AuthorizationException;
import org.openmetadata.service.security.Authorizer;

/**
 * Glossary term relation types are vocabulary every user needs to read to render the Related Terms
 * tab, so reads are open to any authenticated principal while writes stay admin-only (issue
 * #31070). The authorizer here rejects every admin check, standing in for a non-admin caller.
 */
class SystemResourceSettingsAuthorizationTest {
  private static final String GLOSSARY_RELATION_SETTINGS =
      SettingsType.GLOSSARY_TERM_RELATION_SETTINGS.value();
  private static final String RELATION_TYPE_NAME = "relatedTo";

  private MockedStatic<Entity> entityMock;
  private MockedStatic<SettingsCache> settingsCacheMock;
  private SystemRepository systemRepository;
  private SecurityContext securityContext;
  private SystemResource systemResource;

  @BeforeEach
  void setup() {
    entityMock = mockStatic(Entity.class);
    settingsCacheMock = mockStatic(SettingsCache.class);
    systemRepository = mock(SystemRepository.class);
    entityMock.when(Entity::getSystemRepository).thenReturn(systemRepository);
    settingsCacheMock
        .when(
            () ->
                SettingsCache.getSetting(
                    SettingsType.GLOSSARY_TERM_RELATION_SETTINGS,
                    GlossaryTermRelationSettings.class))
        .thenReturn(relationSettings());

    Authorizer nonAdminAuthorizer = mock(Authorizer.class);
    doThrow(new AuthorizationException("Principal: is not admin"))
        .when(nonAdminAuthorizer)
        .authorizeAdmin(any(SecurityContext.class));
    securityContext = mock(SecurityContext.class);
    systemResource = new SystemResource(nonAdminAuthorizer);
  }

  @AfterEach
  void tearDown() {
    settingsCacheMock.close();
    entityMock.close();
  }

  @Test
  void nonAdminReadsGlossaryTermRelationSettings() {
    Settings stored = storedRelationSettings();
    when(systemRepository.getConfigWithKey(GLOSSARY_RELATION_SETTINGS)).thenReturn(stored);

    Settings settings =
        systemResource.getSettingByName(null, securityContext, GLOSSARY_RELATION_SETTINGS);

    assertSame(stored, settings);
  }

  @Test
  void nonAdminListsGlossaryTermRelationTypes() {
    ResultList<GlossaryTermRelationType> relationTypes =
        systemResource.listGlossaryTermRelationTypes(securityContext, 15, 0);

    assertEquals(2, relationTypes.getData().size());
    assertEquals(RELATION_TYPE_NAME, relationTypes.getData().get(0).getName());
  }

  @Test
  void nonAdminCannotReadOtherSettings() {
    assertThrows(
        AuthorizationException.class,
        () ->
            systemResource.getSettingByName(
                null, securityContext, SettingsType.SEARCH_SETTINGS.value()));
  }

  @Test
  void nonAdminCannotCreateRelationType() {
    GlossaryTermRelationType relationType =
        new GlossaryTermRelationType().withName("prescribes").withDisplayName("Prescribes");

    assertThrows(
        AuthorizationException.class,
        () -> systemResource.createGlossaryTermRelationType(securityContext, relationType));
  }

  @Test
  void nonAdminCannotUpdateRelationType() {
    GlossaryTermRelationType relationType =
        new GlossaryTermRelationType().withName(RELATION_TYPE_NAME).withDisplayName("Renamed");

    assertThrows(
        AuthorizationException.class,
        () ->
            systemResource.updateGlossaryTermRelationType(
                securityContext, RELATION_TYPE_NAME, relationType));
  }

  @Test
  void nonAdminCannotDeleteRelationType() {
    assertThrows(
        AuthorizationException.class,
        () -> systemResource.deleteGlossaryTermRelationType(securityContext, RELATION_TYPE_NAME));
  }

  private GlossaryTermRelationSettings relationSettings() {
    return new GlossaryTermRelationSettings()
        .withRelationTypes(
            List.of(
                new GlossaryTermRelationType()
                    .withName(RELATION_TYPE_NAME)
                    .withDisplayName("Related To"),
                new GlossaryTermRelationType()
                    .withName("synonymOf")
                    .withDisplayName("Synonym Of")));
  }

  private Settings storedRelationSettings() {
    return new Settings()
        .withConfigType(SettingsType.GLOSSARY_TERM_RELATION_SETTINGS)
        .withConfigValue(relationSettings());
  }
}
