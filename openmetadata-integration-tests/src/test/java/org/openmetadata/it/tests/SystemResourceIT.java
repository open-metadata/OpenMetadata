/*
 *  Copyright 2021 Collate
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

import static org.junit.jupiter.api.Assertions.*;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.api.configuration.UiThemePreference;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.settings.Settings;
import org.openmetadata.schema.settings.SettingsType;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.network.RequestOptions;

/**
 * Integration tests for System Resource endpoints.
 *
 * <p>Tests system-level endpoints including version info, health checks, and system configuration
 * retrieval. These endpoints don't follow the standard entity CRUD pattern.
 *
 * <p>Migrated from: org.openmetadata.service.resources.system.SystemResourceTest
 *
 * <p>Test isolation: Uses TestNamespace extension for test isolation Parallelization: Safe for
 * concurrent execution via @Execution(ExecutionMode.CONCURRENT)
 */
@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class SystemResourceIT {

  private static final ObjectMapper MAPPER = new ObjectMapper();

  @Test
  void test_getSystemVersion() throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    String versionJson =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.GET, "/system/version", null, RequestOptions.builder().build());

    assertNotNull(versionJson, "Version response should not be null");
    assertFalse(versionJson.isEmpty(), "Version response should not be empty");

    JsonNode versionNode = MAPPER.readTree(versionJson);

    assertTrue(versionNode.has("version"), "Version response should contain 'version' field");
    assertNotNull(versionNode.get("version").asText(), "Version should not be null");
    assertFalse(
        versionNode.get("version").asText().isEmpty(), "Version string should not be empty");

    assertTrue(versionNode.has("revision"), "Version response should contain 'revision' field");
    assertNotNull(versionNode.get("revision").asText(), "Revision should not be null");

    assertTrue(versionNode.has("timestamp"), "Version response should contain 'timestamp' field");
    assertTrue(versionNode.get("timestamp").asLong() > 0, "Timestamp should be positive");
  }

  @Test
  void test_getSystemStatus() throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    String statusJson =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.GET, "/system/status", null, RequestOptions.builder().build());

    assertNotNull(statusJson, "Status response should not be null");
    assertFalse(statusJson.isEmpty(), "Status response should not be empty");

    JsonNode statusNode = MAPPER.readTree(statusJson);

    assertTrue(statusNode.has("migrations"), "Status should contain 'migrations' field");
    JsonNode migrations = statusNode.get("migrations");
    assertTrue(migrations.has("passed"), "Migrations should have 'passed' field");

    Boolean migrationsPassed = migrations.get("passed").asBoolean();
    assertTrue(migrationsPassed, "Database migrations should have passed");
  }

  @Test
  void test_getSystemHealthCheck() throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    String healthJson =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.GET, "/system/status", null, RequestOptions.builder().build());

    assertNotNull(healthJson, "Health check response should not be null");
    assertFalse(healthJson.isEmpty(), "Health check response should not be empty");

    JsonNode healthNode = MAPPER.readTree(healthJson);
    assertNotNull(healthNode, "Health check should return valid JSON");
  }

  @Test
  void test_getSystemConfig_customUITheme() throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    String settingsJson =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.GET,
                "/system/settings/" + SettingsType.CUSTOM_UI_THEME_PREFERENCE.value(),
                null,
                RequestOptions.builder().build());

    assertNotNull(settingsJson, "Settings response should not be null");
    assertFalse(settingsJson.isEmpty(), "Settings response should not be empty");

    Settings settings = MAPPER.readValue(settingsJson, Settings.class);

    assertNotNull(settings, "Settings object should not be null");
    assertEquals(
        SettingsType.CUSTOM_UI_THEME_PREFERENCE,
        settings.getConfigType(),
        "Config type should match");
    assertNotNull(settings.getConfigValue(), "Config value should not be null");

    UiThemePreference themePreference =
        MAPPER.convertValue(settings.getConfigValue(), UiThemePreference.class);
    assertNotNull(themePreference, "Theme preference should be deserializable");
    assertNotNull(themePreference.getCustomTheme(), "Custom theme should not be null");
    assertNotNull(themePreference.getCustomLogoConfig(), "Custom logo config should not be null");
  }

  @Test
  void test_getSystemConfig_loginConfiguration() throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    String settingsJson =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.GET,
                "/system/settings/" + SettingsType.LOGIN_CONFIGURATION.value(),
                null,
                RequestOptions.builder().build());

    assertNotNull(settingsJson, "Login configuration response should not be null");
    assertFalse(settingsJson.isEmpty(), "Login configuration response should not be empty");

    Settings settings = MAPPER.readValue(settingsJson, Settings.class);

    assertNotNull(settings, "Settings object should not be null");
    assertEquals(
        SettingsType.LOGIN_CONFIGURATION, settings.getConfigType(), "Config type should match");
    assertNotNull(settings.getConfigValue(), "Config value should not be null");
  }

  @Test
  void test_listSystemSettings() throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    String allSettingsJson =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.GET, "/system/settings", null, RequestOptions.builder().build());

    assertNotNull(allSettingsJson, "All settings response should not be null");
    assertFalse(allSettingsJson.isEmpty(), "All settings response should not be empty");

    JsonNode settingsArray = MAPPER.readTree(allSettingsJson);
    assertTrue(settingsArray.isArray(), "Settings response should be an array");
    assertTrue(settingsArray.size() > 0, "Should have at least one setting configured");

    for (JsonNode settingNode : settingsArray) {
      assertTrue(settingNode.has("config_type"), "Each setting should have config_type");
      assertTrue(settingNode.has("config_value"), "Each setting should have config_value");
    }
  }

  @Test
  void test_getEntitiesCount() throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    String entitiesCountJson =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.GET, "/system/entities/count", null, RequestOptions.builder().build());

    assertNotNull(entitiesCountJson, "Entities count response should not be null");
    assertFalse(entitiesCountJson.isEmpty(), "Entities count response should not be empty");

    JsonNode countNode = MAPPER.readTree(entitiesCountJson);

    assertTrue(countNode.has("tableCount"), "Should have tableCount");
    assertTrue(countNode.has("topicCount"), "Should have topicCount");
    assertTrue(countNode.has("dashboardCount"), "Should have dashboardCount");
    assertTrue(countNode.has("pipelineCount"), "Should have pipelineCount");
    assertTrue(countNode.has("servicesCount"), "Should have servicesCount");
    assertTrue(countNode.has("userCount"), "Should have userCount");
    assertTrue(countNode.has("teamCount"), "Should have teamCount");

    assertTrue(countNode.get("tableCount").asInt() >= 0, "Table count should be non-negative");
    assertTrue(countNode.get("userCount").asInt() >= 0, "User count should be non-negative");
  }

  @Test
  void test_getServicesCount() throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    String servicesCountJson =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.GET, "/system/services/count", null, RequestOptions.builder().build());

    assertNotNull(servicesCountJson, "Services count response should not be null");
    assertFalse(servicesCountJson.isEmpty(), "Services count response should not be empty");

    JsonNode countNode = MAPPER.readTree(servicesCountJson);

    assertTrue(countNode.has("databaseServiceCount"), "Should have databaseServiceCount");
    assertTrue(countNode.has("messagingServiceCount"), "Should have messagingServiceCount");
    assertTrue(countNode.has("dashboardServiceCount"), "Should have dashboardServiceCount");
    assertTrue(countNode.has("pipelineServiceCount"), "Should have pipelineServiceCount");
    assertTrue(countNode.has("mlModelServiceCount"), "Should have mlModelServiceCount");

    assertTrue(
        countNode.get("databaseServiceCount").asInt() >= 0,
        "Database service count should be non-negative");
  }

  @Test
  void test_getSystemConfig_searchSettings() throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    String settingsJson =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.GET,
                "/system/settings/" + SettingsType.SEARCH_SETTINGS.value(),
                null,
                RequestOptions.builder().build());

    assertNotNull(settingsJson, "Search settings response should not be null");
    assertFalse(settingsJson.isEmpty(), "Search settings response should not be empty");

    Settings settings = MAPPER.readValue(settingsJson, Settings.class);

    assertNotNull(settings, "Settings object should not be null");
    assertEquals(
        SettingsType.SEARCH_SETTINGS, settings.getConfigType(), "Config type should match");
    assertNotNull(settings.getConfigValue(), "Config value should not be null");

    JsonNode configValue = MAPPER.valueToTree(settings.getConfigValue());
    assertTrue(configValue.has("globalSettings"), "Should have globalSettings");

    JsonNode globalSettings = configValue.get("globalSettings");
    assertTrue(globalSettings.has("maxAggregateSize"), "Should have maxAggregateSize");
    assertTrue(globalSettings.has("maxResultHits"), "Should have maxResultHits");
    assertTrue(globalSettings.has("maxAnalyzedOffset"), "Should have maxAnalyzedOffset");
  }

  @Test
  void test_getSystemConfig_lineageSettings() throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    String settingsJson =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.GET,
                "/system/settings/" + SettingsType.LINEAGE_SETTINGS.value(),
                null,
                RequestOptions.builder().build());

    assertNotNull(settingsJson, "Lineage settings response should not be null");
    assertFalse(settingsJson.isEmpty(), "Lineage settings response should not be empty");

    Settings settings = MAPPER.readValue(settingsJson, Settings.class);

    assertNotNull(settings, "Settings object should not be null");
    assertEquals(
        SettingsType.LINEAGE_SETTINGS, settings.getConfigType(), "Config type should match");
    assertNotNull(settings.getConfigValue(), "Config value should not be null");

    JsonNode configValue = MAPPER.valueToTree(settings.getConfigValue());
    assertTrue(configValue.has("upstreamDepth"), "Should have upstreamDepth");
    assertTrue(configValue.has("downstreamDepth"), "Should have downstreamDepth");

    int upstreamDepth = configValue.get("upstreamDepth").asInt();
    int downstreamDepth = configValue.get("downstreamDepth").asInt();

    assertTrue(upstreamDepth > 0, "Upstream depth should be positive");
    assertTrue(downstreamDepth > 0, "Downstream depth should be positive");
  }

  @Test
  void test_getSystemConfig_workflowSettings() throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    String settingsJson =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.GET,
                "/system/settings/" + SettingsType.WORKFLOW_SETTINGS.value(),
                null,
                RequestOptions.builder().build());

    assertNotNull(settingsJson, "Workflow settings response should not be null");
    assertFalse(settingsJson.isEmpty(), "Workflow settings response should not be empty");

    Settings settings = MAPPER.readValue(settingsJson, Settings.class);

    assertNotNull(settings, "Settings object should not be null");
    assertEquals(
        SettingsType.WORKFLOW_SETTINGS, settings.getConfigType(), "Config type should match");
    assertNotNull(settings.getConfigValue(), "Config value should not be null");

    JsonNode configValue = MAPPER.valueToTree(settings.getConfigValue());
    assertTrue(configValue.has("executorConfiguration"), "Should have executorConfiguration");
    assertTrue(
        configValue.has("historyCleanUpConfiguration"), "Should have historyCleanUpConfiguration");

    JsonNode executorConfig = configValue.get("executorConfiguration");
    assertTrue(executorConfig.has("corePoolSize"), "Should have corePoolSize");
    assertTrue(executorConfig.has("maxPoolSize"), "Should have maxPoolSize");
    assertTrue(executorConfig.has("queueSize"), "Should have queueSize");
  }

  @Test
  void test_getSystemVersionInfo() throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    String versionJson =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.GET, "/system/version", null, RequestOptions.builder().build());

    assertNotNull(versionJson, "Version info should not be null");

    JsonNode versionInfo = MAPPER.readTree(versionJson);

    assertTrue(versionInfo.has("version"), "Version info should contain version field");
    String version = versionInfo.get("version").asText();
    assertNotNull(version, "Version should not be null");
    assertFalse(version.isEmpty(), "Version should not be empty");

    assertTrue(
        version.matches("\\d+\\.\\d+\\.\\d+.*"),
        "Version should follow semantic versioning pattern (e.g., 1.2.3)");
  }

  @Test
  void test_systemEndpointsAccessible() throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    String[] endpoints =
        new String[] {
          "/system/version",
          "/system/status",
          "/system/entities/count",
          "/system/services/count",
          "/system/settings"
        };

    for (String endpoint : endpoints) {
      String response =
          client
              .getHttpClient()
              .executeForString(HttpMethod.GET, endpoint, null, RequestOptions.builder().build());

      assertNotNull(response, "Response from endpoint " + endpoint + " should not be null");
      assertFalse(
          response.isEmpty(), "Response from endpoint " + endpoint + " should not be empty");

      JsonNode jsonResponse = MAPPER.readTree(response);
      assertNotNull(jsonResponse, "Response from endpoint " + endpoint + " should be valid JSON");
    }
  }

  @Test
  void test_systemStatusContainsValidationResponse() throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    String statusJson =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.GET, "/system/status", null, RequestOptions.builder().build());

    JsonNode statusNode = MAPPER.readTree(statusJson);

    assertTrue(statusNode.has("migrations"), "Status should contain migrations");

    JsonNode migrations = statusNode.get("migrations");
    assertTrue(migrations.has("passed"), "Migrations should have passed field");
    assertTrue(migrations.has("statusCode"), "Migrations should have statusCode field");

    assertTrue(
        migrations.get("passed").asBoolean(),
        "Migrations should have passed for integration tests to run");
  }
}
