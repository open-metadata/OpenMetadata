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
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assumptions.assumeFalse;

import com.fasterxml.jackson.core.type.TypeReference;
import java.time.Duration;
import java.util.HashMap;
import java.util.Map;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.bootstrap.TestSuiteBootstrap;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.entity.app.App;
import org.openmetadata.schema.entity.app.AppMarketPlaceDefinition;
import org.openmetadata.schema.entity.app.AppRunRecord;
import org.openmetadata.schema.entity.app.AppSchedule;
import org.openmetadata.schema.entity.app.AppType;
import org.openmetadata.schema.entity.app.CreateApp;
import org.openmetadata.schema.entity.app.CreateAppMarketPlaceDefinitionReq;
import org.openmetadata.schema.entity.app.NativeAppPermission;
import org.openmetadata.schema.entity.app.ScheduleTimeline;
import org.openmetadata.schema.entity.app.ScheduleType;
import org.openmetadata.schema.entity.app.ScheduledExecutionContext;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.fluent.Apps;
import org.openmetadata.sdk.network.HttpClient;
import org.openmetadata.sdk.network.HttpMethod;

/**
 * Integration tests for Apps API.
 *
 * <p>Tests the Apps fluent API for retrieving and managing applications. Apps in OpenMetadata are
 * built-in system applications like SearchIndexApplication and DataInsightsApplication.
 *
 * <p>Migrated from: org.openmetadata.service.resources.apps.AppsResourceTest
 *
 * <p>Test isolation: Uses TestNamespace extension for test isolation. Runs in SAME_THREAD mode
 * because multiple tests trigger SearchIndexingApplication which is a shared resource.
 */
@Execution(ExecutionMode.SAME_THREAD)
@ExtendWith(TestNamespaceExtension.class)
public class AppsResourceIT {

  @BeforeAll
  static void setup() {
    Apps.setDefaultClient(SdkClients.adminClient());
  }

  private void waitForAppJobCompletion(String appName) throws Exception {
    HttpClient httpClient = SdkClients.adminClient().getHttpClient();
    int maxRetries = 60; // Increase retries for longer-running jobs in CI
    int retryCount = 0;

    while (retryCount < maxRetries) {
      try {
        AppRunRecord latestRun =
            httpClient.execute(
                HttpMethod.GET,
                "/v1/apps/name/" + appName + "/runs/latest",
                null,
                AppRunRecord.class);

        if (latestRun == null || latestRun.getStatus() == null) {
          // No run record exists yet - safe to proceed
          return;
        }

        String status = latestRun.getStatus().value();

        // Check if the job is in a terminal state
        if ("SUCCESS".equals(status) || "FAILED".equals(status) || "COMPLETED".equals(status)) {
          // Job is complete - add a small buffer to allow scheduler to fully clean up
          Thread.sleep(500);
          return;
        }

        // Job is still running (RUNNING, STARTED, ACTIVE, PENDING_STATUS_UPDATE, etc.)
        // Continue waiting
      } catch (Exception e) {
        // On errors (like 500), the job might be starting - continue waiting
        // Don't log each error to avoid noise in tests
        if (retryCount % 10 == 0) {
          // Log every 10th retry to show we're still trying
          System.out.println(
              "waitForAppJobCompletion: waiting for " + appName + ", attempt " + retryCount);
        }
      }
      Thread.sleep(500);
      retryCount++;
    }
    // After max retries, log a warning and proceed
    System.out.println(
        "waitForAppJobCompletion: max retries reached for " + appName + ", proceeding anyway");
  }

  @Test
  void test_getAppByName_searchIndexApp(TestNamespace ns) {
    String appName = "SearchIndexingApplication";

    App app = Apps.getByName(appName);

    assertNotNull(app, "SearchIndexingApplication should exist");
    assertEquals(appName, app.getName(), "App name should match");
    assertNotNull(app.getId(), "App should have an ID");
    assertNotNull(app.getFullyQualifiedName(), "App should have an FQN");
  }

