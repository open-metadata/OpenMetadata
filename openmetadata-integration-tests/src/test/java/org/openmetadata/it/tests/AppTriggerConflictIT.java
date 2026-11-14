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

package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assumptions.assumeFalse;

import java.time.Duration;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.openmetadata.it.bootstrap.TestSuiteBootstrap;
import org.openmetadata.it.util.OssTestServer;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.entity.app.AppMarketPlaceDefinition;
import org.openmetadata.schema.entity.app.AppType;
import org.openmetadata.schema.entity.app.CreateAppMarketPlaceDefinitionReq;
import org.openmetadata.schema.entity.app.NativeAppPermission;
import org.openmetadata.schema.entity.app.ScheduleType;
import org.openmetadata.schema.entity.app.ScheduledExecutionContext;
import org.openmetadata.sdk.exceptions.ConflictException;
import org.openmetadata.sdk.fluent.Apps;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.service.apps.AbstractNativeApplication;
import org.openmetadata.service.apps.scheduler.AppAlreadyRunningException;
import org.openmetadata.service.apps.scheduler.AppScheduler;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.search.SearchRepository;
import org.quartz.JobExecutionContext;
import org.quartz.JobKey;

/** Triggering an app while its run is still executing is a 409, not a server error. */
@ExtendWith(TestNamespaceExtension.class)
public class AppTriggerConflictIT {
  private static final Duration RUN_TIMEOUT = Duration.ofSeconds(30);

  @BeforeAll
  static void setup() {
    assumeFalse(OssTestServer.isExternalMode(), "Holds the run inside the embedded server's JVM");
    assumeFalse(
        TestSuiteBootstrap.isK8sEnabled(), "App trigger not compatible with K8s pipeline backend");
    Apps.setDefaultClient(SdkClients.adminClient());
  }

  @Test
  void triggeringAnAppWhoseRunIsExecutingIsAConflict(TestNamespace ns) throws Exception {
    String appName = installManualApp(ns.prefix("executingApp"));
    HeldExecutionApp.holdNextRun(appName);
    try {
      Apps.trigger(appName).run();
      HeldExecutionApp.awaitStarted(appName);

      ConflictException conflict =
          assertThrows(ConflictException.class, () -> Apps.trigger(appName).run());

      assertEquals(new AppAlreadyRunningException().getMessage(), conflict.getMessage());
    } finally {
      HeldExecutionApp.release(appName);
      awaitReleased(appName);
      Apps.uninstall(appName, true);
    }
  }

  private static String installManualApp(String appName) {
    CreateAppMarketPlaceDefinitionReq marketPlace =
        new CreateAppMarketPlaceDefinitionReq()
            .withName(appName)
            .withDisplayName("Trigger Conflict Test App")
            .withDescription("An app whose run a test holds open")
            .withFeatures("test features")
            .withDeveloper("Test Developer")
            .withDeveloperUrl("https://www.example.com")
            .withPrivacyPolicyUrl("https://www.example.com/privacy")
            .withSupportEmail("support@example.com")
            .withClassName(HeldExecutionApp.class.getName())
            .withAppType(AppType.Internal)
            .withScheduleType(ScheduleType.OnlyManual)
            .withRuntime(new ScheduledExecutionContext().withEnabled(true))
            .withAppConfiguration(new HashMap<>())
            .withPermission(NativeAppPermission.All);
    SdkClients.adminClient()
        .getHttpClient()
        .execute(
            HttpMethod.PUT, "/v1/apps/marketplace", marketPlace, AppMarketPlaceDefinition.class);
    Apps.install().name(appName).execute();
    return appName;
  }

  /** Quartz deletes a finished on-demand job last, so its absence means the run is released. */
  private static void awaitReleased(String appName) {
    JobKey onDemandJob =
        new JobKey(appName + "-" + AppScheduler.ON_DEMAND_JOB, AppScheduler.APPS_JOB_GROUP);
    Awaitility.await("Quartz releases the run of " + appName)
        .atMost(RUN_TIMEOUT)
        .until(() -> !AppScheduler.getInstance().getScheduler().checkExists(onDemandJob));
  }

  /** An app whose run waits inside its execution until the test releases it. */
  public static final class HeldExecutionApp extends AbstractNativeApplication {
    private static final Map<String, CountDownLatch> STARTED = new ConcurrentHashMap<>();
    private static final Map<String, CountDownLatch> RELEASED = new ConcurrentHashMap<>();

    public HeldExecutionApp(CollectionDAO collectionDAO, SearchRepository searchRepository) {
      super(collectionDAO, searchRepository);
    }

    static void holdNextRun(String appName) {
      STARTED.put(appName, new CountDownLatch(1));
      RELEASED.put(appName, new CountDownLatch(1));
    }

    static void awaitStarted(String appName) throws InterruptedException {
      assertTrue(
          STARTED.get(appName).await(RUN_TIMEOUT.toSeconds(), TimeUnit.SECONDS),
          "the run never started");
    }

    static void release(String appName) {
      RELEASED.get(appName).countDown();
    }

    @Override
    public void startApp(JobExecutionContext jobExecutionContext) {
      String appName = getApp().getName();
      CountDownLatch started = STARTED.get(appName);
      if (started != null) {
        started.countDown();
        awaitQuietly(RELEASED.get(appName));
      }
    }

    private static void awaitQuietly(CountDownLatch latch) {
      try {
        latch.await(RUN_TIMEOUT.multipliedBy(2).toSeconds(), TimeUnit.SECONDS);
      } catch (InterruptedException e) {
        Thread.currentThread().interrupt();
      }
    }
  }
}
