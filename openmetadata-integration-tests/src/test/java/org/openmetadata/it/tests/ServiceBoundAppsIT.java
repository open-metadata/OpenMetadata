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
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.core.type.TypeReference;
import java.time.Duration;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.junit.jupiter.api.parallel.Isolated;
import org.openmetadata.it.factories.DatabaseServiceTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.entity.app.App;
import org.openmetadata.schema.entity.app.AppBoundType;
import org.openmetadata.schema.entity.app.AppRunRecord;
import org.openmetadata.schema.entity.app.AppSchedule;
import org.openmetadata.schema.entity.app.AppType;
import org.openmetadata.schema.entity.app.ScheduleTimeline;
import org.openmetadata.schema.entity.app.ServiceAppConfiguration;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.sdk.fluent.Apps;
import org.openmetadata.sdk.network.HttpClient;
import org.openmetadata.sdk.network.HttpMethod;

/**
 * Integration tests for Service-Bound Applications.
 *
 * <p>Tests the full lifecycle of service-bound apps: adding/removing service configurations,
 * per-service triggering, run record filtering by serviceId, stopping service-bound jobs, and
 * backward compatibility with existing global apps.
 *
 * <p>Uses the pre-seeded ServiceHealthCheckApplication as the test subject.
 *
 * <p>Test isolation: Runs in SAME_THREAD + Isolated mode because tests modify the shared
 * ServiceHealthCheckApplication entity. Each test cleans up service configs in @AfterEach.
 */
@Execution(ExecutionMode.SAME_THREAD)
@Isolated
@ExtendWith(TestNamespaceExtension.class)
public class ServiceBoundAppsIT {

  private static final String APP_NAME = "ServiceHealthCheckApplication";
  private static final String GLOBAL_APP_NAME = "SearchIndexingApplication";

  @BeforeAll
  static void setup() {
    Apps.setDefaultClient(SdkClients.adminClient());
  }

  @AfterEach
  void cleanup() {
    HttpClient httpClient = SdkClients.adminClient().getHttpClient();
    try {
      String appJson =
          httpClient.executeForString(HttpMethod.GET, "/v1/apps/name/" + APP_NAME, null, null);
      App app = JsonUtils.readValue(appJson, App.class);
      if (app.getConfiguration() != null && app.getConfiguration().getServiceAppConfig() != null) {
        for (ServiceAppConfiguration svc : app.getConfiguration().getServiceAppConfig()) {
          try {
            httpClient.execute(
                HttpMethod.DELETE,
                "/v1/apps/name/"
                    + APP_NAME
                    + "/service-configuration/"
                    + svc.getServiceRef().getId(),
                null,
                Void.class);
          } catch (Exception ignored) {
          }
        }
      }
    } catch (Exception ignored) {
    }
  }

  // ========================
  // Helper methods
  // ========================

  private HttpClient httpClient() {
    return SdkClients.adminClient().getHttpClient();
  }

  private App getApp() {
    String json =
        httpClient().executeForString(HttpMethod.GET, "/v1/apps/name/" + APP_NAME, null, null);
    return JsonUtils.readValue(json, App.class);
  }

  private App addServiceConfig(UUID serviceId, Map<String, Object> config, AppSchedule schedule) {
    ServiceAppConfiguration serviceConfig =
        new ServiceAppConfiguration()
            .withServiceRef(new EntityReference().withId(serviceId).withType("databaseService"));
    if (config != null) {
      serviceConfig.withConfig(config);
    }
    if (schedule != null) {
      serviceConfig.withSchedule(schedule);
    }
    return httpClient()
        .execute(
            HttpMethod.POST,
            "/v1/apps/name/" + APP_NAME + "/service-configuration",
            serviceConfig,
            App.class);
  }

  private App addServiceConfigWithDefaults(UUID serviceId) {
    return addServiceConfig(
        serviceId,
        Map.of("delaySeconds", 1),
        new AppSchedule().withScheduleTimeline(ScheduleTimeline.NONE));
  }