  @Test
  void test_getAppByName_dataInsightsApp(TestNamespace ns) {
    String appName = "DataInsightsApplication";

    App app = Apps.getByName(appName);

    assertNotNull(app, "DataInsightsApplication should exist");
    assertEquals(appName, app.getName(), "App name should match");
    assertNotNull(app.getId(), "App should have an ID");
    assertNotNull(app.getFullyQualifiedName(), "App should have an FQN");
  }

  @Test
  void test_getAppByName_withFields(TestNamespace ns) {
    String appName = "SearchIndexingApplication";

    App app = Apps.getByName(appName, "owners,pipelines");

    assertNotNull(app, "SearchIndexingApplication should exist");
    assertEquals(appName, app.getName(), "App name should match");
    assertNotNull(app.getId(), "App should have an ID");
  }

  @Test
  void test_getAppById(TestNamespace ns) {
    String appName = "DataInsightsApplication";

    App appByName = Apps.getByName(appName);
    assertNotNull(appByName, "DataInsightsApplication should exist");

    String appId = appByName.getId().toString();

    App appById = Apps.get(appId);

    assertNotNull(appById, "App retrieved by ID should not be null");
    assertEquals(appByName.getId(), appById.getId(), "App IDs should match");
    assertEquals(appByName.getName(), appById.getName(), "App names should match");
  }

  @Test
  void test_findAppByName(TestNamespace ns) {
    String appName = "SearchIndexingApplication";

    App app = Apps.findByName(appName).fetch();

    assertNotNull(app, "App found by name should not be null");
    assertEquals(appName, app.getName(), "App name should match");
    assertNotNull(app.getId(), "App should have an ID");
  }

  @Test
  void test_findAppById(TestNamespace ns) {
    String appName = "DataInsightsApplication";

    App appByName = Apps.getByName(appName);
    String appId = appByName.getId().toString();

    App app = Apps.find(appId).fetch();

    assertNotNull(app, "App found by ID should not be null");
    assertEquals(appId, app.getId().toString(), "App ID should match");
  }

  @Test
  void test_findAppWithFields(TestNamespace ns) {
    String appName = "SearchIndexingApplication";

    App app = Apps.findByName(appName).withFields("owners", "pipelines").fetch();

    assertNotNull(app, "App found with fields should not be null");
    assertEquals(appName, app.getName(), "App name should match");
  }

  @Test
  @org.junit.jupiter.api.Disabled("Requires AppMarketPlaceDefinition to be created first")
  void test_installCustomApp(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    String appName = ns.prefix("customApp");

    CreateApp createRequest = new CreateApp();
    createRequest.setName(appName);
    createRequest.setDescription("Test custom application");

    App installedApp =
        Apps.install().name(appName).withDescription("Test custom application").execute();

    assertNotNull(installedApp, "Installed app should not be null");
    assertEquals(appName, installedApp.getName(), "Installed app name should match");
    assertNotNull(installedApp.getId(), "Installed app should have an ID");

    Apps.uninstall(appName, true);
  }

  @Test
  @org.junit.jupiter.api.Disabled("Requires AppMarketPlaceDefinition to be created first")
  void test_installAppWithDisplayName(TestNamespace ns) {
    String appName = ns.prefix("displayNameApp");

    App installedApp =
        Apps.install()
            .name(appName)
            .withDisplayName("My Custom App")
            .withDescription("App with display name")
            .execute();

    assertNotNull(installedApp, "Installed app should not be null");
    assertEquals(appName, installedApp.getName(), "App name should match");
    assertEquals("My Custom App", installedApp.getDisplayName(), "Display name should match");

    Apps.uninstall(appName, true);
  }

  @Test
  @org.junit.jupiter.api.Disabled("Requires AppMarketPlaceDefinition to be created first")
  void test_uninstallApp(TestNamespace ns) {
    String appName = ns.prefix("uninstallApp");

    App installedApp =
        Apps.install().name(appName).withDescription("App to be uninstalled").execute();

    assertNotNull(installedApp, "App should be installed");

    Apps.uninstall(appName, false);

    assertThrows(
        Exception.class,
        () -> Apps.getByName(appName),
        "App should not be retrievable after soft delete");
  }

