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
import jakarta.json.JsonException;
import jakarta.json.JsonPatch;
import jakarta.ws.rs.core.Response;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.MockedStatic;
import org.openmetadata.schema.configuration.GlossaryTermRelationSettings;
import org.openmetadata.schema.email.SmtpSettings;
import org.openmetadata.schema.settings.Settings;
import org.openmetadata.schema.settings.SettingsType;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.BadRequestException;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.exception.PreconditionFailedException;
import org.openmetadata.service.exception.SystemSettingsException;
import org.openmetadata.service.jdbi3.CollectionDAO.SystemDAO;
import org.openmetadata.service.migration.MigrationValidationClient;
import org.openmetadata.service.resources.settings.SettingsCache;
import org.openmetadata.service.secrets.masker.PasswordEntityMasker;

class SystemRepositoryPatchSettingTest {
  private static final String SETTING_NAME = SettingsType.GLOSSARY_TERM_RELATION_SETTINGS.value();
  private static final String ORIGINAL_JSON = "{\"relationTypes\":[]}";
  private static final String EMAIL_SETTING_NAME = SettingsType.EMAIL_CONFIGURATION.value();
  private static final String SMTP_PASSWORD = "smtp-secret";
  private static final String ORIGINAL_SENDER = "before@example.com";
  private static final String UPDATED_SENDER = "after@example.com";

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
  void patchSettingRejectsDuplicateGlossaryTermRelationTypeNames() {
    String existingJson = "{\"relationTypes\":[{\"name\":\"prescribes\"}]}";
    when(systemDAO.getGlossaryTermRelationSettingsJson()).thenReturn(existingJson);

    SystemSettingsException failure =
        assertThrows(
            SystemSettingsException.class,
            () -> systemRepository.patchSetting(SETTING_NAME, duplicateRelationTypePatch()));

    assertTrue(failure.getMessage().contains("already exists"));
    assertEquals(Response.Status.CONFLICT.getStatusCode(), failure.getResponse().getStatus());
    verify(systemDAO, never())
        .updateGlossaryTermRelationSettingsIfCurrent(anyString(), anyString());
    settingsCacheMock.verifyNoInteractions();
  }

  @Test
  void patchSettingRejectsInvalidRelationPatchAsBadRequest() {
    String existingJson = "{\"relationTypes\":[{\"name\":\"relatedTo\"}]}";
    when(systemDAO.getGlossaryTermRelationSettingsJson()).thenReturn(existingJson);

    BadRequestException failure =
        assertThrows(
            BadRequestException.class,
            () -> systemRepository.patchSetting(SETTING_NAME, staleRelationTypePatch()));

    assertTrue(failure.getMessage().contains("Invalid JSON Patch"));
    assertEquals(Response.Status.BAD_REQUEST.getStatusCode(), failure.getResponse().getStatus());
    assertTrue(failure.getCause() instanceof JsonException);
    verify(systemDAO, never())
        .updateGlossaryTermRelationSettingsIfCurrent(anyString(), anyString());
    settingsCacheMock.verifyNoInteractions();
  }

  @Test
  void patchSettingRejectsDeletingSystemDefinedRelationType() {
    String existingJson = "{\"relationTypes\":[{\"name\":\"relatedTo\",\"isSystemDefined\":true}]}";
    when(systemDAO.getGlossaryTermRelationSettingsJson()).thenReturn(existingJson);

    SystemSettingsException failure =
        assertThrows(
            SystemSettingsException.class,
            () -> systemRepository.patchSetting(SETTING_NAME, removeFirstRelationTypePatch()));

    assertTrue(failure.getMessage().contains("system-defined"));
    verify(systemDAO, never())
        .updateGlossaryTermRelationSettingsIfCurrent(anyString(), anyString());
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
    String originalJson = "{}";
    when(systemDAO.getConfigJsonWithKey(settingName)).thenReturn(originalJson);
    when(systemDAO.updateSettingsIfCurrent(eq(settingName), eq(originalJson), anyString()))
        .thenReturn(1);

    Response response =
        systemRepository.patchSetting(settingName, Json.createPatchBuilder().build());

    assertEquals(Response.Status.OK.getStatusCode(), response.getStatus());
    verify(systemDAO).getConfigJsonWithKey(settingName);
    verify(systemDAO).updateSettingsIfCurrent(eq(settingName), eq(originalJson), anyString());
    verify(systemDAO, never()).insertSettings(anyString(), anyString());
    verify(systemDAO, never()).getGlossaryTermRelationSettingsJson();
    verify(systemDAO, never())
        .updateGlossaryTermRelationSettingsIfCurrent(anyString(), anyString());
    settingsCacheMock.verify(() -> SettingsCache.invalidateSettings(settingName));
  }

  @Test
  void patchSettingRejectsMissingGenericSetting() {
    String settingName = SettingsType.LINEAGE_SETTINGS.value();
    when(systemDAO.getConfigJsonWithKey(settingName)).thenReturn(null);

    assertThrows(
        EntityNotFoundException.class,
        () -> systemRepository.patchSetting(settingName, Json.createPatchBuilder().build()));

    verify(systemDAO, never()).updateSettingsIfCurrent(anyString(), anyString(), anyString());
    settingsCacheMock.verifyNoInteractions();
  }

