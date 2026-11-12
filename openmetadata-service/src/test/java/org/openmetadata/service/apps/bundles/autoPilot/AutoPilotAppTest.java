package org.openmetadata.service.apps.bundles.autoPilot;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import jakarta.ws.rs.BadRequestException;
import java.util.HashMap;
import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.openmetadata.schema.entity.app.App;
import org.openmetadata.schema.utils.JsonUtils;

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

  @ParameterizedTest
  @ValueSource(
      strings = {
        "{}",
        "{\"active\":null}",
        "{\"entityLink\":null}",
        "{\"entityLink\":\"<#E::table::my_catalog.my_schema.my_table>\"}"
      })
  void directTriggersValidateTheirTarget(String payload) {
    AutoPilotApp application = new ConfiguredAutoPilotApp();
    Map<String, Object> overrides = JsonUtils.getMap(JsonUtils.readTree(payload));
    assertThrows(BadRequestException.class, () -> application.triggerOnDemand(overrides));
  }

  @Test
  void directTriggersRejectMalformedLinks() {
    assertThrows(
        IllegalArgumentException.class,
        () -> new ConfiguredAutoPilotApp().triggerOnDemand(Map.of("entityLink", "invalid-link")));
  }

  @Test
  void inheritedPreparationKeepsInactiveRunsAsNoOps() {
    AutoPilotApp application = new ConfiguredAutoPilotApp();
    assertEquals(Set.of("entityLink"), application.getRuntimeTriggerParameters());
    var trigger = application.prepareTrigger(Map.of("active", false));
    assertTrue(trigger.authRequests().isEmpty());
    trigger.run();
  }

  private static class ConfiguredAutoPilotApp extends AutoPilotApp {
    private final App app = new App().withAppConfiguration(Map.of("active", true));

    ConfiguredAutoPilotApp() {
      super(null, null);
    }

    @Override
    public App getApp() {
      return app;
    }
  }
}