  @Test
  @org.junit.jupiter.api.Disabled("Requires AppMarketPlaceDefinition to be created first")
  void test_uninstallAppHardDelete(TestNamespace ns) {
    String appName = ns.prefix("hardDeleteApp");

    App installedApp =
        Apps.install().name(appName).withDescription("App to be hard deleted").execute();

    assertNotNull(installedApp, "App should be installed");

    Apps.uninstall(appName, true);

    assertThrows(
        Exception.class, () -> Apps.getByName(appName), "App should not exist after hard delete");
  }

  @Test
  @org.junit.jupiter.api.Disabled("Requires AppMarketPlaceDefinition to be created first")
  void test_deleteAppById(TestNamespace ns) {
    String appName = ns.prefix("deleteByIdApp");

    App installedApp =
        Apps.install().name(appName).withDescription("App to be deleted by ID").execute();

    assertNotNull(installedApp, "App should be installed");
    String appId = installedApp.getId().toString();

    Apps.delete(appId);

    assertThrows(
        Exception.class, () -> Apps.get(appId), "App should not be retrievable after deletion");
  }

  @Test
  void test_getAppByName_nonExistent(TestNamespace ns) {
    String nonExistentAppName = ns.prefix("nonExistentApp");

    assertThrows(
        Exception.class,
        () -> Apps.getByName(nonExistentAppName),
        "Getting non-existent app should throw exception");
  }

  @Test
  void test_getAppById_nonExistent(TestNamespace ns) {
    String nonExistentId = "00000000-0000-0000-0000-000000000000";

    assertThrows(
        Exception.class,
        () -> Apps.get(nonExistentId),
        "Getting app with non-existent ID should throw exception");
  }

  @Test
  void test_deleteSystemApp_400(TestNamespace ns) throws Exception {
    HttpClient httpClient = SdkClients.adminClient().getHttpClient();

    String systemAppName = ns.prefix("systemApp");

    CreateAppMarketPlaceDefinitionReq marketPlaceReq =
        new CreateAppMarketPlaceDefinitionReq()
            .withName(systemAppName)
            .withDisplayName("System App Test")
            .withDescription("A system application for testing")
            .withFeatures("test features")
            .withDeveloper("Test Developer")
            .withDeveloperUrl("https://www.example.com")
            .withPrivacyPolicyUrl("https://www.example.com/privacy")
            .withSupportEmail("support@example.com")
            .withClassName("org.openmetadata.service.resources.apps.TestApp")
            .withAppType(AppType.Internal)
            .withScheduleType(ScheduleType.Scheduled)
            .withRuntime(new ScheduledExecutionContext().withEnabled(true))
            .withAppConfiguration(new HashMap<>())
            .withPermission(NativeAppPermission.All)
            .withSystem(true);

    AppMarketPlaceDefinition marketPlaceDef =
        httpClient.execute(
            HttpMethod.POST,
            "/v1/apps/marketplace",
            marketPlaceReq,
            AppMarketPlaceDefinition.class);

    CreateApp createApp =
        new CreateApp()
            .withName(marketPlaceDef.getName())
            .withAppConfiguration(marketPlaceDef.getAppConfiguration())
            .withAppSchedule(new AppSchedule().withScheduleTimeline(ScheduleTimeline.HOURLY));

    App systemApp = Apps.install().name(createApp.getName()).execute();

    assertNotNull(systemApp);

    Exception exception =
        assertThrows(
            Exception.class,
            () -> Apps.delete(systemApp.getId().toString()),
            "System app should not be deletable");
    assertTrue(
        exception.getMessage().contains("SystemApp")
            || exception.getMessage().contains("can not be deleted"));
  }

  @Test
  void test_triggerApp_200(TestNamespace ns) throws Exception {
    assumeFalse(
        TestSuiteBootstrap.isK8sEnabled(), "App trigger not compatible with K8s pipeline backend");
    String appName = "SearchIndexingApplication";

    waitForAppJobCompletion(appName);

    // Wait for any in-flight job to finish, then trigger
    Awaitility.await("Trigger " + appName)
        .atMost(Duration.ofMinutes(2))
        .pollInterval(Duration.ofSeconds(3))
        .ignoreExceptionsMatching(
            e -> e.getMessage() != null && e.getMessage().contains("already running"))
        .until(
            () -> {
              Apps.trigger(appName).run();
              return true;
            });

    Thread.sleep(2000);

    HttpClient httpClient = SdkClients.adminClient().getHttpClient();
    AppRunRecord latestRun =
        httpClient.execute(
            HttpMethod.GET, "/v1/apps/name/" + appName + "/runs/latest", null, AppRunRecord.class);

    assertNotNull(latestRun);
    assertNotNull(latestRun.getStatus());
  }

