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

package org.openmetadata.service.resources.system;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.service.util.TestUtils.ADMIN_AUTH_HEADERS;

import jakarta.ws.rs.client.WebTarget;
import jakarta.ws.rs.core.Response;
import java.io.IOException;
import java.util.Arrays;
import java.util.List;
import org.apache.http.client.HttpResponseException;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.junit.jupiter.api.TestMethodOrder;
import org.openmetadata.schema.api.configuration.MCPConfiguration;
import org.openmetadata.schema.settings.Settings;
import org.openmetadata.schema.settings.SettingsType;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplicationTest;
import org.openmetadata.service.resources.settings.SettingsCache;
import org.openmetadata.service.security.auth.SecurityConfigurationManager;
import org.openmetadata.service.util.TestUtils;

@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
public class MCPConfigurationIntegrationTest extends OpenMetadataApplicationTest {

  @Test
  @Order(1)
  void testDatabaseFirstLoading(TestInfo test) throws IOException, InterruptedException {
    MCPConfiguration initialConfig = new MCPConfiguration();
    initialConfig.setBaseUrl("https://initial.example.com");
    initialConfig.setAllowedOrigins(Arrays.asList("https://initial-app.example.com"));
    initialConfig.setEnabled(true);

    Settings mcpSettings =
        new Settings()
            .withConfigType(SettingsType.MCP_CONFIGURATION)
            .withConfigValue(initialConfig);

    Entity.getSystemRepository().createOrUpdate(mcpSettings);

    SettingsCache.invalidateSettings(SettingsType.MCP_CONFIGURATION.toString());

    MCPConfiguration loadedConfig =
        SettingsCache.getSetting(SettingsType.MCP_CONFIGURATION, MCPConfiguration.class);

    assertNotNull(loadedConfig, "Config should be loaded from database");
    assertEquals("https://initial.example.com", loadedConfig.getBaseUrl());
    assertEquals(1, loadedConfig.getAllowedOrigins().size());
    assertEquals("https://initial-app.example.com", loadedConfig.getAllowedOrigins().get(0));
  }

  @Test
  @Order(2)
  void testConfigurationUpdateViaAPI(TestInfo test) throws IOException, InterruptedException {
    MCPConfiguration updateConfig = new MCPConfiguration();
    updateConfig.setBaseUrl("https://updated.example.com");
    updateConfig.setAllowedOrigins(
        Arrays.asList("https://app1.example.com", "https://app2.example.com"));
    updateConfig.setEnabled(true);
    updateConfig.setConnectTimeout(5000);
    updateConfig.setReadTimeout(10000);

    WebTarget target = getResource("system/mcp/config");
    Response response =
        TestUtils.put(
            target,
            JsonUtils.pojoToJson(updateConfig),
            Response.class,
            Response.Status.OK,
            ADMIN_AUTH_HEADERS);

    assertEquals(Response.Status.OK.getStatusCode(), response.getStatus());

    Thread.sleep(1000);

    MCPConfiguration verifyConfig =
        SettingsCache.getSetting(SettingsType.MCP_CONFIGURATION, MCPConfiguration.class);

    assertNotNull(verifyConfig);
    assertEquals("https://updated.example.com", verifyConfig.getBaseUrl());
    assertEquals(2, verifyConfig.getAllowedOrigins().size());
    assertTrue(verifyConfig.getAllowedOrigins().contains("https://app1.example.com"));
    assertTrue(verifyConfig.getAllowedOrigins().contains("https://app2.example.com"));
    assertEquals(5000, verifyConfig.getConnectTimeout());
    assertEquals(10000, verifyConfig.getReadTimeout());
  }

  @Test
  @Order(3)
  void testConfigurationPersistsAcrossReload(TestInfo test) throws IOException {
    MCPConfiguration beforeReload =
        SettingsCache.getSetting(SettingsType.MCP_CONFIGURATION, MCPConfiguration.class);
    assertNotNull(beforeReload);

    String baseUrlBefore = beforeReload.getBaseUrl();

    SettingsCache.invalidateSettings(SettingsType.MCP_CONFIGURATION.toString());

    MCPConfiguration afterReload =
        SettingsCache.getSetting(SettingsType.MCP_CONFIGURATION, MCPConfiguration.class);
    assertNotNull(afterReload);
    assertEquals(
        baseUrlBefore, afterReload.getBaseUrl(), "Config should persist after cache invalidation");
  }

  @Test
  @Order(4)
  void testConfigurationChangeDetection(TestInfo test) throws IOException, InterruptedException {
    MCPConfiguration config1 = new MCPConfiguration();
    config1.setBaseUrl("https://config1.example.com");
    config1.setEnabled(true);

    Settings settings1 =
        new Settings().withConfigType(SettingsType.MCP_CONFIGURATION).withConfigValue(config1);
    Entity.getSystemRepository().createOrUpdate(settings1);

    SettingsCache.invalidateSettings(SettingsType.MCP_CONFIGURATION.toString());

    Thread.sleep(500);

    MCPConfiguration config2 = new MCPConfiguration();
    config2.setBaseUrl("https://config2.example.com");
    config2.setEnabled(false);

    Settings settings2 =
        new Settings().withConfigType(SettingsType.MCP_CONFIGURATION).withConfigValue(config2);
    Entity.getSystemRepository().createOrUpdate(settings2);

    Thread.sleep(12000);

    SettingsCache.invalidateSettings(SettingsType.MCP_CONFIGURATION.toString());
    MCPConfiguration latestConfig =
        SettingsCache.getSetting(SettingsType.MCP_CONFIGURATION, MCPConfiguration.class);

    assertNotNull(latestConfig);
    assertEquals("https://config2.example.com", latestConfig.getBaseUrl());
    assertEquals(false, latestConfig.getEnabled());
  }

