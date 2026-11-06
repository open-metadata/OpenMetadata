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
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.app.App;

/**
 * Triggering an app needs EditAll only to change a setting the configuration already holds. Supplying
 * a value for a runtime parameter the configuration leaves unset - AutoPilot's {@code entityLink} -
 * is part of a normal Trigger, so a Data Steward who may trigger but not edit the app must not get a
 * 403 for it.
 */
class AppResourceTriggerPayloadTest {

  @Test
  void supplyingAnUnsetRuntimeParameterIsNotAnOverride() {
    Map<String, Object> stored = new HashMap<>();
    stored.put("type", "AutoPilotApplication");
    stored.put("entityLink", null);
    App autoPilot = new App().withAppConfiguration(stored);

    assertFalse(
        AppResource.overridesConfiguredValue(
            autoPilot, Map.of("entityLink", "<#E::table::svc.db.sch.t>")));
  }

  @Test
  void changingAConfiguredValueIsAnOverride() {
    App app = new App().withAppConfiguration(Map.of("scheduleType", "Scheduled"));
    assertTrue(AppResource.overridesConfiguredValue(app, Map.of("scheduleType", "Manual")));
  }

  @Test
  void removingAConfiguredValueIsAnOverride() {
    App app = new App().withAppConfiguration(Map.of("scheduleType", "Scheduled"));
    Map<String, Object> delete = new HashMap<>();
    delete.put("scheduleType", null);
    assertTrue(AppResource.overridesConfiguredValue(app, delete));
  }

  @Test
  void resendingTheSameValueIsNotAnOverride() {
    App app = new App().withAppConfiguration(Map.of("scheduleType", "Scheduled"));
    assertFalse(AppResource.overridesConfiguredValue(app, Map.of("scheduleType", "Scheduled")));
  }

  @Test
  void anEmptyPayloadIsNotAnOverride() {
    App app = new App().withAppConfiguration(Map.of("scheduleType", "Scheduled"));
    assertFalse(AppResource.overridesConfiguredValue(app, Map.of()));
  }

  /**
   * The seeded search indexing config leaves recreateIndex to its schema default, so setting it is
   * an override even though no stored value is replaced.
   */
  @Test
  void settingAKeyTheStoredConfigOmitsIsAnOverride() {
    App searchIndexing =
        new App().withAppConfiguration(Map.of("type", "SearchIndexing", "batchSize", "100"));
    assertTrue(AppResource.overridesConfiguredValue(searchIndexing, Map.of("recreateIndex", true)));
  }

  @Test
  void aRuntimeParameterCannotCarryAConfigKey() {
    Map<String, Object> stored = new HashMap<>();
    stored.put("type", "AutoPilotApplication");
    stored.put("entityLink", null);
    App autoPilot = new App().withAppConfiguration(stored);

    assertTrue(
        AppResource.overridesConfiguredValue(
            autoPilot, Map.of("entityLink", "<#E::table::svc.db.sch.t>", "recreateIndex", true)));
  }
}