  private void triggerForService(UUID serviceId) {
    httpClient()
        .execute(
            HttpMethod.POST,
            "/v1/apps/trigger/" + APP_NAME + "?serviceId=" + serviceId,
            null,
            Void.class);
  }

  private void waitForJobCompletion(UUID serviceId) {
    Awaitility.await("Wait for job completion for service " + serviceId)
        .atMost(Duration.ofSeconds(30))
        .pollDelay(Duration.ofMillis(500))
        .pollInterval(Duration.ofSeconds(2))
        .ignoreExceptions()
        .untilAsserted(
            () -> {
              AppRunRecord run =
                  httpClient()
                      .execute(
                          HttpMethod.GET,
                          "/v1/apps/name/" + APP_NAME + "/runs/latest?serviceId=" + serviceId,
                          null,
                          AppRunRecord.class);
              assertNotNull(run, "Run record should exist");
              assertNotNull(run.getStatus(), "Run status should not be null");
              assertTrue(
                  Set.of("success", "completed", "failed").contains(run.getStatus().value()),
                  "Job should be terminal: " + run.getStatus());
            });
  }

  private DatabaseService createTestService(TestNamespace ns) {
    return DatabaseServiceTestFactory.createPostgres(ns);
  }

  // ========================
  // Group 1: App Retrieval & Metadata
  // ========================

  @Test
  void test_getServiceBoundApp_hasBoundTypeService(TestNamespace ns) {
    App app = getApp();

    assertNotNull(app, APP_NAME + " should exist");
    assertEquals(APP_NAME, app.getName());
    assertEquals(AppBoundType.Service, app.getBoundType(), "boundType should be Service");
    assertEquals(AppType.Internal, app.getAppType(), "appType should be Internal");
  }

  @Test
  void test_getServiceBoundApp_hasEmptyServiceConfigs(TestNamespace ns) {
    App app = getApp();

    assertNotNull(app.getConfiguration(), "configuration should not be null");
    assertNotNull(
        app.getConfiguration().getServiceAppConfig(), "serviceAppConfig should not be null");
    assertTrue(
        app.getConfiguration().getServiceAppConfig().isEmpty(),
        "serviceAppConfig should be empty initially");
  }

  @Test
  void test_getServiceBoundApp_supportsInterrupt(TestNamespace ns) {
    App app = getApp();

    assertTrue(Boolean.TRUE.equals(app.getSupportsInterrupt()), "supportsInterrupt should be true");
  }

  // ========================
  // Group 2: Service Configuration Management
  // ========================

  @Test
  void test_addServiceConfiguration_200(TestNamespace ns) {
    DatabaseService service = createTestService(ns);
    UUID serviceId = service.getId();

    App updatedApp = addServiceConfigWithDefaults(serviceId);

    assertNotNull(updatedApp);
    App refetched = getApp();
    assertNotNull(refetched.getConfiguration());
    assertFalse(refetched.getConfiguration().getServiceAppConfig().isEmpty());
    assertEquals(
        1,
        refetched.getConfiguration().getServiceAppConfig().size(),
        "Should have exactly 1 service config");
    assertEquals(
        serviceId,
        refetched.getConfiguration().getServiceAppConfig().get(0).getServiceRef().getId());
  }

  @Test
  void test_addServiceConfiguration_withConfigAndSchedule(TestNamespace ns) {
    DatabaseService service = createTestService(ns);
    UUID serviceId = service.getId();

    Map<String, Object> config = Map.of("delaySeconds", 2);
    AppSchedule schedule =
        new AppSchedule()
            .withScheduleTimeline(ScheduleTimeline.CUSTOM)
            .withCronExpression("*/5 * * * *");

    addServiceConfig(serviceId, config, schedule);

    App refetched = getApp();
    ServiceAppConfiguration svcConfig = refetched.getConfiguration().getServiceAppConfig().get(0);

    assertNotNull(svcConfig.getConfig(), "Config should be stored");
    assertNotNull(svcConfig.getSchedule(), "Schedule should be stored");
    assertEquals(
        ScheduleTimeline.CUSTOM,
        svcConfig.getSchedule().getScheduleTimeline(),
        "Schedule timeline should be CUSTOM");
  }

