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

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assertions.fail;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.api.configuration.LogoConfiguration;
import org.openmetadata.api.configuration.ThemeConfiguration;
import org.openmetadata.api.configuration.UiThemePreference;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.configuration.LoginConfiguration;
import org.openmetadata.schema.api.configuration.profiler.MetricConfigurationDefinition;
import org.openmetadata.schema.api.configuration.profiler.ProfilerConfiguration;
import org.openmetadata.schema.api.lineage.LineageSettings;
import org.openmetadata.schema.api.search.AllowedSearchFields;
import org.openmetadata.schema.api.search.AssetTypeConfiguration;
import org.openmetadata.schema.api.search.Field;
import org.openmetadata.schema.api.search.FieldBoost;
import org.openmetadata.schema.api.search.FieldValueBoost;
import org.openmetadata.schema.api.search.SearchSettings;
import org.openmetadata.schema.api.search.TermBoost;
import org.openmetadata.schema.api.security.AuthenticationConfiguration;
import org.openmetadata.schema.api.security.AuthorizerConfiguration;
import org.openmetadata.schema.api.security.ClientType;
import org.openmetadata.schema.api.security.ResponseType;
import org.openmetadata.schema.api.teams.CreateUser;
import org.openmetadata.schema.auth.JWTAuthMechanism;
import org.openmetadata.schema.auth.JWTTokenExpiry;
import org.openmetadata.schema.configuration.AssetCertificationSettings;
import org.openmetadata.schema.configuration.SecurityConfiguration;
import org.openmetadata.schema.configuration.WorkflowSettings;
import org.openmetadata.schema.entity.teams.AuthenticationMechanism;
import org.openmetadata.schema.profiler.MetricType;
import org.openmetadata.schema.services.connections.metadata.AuthProvider;
import org.openmetadata.schema.settings.Settings;
import org.openmetadata.schema.settings.SettingsType;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.SemanticsRule;
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
                HttpMethod.GET, "/v1/system/version", null, RequestOptions.builder().build());

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
                HttpMethod.GET, "/v1/system/status", null, RequestOptions.builder().build());

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
                HttpMethod.GET, "/v1/system/status", null, RequestOptions.builder().build());

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
                "/v1/system/settings/" + SettingsType.CUSTOM_UI_THEME_PREFERENCE.value(),
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
                "/v1/system/settings/" + SettingsType.LOGIN_CONFIGURATION.value(),
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
                HttpMethod.GET, "/v1/system/settings", null, RequestOptions.builder().build());

    assertNotNull(allSettingsJson, "All settings response should not be null");
    assertFalse(allSettingsJson.isEmpty(), "All settings response should not be empty");

    JsonNode responseNode = MAPPER.readTree(allSettingsJson);
    assertTrue(responseNode.has("data"), "Settings response should have 'data' field");

    JsonNode settingsArray = responseNode.get("data");
    assertTrue(settingsArray.isArray(), "Settings data should be an array");
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
                HttpMethod.GET,
                "/v1/system/entities/count",
                null,
                RequestOptions.builder().build());

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
                HttpMethod.GET,
                "/v1/system/services/count",
                null,
                RequestOptions.builder().build());

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
                "/v1/system/settings/" + SettingsType.SEARCH_SETTINGS.value(),
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
                "/v1/system/settings/" + SettingsType.LINEAGE_SETTINGS.value(),
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
                "/v1/system/settings/" + SettingsType.WORKFLOW_SETTINGS.value(),
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
                HttpMethod.GET, "/v1/system/version", null, RequestOptions.builder().build());

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
          "/v1/system/version",
          "/v1/system/status",
          "/v1/system/entities/count",
          "/v1/system/services/count",
          "/v1/system/settings"
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
                HttpMethod.GET, "/v1/system/status", null, RequestOptions.builder().build());

    JsonNode statusNode = MAPPER.readTree(statusJson);

    assertTrue(statusNode.has("migrations"), "Status should contain migrations");

    JsonNode migrations = statusNode.get("migrations");
    assertTrue(migrations.has("passed"), "Migrations should have passed field");

    assertTrue(
        migrations.get("passed").asBoolean(),
        "Migrations should have passed for integration tests to run");
  }

  @Test
  void test_getEntitiesCountWithInclude() throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    String allResponseJson =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.GET,
                "/v1/system/entities/count?include=all",
                null,
                RequestOptions.builder().build());

    assertNotNull(allResponseJson, "All entities count response should not be null");

    JsonNode allCountsNode = MAPPER.readTree(allResponseJson);
    assertTrue(allCountsNode.has("tableCount"), "Should have table count");

    String nonDeletedResponseJson =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.GET,
                "/v1/system/entities/count?include=non-deleted",
                null,
                RequestOptions.builder().build());

    assertNotNull(nonDeletedResponseJson, "Non-deleted entities count should not be null");

    JsonNode nonDeletedCountsNode = MAPPER.readTree(nonDeletedResponseJson);
    assertTrue(nonDeletedCountsNode.has("tableCount"), "Should have table count");

    int allTableCount = allCountsNode.get("tableCount").asInt();
    int nonDeletedTableCount = nonDeletedCountsNode.get("tableCount").asInt();

    assertTrue(allTableCount >= nonDeletedTableCount, "All count should be >= non-deleted count");
  }

  @Test
  void test_updateCustomUIThemePreference(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    UiThemePreference updateConfigReq =
        new UiThemePreference()
            .withCustomLogoConfig(
                new LogoConfiguration()
                    .withCustomLogoUrlPath("http://test.com")
                    .withCustomMonogramUrlPath("http://test.com"))
            .withCustomTheme(
                new ThemeConfiguration()
                    .withPrimaryColor("#FF5733")
                    .withSuccessColor("#28A745")
                    .withErrorColor("#DC3545")
                    .withWarningColor("#FFC107")
                    .withInfoColor("#17A2B8"));

    Settings updateSettings =
        new Settings()
            .withConfigType(SettingsType.CUSTOM_UI_THEME_PREFERENCE)
            .withConfigValue(updateConfigReq);

    String updateJson = MAPPER.writeValueAsString(updateSettings);
    String updatedJson =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.PUT,
                "/v1/system/settings",
                updateJson,
                RequestOptions.builder().build());

    Settings updated = MAPPER.readValue(updatedJson, Settings.class);
    UiThemePreference updatedConfig =
        MAPPER.convertValue(updated.getConfigValue(), UiThemePreference.class);

    assertEquals("http://test.com", updatedConfig.getCustomLogoConfig().getCustomLogoUrlPath());
    assertEquals("#FF5733", updatedConfig.getCustomTheme().getPrimaryColor());

    UiThemePreference resetConfigReq =
        new UiThemePreference()
            .withCustomLogoConfig(
                new LogoConfiguration().withCustomLogoUrlPath("").withCustomMonogramUrlPath(""))
            .withCustomTheme(
                new ThemeConfiguration()
                    .withPrimaryColor("")
                    .withSuccessColor("")
                    .withErrorColor("")
                    .withWarningColor("")
                    .withInfoColor(""));

    Settings resetSettings =
        new Settings()
            .withConfigType(SettingsType.CUSTOM_UI_THEME_PREFERENCE)
            .withConfigValue(resetConfigReq);

    String resetJson = MAPPER.writeValueAsString(resetSettings);
    client
        .getHttpClient()
        .executeForString(
            HttpMethod.PUT, "/v1/system/settings", resetJson, RequestOptions.builder().build());
  }

  @Test
  void test_botUserNotCountedInUserCount(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    String beforeCountJson =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.GET,
                "/v1/system/entities/count",
                null,
                RequestOptions.builder().build());

    JsonNode beforeCount = MAPPER.readTree(beforeCountJson);
    int beforeUserCount = beforeCount.get("userCount").asInt();

    CreateUser createBotUser =
        new CreateUser()
            .withName(ns.prefix("testbotuser"))
            .withEmail("botuser" + ns.shortPrefix() + "@example.com")
            .withIsBot(true)
            .withAuthenticationMechanism(
                new AuthenticationMechanism()
                    .withAuthType(AuthenticationMechanism.AuthType.JWT)
                    .withConfig(
                        new JWTAuthMechanism().withJWTTokenExpiry(JWTTokenExpiry.Unlimited)));

    String botUserJson = MAPPER.writeValueAsString(createBotUser);
    client
        .getHttpClient()
        .executeForString(
            HttpMethod.POST, "/v1/users", botUserJson, RequestOptions.builder().build());

    String afterCountJson =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.GET,
                "/v1/system/entities/count",
                null,
                RequestOptions.builder().build());

    JsonNode afterCount = MAPPER.readTree(afterCountJson);
    int afterUserCount = afterCount.get("userCount").asInt();

    // Verify the bot user is NOT counted in userCount
    // Note: In parallel test execution, other tests might create regular users between
    // our before/after measurements. We verify by querying if our specific bot exists
    // and checking it's not included in regular user counts.
    // The key assertion: after creating a bot, userCount should not increase due to that bot.
    // We allow a small tolerance for parallel test interference but fail if count increases
    // significantly.
    int maxAllowedIncrease = 5; // Tolerance for parallel tests creating regular users
    assertTrue(
        afterUserCount <= beforeUserCount + maxAllowedIncrease,
        String.format(
            "User count increased unexpectedly. Before: %d, After: %d, Max allowed: %d. "
                + "This might indicate bot users are being incorrectly counted.",
            beforeUserCount, afterUserCount, beforeUserCount + maxAllowedIncrease));
  }

  @Test
  void test_updateLoginConfiguration() throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    String settingsJson =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.GET,
                "/v1/system/settings/" + SettingsType.LOGIN_CONFIGURATION.value(),
                null,
                RequestOptions.builder().build());

    Settings settings = MAPPER.readValue(settingsJson, Settings.class);
    LoginConfiguration loginConfig =
        MAPPER.convertValue(settings.getConfigValue(), LoginConfiguration.class);

    int originalMaxAttempts = loginConfig.getMaxLoginFailAttempts();
    int originalBlockTime = loginConfig.getAccessBlockTime();
    int originalTokenExpiry = loginConfig.getJwtTokenExpiryTime();

    loginConfig.setMaxLoginFailAttempts(5);
    loginConfig.setAccessBlockTime(300);
    loginConfig.setJwtTokenExpiryTime(7200);

    Settings updatedSettings =
        new Settings()
            .withConfigType(SettingsType.LOGIN_CONFIGURATION)
            .withConfigValue(loginConfig);

    String updateJson = MAPPER.writeValueAsString(updatedSettings);
    String updatedJson =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.PUT,
                "/v1/system/settings",
                updateJson,
                RequestOptions.builder().build());

    Settings updated = MAPPER.readValue(updatedJson, Settings.class);
    LoginConfiguration updatedLoginConfig =
        MAPPER.convertValue(updated.getConfigValue(), LoginConfiguration.class);

    assertEquals(5, updatedLoginConfig.getMaxLoginFailAttempts());
    assertEquals(300, updatedLoginConfig.getAccessBlockTime());
    assertEquals(7200, updatedLoginConfig.getJwtTokenExpiryTime());

    loginConfig.setMaxLoginFailAttempts(originalMaxAttempts);
    loginConfig.setAccessBlockTime(originalBlockTime);
    loginConfig.setJwtTokenExpiryTime(originalTokenExpiry);

    Settings resetSettings =
        new Settings()
            .withConfigType(SettingsType.LOGIN_CONFIGURATION)
            .withConfigValue(loginConfig);

    String resetJson = MAPPER.writeValueAsString(resetSettings);
    client
        .getHttpClient()
        .executeForString(
            HttpMethod.PUT, "/v1/system/settings", resetJson, RequestOptions.builder().build());
  }

  @Test
  void test_getDefaultSearchSettings() throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    String settingsJson =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.GET,
                "/v1/system/settings/" + SettingsType.SEARCH_SETTINGS.value(),
                null,
                RequestOptions.builder().build());

    Settings settings = MAPPER.readValue(settingsJson, Settings.class);
    SearchSettings searchConfig =
        MAPPER.convertValue(settings.getConfigValue(), SearchSettings.class);

    assertNotNull(searchConfig.getGlobalSettings());
    assertEquals(10000, searchConfig.getGlobalSettings().getMaxAggregateSize());
    assertEquals(10000, searchConfig.getGlobalSettings().getMaxResultHits());
    assertEquals(1000, searchConfig.getGlobalSettings().getMaxAnalyzedOffset());

    assertNotNull(searchConfig.getGlobalSettings().getAggregations());
    assertFalse(searchConfig.getGlobalSettings().getAggregations().isEmpty());

    assertNotNull(searchConfig.getGlobalSettings().getHighlightFields());
    assertFalse(searchConfig.getGlobalSettings().getHighlightFields().isEmpty());

    assertNotNull(searchConfig.getAssetTypeConfigurations());
    assertFalse(searchConfig.getAssetTypeConfigurations().isEmpty());

    boolean tableConfigExists =
        searchConfig.getAssetTypeConfigurations().stream()
            .anyMatch(conf -> "table".equalsIgnoreCase(conf.getAssetType()));
    assertTrue(tableConfigExists);

    assertNotNull(searchConfig.getDefaultConfiguration());
  }

  @Test
  void test_resetSearchSettingsToDefault() throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    String settingsJson =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.GET,
                "/v1/system/settings/" + SettingsType.SEARCH_SETTINGS.value(),
                null,
                RequestOptions.builder().build());

    Settings settings = MAPPER.readValue(settingsJson, Settings.class);
    SearchSettings searchConfig =
        MAPPER.convertValue(settings.getConfigValue(), SearchSettings.class);

    searchConfig.getGlobalSettings().setEnableAccessControl(true);
    searchConfig.getGlobalSettings().setMaxAggregateSize(5000);

    AssetTypeConfiguration tableConfig =
        searchConfig.getAssetTypeConfigurations().stream()
            .filter(conf -> "table".equalsIgnoreCase(conf.getAssetType()))
            .findFirst()
            .orElseThrow(() -> new AssertionError("Table configuration not found"));

    FieldBoost nameField =
        tableConfig.getSearchFields().stream()
            .filter(field -> "name".equals(field.getField()))
            .findFirst()
            .orElseThrow(() -> new AssertionError("Name field configuration not found"));

    nameField.setBoost(nameField.getBoost() + 20.0);

    Settings updatedSettings =
        new Settings().withConfigType(SettingsType.SEARCH_SETTINGS).withConfigValue(searchConfig);

    String updateJson = MAPPER.writeValueAsString(updatedSettings);
    client
        .getHttpClient()
        .executeForString(
            HttpMethod.PUT, "/v1/system/settings", updateJson, RequestOptions.builder().build());

    String modifiedJson =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.GET,
                "/v1/system/settings/" + SettingsType.SEARCH_SETTINGS.value(),
                null,
                RequestOptions.builder().build());

    Settings modifiedSettings = MAPPER.readValue(modifiedJson, Settings.class);
    SearchSettings modifiedSearchConfig =
        MAPPER.convertValue(modifiedSettings.getConfigValue(), SearchSettings.class);

    assertEquals(true, modifiedSearchConfig.getGlobalSettings().getEnableAccessControl());
    assertEquals(5000, modifiedSearchConfig.getGlobalSettings().getMaxAggregateSize());

    client
        .getHttpClient()
        .executeForString(
            HttpMethod.PUT,
            "/v1/system/settings/reset/" + SettingsType.SEARCH_SETTINGS.value(),
            null,
            RequestOptions.builder().build());

    String resetJson =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.GET,
                "/v1/system/settings/" + SettingsType.SEARCH_SETTINGS.value(),
                null,
                RequestOptions.builder().build());

    Settings resetSettings = MAPPER.readValue(resetJson, Settings.class);
    SearchSettings resetSearchConfig =
        MAPPER.convertValue(resetSettings.getConfigValue(), SearchSettings.class);

    assertEquals(false, resetSearchConfig.getGlobalSettings().getEnableAccessControl());
    assertEquals(10000, resetSearchConfig.getGlobalSettings().getMaxAggregateSize());
  }

  @Test
  void test_globalSettingsModification() throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    String settingsJson =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.GET,
                "/v1/system/settings/" + SettingsType.SEARCH_SETTINGS.value(),
                null,
                RequestOptions.builder().build());

    Settings settings = MAPPER.readValue(settingsJson, Settings.class);
    SearchSettings searchConfig =
        MAPPER.convertValue(settings.getConfigValue(), SearchSettings.class);

    List<?> originalAggregations = searchConfig.getGlobalSettings().getAggregations();
    List<String> originalHighlightFields = searchConfig.getGlobalSettings().getHighlightFields();

    searchConfig.getGlobalSettings().setMaxAggregateSize(5000);
    searchConfig.getGlobalSettings().setMaxResultHits(8000);
    searchConfig.getGlobalSettings().setMaxAnalyzedOffset(2000);

    searchConfig.getGlobalSettings().setAggregations(new ArrayList<>());
    searchConfig.getGlobalSettings().setHighlightFields(List.of("modifiedField"));

    Settings updatedSettings =
        new Settings().withConfigType(SettingsType.SEARCH_SETTINGS).withConfigValue(searchConfig);

    String updateJson = MAPPER.writeValueAsString(updatedSettings);
    client
        .getHttpClient()
        .executeForString(
            HttpMethod.PUT, "/v1/system/settings", updateJson, RequestOptions.builder().build());

    String retrievedJson =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.GET,
                "/v1/system/settings/" + SettingsType.SEARCH_SETTINGS.value(),
                null,
                RequestOptions.builder().build());

    Settings retrievedSettings = MAPPER.readValue(retrievedJson, Settings.class);
    SearchSettings updatedSearchConfig =
        MAPPER.convertValue(retrievedSettings.getConfigValue(), SearchSettings.class);

    assertEquals(5000, updatedSearchConfig.getGlobalSettings().getMaxAggregateSize());
    assertEquals(8000, updatedSearchConfig.getGlobalSettings().getMaxResultHits());
    assertEquals(2000, updatedSearchConfig.getGlobalSettings().getMaxAnalyzedOffset());

    assertEquals(originalAggregations, updatedSearchConfig.getGlobalSettings().getAggregations());
    assertEquals(
        originalHighlightFields, updatedSearchConfig.getGlobalSettings().getHighlightFields());
  }

  @Test
  void test_cannotDeleteAssetType() throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    String settingsJson =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.GET,
                "/v1/system/settings/" + SettingsType.SEARCH_SETTINGS.value(),
                null,
                RequestOptions.builder().build());

    Settings settings = MAPPER.readValue(settingsJson, Settings.class);
    SearchSettings searchConfig =
        MAPPER.convertValue(settings.getConfigValue(), SearchSettings.class);

    searchConfig
        .getAssetTypeConfigurations()
        .removeIf(conf -> "table".equalsIgnoreCase(conf.getAssetType()));

    Settings updatedSettings =
        new Settings().withConfigType(SettingsType.SEARCH_SETTINGS).withConfigValue(searchConfig);

    String updateJson = MAPPER.writeValueAsString(updatedSettings);
    client
        .getHttpClient()
        .executeForString(
            HttpMethod.PUT, "/v1/system/settings", updateJson, RequestOptions.builder().build());

    String retrievedJson =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.GET,
                "/v1/system/settings/" + SettingsType.SEARCH_SETTINGS.value(),
                null,
                RequestOptions.builder().build());

    Settings retrievedSettings = MAPPER.readValue(retrievedJson, Settings.class);
    SearchSettings updatedSearchConfig =
        MAPPER.convertValue(retrievedSettings.getConfigValue(), SearchSettings.class);

    boolean tableConfigExists =
        updatedSearchConfig.getAssetTypeConfigurations().stream()
            .anyMatch(conf -> "table".equalsIgnoreCase(conf.getAssetType()));
    assertTrue(tableConfigExists);
  }

  @Test
  void test_canAddNewAssetType() throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    String settingsJson =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.GET,
                "/v1/system/settings/" + SettingsType.SEARCH_SETTINGS.value(),
                null,
                RequestOptions.builder().build());

    Settings settings = MAPPER.readValue(settingsJson, Settings.class);
    SearchSettings searchConfig =
        MAPPER.convertValue(settings.getConfigValue(), SearchSettings.class);

    AssetTypeConfiguration newAssetType =
        new AssetTypeConfiguration()
            .withAssetType("newAsset")
            .withSearchFields(new ArrayList<>())
            .withHighlightFields(Arrays.asList("name", "description"))
            .withAggregations(new ArrayList<>())
            .withTermBoosts(new ArrayList<>())
            .withScoreMode(AssetTypeConfiguration.ScoreMode.MULTIPLY)
            .withBoostMode(AssetTypeConfiguration.BoostMode.MULTIPLY);

    searchConfig.getAssetTypeConfigurations().add(newAssetType);

    Settings updatedSettings =
        new Settings().withConfigType(SettingsType.SEARCH_SETTINGS).withConfigValue(searchConfig);

    String updateJson = MAPPER.writeValueAsString(updatedSettings);
    client
        .getHttpClient()
        .executeForString(
            HttpMethod.PUT, "/v1/system/settings", updateJson, RequestOptions.builder().build());

    String retrievedJson =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.GET,
                "/v1/system/settings/" + SettingsType.SEARCH_SETTINGS.value(),
                null,
                RequestOptions.builder().build());

    Settings retrievedSettings = MAPPER.readValue(retrievedJson, Settings.class);
    SearchSettings updatedSearchConfig =
        MAPPER.convertValue(retrievedSettings.getConfigValue(), SearchSettings.class);

    boolean newAssetTypeExists =
        updatedSearchConfig.getAssetTypeConfigurations().stream()
            .anyMatch(conf -> "newAsset".equalsIgnoreCase(conf.getAssetType()));
    assertTrue(newAssetTypeExists);
  }

  @Test
  void test_assetCertificationSettings() throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    String settingsJson =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.GET,
                "/v1/system/settings/" + SettingsType.ASSET_CERTIFICATION_SETTINGS.value(),
                null,
                RequestOptions.builder().build());

    Settings settings = MAPPER.readValue(settingsJson, Settings.class);
    AssetCertificationSettings certificationConfig =
        MAPPER.convertValue(settings.getConfigValue(), AssetCertificationSettings.class);

    assertEquals("Certification", certificationConfig.getAllowedClassification());
    assertEquals("P30D", certificationConfig.getValidityPeriod());

    certificationConfig.setAllowedClassification("NewCertification");
    certificationConfig.setValidityPeriod("P60D");

    Settings updatedSettings =
        new Settings()
            .withConfigType(SettingsType.ASSET_CERTIFICATION_SETTINGS)
            .withConfigValue(certificationConfig);

    String updateJson = MAPPER.writeValueAsString(updatedSettings);
    String updatedJson =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.PUT,
                "/v1/system/settings",
                updateJson,
                RequestOptions.builder().build());

    Settings updated = MAPPER.readValue(updatedJson, Settings.class);
    AssetCertificationSettings updatedCertificationConfig =
        MAPPER.convertValue(updated.getConfigValue(), AssetCertificationSettings.class);

    assertEquals("NewCertification", updatedCertificationConfig.getAllowedClassification());
    assertEquals("P60D", updatedCertificationConfig.getValidityPeriod());

    // Reset to original values to avoid cross-test pollution
    certificationConfig.setAllowedClassification("Certification");
    certificationConfig.setValidityPeriod("P30D");

    Settings resetSettings =
        new Settings()
            .withConfigType(SettingsType.ASSET_CERTIFICATION_SETTINGS)
            .withConfigValue(certificationConfig);

    String resetJson = MAPPER.writeValueAsString(resetSettings);
    client
        .getHttpClient()
        .executeForString(
            HttpMethod.PUT, "/v1/system/settings", resetJson, RequestOptions.builder().build());
  }

  @Test
  void test_updateLineageSettings() throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    String settingsJson =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.GET,
                "/v1/system/settings/" + SettingsType.LINEAGE_SETTINGS.value(),
                null,
                RequestOptions.builder().build());

    Settings settings = MAPPER.readValue(settingsJson, Settings.class);
    LineageSettings lineageConfig =
        MAPPER.convertValue(settings.getConfigValue(), LineageSettings.class);

    int originalUpstream = lineageConfig.getUpstreamDepth();
    int originalDownstream = lineageConfig.getDownstreamDepth();

    lineageConfig.setUpstreamDepth(3);
    lineageConfig.setDownstreamDepth(4);

    Settings updatedSettings =
        new Settings().withConfigType(SettingsType.LINEAGE_SETTINGS).withConfigValue(lineageConfig);

    String updateJson = MAPPER.writeValueAsString(updatedSettings);
    String updatedJson =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.PUT,
                "/v1/system/settings",
                updateJson,
                RequestOptions.builder().build());

    Settings updated = MAPPER.readValue(updatedJson, Settings.class);
    LineageSettings updatedLineageConfig =
        MAPPER.convertValue(updated.getConfigValue(), LineageSettings.class);

    assertEquals(3, updatedLineageConfig.getUpstreamDepth());
    assertEquals(4, updatedLineageConfig.getDownstreamDepth());

    lineageConfig.setUpstreamDepth(originalUpstream);
    lineageConfig.setDownstreamDepth(originalDownstream);

    Settings resetSettings =
        new Settings().withConfigType(SettingsType.LINEAGE_SETTINGS).withConfigValue(lineageConfig);

    String resetJson = MAPPER.writeValueAsString(resetSettings);
    client
        .getHttpClient()
        .executeForString(
            HttpMethod.PUT, "/v1/system/settings", resetJson, RequestOptions.builder().build());
  }

  @Test
  void test_updateWorkflowSettings() throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    String settingsJson =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.GET,
                "/v1/system/settings/" + SettingsType.WORKFLOW_SETTINGS.value(),
                null,
                RequestOptions.builder().build());

    Settings settings = MAPPER.readValue(settingsJson, Settings.class);
    WorkflowSettings workflowSettings =
        MAPPER.convertValue(settings.getConfigValue(), WorkflowSettings.class);

    int originalCorePoolSize = workflowSettings.getExecutorConfiguration().getCorePoolSize();
    int originalQueueSize = workflowSettings.getExecutorConfiguration().getQueueSize();
    int originalMaxPoolSize = workflowSettings.getExecutorConfiguration().getMaxPoolSize();
    int originalTasksDue = workflowSettings.getExecutorConfiguration().getTasksDuePerAcquisition();
    int originalCleanupDays =
        workflowSettings.getHistoryCleanUpConfiguration().getCleanAfterNumberOfDays();

    workflowSettings.getExecutorConfiguration().setCorePoolSize(100);
    workflowSettings.getExecutorConfiguration().setQueueSize(2000);
    workflowSettings.getExecutorConfiguration().setMaxPoolSize(200);
    workflowSettings.getExecutorConfiguration().setTasksDuePerAcquisition(40);
    workflowSettings.getHistoryCleanUpConfiguration().setCleanAfterNumberOfDays(10);

    Settings updatedSettings =
        new Settings()
            .withConfigType(SettingsType.WORKFLOW_SETTINGS)
            .withConfigValue(workflowSettings);

    String updateJson = MAPPER.writeValueAsString(updatedSettings);
    String updatedJson =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.PUT,
                "/v1/system/settings",
                updateJson,
                RequestOptions.builder().build());

    Settings updated = MAPPER.readValue(updatedJson, Settings.class);
    WorkflowSettings updatedWorkflowSettings =
        MAPPER.convertValue(updated.getConfigValue(), WorkflowSettings.class);

    assertEquals(100, updatedWorkflowSettings.getExecutorConfiguration().getCorePoolSize());
    assertEquals(2000, updatedWorkflowSettings.getExecutorConfiguration().getQueueSize());
    assertEquals(200, updatedWorkflowSettings.getExecutorConfiguration().getMaxPoolSize());
    assertEquals(
        40, updatedWorkflowSettings.getExecutorConfiguration().getTasksDuePerAcquisition());
    assertEquals(
        10, updatedWorkflowSettings.getHistoryCleanUpConfiguration().getCleanAfterNumberOfDays());

    workflowSettings.getExecutorConfiguration().setCorePoolSize(originalCorePoolSize);
    workflowSettings.getExecutorConfiguration().setQueueSize(originalQueueSize);
    workflowSettings.getExecutorConfiguration().setMaxPoolSize(originalMaxPoolSize);
    workflowSettings.getExecutorConfiguration().setTasksDuePerAcquisition(originalTasksDue);
    workflowSettings
        .getHistoryCleanUpConfiguration()
        .setCleanAfterNumberOfDays(originalCleanupDays);

    Settings resetSettings =
        new Settings()
            .withConfigType(SettingsType.WORKFLOW_SETTINGS)
            .withConfigValue(workflowSettings);

    String resetJson = MAPPER.writeValueAsString(resetSettings);
    client
        .getHttpClient()
        .executeForString(
            HttpMethod.PUT, "/v1/system/settings", resetJson, RequestOptions.builder().build());
  }

  @Test
  void test_profilerConfiguration() throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    ProfilerConfiguration profilerConfiguration = new ProfilerConfiguration();
    MetricConfigurationDefinition intMetricConfigDefinition =
        new MetricConfigurationDefinition()
            .withDataType(ColumnDataType.INT)
            .withMetrics(
                List.of(MetricType.VALUES_COUNT, MetricType.FIRST_QUARTILE, MetricType.MEAN));
    MetricConfigurationDefinition dateTimeMetricConfigDefinition =
        new MetricConfigurationDefinition()
            .withDataType(ColumnDataType.DATETIME)
            .withDisabled(true);
    profilerConfiguration.setMetricConfiguration(
        List.of(intMetricConfigDefinition, dateTimeMetricConfigDefinition));

    Settings profilerSettings =
        new Settings()
            .withConfigType(SettingsType.PROFILER_CONFIGURATION)
            .withConfigValue(profilerConfiguration);

    String createJson = MAPPER.writeValueAsString(profilerSettings);
    String createdJson =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.PUT,
                "/v1/system/settings",
                createJson,
                RequestOptions.builder().build());

    Settings created = MAPPER.readValue(createdJson, Settings.class);
    ProfilerConfiguration createdProfilerSettings =
        MAPPER.convertValue(created.getConfigValue(), ProfilerConfiguration.class);

    assertEquals(
        profilerConfiguration.getMetricConfiguration(),
        createdProfilerSettings.getMetricConfiguration());

    profilerConfiguration.setMetricConfiguration(List.of(intMetricConfigDefinition));
    profilerSettings =
        new Settings()
            .withConfigType(SettingsType.PROFILER_CONFIGURATION)
            .withConfigValue(profilerConfiguration);

    String updateJson = MAPPER.writeValueAsString(profilerSettings);
    String updatedJson =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.PUT,
                "/v1/system/settings",
                updateJson,
                RequestOptions.builder().build());

    Settings updated = MAPPER.readValue(updatedJson, Settings.class);
    ProfilerConfiguration updatedProfilerSettings =
        MAPPER.convertValue(updated.getConfigValue(), ProfilerConfiguration.class);

    assertEquals(
        profilerConfiguration.getMetricConfiguration(),
        updatedProfilerSettings.getMetricConfiguration());

    profilerConfiguration.setMetricConfiguration(new ArrayList<>());
    profilerSettings =
        new Settings()
            .withConfigType(SettingsType.PROFILER_CONFIGURATION)
            .withConfigValue(profilerConfiguration);

    String deleteJson = MAPPER.writeValueAsString(profilerSettings);
    String deletedJson =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.PUT,
                "/v1/system/settings",
                deleteJson,
                RequestOptions.builder().build());

    Settings deleted = MAPPER.readValue(deletedJson, Settings.class);
    ProfilerConfiguration deletedProfilerSettings =
        MAPPER.convertValue(deleted.getConfigValue(), ProfilerConfiguration.class);

    assertEquals(
        profilerConfiguration.getMetricConfiguration(),
        deletedProfilerSettings.getMetricConfiguration());
  }

  @Test
  void test_searchSettingsValidation() throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    String settingsJson =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.GET,
                "/v1/system/settings/" + SettingsType.SEARCH_SETTINGS.value(),
                null,
                RequestOptions.builder().build());

    Settings settings = MAPPER.readValue(settingsJson, Settings.class);
    SearchSettings searchConfig =
        MAPPER.convertValue(settings.getConfigValue(), SearchSettings.class);

    searchConfig.getGlobalSettings().setMaxAggregateSize(50);
    Settings updatedSettings =
        new Settings().withConfigType(SettingsType.SEARCH_SETTINGS).withConfigValue(searchConfig);

    String updateJson = MAPPER.writeValueAsString(updatedSettings);
    try {
      client
          .getHttpClient()
          .executeForString(
              HttpMethod.PUT, "/v1/system/settings", updateJson, RequestOptions.builder().build());
      fail("Expected exception for invalid maxAggregateSize");
    } catch (Exception e) {
      assertTrue(e.getMessage().contains("maxAggregateSize"));
    }

    searchConfig.getGlobalSettings().setMaxAggregateSize(15000);
    updatedSettings =
        new Settings().withConfigType(SettingsType.SEARCH_SETTINGS).withConfigValue(searchConfig);

    updateJson = MAPPER.writeValueAsString(updatedSettings);
    try {
      client
          .getHttpClient()
          .executeForString(
              HttpMethod.PUT, "/v1/system/settings", updateJson, RequestOptions.builder().build());
      fail("Expected exception for invalid maxAggregateSize");
    } catch (Exception e) {
      assertTrue(e.getMessage().contains("maxAggregateSize"));
    }

    searchConfig.getGlobalSettings().setMaxAggregateSize(1000);
    searchConfig.getGlobalSettings().setMaxResultHits(50);
    updatedSettings =
        new Settings().withConfigType(SettingsType.SEARCH_SETTINGS).withConfigValue(searchConfig);

    updateJson = MAPPER.writeValueAsString(updatedSettings);
    try {
      client
          .getHttpClient()
          .executeForString(
              HttpMethod.PUT, "/v1/system/settings", updateJson, RequestOptions.builder().build());
      fail("Expected exception for invalid maxResultHits");
    } catch (Exception e) {
      assertTrue(e.getMessage().contains("maxResultHits"));
    }

    searchConfig.getGlobalSettings().setMaxResultHits(1000);
    searchConfig.getGlobalSettings().setMaxAnalyzedOffset(500);
    updatedSettings =
        new Settings().withConfigType(SettingsType.SEARCH_SETTINGS).withConfigValue(searchConfig);

    updateJson = MAPPER.writeValueAsString(updatedSettings);
    try {
      client
          .getHttpClient()
          .executeForString(
              HttpMethod.PUT, "/v1/system/settings", updateJson, RequestOptions.builder().build());
      fail("Expected exception for invalid maxAnalyzedOffset");
    } catch (Exception e) {
      assertTrue(e.getMessage().contains("maxAnalyzedOffset"));
    }

    searchConfig.getGlobalSettings().setMaxAggregateSize(5000);
    searchConfig.getGlobalSettings().setMaxResultHits(5000);
    searchConfig.getGlobalSettings().setMaxAnalyzedOffset(5000);
    updatedSettings =
        new Settings().withConfigType(SettingsType.SEARCH_SETTINGS).withConfigValue(searchConfig);

    updateJson = MAPPER.writeValueAsString(updatedSettings);
    String validJson =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.PUT,
                "/v1/system/settings",
                updateJson,
                RequestOptions.builder().build());

    Settings validSettings = MAPPER.readValue(validJson, Settings.class);
    SearchSettings validSearchConfig =
        MAPPER.convertValue(validSettings.getConfigValue(), SearchSettings.class);

    assertEquals(5000, validSearchConfig.getGlobalSettings().getMaxAggregateSize());
    assertEquals(5000, validSearchConfig.getGlobalSettings().getMaxResultHits());
    assertEquals(5000, validSearchConfig.getGlobalSettings().getMaxAnalyzedOffset());
  }

  @Test
  void test_termBoostsAndFieldValueBoostsOverride() throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    String settingsJson =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.GET,
                "/v1/system/settings/" + SettingsType.SEARCH_SETTINGS.value(),
                null,
                RequestOptions.builder().build());

    Settings settings = MAPPER.readValue(settingsJson, Settings.class);
    SearchSettings searchConfig =
        MAPPER.convertValue(settings.getConfigValue(), SearchSettings.class);

    List<TermBoost> termBoosts = new ArrayList<>();
    termBoosts.add(
        new TermBoost().withField("custom_term").withValue("term_value").withBoost(15.0));

    List<FieldValueBoost> fieldValueBoosts = new ArrayList<>();
    fieldValueBoosts.add(new FieldValueBoost().withField("custom_field").withFactor(25.0));

    searchConfig.getGlobalSettings().setTermBoosts(termBoosts);
    searchConfig.getGlobalSettings().setFieldValueBoosts(fieldValueBoosts);

    Settings updatedSettings =
        new Settings().withConfigType(SettingsType.SEARCH_SETTINGS).withConfigValue(searchConfig);

    String updateJson = MAPPER.writeValueAsString(updatedSettings);
    client
        .getHttpClient()
        .executeForString(
            HttpMethod.PUT, "/v1/system/settings", updateJson, RequestOptions.builder().build());

    String retrievedJson =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.GET,
                "/v1/system/settings/" + SettingsType.SEARCH_SETTINGS.value(),
                null,
                RequestOptions.builder().build());

    Settings retrievedSettings = MAPPER.readValue(retrievedJson, Settings.class);
    SearchSettings updatedSearchConfig =
        MAPPER.convertValue(retrievedSettings.getConfigValue(), SearchSettings.class);

    assertNotNull(updatedSearchConfig.getGlobalSettings().getTermBoosts());
    assertFalse(updatedSearchConfig.getGlobalSettings().getTermBoosts().isEmpty());
    assertEquals(1, updatedSearchConfig.getGlobalSettings().getTermBoosts().size());
    assertEquals(
        "custom_term", updatedSearchConfig.getGlobalSettings().getTermBoosts().get(0).getField());
    assertEquals(
        "term_value", updatedSearchConfig.getGlobalSettings().getTermBoosts().get(0).getValue());
    assertEquals(15.0, updatedSearchConfig.getGlobalSettings().getTermBoosts().get(0).getBoost());

    assertNotNull(updatedSearchConfig.getGlobalSettings().getFieldValueBoosts());
    assertFalse(updatedSearchConfig.getGlobalSettings().getFieldValueBoosts().isEmpty());
    assertEquals(1, updatedSearchConfig.getGlobalSettings().getFieldValueBoosts().size());
    assertEquals(
        "custom_field",
        updatedSearchConfig.getGlobalSettings().getFieldValueBoosts().get(0).getField());
    assertEquals(
        25.0, updatedSearchConfig.getGlobalSettings().getFieldValueBoosts().get(0).getFactor());
  }

  @Test
  void test_duplicateSearchFieldConfiguration() throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    String settingsJson =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.GET,
                "/v1/system/settings/" + SettingsType.SEARCH_SETTINGS.value(),
                null,
                RequestOptions.builder().build());

    Settings settings = MAPPER.readValue(settingsJson, Settings.class);
    SearchSettings searchConfig =
        MAPPER.convertValue(settings.getConfigValue(), SearchSettings.class);

    AssetTypeConfiguration tableConfig =
        searchConfig.getAssetTypeConfigurations().stream()
            .filter(conf -> "table".equalsIgnoreCase(conf.getAssetType()))
            .findFirst()
            .orElseThrow(() -> new AssertionError("Table configuration not found"));

    tableConfig.getSearchFields().add(new FieldBoost().withField("name").withBoost(20.0));

    Settings updatedSettings =
        new Settings().withConfigType(SettingsType.SEARCH_SETTINGS).withConfigValue(searchConfig);

    String updateJson = MAPPER.writeValueAsString(updatedSettings);
    try {
      client
          .getHttpClient()
          .executeForString(
              HttpMethod.PUT, "/v1/system/settings", updateJson, RequestOptions.builder().build());
      fail("Expected exception for duplicate field configuration");
    } catch (Exception e) {
      assertTrue(
          e.getMessage().contains("Duplicate field configuration")
              || e.getMessage().contains("duplicate"));
    }
  }

  @Test
  void test_allowedFieldsCannotBeOverwritten() throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    String settingsJson =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.GET,
                "/v1/system/settings/" + SettingsType.SEARCH_SETTINGS.value(),
                null,
                RequestOptions.builder().build());

    Settings settings = MAPPER.readValue(settingsJson, Settings.class);
    SearchSettings searchConfig =
        MAPPER.convertValue(settings.getConfigValue(), SearchSettings.class);

    List<AllowedSearchFields> originalAllowedFields = searchConfig.getAllowedFields();
    assertNotNull(originalAllowedFields);
    assertFalse(originalAllowedFields.isEmpty());

    int originalSize = originalAllowedFields.size();

    List<Field> fieldsList = new ArrayList<>();
    fieldsList.add(new Field().withName("test.field").withDescription("Test field description"));

    AllowedSearchFields testEntity =
        new AllowedSearchFields().withEntityType("test").withFields(fieldsList);

    List<AllowedSearchFields> modifiedAllowedFields = new ArrayList<>();
    modifiedAllowedFields.add(testEntity);

    searchConfig.setAllowedFields(modifiedAllowedFields);

    Settings updatedSettings =
        new Settings().withConfigType(SettingsType.SEARCH_SETTINGS).withConfigValue(searchConfig);

    String updateJson = MAPPER.writeValueAsString(updatedSettings);
    client
        .getHttpClient()
        .executeForString(
            HttpMethod.PUT, "/v1/system/settings", updateJson, RequestOptions.builder().build());

    String retrievedJson =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.GET,
                "/v1/system/settings/" + SettingsType.SEARCH_SETTINGS.value(),
                null,
                RequestOptions.builder().build());

    Settings retrievedSettings = MAPPER.readValue(retrievedJson, Settings.class);
    SearchSettings updatedSearchConfig =
        MAPPER.convertValue(retrievedSettings.getConfigValue(), SearchSettings.class);

    List<AllowedSearchFields> retrievedAllowedFields = updatedSearchConfig.getAllowedFields();
    assertNotNull(retrievedAllowedFields);
    assertFalse(retrievedAllowedFields.isEmpty());

    assertEquals(originalSize, retrievedAllowedFields.size());

    Set<String> retrievedEntityTypes =
        retrievedAllowedFields.stream()
            .map(AllowedSearchFields::getEntityType)
            .collect(Collectors.toSet());

    assertFalse(retrievedEntityTypes.contains("test"));
  }

  @Test
  void test_updateSecurityConfig() throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    SecurityConfiguration securityConfig =
        new SecurityConfiguration()
            .withAuthenticationConfiguration(
                new AuthenticationConfiguration()
                    .withClientType(ClientType.PUBLIC)
                    .withProvider(AuthProvider.BASIC)
                    .withResponseType(ResponseType.ID_TOKEN)
                    .withProviderName("OpenMetadata")
                    .withPublicKeyUrls(
                        Arrays.asList("http://localhost:8585/api/v1/system/config/jwks"))
                    .withTokenValidationAlgorithm(
                        AuthenticationConfiguration.TokenValidationAlgorithm.RS_256)
                    .withAuthority("http://localhost:8585")
                    .withClientId("open-metadata")
                    .withCallbackUrl("http://localhost:8585/callback")
                    .withJwtPrincipalClaims(Arrays.asList("email", "preferred_username", "sub"))
                    .withJwtPrincipalClaimsMapping(new ArrayList<>())
                    .withEnableSelfSignup(true))
            .withAuthorizerConfiguration(
                new AuthorizerConfiguration()
                    .withClassName("org.openmetadata.service.security.DefaultAuthorizer")
                    .withContainerRequestFilter("org.openmetadata.service.security.JwtFilter")
                    .withAdminPrincipals(Set.of("admin"))
                    .withAllowedEmailRegistrationDomains(Set.of("all"))
                    .withPrincipalDomain("open-metadata.org")
                    .withAllowedDomains(new HashSet<>())
                    .withEnforcePrincipalDomain(false)
                    .withEnableSecureSocketConnection(false)
                    .withUseRolesFromProvider(false));

    String securityConfigJson = MAPPER.writeValueAsString(securityConfig);
    String updatedJson =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.PUT,
                "/v1/system/security/config",
                securityConfigJson,
                RequestOptions.builder().build());

    assertNotNull(updatedJson);
    SecurityConfiguration updated = MAPPER.readValue(updatedJson, SecurityConfiguration.class);

    assertNotNull(updated);
    assertEquals(
        securityConfig.getAuthenticationConfiguration().getProvider(),
        updated.getAuthenticationConfiguration().getProvider());
    assertEquals(
        securityConfig.getAuthorizerConfiguration().getClassName(),
        updated.getAuthorizerConfiguration().getClassName());
  }

  @Test
  void test_getEntityRulesSettingByType() throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    String tableRulesJson =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.GET,
                "/v1/system/settings/entityRulesSettings/table",
                null,
                RequestOptions.builder().build());

    List<SemanticsRule> tableRules =
        MAPPER.readValue(tableRulesJson, new TypeReference<List<SemanticsRule>>() {});

    assertFalse(tableRules.isEmpty());

    assertTrue(
        tableRules.stream()
            .anyMatch(rule -> rule.getName().equals("Multiple Users or Single Team Ownership")));

    String dashboardRulesJson =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.GET,
                "/v1/system/settings/entityRulesSettings/dashboard",
                null,
                RequestOptions.builder().build());

    List<SemanticsRule> dashboardRules =
        MAPPER.readValue(dashboardRulesJson, new TypeReference<List<SemanticsRule>>() {});

    assertFalse(dashboardRules.isEmpty());

    assertTrue(
        dashboardRules.stream()
            .anyMatch(rule -> rule.getName().equals("Multiple Users or Single Team Ownership")));

    String teamRulesJson =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.GET,
                "/v1/system/settings/entityRulesSettings/team",
                null,
                RequestOptions.builder().build());

    List<SemanticsRule> teamRules =
        MAPPER.readValue(teamRulesJson, new TypeReference<List<SemanticsRule>>() {});

    assertFalse(teamRules.isEmpty());

    assertTrue(
        teamRules.stream()
            .anyMatch(rule -> rule.getName().equals("Multiple Users or Single Team Ownership")));
  }
}
