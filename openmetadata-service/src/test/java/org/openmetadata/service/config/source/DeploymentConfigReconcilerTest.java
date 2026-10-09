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

package org.openmetadata.service.config.source;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.openmetadata.schema.settings.SettingsType.AUTHENTICATION_CONFIGURATION;
import static org.openmetadata.schema.settings.SettingsType.AUTHORIZER_CONFIGURATION;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import jakarta.ws.rs.BadRequestException;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.configuration.ConfigSourceConfiguration;
import org.openmetadata.schema.configuration.ConfigSourceMode;
import org.openmetadata.schema.settings.SettingsType;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.fernet.Fernet;
import org.openmetadata.service.jdbi3.SystemTokenDAOs.SystemDAO;

class DeploymentConfigReconcilerTest {
  private static final ObjectMapper MAPPER = new ObjectMapper();
  private static final String KEY = "GhtAEzEb5WD6bTLvwa24JA6ePHxfVLDjb8X4hMShmVY=";
  private static final String AUTH = AUTHENTICATION_CONFIGURATION.value();
  private static final DeploymentTemplate TEMPLATE =
      DeploymentTemplate.parse(
          """
          authenticationConfiguration:
            provider: ${AUTHENTICATION_PROVIDER:-basic}
            providerName: ${CUSTOM_OIDC_AUTHENTICATION_PROVIDER_NAME:-""}
            clientId: ${AUTHENTICATION_CLIENT_ID:-""}
            enableSelfSignup: ${AUTHENTICATION_ENABLE_SELF_SIGNUP:-true}
            maxActiveSessionsPerUser: ${AUTHENTICATION_MAX_ACTIVE_SESSIONS_PER_USER:-5}
            oidcConfiguration:
              id: ${OIDC_CLIENT_ID:-""}
              secret: ${OIDC_CLIENT_SECRET:-""}
          """,
          "/authenticationConfiguration");

  private static final DeploymentTemplate AUTHORIZER_TEMPLATE =
      DeploymentTemplate.parse(
          """
          authorizerConfiguration:
            adminPrincipals: ${AUTHORIZER_ADMIN_PRINCIPALS:-[admin]}
          """,
          "/authorizerConfiguration");
  private static final String UI_CONFIGURED_OIDC =
      "{'provider':'custom-oidc','providerName':'Corp','clientId':'ui-client'}";

  private final Map<String, StoredSettingRow> rows = new ConcurrentHashMap<>();
  private final AtomicBoolean rejectNextPreparedValue = new AtomicBoolean();
  private SystemDAO dao;

  @BeforeEach
  void setUp() {
    Fernet.getInstance().setFernetKey(KEY);
    dao = inMemoryDao();
  }

  /** A start recorded in ENV mode would make later tests in this JVM see read-only settings. */
  @AfterEach
  void tearDown() {
    ConfigSources.recordPersistedMode(AUTHENTICATION_CONFIGURATION, ConfigSourceMode.AUTO);
    ConfigSources.recordPersistedMode(AUTHORIZER_CONFIGURATION, ConfigSourceMode.AUTO);
  }

  @Test
  void storesAMissingSettingWithItsDeploymentValueAndSnapshot() {
    reconcile(ConfigSourceMode.AUTO, "{'provider':'basic','maxActiveSessionsPerUser':1000}");

    assertEquals(1000, stored().get("maxActiveSessionsPerUser").asInt());
    assertEquals(1000, snapshot().values().get("maxActiveSessionsPerUser").asInt());
    assertEquals(ConfigSourceMode.AUTO, snapshot().meta().mode());
  }

  @Test
  void firstReconciliationFillsAFieldAnOlderVersionNeverStored() {
    rows.put(AUTH, new StoredSettingRow(json("{'provider':'basic'}").toString(), null));

    reconcile(ConfigSourceMode.AUTO, "{'provider':'basic','maxActiveSessionsPerUser':1000}");

    assertEquals(1000, stored().get("maxActiveSessionsPerUser").asInt());
    assertEquals(1000, snapshot().values().get("maxActiveSessionsPerUser").asInt());
  }

