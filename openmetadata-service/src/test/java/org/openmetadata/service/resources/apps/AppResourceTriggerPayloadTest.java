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

package org.openmetadata.service.resources.apps;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.HashMap;
import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.app.App;

class AppResourceTriggerPayloadTest {

  @Test
  void supplyingAnUnsetRuntimeParameterIsNotAnOverride() {
    Map<String, Object> stored = new HashMap<>();
    stored.put("type", "AutoPilotApplication");
    stored.put("entityLink", null);
    App autoPilot = new App().withAppConfiguration(stored);

    assertFalse(
        AppResource.overridesConfiguredValue(
            autoPilot,
            Map.of("entityLink", "<#E::databaseService::my_service>"),
            Set.of("entityLink")));
  }

  @Test
  void changingAConfiguredValueIsAnOverride() {
    App app = new App().withAppConfiguration(Map.of("scheduleType", "Scheduled"));
    assertTrue(
        AppResource.overridesConfiguredValue(app, Map.of("scheduleType", "Manual"), Set.of()));
  }

  @Test
  void removingAConfiguredValueIsAnOverride() {
    App app = new App().withAppConfiguration(Map.of("scheduleType", "Scheduled"));
    Map<String, Object> delete = new HashMap<>();
    delete.put("scheduleType", null);
    assertTrue(AppResource.overridesConfiguredValue(app, delete, Set.of()));
  }

  @Test
  void resendingTheSameValueIsNotAnOverride() {
    App app = new App().withAppConfiguration(Map.of("scheduleType", "Scheduled"));
    assertFalse(
        AppResource.overridesConfiguredValue(app, Map.of("scheduleType", "Scheduled"), Set.of()));
  }

  @Test
  void anEmptyPayloadIsNotAnOverride() {
    App app = new App().withAppConfiguration(Map.of("scheduleType", "Scheduled"));
    assertFalse(AppResource.overridesConfiguredValue(app, Map.of(), Set.of()));
  }

  /**
   * The seeded search indexing config leaves recreateIndex to its schema default, so setting it is
   * an override even though no stored value is replaced.
   */
  @Test
  void settingAKeyTheStoredConfigOmitsIsAnOverride() {
    App searchIndexing =
        new App().withAppConfiguration(Map.of("type", "SearchIndexing", "batchSize", "100"));
    assertTrue(
        AppResource.overridesConfiguredValue(
            searchIndexing, Map.of("recreateIndex", true), Set.of()));
  }

  @Test
  void aRuntimeParameterCannotCarryAConfigKey() {
    Map<String, Object> stored = new HashMap<>();
    stored.put("type", "AutoPilotApplication");
    stored.put("entityLink", null);
    App autoPilot = new App().withAppConfiguration(stored);

    assertTrue(
        AppResource.overridesConfiguredValue(
            autoPilot,
            Map.of("entityLink", "<#E::databaseService::my_service>", "recreateIndex", true),
            Set.of("entityLink")));
  }

  @Test
  void undeclaredTargetIsAConfigurationOverride() {
    App app = new App().withAppConfiguration(Map.of());
    assertTrue(
        AppResource.overridesConfiguredValue(
            app, Map.of("entityLink", "<#E::databaseService::my_service>"), Set.of()));
  }
}
