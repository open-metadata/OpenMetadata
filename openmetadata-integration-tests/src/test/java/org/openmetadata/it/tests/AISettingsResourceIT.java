/*
 *  Copyright 2025 Collate
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

package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.junit.jupiter.api.parallel.Isolated;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.configuration.AIDeletionPolicy;
import org.openmetadata.schema.configuration.AISettings;
import org.openmetadata.schema.configuration.MemoryAgentSettings;
import org.openmetadata.schema.settings.Settings;
import org.openmetadata.schema.settings.SettingsType;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.network.RequestOptions;

/**
 * Integration tests for the AI Settings REST resource ({@code /system/settings/aiSettings}).
 *
 * <p>These tests are fully deterministic: no LLM provider is required. They verify GET default
 * values, PUT with changed settings, and reset to defaults via the admin client.
 *
 * <p>@Isolated because each test mutates global AI settings; isolation prevents interference with
 * concurrently-running tests that read the same settings.
 */
@Isolated
@Execution(ExecutionMode.SAME_THREAD)
@ExtendWith(TestNamespaceExtension.class)
public class AISettingsResourceIT {

  private static final ObjectMapper MAPPER = new ObjectMapper();
  private static final String SETTINGS_PATH = "/v1/system/settings";
  private static final String AI_SETTINGS_PATH = SETTINGS_PATH + "/aiSettings";
  private static final String AI_SETTINGS_RESET_PATH = SETTINGS_PATH + "/reset/aiSettings";

  @Test
  void get_aiSettings_defaultsAreCorrect() throws Exception {
    resetToDefaults();

    AISettings settings = fetchAiSettings();

    assertNotNull(settings, "AISettings must not be null");
    assertTrue(settings.getEnabled(), "Top-level enabled must default to true");
    assertNotNull(settings.getMemoryAgent(), "memoryAgent must be present in defaults");
    assertTrue(settings.getMemoryAgent().getEnabled(), "memoryAgent.enabled must default to true");
    assertEquals(
        AIDeletionPolicy.CASCADE,
        settings.getMemoryAgent().getDeletionPolicy(),
        "memoryAgent.deletionPolicy must default to cascade");
  }

  @Test
  void put_aiSettings_persistsMemoryAgentDisabled() throws Exception {
    resetToDefaults();

    AISettings modified =
        new AISettings()
            .withEnabled(true)
            .withMemoryAgent(new MemoryAgentSettings().withEnabled(false));
    putAiSettings(modified);

    AISettings fetched = fetchAiSettings();

    assertNotNull(fetched, "Fetched AISettings must not be null");
    assertTrue(fetched.getEnabled(), "Top-level enabled must remain true after partial PUT");
    assertNotNull(fetched.getMemoryAgent(), "memoryAgent must be present after PUT");
    assertEquals(
        false,
        fetched.getMemoryAgent().getEnabled(),
        "memoryAgent.enabled must reflect the PUT value");
  }

  @Test
  void put_resetAiSettings_restoresDefaults() throws Exception {
    AISettings modified =
        new AISettings()
            .withEnabled(true)
            .withMemoryAgent(new MemoryAgentSettings().withEnabled(false));
    putAiSettings(modified);

    resetToDefaults();

    AISettings restored = fetchAiSettings();

    assertNotNull(restored, "Restored AISettings must not be null");
    assertTrue(restored.getEnabled(), "Top-level enabled must be true after reset");
    assertNotNull(restored.getMemoryAgent(), "memoryAgent must be present after reset");
    assertTrue(
        restored.getMemoryAgent().getEnabled(), "memoryAgent.enabled must be true after reset");
    assertEquals(
        AIDeletionPolicy.CASCADE,
        restored.getMemoryAgent().getDeletionPolicy(),
        "memoryAgent.deletionPolicy must be cascade after reset");
  }

  private AISettings fetchAiSettings() throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    String json =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.GET, AI_SETTINGS_PATH, null, RequestOptions.builder().build());
    Settings settings = MAPPER.readValue(json, Settings.class);
    assertEquals(SettingsType.AI_SETTINGS, settings.getConfigType());
    return MAPPER.convertValue(settings.getConfigValue(), AISettings.class);
  }

  private void putAiSettings(AISettings aiSettings) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    Settings payload =
        new Settings().withConfigType(SettingsType.AI_SETTINGS).withConfigValue(aiSettings);
    String json = MAPPER.writeValueAsString(payload);
    client
        .getHttpClient()
        .executeForString(HttpMethod.PUT, SETTINGS_PATH, json, RequestOptions.builder().build());
  }

  private void resetToDefaults() throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    client
        .getHttpClient()
        .executeForString(
            HttpMethod.PUT, AI_SETTINGS_RESET_PATH, null, RequestOptions.builder().build());
  }
}