  @Test
  void laterDeploymentChangesApplyAndUiChangesSurviveThem() {
    reconcile(
        ConfigSourceMode.AUTO,
        "{'provider':'basic','enableSelfSignup':true,'maxActiveSessionsPerUser':5}");
    editStored("enableSelfSignup", false);

    reconcile(
        ConfigSourceMode.AUTO,
        "{'provider':'basic','enableSelfSignup':true,'maxActiveSessionsPerUser':1000}");

    assertEquals(1000, stored().get("maxActiveSessionsPerUser").asInt());
    assertFalse(stored().get("enableSelfSignup").asBoolean());
  }

  @Test
  void retriesWhenTheSettingChangesWhileItIsReconciled() {
    rows.put(AUTH, new StoredSettingRow(json("{'provider':'basic'}").toString(), null));
    AtomicInteger casAttempts = interveneOnFirstCompareAndSet();

    reconcile(ConfigSourceMode.AUTO, "{'provider':'basic','maxActiveSessionsPerUser':1000}");

    assertEquals(2, casAttempts.get());
    assertEquals(1000, stored().get("maxActiveSessionsPerUser").asInt());
    assertTrue(stored().get("enableSelfSignup").booleanValue());
  }

  @Test
  void leavesASettingReconciledByANewerServerVersionAlone() {
    DeploymentSnapshot newer =
        new DeploymentSnapshot(
            json("{'provider':'basic'}"),
            new DeploymentSnapshot.Meta(ConfigSourceMode.AUTO, "99.0.0", null, List.of(), null));
    rows.put(AUTH, new StoredSettingRow(json("{'provider':'basic'}").toString(), newer.toJson()));

    reconcile(ConfigSourceMode.AUTO, "{'provider':'basic','maxActiveSessionsPerUser':1000}");

    assertFalse(stored().has("maxActiveSessionsPerUser"));
  }

  @Test
  void keepsTheStoredValueWhenTheReconciledValueIsInvalid() {
    rows.put(AUTH, new StoredSettingRow(json("{'provider':'basic'}").toString(), null));
    rejectNextPreparedValue.set(true);

    reconcile(ConfigSourceMode.AUTO, "{'provider':'basic','maxActiveSessionsPerUser':1000}");

    assertFalse(stored().has("maxActiveSessionsPerUser"));
    assertTrue(DeploymentSnapshot.parse(rows.get(AUTH).snapshot()).isEmpty());
  }

  @Test
  void envModeRefusesToStartWithAnInvalidDeploymentValue() {
    rows.put(AUTH, new StoredSettingRow(json("{'provider':'basic'}").toString(), null));
    rejectNextPreparedValue.set(true);

    assertThrows(
        IllegalStateException.class,
        () ->
            reconcile(
                ConfigSourceMode.ENV, "{'provider':'basic','maxActiveSessionsPerUser':1000}"));
  }

  @Test
  void aRefusedEnvStartChangesNoSettingOfTheSecurityGroup() {
    String authorizer = AUTHORIZER_CONFIGURATION.value();
    String storedAdmins = json("{'adminPrincipals':['admin']}").toString();
    rows.put(authorizer, new StoredSettingRow(storedAdmins, null));
    storeUiConfiguredProvider();

    assertThrows(
        IllegalStateException.class,
        () -> reconcileSecurity(new ConfigSourceConfiguration(), "{'provider':'basic'}"));

    assertEquals(storedAdmins, rows.get(authorizer).json());
    assertEquals("custom-oidc", stored().get("provider").asText());
  }

  @Test
  void envModeKeepsTheEmptyProviderNameOfTheProviderItSwitchesTo() {
    storeUiConfiguredProvider();

    reconcileSecurity(
        new ConfigSourceConfiguration().withConfirmProviderChange(true),
        "{'provider':'basic','providerName':'','clientId':''}");

    assertEquals("basic", stored().get("provider").asText());
    assertTrue(stored().has("providerName"));
    assertEquals("", stored().get("providerName").asText());
  }

  @Test
  void reconcilesASettingWithAnUnreadableSnapshotAsOnFirstSight() {
    rows.put(
        AUTH,
        new StoredSettingRow(
            json("{'provider':'basic'}").toString(), "{\"meta\":{\"mode\":\"NOT_A_MODE\"}}"));

    reconcile(ConfigSourceMode.AUTO, "{'provider':'basic','maxActiveSessionsPerUser':1000}");

    assertEquals(1000, stored().get("maxActiveSessionsPerUser").asInt());
    assertEquals(ConfigSourceMode.AUTO, snapshot().meta().mode());
  }