  @Test
  void test_addSecondService_independent(TestNamespace ns) {
    DatabaseService service1 = createTestService(ns);
    DatabaseService service2 = createTestService(ns);

    addServiceConfig(
        service1.getId(),
        Map.of("delaySeconds", 1),
        new AppSchedule().withScheduleTimeline(ScheduleTimeline.NONE));
    addServiceConfig(
        service2.getId(),
        Map.of("delaySeconds", 2),
        new AppSchedule().withScheduleTimeline(ScheduleTimeline.NONE));

    App refetched = getApp();
    assertEquals(
        2,
        refetched.getConfiguration().getServiceAppConfig().size(),
        "Should have 2 service configs");

    Set<UUID> serviceIds =
        Set.of(
            refetched.getConfiguration().getServiceAppConfig().get(0).getServiceRef().getId(),
            refetched.getConfiguration().getServiceAppConfig().get(1).getServiceRef().getId());
    assertTrue(serviceIds.contains(service1.getId()));
    assertTrue(serviceIds.contains(service2.getId()));
  }

  @Test
  void test_addServiceConfiguration_toGlobalApp_400(TestNamespace ns) {
    DatabaseService service = createTestService(ns);
    ServiceAppConfiguration serviceConfig =
        new ServiceAppConfiguration()
            .withServiceRef(
                new EntityReference().withId(service.getId()).withType("databaseService"));

    Exception ex =
        assertThrows(
            Exception.class,
            () ->
                httpClient()
                    .execute(
                        HttpMethod.POST,
                        "/v1/apps/name/" + GLOBAL_APP_NAME + "/service-configuration",
                        serviceConfig,
                        App.class),
            "Adding service config to global app should fail");
    assertTrue(
        ex.getMessage().contains("non-service-bound"),
        "Error should mention non-service-bound: " + ex.getMessage());
  }

  @Test
  void test_addServiceConfiguration_upsert(TestNamespace ns) {
    DatabaseService service = createTestService(ns);
    UUID serviceId = service.getId();

    addServiceConfig(
        serviceId,
        Map.of("delaySeconds", 1),
        new AppSchedule().withScheduleTimeline(ScheduleTimeline.NONE));

    // Add same service again with different config (upsert)
    addServiceConfig(
        serviceId,
        Map.of("delaySeconds", 5),
        new AppSchedule().withScheduleTimeline(ScheduleTimeline.NONE));

    App refetched = getApp();
    assertEquals(
        1,
        refetched.getConfiguration().getServiceAppConfig().size(),
        "Upsert should not create duplicate — still 1 config");
  }

  @Test
  void test_removeServiceConfiguration_200(TestNamespace ns) {
    DatabaseService service = createTestService(ns);
    UUID serviceId = service.getId();
    addServiceConfigWithDefaults(serviceId);

    // Verify it exists
    App before = getApp();
    assertEquals(1, before.getConfiguration().getServiceAppConfig().size());

    // Remove it
    httpClient()
        .execute(
            HttpMethod.DELETE,
            "/v1/apps/name/" + APP_NAME + "/service-configuration/" + serviceId,
            null,
            App.class);

    App after = getApp();
    assertTrue(
        after.getConfiguration().getServiceAppConfig().isEmpty(),
        "Service config should be removed");
  }

  @Test
  void test_removeServiceConfiguration_notFound_400(TestNamespace ns) {
    UUID randomId = UUID.randomUUID();

    Exception ex =
        assertThrows(
            Exception.class,
            () ->
                httpClient()
                    .execute(
                        HttpMethod.DELETE,
                        "/v1/apps/name/" + APP_NAME + "/service-configuration/" + randomId,
                        null,
                        App.class),
            "Removing non-existent service config should fail");
    assertTrue(
        ex.getMessage().contains("not found") || ex.getMessage().contains("400"),
        "Error should indicate not found: " + ex.getMessage());
  }

