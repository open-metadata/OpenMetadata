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

import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.entity.app.App;
import org.openmetadata.schema.entity.app.CreateApp;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.fluent.Apps;

/**
 * Integration tests for Apps API.
 *
 * <p>Tests the Apps fluent API for retrieving and managing applications. Apps in OpenMetadata are
 * built-in system applications like SearchIndexApplication and DataInsightsApplication.
 *
 * <p>Migrated from: org.openmetadata.service.resources.apps.AppsResourceTest
 *
 * <p>Test isolation: Uses TestNamespace extension for test isolation Parallelization: Safe for
 * concurrent execution via @Execution(ExecutionMode.CONCURRENT)
 */
@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class AppsResourceIT {

  @BeforeAll
  static void setup() {
    Apps.setDefaultClient(SdkClients.adminClient());
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
}