  @Test
  void aSnapshotWriteRacingAnotherWriterIsRetriedOnTheirValue() {
    reconcile(ConfigSourceMode.AUTO, "{'provider':'basic','maxActiveSessionsPerUser':5}");
    AtomicInteger attempts = new AtomicInteger();
    doAnswer(
            invocation -> {
              if (attempts.incrementAndGet() == 1) {
                editStored("enableSelfSignup", false);
              }
              return snapshotCompareAndSet(
                  invocation.getArgument(0),
                  invocation.getArgument(1),
                  invocation.getArgument(2),
                  invocation.getArgument(3));
            })
        .when(dao)
        .updateDeploymentSnapshotIfCurrent(any(), any(), any(), any());

    reconcile(ConfigSourceMode.AUTO, "{'provider':'basic','maxActiveSessionsPerUser':5}");

    assertEquals(2, attempts.get());
    assertFalse(stored().get("enableSelfSignup").asBoolean());
  }

  @Test
  void storesSecretsEncryptedInTheSnapshot() {
    reconcile(
        ConfigSourceMode.AUTO,
        "{'provider':'custom-oidc','oidcConfiguration':{'id':'om','secret':'s3cret'}}");

    String storedSecret = snapshot().values().at("/oidcConfiguration/secret").asText();
    assertTrue(Fernet.isTokenized(storedSecret));
  }

  private void reconcile(ConfigSourceMode mode, String deploymentValue) {
    DeploymentSetting setting =
        new DeploymentSetting(DualSourceSetting.AUTHENTICATION, json(deploymentValue), TEMPLATE);
    DeploymentConfig deployment =
        DeploymentConfig.of(List.of(setting), new ConfigSourceConfiguration().withSecurity(mode));
    new DeploymentConfigReconciler(dao, new TestPreparer(), "2.1.0").reconcileAll(deployment);
  }

  /** A provider configured in the UI over the deployment's {@code basic}, last applied in AUTO. */
  private void storeUiConfiguredProvider() {
    DeploymentSnapshot lastApplied =
        new DeploymentSnapshot(
            json("{'provider':'basic','providerName':'','clientId':''}"),
            new DeploymentSnapshot.Meta(ConfigSourceMode.AUTO, "2.1.0", null, List.of(), null));
    rows.put(AUTH, new StoredSettingRow(json(UI_CONFIGURED_OIDC).toString(), lastApplied.toJson()));
  }

  private void reconcileSecurity(ConfigSourceConfiguration sources, String authenticationValue) {
    DeploymentSetting authorizer =
        new DeploymentSetting(
            DualSourceSetting.AUTHORIZER,
            json("{'adminPrincipals':['admin','ops']}"),
            AUTHORIZER_TEMPLATE);
    DeploymentSetting authentication =
        new DeploymentSetting(
            DualSourceSetting.AUTHENTICATION, json(authenticationValue), TEMPLATE);
    DeploymentConfig deployment =
        DeploymentConfig.of(
            List.of(authorizer, authentication), sources.withSecurity(ConfigSourceMode.ENV));
    new DeploymentConfigReconciler(dao, new TestPreparer(), "2.1.0").reconcileAll(deployment);
  }

  private JsonNode stored() {
    return SettingsSecrets.decrypted(
        AUTHENTICATION_CONFIGURATION, JsonUtils.readTree(rows.get(AUTH).json()));
  }

  private DeploymentSnapshot snapshot() {
    return DeploymentSnapshot.parse(rows.get(AUTH).snapshot()).orElseThrow();
  }

  private void editStored(String field, boolean value) {
    StoredSettingRow row = rows.get(AUTH);
    JsonNode edited = JsonUtils.readTree(row.json());
    ((ObjectNode) edited).put(field, value);
    rows.put(AUTH, new StoredSettingRow(edited.toString(), row.snapshot()));
  }