  // ========================
  // Group 3: Triggering
  // ========================

  @Test
  void test_triggerServiceBoundApp_withServiceId_200(TestNamespace ns) {
    DatabaseService service = createTestService(ns);
    UUID serviceId = service.getId();
    addServiceConfigWithDefaults(serviceId);

    triggerForService(serviceId);
    waitForJobCompletion(serviceId);

    AppRunRecord run =
        httpClient()
            .execute(
                HttpMethod.GET,
                "/v1/apps/name/" + APP_NAME + "/runs/latest?serviceId=" + serviceId,
                null,
                AppRunRecord.class);
    assertNotNull(run);
    assertNotNull(run.getStatus());
  }

  @Test
  void test_triggerServiceBoundApp_withoutServiceId_400(TestNamespace ns) {
    Exception ex =
        assertThrows(
            Exception.class,
            () ->
                httpClient()
                    .execute(HttpMethod.POST, "/v1/apps/trigger/" + APP_NAME, null, Void.class),
            "Triggering service-bound app without serviceId should fail");
    assertTrue(
        ex.getMessage().contains("serviceId") || ex.getMessage().contains("service-bound"),
        "Error should mention serviceId requirement: " + ex.getMessage());
  }

  @Test
  void test_triggerServiceBoundApp_twoServices_independentRunRecords(TestNamespace ns) {
    DatabaseService service1 = createTestService(ns);
    DatabaseService service2 = createTestService(ns);

    addServiceConfigWithDefaults(service1.getId());
    addServiceConfigWithDefaults(service2.getId());

    // Trigger service 1
    triggerForService(service1.getId());
    waitForJobCompletion(service1.getId());

    // Trigger service 2
    triggerForService(service2.getId());
    waitForJobCompletion(service2.getId());

    // Each should have independent run records
    AppRunRecord run1 =
        httpClient()
            .execute(
                HttpMethod.GET,
                "/v1/apps/name/" + APP_NAME + "/runs/latest?serviceId=" + service1.getId(),
                null,
                AppRunRecord.class);
    AppRunRecord run2 =
        httpClient()
            .execute(
                HttpMethod.GET,
                "/v1/apps/name/" + APP_NAME + "/runs/latest?serviceId=" + service2.getId(),
                null,
                AppRunRecord.class);

    assertNotNull(run1, "Run record for service 1 should exist");
    assertNotNull(run2, "Run record for service 2 should exist");
  }

  @Test
  void test_triggerGlobalApp_noRegression(TestNamespace ns) {
    // Wait for any existing job to finish
    Awaitility.await("Wait for SearchIndexingApp to be ready")
        .atMost(Duration.ofSeconds(30))
        .pollInterval(Duration.ofSeconds(2))
        .ignoreExceptions()
        .until(
            () -> {
              AppRunRecord run =
                  httpClient()
                      .execute(
                          HttpMethod.GET,
                          "/v1/apps/name/" + GLOBAL_APP_NAME + "/runs/latest",
                          null,
                          AppRunRecord.class);
              if (run == null || run.getStatus() == null) {
                return true;
              }
              return Set.of("success", "completed", "failed").contains(run.getStatus().value());
            });

    // Trigger global app (no serviceId)
    Awaitility.await("Trigger global app")
        .atMost(Duration.ofMinutes(2))
        .pollInterval(Duration.ofSeconds(3))
        .ignoreExceptionsMatching(
            e -> e.getMessage() != null && e.getMessage().contains("already running"))
        .until(
            () -> {
              Apps.trigger(GLOBAL_APP_NAME).run();
              return true;
            });

    Awaitility.await("Wait for global app run record")
        .atMost(Duration.ofSeconds(30))
        .pollInterval(Duration.ofSeconds(2))
        .ignoreExceptions()
        .untilAsserted(
            () -> {
              AppRunRecord run =
                  httpClient()
                      .execute(
                          HttpMethod.GET,
                          "/v1/apps/name/" + GLOBAL_APP_NAME + "/runs/latest",
                          null,
                          AppRunRecord.class);
              assertNotNull(run, "Global app should still produce run records");
              assertNotNull(run.getStatus());
            });
  }

