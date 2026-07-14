package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import jakarta.json.Json;
import jakarta.json.JsonPatch;
import jakarta.ws.rs.core.Response;
import java.util.Map;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.MockedStatic;
import org.openmetadata.schema.configuration.GlossaryTermRelationSettings;
import org.openmetadata.schema.settings.Settings;
import org.openmetadata.schema.settings.SettingsType;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.exception.PreconditionFailedException;
import org.openmetadata.service.jdbi3.CollectionDAO.SystemDAO;
import org.openmetadata.service.migration.MigrationValidationClient;
import org.openmetadata.service.resources.settings.SettingsCache;

class SystemRepositoryPatchSettingTest {
  private static final String SETTING_NAME = SettingsType.GLOSSARY_TERM_RELATION_SETTINGS.value();
  private static final String ORIGINAL_JSON = "{\"relationTypes\":[]}";

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

  @Test
  void patchSettingUsesSnapshotCompareAndSet() {
    when(systemDAO.getGlossaryTermRelationSettingsJson()).thenReturn(ORIGINAL_JSON);
    when(systemDAO.updateGlossaryTermRelationSettingsIfCurrent(eq(ORIGINAL_JSON), anyString()))
        .thenReturn(1);

    Response response = systemRepository.patchSetting(SETTING_NAME, appendRelationTypePatch());

    assertEquals(Response.Status.OK.getStatusCode(), response.getStatus());
    Settings responseSettings = (Settings) response.getEntity();
    assertEquals(SettingsType.GLOSSARY_TERM_RELATION_SETTINGS, responseSettings.getConfigType());
    assertTrue(responseSettings.getConfigValue() instanceof GlossaryTermRelationSettings);
    ArgumentCaptor<String> updatedJson = ArgumentCaptor.forClass(String.class);
    verify(systemDAO)
        .updateGlossaryTermRelationSettingsIfCurrent(eq(ORIGINAL_JSON), updatedJson.capture());
    GlossaryTermRelationSettings updated =
        JsonUtils.readValue(updatedJson.getValue(), GlossaryTermRelationSettings.class);
    assertEquals(1, updated.getRelationTypes().size());
    assertEquals("prescribes", updated.getRelationTypes().get(0).getName());
    settingsCacheMock.verify(() -> SettingsCache.invalidateSettings(SETTING_NAME));
  }

  @Test
  void patchSettingRejectsConcurrentSnapshotChange() {
    when(systemDAO.getGlossaryTermRelationSettingsJson()).thenReturn(ORIGINAL_JSON);
    when(systemDAO.updateGlossaryTermRelationSettingsIfCurrent(eq(ORIGINAL_JSON), anyString()))
        .thenReturn(0);

    PreconditionFailedException failure =
        assertThrows(
            PreconditionFailedException.class,
            () -> systemRepository.patchSetting(SETTING_NAME, appendRelationTypePatch()));

    assertTrue(failure.getMessage().contains("Glossary term relation settings changed"));
    assertEquals(
        Response.Status.PRECONDITION_FAILED.getStatusCode(), failure.getResponse().getStatus());
    settingsCacheMock.verifyNoInteractions();
  }

  @Test
  void patchSettingRejectsMissingSetting() {
    when(systemDAO.getGlossaryTermRelationSettingsJson()).thenReturn(null);

    assertThrows(
        EntityNotFoundException.class,
        () -> systemRepository.patchSetting(SETTING_NAME, appendRelationTypePatch()));
  }

  @Test
  void patchSettingUsesGenericPathForUnrelatedSettings() {
    String settingName = SettingsType.LINEAGE_SETTINGS.value();
    Settings current =
        new Settings().withConfigType(SettingsType.LINEAGE_SETTINGS).withConfigValue(Map.of());
    when(systemDAO.getConfigWithKey(settingName)).thenReturn(current);

    Response response =
        systemRepository.patchSetting(settingName, Json.createPatchBuilder().build());

    assertEquals(Response.Status.OK.getStatusCode(), response.getStatus());
    verify(systemDAO).getConfigWithKey(settingName);
    verify(systemDAO).insertSettings(settingName, "{}");
    verify(systemDAO, never()).getGlossaryTermRelationSettingsJson();
    verify(systemDAO, never())
        .updateGlossaryTermRelationSettingsIfCurrent(anyString(), anyString());
    settingsCacheMock.verify(() -> SettingsCache.invalidateSettings(settingName));
  }

  private JsonPatch appendRelationTypePatch() {
    return Json.createPatchBuilder()
        .test("/relationTypes", Json.createArrayBuilder().build())
        .add("/relationTypes/-", Json.createObjectBuilder().add("name", "prescribes").build())
        .build();
  }
}