  /** Simulates an admin saving the setting between the reconciler's read and its write. */
  private AtomicInteger interveneOnFirstCompareAndSet() {
    AtomicInteger attempts = new AtomicInteger();
    when(dao.updateSettingsWithSnapshotIfCurrent(
            anyString(), anyString(), anyString(), anyString()))
        .thenAnswer(
            invocation -> {
              if (attempts.incrementAndGet() == 1) {
                editStored("enableSelfSignup", true);
              }
              return compareAndSet(
                  invocation.getArgument(0),
                  invocation.getArgument(1),
                  invocation.getArgument(2),
                  invocation.getArgument(3));
            });
    return attempts;
  }

  private SystemDAO inMemoryDao() {
    SystemDAO inMemory = mock(SystemDAO.class);
    when(inMemory.getStoredSettingRow(anyString()))
        .thenAnswer(i -> rows.get(i.<String>getArgument(0)));
    when(inMemory.getConfigJsonWithKey(anyString()))
        .thenAnswer(
            i ->
                rows.containsKey(i.<String>getArgument(0))
                    ? rows.get(i.<String>getArgument(0)).json()
                    : null);
    when(inMemory.insertSettingsIfAbsent(anyString(), anyString(), anyString()))
        .thenAnswer(
            i ->
                rows.putIfAbsent(
                            i.getArgument(0),
                            new StoredSettingRow(i.getArgument(1), i.getArgument(2)))
                        == null
                    ? 1
                    : 0);
    when(inMemory.updateSettingsWithSnapshotIfCurrent(
            anyString(), anyString(), anyString(), anyString()))
        .thenAnswer(
            i ->
                compareAndSet(
                    i.getArgument(0), i.getArgument(1), i.getArgument(2), i.getArgument(3)));
    doAnswer(
            i -> {
              rows.computeIfPresent(
                  i.getArgument(0),
                  (type, row) -> new StoredSettingRow(row.json(), i.getArgument(1)));
              return null;
            })
        .when(inMemory)
        .updateDeploymentSnapshot(anyString(), anyString());
    when(inMemory.updateDeploymentSnapshotIfCurrent(any(), any(), any(), any()))
        .thenAnswer(
            i ->
                snapshotCompareAndSet(
                    i.getArgument(0), i.getArgument(1), i.getArgument(2), i.getArgument(3)));
    return inMemory;
  }

  /** Like the database: the snapshot gets the hash of the written value in the same write. */
  private int compareAndSet(String type, String expectedJson, String updatedJson, String snapshot) {
    StoredSettingRow current = rows.get(type);
    boolean unchanged =
        current != null
            && JsonUtils.readTree(current.json()).equals(JsonUtils.readTree(expectedJson));
    if (unchanged) {
      ObjectNode marked = (ObjectNode) JsonUtils.readTree(snapshot);
      ((ObjectNode) marked.get("meta")).put("appliedJsonHash", hashOf(updatedJson));
      rows.put(type, new StoredSettingRow(updatedJson, marked.toString()));
    }
    return unchanged ? 1 : 0;
  }

  private int snapshotCompareAndSet(
      String type, String expectedJson, String expectedSnapshot, String snapshot) {
    StoredSettingRow current = rows.get(type);
    boolean unchanged =
        current != null
            && JsonUtils.readTree(current.json()).equals(JsonUtils.readTree(expectedJson))
            && Objects.equals(current.snapshot(), expectedSnapshot);
    if (unchanged) {
      rows.put(type, new StoredSettingRow(current.json(), snapshot));
    }
    return unchanged ? 1 : 0;
  }

  private static String hashOf(String json) {
    return Integer.toHexString(JsonUtils.readTree(json).hashCode());
  }

  /** Stores what it is given, secrets encrypted, like the settings repository. */
  private final class TestPreparer implements DeploymentSettingPreparer {
    @Override
    public String prepareReconciled(SettingsType settingsType, JsonNode value) {
      if (rejectNextPreparedValue.getAndSet(false)) {
        throw new BadRequestException("Invalid security configuration");
      }
      return JsonUtils.pojoToJson(SettingsSecrets.encrypted(settingsType, value));
    }

    @Override
    public String prepareSeed(SettingsType settingsType, JsonNode value) {
      return prepareReconciled(settingsType, value);
    }
  }

  private static JsonNode json(String singleQuoted) {
    try {
      return MAPPER.readTree(singleQuoted.replace('\'', '"'));
    } catch (JsonProcessingException invalid) {
      throw new IllegalArgumentException(singleQuoted, invalid);
    }
  }
}