  @Test
  void test_triggerApp_withCustomConfig(TestNamespace ns) throws Exception {
    String appName = "SearchIndexingApplication";
    HttpClient httpClient = SdkClients.adminClient().getHttpClient();

    waitForAppJobCompletion(appName);

    Map<String, Object> config = new HashMap<>();
    config.put("batchSize", 1234);

    // Retry trigger with backoff in case a previous job is still finishing up
    int maxTriggerRetries = 10;
    boolean triggered = false;
    Exception lastException = null;

    for (int i = 0; i < maxTriggerRetries && !triggered; i++) {
      try {
        httpClient.execute(HttpMethod.POST, "/v1/apps/trigger/" + appName, config, Void.class);
        triggered = true;
      } catch (Exception e) {
        lastException = e;
        if (e.getMessage() != null && e.getMessage().contains("already running")) {
          // Job is still running from previous test, wait and retry
          Thread.sleep(2000);
        } else {
          throw e; // Re-throw if it's a different error
        }
      }
    }

    if (!triggered && lastException != null) {
      throw lastException;
    }

    Thread.sleep(2000);

    AppRunRecord latestRun =
        httpClient.execute(
            HttpMethod.GET, "/v1/apps/name/" + appName + "/runs/latest", null, AppRunRecord.class);

    assertNotNull(latestRun);
    assertNotNull(latestRun.getConfig());
    assertEquals(1234, latestRun.getConfig().get("batchSize"));
  }

  @Test
  void test_triggerApp_400_invalidConfig(TestNamespace ns) {
    String appName = "SearchIndexingApplication";
    HttpClient httpClient = SdkClients.adminClient().getHttpClient();

    Map<String, Object> config = new HashMap<>();
    config.put("thisShouldFail", "but will it?");

    Exception exception =
        assertThrows(
            Exception.class,
            () ->
                httpClient.execute(
                    HttpMethod.POST, "/v1/apps/trigger/" + appName, config, Void.class));
    assertTrue(exception.getMessage().contains("thisShouldFail"));
  }

  @Test
  @org.junit.jupiter.api.Disabled("Job timing issues - job completion wait not reliable")
  void test_listAppRuns_orderedByNewestFirst(TestNamespace ns) throws Exception {
    String appName = "SearchIndexingApplication";
    HttpClient httpClient = SdkClients.adminClient().getHttpClient();

    waitForAppJobCompletion(appName);
    Apps.trigger(appName).run();
    Thread.sleep(1000);
    waitForAppJobCompletion(appName);
    Thread.sleep(500);
    Apps.trigger(appName).run();
    Thread.sleep(2000);

    String responseJson =
        httpClient.executeForString(
            HttpMethod.GET, "/v1/apps/name/" + appName + "/status", null, null);

    ResultList<AppRunRecord> runList =
        JsonUtils.readValue(responseJson, new TypeReference<ResultList<AppRunRecord>>() {});

    assertNotNull(runList);
    assertTrue(runList.getData().size() >= 2);

    for (int i = 0; i < runList.getData().size() - 1; i++) {
      AppRunRecord current = runList.getData().get(i);
      AppRunRecord next = runList.getData().get(i + 1);
      assertTrue(
          current.getStartTime() >= next.getStartTime(), "App runs should be ordered newest first");
    }
  }

  @Test
  void test_triggerNoTriggerApp_400(TestNamespace ns) {
    String appName = "ExampleAppNoTrigger";

    Exception exception =
        assertThrows(
            Exception.class,
            () -> Apps.trigger(appName).run(),
            "App that doesn't support manual trigger should fail");
    assertTrue(
        exception.getMessage().contains("does not support manual trigger")
            || exception.getMessage().contains("not found"));
  }