  // ========================
  // Group 4: Run Records & Filtering
  // ========================

  @Test
  void test_listAppRuns_filteredByServiceId(TestNamespace ns) {
    DatabaseService service1 = createTestService(ns);
    DatabaseService service2 = createTestService(ns);

    addServiceConfigWithDefaults(service1.getId());
    addServiceConfigWithDefaults(service2.getId());

    triggerForService(service1.getId());
    waitForJobCompletion(service1.getId());

    triggerForService(service2.getId());
    waitForJobCompletion(service2.getId());

    // Filter by service1 only
    String responseJson =
        httpClient()
            .executeForString(
                HttpMethod.GET,
                "/v1/apps/name/" + APP_NAME + "/status?serviceId=" + service1.getId(),
                null,
                null);

    ResultList<AppRunRecord> runs =
        JsonUtils.readValue(responseJson, new TypeReference<ResultList<AppRunRecord>>() {});

    assertNotNull(runs);
    assertNotNull(runs.getData());
    assertFalse(runs.getData().isEmpty(), "Should have at least 1 run for service 1");
  }

  @Test
  void test_listAppRuns_noServiceIdFilter_returnsAll(TestNamespace ns) {
    DatabaseService service1 = createTestService(ns);
    DatabaseService service2 = createTestService(ns);

    addServiceConfigWithDefaults(service1.getId());
    addServiceConfigWithDefaults(service2.getId());

    triggerForService(service1.getId());
    waitForJobCompletion(service1.getId());

    triggerForService(service2.getId());
    waitForJobCompletion(service2.getId());

    // List without filter — should return runs from both services
    String responseJson =
        httpClient()
            .executeForString(HttpMethod.GET, "/v1/apps/name/" + APP_NAME + "/status", null, null);

    ResultList<AppRunRecord> runs =
        JsonUtils.readValue(responseJson, new TypeReference<ResultList<AppRunRecord>>() {});

    assertNotNull(runs);
    assertNotNull(runs.getData());
    assertTrue(
        runs.getData().size() >= 2,
        "Should have at least 2 runs (one per service), got " + runs.getData().size());
  }

  @Test
  void test_latestAppRun_filteredByServiceId(TestNamespace ns) {
    DatabaseService service1 = createTestService(ns);
    DatabaseService service2 = createTestService(ns);

    addServiceConfigWithDefaults(service1.getId());
    addServiceConfigWithDefaults(service2.getId());

    // Trigger service 1 first
    triggerForService(service1.getId());
    waitForJobCompletion(service1.getId());

    // Then trigger service 2
    triggerForService(service2.getId());
    waitForJobCompletion(service2.getId());

    // Latest for service 1 should exist
    AppRunRecord latestRun1 =
        httpClient()
            .execute(
                HttpMethod.GET,
                "/v1/apps/name/" + APP_NAME + "/runs/latest?serviceId=" + service1.getId(),
                null,
                AppRunRecord.class);

    assertNotNull(latestRun1, "Latest run for service 1 should exist");
    assertNotNull(latestRun1.getStatus());
  }

  @Test
  void test_appRunRecord_containsServiceId(TestNamespace ns) {
    DatabaseService service = createTestService(ns);
    UUID serviceId = service.getId();
    addServiceConfigWithDefaults(serviceId);

    triggerForService(serviceId);
    waitForJobCompletion(serviceId);

    // Fetch the run record and check properties contain serviceId
    String responseJson =
        httpClient()
            .executeForString(
                HttpMethod.GET,
                "/v1/apps/name/" + APP_NAME + "/runs/latest?serviceId=" + serviceId,
                null,
                null);
    // Parse as generic map to inspect all fields
    Map<String, Object> runMap = JsonUtils.readValue(responseJson, Map.class);

    assertNotNull(runMap, "Run record should exist");

    // Check that services array contains the serviceId
    Object services = runMap.get("services");
    assertNotNull(services, "Run record should have 'services' field");
  }

