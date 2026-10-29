package org.openmetadata.service.apps.bundles.autoPilot;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.util.HashMap;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.app.App;

class AutoPilotAppTest {

  @Test
  void callerTargetOverridesStoredTargetWithoutChangingStoredConfiguration() {
    Map<String, Object> storedConfig = new HashMap<>();
    storedConfig.put("active", true);
    storedConfig.put("entityLink", "<#E::databaseService::my_service>");
    App app = new App().withAppConfiguration(storedConfig);

    Map<String, Object> runtimeConfig =
        AutoPilotApp.getRuntimeConfig(
            app, Map.of("entityLink", "<#E::databaseService::other_service>"));

    assertEquals("<#E::databaseService::other_service>", runtimeConfig.get("entityLink"));
    assertEquals(true, runtimeConfig.get("active"));
    assertEquals("<#E::databaseService::my_service>", storedConfig.get("entityLink"));
  }

  @Test
  void absentOverridesUseStoredTarget() {
    App app =
        new App()
            .withAppConfiguration(
                Map.of("active", true, "entityLink", "<#E::databaseService::my_service>"));

    assertEquals(
        "<#E::databaseService::my_service>",
        AutoPilotApp.getRuntimeConfig(app, null).get("entityLink"));
    assertEquals(
        "<#E::databaseService::my_service>",
        AutoPilotApp.getRuntimeConfig(app, Map.of("active", false)).get("entityLink"));
  }
}