  @Test
  @Order(5)
  void testInvalidConfigurationRejected(TestInfo test) {
    MCPConfiguration invalidConfig = new MCPConfiguration();
    invalidConfig.setBaseUrl("ftp://invalid-protocol.example.com");
    invalidConfig.setEnabled(true);

    WebTarget target = getResource("system/mcp/config");
    assertThrows(
        HttpResponseException.class,
        () ->
            TestUtils.put(
                target,
                JsonUtils.pojoToJson(invalidConfig),
                Response.Status.BAD_REQUEST,
                ADMIN_AUTH_HEADERS),
        "Invalid protocol should be rejected");
  }

  @Test
  @Order(6)
  void testPartialWildcardOriginRejected(TestInfo test) {
    MCPConfiguration invalidConfig = new MCPConfiguration();
    invalidConfig.setBaseUrl("https://valid.example.com");
    invalidConfig.setAllowedOrigins(Arrays.asList("https://*.example.com"));
    invalidConfig.setEnabled(true);

    WebTarget target = getResource("system/mcp/config");
    assertThrows(
        HttpResponseException.class,
        () ->
            TestUtils.put(
                target,
                JsonUtils.pojoToJson(invalidConfig),
                Response.Status.BAD_REQUEST,
                ADMIN_AUTH_HEADERS),
        "Partial wildcard should be rejected");
  }

  @Test
  @Order(7)
  void testExactWildcardOriginAccepted(TestInfo test) throws IOException {
    MCPConfiguration validConfig = new MCPConfiguration();
    validConfig.setBaseUrl("https://valid.example.com");
    validConfig.setAllowedOrigins(Arrays.asList("*"));
    validConfig.setEnabled(true);

    WebTarget target = getResource("system/mcp/config");
    Response response =
        TestUtils.put(
            target,
            JsonUtils.pojoToJson(validConfig),
            Response.class,
            Response.Status.OK,
            ADMIN_AUTH_HEADERS);

    assertEquals(Response.Status.OK.getStatusCode(), response.getStatus());

    MCPConfiguration verifyConfig =
        SettingsCache.getSetting(SettingsType.MCP_CONFIGURATION, MCPConfiguration.class);
    assertNotNull(verifyConfig);
    assertTrue(verifyConfig.getAllowedOrigins().contains("*"));
  }

  @Test
  @Order(8)
  void testConfigurationReloadNotifiesListeners(TestInfo test)
      throws IOException, InterruptedException {
    class TestListener implements SecurityConfigurationManager.ConfigurationChangeListener {
      volatile boolean notified = false;
      volatile MCPConfiguration receivedConfig = null;

      @Override
      public void onConfigurationChanged(
          org.openmetadata.schema.api.security.AuthenticationConfiguration authConfig,
          org.openmetadata.schema.api.security.AuthorizerConfiguration authzConfig,
          MCPConfiguration mcpConfig) {
        notified = true;
        receivedConfig = mcpConfig;
      }
    }

    TestListener listener = new TestListener();
    SecurityConfigurationManager.getInstance().addConfigurationChangeListener(listener);

    MCPConfiguration newConfig = new MCPConfiguration();
    newConfig.setBaseUrl("https://listener-test.example.com");
    newConfig.setEnabled(true);

    WebTarget target = getResource("system/mcp/config");
    Response response =
        TestUtils.put(
            target,
            JsonUtils.pojoToJson(newConfig),
            Response.class,
            Response.Status.OK,
            ADMIN_AUTH_HEADERS);

    assertEquals(Response.Status.OK.getStatusCode(), response.getStatus());

    Thread.sleep(2000);

    assertTrue(listener.notified, "Listener should be notified of config change");
    assertNotNull(listener.receivedConfig);
    assertEquals("https://listener-test.example.com", listener.receivedConfig.getBaseUrl());

    SecurityConfigurationManager.getInstance().removeConfigurationChangeListener(listener);
  }

  @Test
  @Order(9)
  void testMultipleConfigUpdatesInSequence(TestInfo test) throws IOException, InterruptedException {
    List<String> testUrls =
        Arrays.asList(
            "https://test1.example.com", "https://test2.example.com", "https://test3.example.com");

    for (String url : testUrls) {
      MCPConfiguration config = new MCPConfiguration();
      config.setBaseUrl(url);
      config.setEnabled(true);

      WebTarget target = getResource("system/mcp/config");
      Response response =
          TestUtils.put(
              target,
              JsonUtils.pojoToJson(config),
              Response.class,
              Response.Status.OK,
              ADMIN_AUTH_HEADERS);

      assertEquals(Response.Status.OK.getStatusCode(), response.getStatus());
      Thread.sleep(500);

      MCPConfiguration verify =
          SettingsCache.getSetting(SettingsType.MCP_CONFIGURATION, MCPConfiguration.class);
      assertEquals(url, verify.getBaseUrl(), "Each update should persist correctly");
    }
  }
}