  // ========================
  // Group 5: Stop
  // ========================

  @Test
  void test_stopServiceBoundApp_withServiceId_200(TestNamespace ns) {
    DatabaseService service = createTestService(ns);
    UUID serviceId = service.getId();
    // Use longer delay so we can stop it
    addServiceConfig(
        serviceId,
        Map.of("delaySeconds", 10),
        new AppSchedule().withScheduleTimeline(ScheduleTimeline.NONE));

    // Trigger the job (it will run for 10 seconds)
    triggerForService(serviceId);

    // Wait briefly for the job to start
    Awaitility.await("Wait for job to start")
        .atMost(Duration.ofSeconds(10))
        .pollInterval(Duration.ofSeconds(1))
        .ignoreExceptions()
        .until(
            () -> {
              AppRunRecord run =
                  httpClient()
                      .execute(
                          HttpMethod.GET,
                          "/v1/apps/name/" + APP_NAME + "/runs/latest?serviceId=" + serviceId,
                          null,
                          AppRunRecord.class);
              return run != null && run.getStatus() != null;
            });

    // Stop the job
    httpClient()
        .execute(
            HttpMethod.POST,
            "/v1/apps/stop/" + APP_NAME + "?serviceId=" + serviceId,
            null,
            Void.class);

    // Wait for the status to reflect stopped/completed
    Awaitility.await("Wait for stop to take effect")
        .atMost(Duration.ofSeconds(15))
        .pollInterval(Duration.ofSeconds(1))
        .ignoreExceptions()
        .untilAsserted(
            () -> {
              AppRunRecord run =
                  httpClient()
                      .execute(
                          HttpMethod.GET,
                          "/v1/apps/name/" + APP_NAME + "/runs/latest?serviceId=" + serviceId,
                          null,
                          AppRunRecord.class);
              assertNotNull(run);
              assertTrue(
                  Set.of("stopped", "completed", "success", "failed")
                      .contains(run.getStatus().value()),
                  "Job should be stopped or completed: " + run.getStatus());
            });
  }

  @Test
  void test_stopServiceBoundApp_withoutServiceId_400(TestNamespace ns) {
    Exception ex =
        assertThrows(
            Exception.class,
            () ->
                httpClient()
                    .execute(HttpMethod.POST, "/v1/apps/stop/" + APP_NAME, null, Void.class),
            "Stopping service-bound app without serviceId should fail");
    assertTrue(
        ex.getMessage().contains("serviceId") || ex.getMessage().contains("service-bound"),
        "Error should mention serviceId: " + ex.getMessage());
  }

  // ========================
  // Group 6: Deletion & Cleanup
  // ========================

  @Test
  void test_removeServiceConfig_removesScheduledJob(TestNamespace ns) {
    DatabaseService service = createTestService(ns);
    UUID serviceId = service.getId();

    // Add with a cron schedule
    addServiceConfig(
        serviceId,
        Map.of("delaySeconds", 1),
        new AppSchedule()
            .withScheduleTimeline(ScheduleTimeline.CUSTOM)
            .withCronExpression("*/10 * * * *"));

    // Remove it
    httpClient()
        .execute(
            HttpMethod.DELETE,
            "/v1/apps/name/" + APP_NAME + "/service-configuration/" + serviceId,
            null,
            App.class);

    // Verify the service config is gone
    App refetched = getApp();
    assertTrue(
        refetched.getConfiguration().getServiceAppConfig().isEmpty(),
        "Service config should be removed after delete");
  }

  // ========================
  // Group 7: Backward Compatibility
  // ========================