  @Test
  void patchSettingRejectsConcurrentGenericSnapshotChange() {
    String settingName = SettingsType.LINEAGE_SETTINGS.value();
    String originalJson = "{}";
    when(systemDAO.getConfigJsonWithKey(settingName)).thenReturn(originalJson);
    when(systemDAO.updateSettingsIfCurrent(eq(settingName), eq(originalJson), anyString()))
        .thenReturn(0);

    PreconditionFailedException failure =
        assertThrows(
            PreconditionFailedException.class,
            () -> systemRepository.patchSetting(settingName, Json.createPatchBuilder().build()));

    assertTrue(failure.getMessage().contains("Setting changed"));
    assertEquals(
        Response.Status.PRECONDITION_FAILED.getStatusCode(), failure.getResponse().getStatus());
    settingsCacheMock.verifyNoInteractions();
  }

  @Test
  void patchEmailSettingPreservesMaskedPassword() {
    String originalJson = JsonUtils.pojoToJson(emailSettings(SMTP_PASSWORD, ORIGINAL_SENDER));
    when(systemDAO.getConfigJsonWithKey(EMAIL_SETTING_NAME)).thenReturn(originalJson);
    when(systemDAO.updateSettingsIfCurrent(eq(EMAIL_SETTING_NAME), eq(originalJson), anyString()))
        .thenReturn(1);

    Response response =
        systemRepository.patchSetting(
            EMAIL_SETTING_NAME,
            Json.createPatchBuilder().replace("/senderMail", UPDATED_SENDER).build());

    assertEquals(Response.Status.OK.getStatusCode(), response.getStatus());
    ArgumentCaptor<String> updatedJson = ArgumentCaptor.forClass(String.class);
    verify(systemDAO)
        .updateSettingsIfCurrent(eq(EMAIL_SETTING_NAME), eq(originalJson), updatedJson.capture());
    SmtpSettings persisted =
        SystemRepository.decryptEmailSetting(
            JsonUtils.readValue(updatedJson.getValue(), SmtpSettings.class));
    assertEquals(SMTP_PASSWORD, persisted.getPassword());
    assertEquals(UPDATED_SENDER, persisted.getSenderMail());
    Settings responseSettings = (Settings) response.getEntity();
    SmtpSettings responseConfig = (SmtpSettings) responseSettings.getConfigValue();
    assertEquals(PasswordEntityMasker.PASSWORD_MASK, responseConfig.getPassword());
  }

  @Test
  void putEmailSettingPreservesOmittedPassword() {
    Settings stored =
        new Settings()
            .withConfigType(SettingsType.EMAIL_CONFIGURATION)
            .withConfigValue(emailSettings(SMTP_PASSWORD, ORIGINAL_SENDER));
    Settings update =
        new Settings()
            .withConfigType(SettingsType.EMAIL_CONFIGURATION)
            .withConfigValue(
                JsonUtils.readValue(
                    JsonUtils.pojoToJson(emailSettings(null, UPDATED_SENDER)), Object.class));
    when(systemDAO.getConfigWithKey(EMAIL_SETTING_NAME)).thenReturn(stored);

    Response response = systemRepository.createOrUpdate(update);

    assertEquals(Response.Status.OK.getStatusCode(), response.getStatus());
    ArgumentCaptor<String> updatedJson = ArgumentCaptor.forClass(String.class);
    verify(systemDAO).insertSettings(eq(EMAIL_SETTING_NAME), updatedJson.capture());
    SmtpSettings persisted =
        SystemRepository.decryptEmailSetting(
            JsonUtils.readValue(updatedJson.getValue(), SmtpSettings.class));
    assertEquals(SMTP_PASSWORD, persisted.getPassword());
    assertEquals(UPDATED_SENDER, persisted.getSenderMail());
    Settings responseSettings = (Settings) response.getEntity();
    SmtpSettings responseConfig = (SmtpSettings) responseSettings.getConfigValue();
    assertEquals(PasswordEntityMasker.PASSWORD_MASK, responseConfig.getPassword());
  }

  private JsonPatch appendRelationTypePatch() {
    return Json.createPatchBuilder()
        .test("/relationTypes", Json.createArrayBuilder().build())
        .add("/relationTypes/-", Json.createObjectBuilder().add("name", "prescribes").build())
        .build();
  }

  private JsonPatch duplicateRelationTypePatch() {
    return Json.createPatchBuilder()
        .add("/relationTypes/-", Json.createObjectBuilder().add("name", "PRESCRIBES").build())
        .build();
  }

  private JsonPatch staleRelationTypePatch() {
    return Json.createPatchBuilder()
        .test("/relationTypes/0/name", "synonym")
        .remove("/relationTypes/0")
        .build();
  }

  private JsonPatch removeFirstRelationTypePatch() {
    return Json.createPatchBuilder().remove("/relationTypes/0").build();
  }

  private SmtpSettings emailSettings(String password, String senderMail) {
    return new SmtpSettings().withPassword(password).withSenderMail(senderMail);
  }
}