  @Test
  void test_listAppsReturnsBotField(TestNamespace ns) throws Exception {
    HttpClient httpClient = SdkClients.adminClient().getHttpClient();

    String responseJson =
        httpClient.executeForString(HttpMethod.GET, "/v1/apps?fields=*&limit=1000", null, null);

    ResultList<App> apps =
        JsonUtils.readValue(responseJson, new TypeReference<ResultList<App>>() {});

    assertNotNull(apps);
    assertNotNull(apps.getData());
    assertFalse(apps.getData().isEmpty());

    App searchIndexApp =
        apps.getData().stream()
            .filter(app -> "SearchIndexingApplication".equals(app.getName()))
            .findFirst()
            .orElse(null);

    assertNotNull(searchIndexApp, "SearchIndexingApplication should exist");
    assertNotNull(searchIndexApp.getBot(), "Bot field should be present in list API response");
  }

  @Test
  void test_listApps_filterBySingleAgentType(TestNamespace ns) throws Exception {
    HttpClient httpClient = SdkClients.adminClient().getHttpClient();

    String appName1 = ns.prefix("testAppCollateAI");
    String appName2 = ns.prefix("testAppMetadata");

    try {
      CreateAppMarketPlaceDefinitionReq marketPlaceReq1 =
          new CreateAppMarketPlaceDefinitionReq()
              .withName(appName1)
              .withDisplayName("CollateAI App")
              .withDescription("Test CollateAI app")
              .withFeatures("test features")
              .withDeveloper("Test Developer")
              .withDeveloperUrl("https://www.example.com")
              .withPrivacyPolicyUrl("https://www.example.com/privacy")
              .withSupportEmail("support@example.com")
              .withClassName("org.openmetadata.service.resources.apps.TestApp")
              .withAppType(AppType.Internal)
              .withScheduleType(ScheduleType.Scheduled)
              .withRuntime(new ScheduledExecutionContext().withEnabled(true))
              .withAppConfiguration(new HashMap<>())
              .withPermission(NativeAppPermission.All)
              .withAgentType(org.openmetadata.schema.entity.app.AgentType.CollateAI);

      CreateAppMarketPlaceDefinitionReq marketPlaceReq2 =
          new CreateAppMarketPlaceDefinitionReq()
              .withName(appName2)
              .withDisplayName("Metadata App")
              .withDescription("Test Metadata app")
              .withFeatures("test features")
              .withDeveloper("Test Developer")
              .withDeveloperUrl("https://www.example.com")
              .withPrivacyPolicyUrl("https://www.example.com/privacy")
              .withSupportEmail("support@example.com")
              .withClassName("org.openmetadata.service.resources.apps.TestApp")
              .withAppType(AppType.Internal)
              .withScheduleType(ScheduleType.Scheduled)
              .withRuntime(new ScheduledExecutionContext().withEnabled(true))
              .withAppConfiguration(new HashMap<>())
              .withPermission(NativeAppPermission.All)
              .withAgentType(org.openmetadata.schema.entity.app.AgentType.Metadata);

      AppMarketPlaceDefinition marketPlaceDef1 =
          httpClient.execute(
              HttpMethod.POST,
              "/v1/apps/marketplace",
              marketPlaceReq1,
              AppMarketPlaceDefinition.class);

      AppMarketPlaceDefinition marketPlaceDef2 =
          httpClient.execute(
              HttpMethod.POST,
              "/v1/apps/marketplace",
              marketPlaceReq2,
              AppMarketPlaceDefinition.class);

      App app1 =
          Apps.install()
              .name(marketPlaceDef1.getName())
              .withDescription("CollateAI test app")
              .execute();

      App app2 =
          Apps.install()
              .name(marketPlaceDef2.getName())
              .withDescription("Metadata test app")
              .execute();

      String responseJson =
          httpClient.executeForString(HttpMethod.GET, "/v1/apps?agentType=CollateAI", null, null);
      ResultList<App> apps =
          JsonUtils.readValue(responseJson, new TypeReference<ResultList<App>>() {});

      assertNotNull(apps);
      assertNotNull(apps.getData());

      boolean foundCollateAIApp =
          apps.getData().stream().anyMatch(app -> app.getName().equals(appName1));
      assertTrue(
          foundCollateAIApp,
          "CollateAI app should be found when filtering by CollateAI agent type");

      responseJson =
          httpClient.executeForString(HttpMethod.GET, "/v1/apps?agentType=Metadata", null, null);
      apps = JsonUtils.readValue(responseJson, new TypeReference<ResultList<App>>() {});

      assertNotNull(apps);
      assertNotNull(apps.getData());

      boolean foundMetadataApp =
          apps.getData().stream().anyMatch(app -> app.getName().equals(appName2));
      assertTrue(
          foundMetadataApp, "Metadata app should be found when filtering by Metadata agent type");

    } finally {
      try {
        Apps.uninstall(appName1, true);
      } catch (Exception ignored) {
      }
      try {
        Apps.uninstall(appName2, true);
      } catch (Exception ignored) {
      }
    }
  }