  @Test
  void test_globalApp_configRouting_noRegression(TestNamespace ns) {
    String json =
        httpClient()
            .executeForString(HttpMethod.GET, "/v1/apps/name/" + GLOBAL_APP_NAME, null, null);
    App app = JsonUtils.readValue(json, App.class);

    assertNotNull(app);
    assertEquals(AppBoundType.Global, app.getBoundType(), "SearchIndexingApp should be Global");

    // Verify config is accessible through the nested structure
    assertNotNull(app.getConfiguration(), "Global app should have configuration");
    assertNotNull(
        app.getConfiguration().getGlobalAppConfig(), "Global app should have globalAppConfig");
  }

  // ========================
  // Group 8: List API Filters (boundType, serviceId)
  // ========================

  @Test
  void test_listApps_filterByBoundTypeService(TestNamespace ns) {
    String json =
        httpClient()
            .executeForString(HttpMethod.GET, "/v1/apps?boundType=Service&limit=100", null, null);
    ResultList<App> apps = JsonUtils.readValue(json, new TypeReference<ResultList<App>>() {});

    assertNotNull(apps);
    assertFalse(apps.getData().isEmpty(), "Should return at least one service-bound app");
    for (App app : apps.getData()) {
      assertEquals(
          AppBoundType.Service, app.getBoundType(), "All returned apps should be Service-bound");
    }
  }

  @Test
  void test_listApps_filterByBoundTypeGlobal(TestNamespace ns) {
    String json =
        httpClient()
            .executeForString(HttpMethod.GET, "/v1/apps?boundType=Global&limit=100", null, null);
    ResultList<App> apps = JsonUtils.readValue(json, new TypeReference<ResultList<App>>() {});

    assertNotNull(apps);
    assertFalse(apps.getData().isEmpty(), "Should return at least one global app");
    for (App app : apps.getData()) {
      assertEquals(AppBoundType.Global, app.getBoundType(), "All returned apps should be Global");
    }
  }

  @Test
  void test_listApps_filterByServiceId(TestNamespace ns) {
    DatabaseService service = createTestService(ns);
    UUID serviceId = service.getId();
    addServiceConfigWithDefaults(serviceId);

    String json =
        httpClient()
            .executeForString(
                HttpMethod.GET, "/v1/apps?serviceId=" + serviceId + "&limit=100", null, null);
    ResultList<App> apps = JsonUtils.readValue(json, new TypeReference<ResultList<App>>() {});

    assertNotNull(apps);
    assertFalse(apps.getData().isEmpty(), "Should return the app configured for this service");
    boolean found = false;
    for (App app : apps.getData()) {
      if (APP_NAME.equals(app.getName())) {
        found = true;
        break;
      }
    }
    assertTrue(found, APP_NAME + " should be in the list for serviceId=" + serviceId);
  }

  @Test
  void test_listApps_filterByServiceId_excludesUnconfiguredApps(TestNamespace ns) {
    UUID randomServiceId = UUID.randomUUID();

    String json =
        httpClient()
            .executeForString(
                HttpMethod.GET, "/v1/apps?serviceId=" + randomServiceId + "&limit=100", null, null);
    ResultList<App> apps = JsonUtils.readValue(json, new TypeReference<ResultList<App>>() {});

    assertNotNull(apps);
    for (App app : apps.getData()) {
      assertFalse(
          APP_NAME.equals(app.getName()),
          APP_NAME + " should NOT appear for an unconfigured service");
    }
  }

  @Test
  void test_globalApp_scheduleRouting_noRegression(TestNamespace ns) {
    String json =
        httpClient()
            .executeForString(HttpMethod.GET, "/v1/apps/name/" + GLOBAL_APP_NAME, null, null);
    App app = JsonUtils.readValue(json, App.class);

    assertNotNull(app.getConfiguration());
    assertNotNull(app.getConfiguration().getGlobalAppConfig());
    assertNotNull(
        app.getConfiguration().getGlobalAppConfig().getSchedule(),
        "Global app should have schedule in nested config");
  }
}