  @Test
  void test_listApps_filterByMultipleAgentTypes(TestNamespace ns) throws Exception {
    HttpClient httpClient = SdkClients.adminClient().getHttpClient();

    String appName1 = ns.prefix("testAppCollateAI2");
    String appName2 = ns.prefix("testAppMetadata2");
    String appName3 = ns.prefix("testAppTierAgent");

    try {
      CreateAppMarketPlaceDefinitionReq marketPlaceReq1 =
          new CreateAppMarketPlaceDefinitionReq()
              .withName(appName1)
              .withDisplayName("CollateAI App 2")
              .withDescription("Test CollateAI app 2")
              .withFeatures("test features")
              .withDeveloper("Test Developer")
              .withDeveloperUrl("https://www.example.com")
              .withPrivacyPolicyUrl("https://www.example.com/privacy")
              .withSupportEmail("support@example.com")
              .withClassName("org.openmetadata.service.resources.apps.TestApp")
              .withAppType(AppType.Internal)
              .withScheduleType(ScheduleType.Scheduled)
              .withRuntime(new ScheduledExecutionContext().withEnabled(true))
              .withAppConfiguration(new HashMap<>())
              .withPermission(NativeAppPermission.All)
              .withAgentType(org.openmetadata.schema.entity.app.AgentType.CollateAI);

      CreateAppMarketPlaceDefinitionReq marketPlaceReq2 =
          new CreateAppMarketPlaceDefinitionReq()
              .withName(appName2)
              .withDisplayName("Metadata App 2")
              .withDescription("Test Metadata app 2")
              .withFeatures("test features")
              .withDeveloper("Test Developer")
              .withDeveloperUrl("https://www.example.com")
              .withPrivacyPolicyUrl("https://www.example.com/privacy")
              .withSupportEmail("support@example.com")
              .withClassName("org.openmetadata.service.resources.apps.TestApp")
              .withAppType(AppType.Internal)
              .withScheduleType(ScheduleType.Scheduled)
              .withRuntime(new ScheduledExecutionContext().withEnabled(true))
              .withAppConfiguration(new HashMap<>())
              .withPermission(NativeAppPermission.All)
              .withAgentType(org.openmetadata.schema.entity.app.AgentType.Metadata);

      CreateAppMarketPlaceDefinitionReq marketPlaceReq3 =
          new CreateAppMarketPlaceDefinitionReq()
              .withName(appName3)
              .withDisplayName("Tier Agent App")
              .withDescription("Test Tier Agent app")
              .withFeatures("test features")
              .withDeveloper("Test Developer")
              .withDeveloperUrl("https://www.example.com")
              .withPrivacyPolicyUrl("https://www.example.com/privacy")
              .withSupportEmail("support@example.com")
              .withClassName("org.openmetadata.service.resources.apps.TestApp")
              .withAppType(AppType.Internal)
              .withScheduleType(ScheduleType.Scheduled)
              .withRuntime(new ScheduledExecutionContext().withEnabled(true))
              .withAppConfiguration(new HashMap<>())
              .withPermission(NativeAppPermission.All)
              .withAgentType(org.openmetadata.schema.entity.app.AgentType.CollateAITierAgent);

      AppMarketPlaceDefinition marketPlaceDef1 =
          httpClient.execute(
              HttpMethod.POST,
              "/v1/apps/marketplace",
              marketPlaceReq1,
              AppMarketPlaceDefinition.class);

      AppMarketPlaceDefinition marketPlaceDef2 =
          httpClient.execute(
              HttpMethod.POST,
              "/v1/apps/marketplace",
              marketPlaceReq2,
              AppMarketPlaceDefinition.class);

      AppMarketPlaceDefinition marketPlaceDef3 =
          httpClient.execute(
              HttpMethod.POST,
              "/v1/apps/marketplace",
              marketPlaceReq3,
              AppMarketPlaceDefinition.class);

      Apps.install().name(marketPlaceDef1.getName()).execute();
      Apps.install().name(marketPlaceDef2.getName()).execute();
      Apps.install().name(marketPlaceDef3.getName()).execute();

      String responseJson =
          httpClient.executeForString(
              HttpMethod.GET, "/v1/apps?agentType=CollateAI,CollateAITierAgent", null, null);
      ResultList<App> apps =
          JsonUtils.readValue(responseJson, new TypeReference<ResultList<App>>() {});

      assertNotNull(apps);
      assertNotNull(apps.getData());

      boolean foundCollateAIApp =
          apps.getData().stream().anyMatch(app -> app.getName().equals(appName1));
      boolean foundTierAgentApp =
          apps.getData().stream().anyMatch(app -> app.getName().equals(appName3));

      assertTrue(
          foundCollateAIApp || foundTierAgentApp,
          "Should find apps matching CollateAI or CollateAITierAgent agent types");

    } finally {
      try {
        Apps.uninstall(appName1, true);
      } catch (Exception ignored) {
      }
      try {
        Apps.uninstall(appName2, true);
      } catch (Exception ignored) {
      }
      try {
        Apps.uninstall(appName3, true);
      } catch (Exception ignored) {
      }
    }
  }

  @Test
  void test_listApps_filterByAgentTypeWithWhitespace(TestNamespace ns) throws Exception {
    HttpClient httpClient = SdkClients.adminClient().getHttpClient();

    String responseJson =
        httpClient.executeForString(
            HttpMethod.GET, "/v1/apps?agentType= CollateAI , Metadata ", null, null);
    ResultList<App> apps =
        JsonUtils.readValue(responseJson, new TypeReference<ResultList<App>>() {});

    assertNotNull(apps);
    assertNotNull(apps.getData());
  }

  @Test
  void test_listApps_filterByEmptyAgentType(TestNamespace ns) throws Exception {
    HttpClient httpClient = SdkClients.adminClient().getHttpClient();

    String responseJson =
        httpClient.executeForString(HttpMethod.GET, "/v1/apps?agentType=", null, null);
    ResultList<App> apps =
        JsonUtils.readValue(responseJson, new TypeReference<ResultList<App>>() {});

    assertNotNull(apps);
    assertNotNull(apps.getData());
  }

  @Test
  void test_listApps_filterByNonExistentAgentType(TestNamespace ns) throws Exception {
    HttpClient httpClient = SdkClients.adminClient().getHttpClient();

    String responseJson =
        httpClient.executeForString(
            HttpMethod.GET, "/v1/apps?agentType=NonExistentAgentType", null, null);
    ResultList<App> apps =
        JsonUtils.readValue(responseJson, new TypeReference<ResultList<App>>() {});

    assertNotNull(apps);
    assertNotNull(apps.getData());
  }

  @Test
  void test_listApps_combineAgentTypeWithOtherFilters(TestNamespace ns) throws Exception {
    HttpClient httpClient = SdkClients.adminClient().getHttpClient();

    String responseJson =
        httpClient.executeForString(
            HttpMethod.GET, "/v1/apps?agentType=CollateAI,Metadata&limit=50", null, null);
    ResultList<App> apps =
        JsonUtils.readValue(responseJson, new TypeReference<ResultList<App>>() {});

    assertNotNull(apps);
    assertNotNull(apps.getData());
    assertTrue(apps.getData().size() <= 50);
  }
}
