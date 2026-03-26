package org.openmetadata.service.util;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.app.App;
import org.openmetadata.schema.entity.app.AppBoundConfiguration;
import org.openmetadata.schema.entity.app.AppBoundType;
import org.openmetadata.schema.entity.app.AppSchedule;
import org.openmetadata.schema.entity.app.GlobalAppConfiguration;
import org.openmetadata.schema.entity.app.ScheduleTimeline;
import org.openmetadata.schema.entity.app.ServiceAppConfiguration;
import org.openmetadata.schema.type.EntityReference;

class AppBoundConfigurationUtilTest {

  private App createGlobalApp() {
    GlobalAppConfiguration globalConfig =
        new GlobalAppConfiguration()
            .withConfig(Map.of("key", "globalValue"))
            .withSchedule(new AppSchedule().withScheduleTimeline(ScheduleTimeline.DAILY));
    AppBoundConfiguration boundConfig =
        new AppBoundConfiguration().withGlobalAppConfig(globalConfig);

    return new App()
        .withId(UUID.randomUUID())
        .withName("TestGlobalApp")
        .withBoundType(AppBoundType.Global)
        .withConfiguration(boundConfig);
  }

  private App createServiceBoundApp(UUID... serviceIds) {
    AppBoundConfiguration boundConfig = new AppBoundConfiguration();
    for (UUID serviceId : serviceIds) {
      ServiceAppConfiguration serviceConfig =
          new ServiceAppConfiguration()
              .withServiceRef(new EntityReference().withId(serviceId))
              .withConfig(Map.of("serviceKey", "value-" + serviceId))
              .withSchedule(new AppSchedule().withScheduleTimeline(ScheduleTimeline.HOURLY));
      if (boundConfig.getServiceAppConfig() == null) {
        boundConfig.setServiceAppConfig(new java.util.ArrayList<>());
      }
      boundConfig.getServiceAppConfig().add(serviceConfig);
    }

    return new App()
        .withId(UUID.randomUUID())
        .withName("TestServiceApp")
        .withBoundType(AppBoundType.Service)
        .withConfiguration(boundConfig);
  }

  // --- setAppConfiguration with serviceId (Bug #1 fix verification) ---

  @Test
  void testSetAppConfiguration_serviceBound_setsConfigNotPrivateConfig() {
    UUID serviceId = UUID.randomUUID();
    App app = createServiceBoundApp(serviceId);

    Map<String, String> newConfig = Map.of("updated", "true");
    AppBoundConfigurationUtil.setAppConfiguration(app, serviceId, newConfig);

    Object config = AppBoundConfigurationUtil.getAppConfiguration(app, serviceId);
    assertNotNull(config, "Config should not be null after setAppConfiguration");
    assertEquals(newConfig, config);

    Object privateConfig = AppBoundConfigurationUtil.getPrivateConfiguration(app, serviceId);
    assertNull(privateConfig, "Private config should remain null");
  }

  @Test
  void testSetAppConfiguration_serviceBound_newService_createsConfig() {
    UUID existingServiceId = UUID.randomUUID();
    UUID newServiceId = UUID.randomUUID();
    App app = createServiceBoundApp(existingServiceId);

    Map<String, String> newConfig = Map.of("newService", "config");
    AppBoundConfigurationUtil.setAppConfiguration(app, newServiceId, newConfig);

    Object config = AppBoundConfigurationUtil.getAppConfiguration(app, newServiceId);
    assertNotNull(config);
    assertEquals(newConfig, config);

    // Existing service config should be unchanged
    Object existingConfig = AppBoundConfigurationUtil.getAppConfiguration(app, existingServiceId);
    assertNotNull(existingConfig);
  }

  // --- Global app config access ---

  @Test
  void testGetAppConfiguration_globalApp() {
    App app = createGlobalApp();
    Object config = AppBoundConfigurationUtil.getAppConfiguration(app);
    assertNotNull(config);
  }

  @Test
  void testGetAppConfiguration_serviceBound_withoutServiceId_returnsNull() {
    UUID serviceId = UUID.randomUUID();
    App app = createServiceBoundApp(serviceId);
    Object config = AppBoundConfigurationUtil.getAppConfiguration(app);
    assertNull(config, "Service-bound app without serviceId should return null config");
  }

  // --- Schedule access ---

  @Test
  void testGetAppSchedule_serviceBound() {
    UUID serviceId = UUID.randomUUID();
    App app = createServiceBoundApp(serviceId);

    AppSchedule schedule = AppBoundConfigurationUtil.getAppSchedule(app, serviceId);
    assertNotNull(schedule);
    assertEquals(ScheduleTimeline.HOURLY, schedule.getScheduleTimeline());
  }

  @Test
  void testGetAppSchedule_globalApp() {
    App app = createGlobalApp();
    AppSchedule schedule = AppBoundConfigurationUtil.getAppSchedule(app);
    assertNotNull(schedule);
    assertEquals(ScheduleTimeline.DAILY, schedule.getScheduleTimeline());
  }

  // --- Service configuration management ---

  @Test
  void testGetAllServiceConfigurations() {
    UUID svc1 = UUID.randomUUID();
    UUID svc2 = UUID.randomUUID();
    App app = createServiceBoundApp(svc1, svc2);

    List<ServiceAppConfiguration> configs =
        AppBoundConfigurationUtil.getAllServiceConfigurations(app);
    assertEquals(2, configs.size());
  }

  @Test
  void testAddServiceConfiguration() {
    UUID svc1 = UUID.randomUUID();
    App app = createServiceBoundApp(svc1);

    UUID svc2 = UUID.randomUUID();
    EntityReference newRef = new EntityReference().withId(svc2).withType("databaseService");
    AppBoundConfigurationUtil.addServiceConfiguration(app, newRef);

    List<ServiceAppConfiguration> configs =
        AppBoundConfigurationUtil.getAllServiceConfigurations(app);
    assertEquals(2, configs.size());
  }

  @Test
  void testRemoveServiceConfiguration() {
    UUID svc1 = UUID.randomUUID();
    UUID svc2 = UUID.randomUUID();
    App app = createServiceBoundApp(svc1, svc2);

    boolean removed = AppBoundConfigurationUtil.removeServiceConfiguration(app, svc1);
    assertTrue(removed);

    List<ServiceAppConfiguration> configs =
        AppBoundConfigurationUtil.getAllServiceConfigurations(app);
    assertEquals(1, configs.size());
    assertEquals(svc2, configs.get(0).getServiceRef().getId());
  }

  // --- Event subscriptions null safety (Bug #12 fix verification) ---

  @Test
  void testGetEventSubscriptionsForServiceApp_nullEventSubscriptions() {
    UUID serviceId = UUID.randomUUID();
    // Create service config WITHOUT event subscriptions (they default to null)
    ServiceAppConfiguration serviceConfig =
        new ServiceAppConfiguration().withServiceRef(new EntityReference().withId(serviceId));

    AppBoundConfiguration boundConfig = new AppBoundConfiguration();
    boundConfig.setServiceAppConfig(new java.util.ArrayList<>());
    boundConfig.getServiceAppConfig().add(serviceConfig);

    App app =
        new App()
            .withId(UUID.randomUUID())
            .withName("TestApp")
            .withBoundType(AppBoundType.Service)
            .withConfiguration(boundConfig);

    // Should not throw NPE
    List<EntityReference> subs = AppBoundConfigurationUtil.getEventSubscriptionsForServiceApp(app);
    assertNotNull(subs);
    assertTrue(subs.isEmpty());
  }

  // --- Bound type detection ---

  @Test
  void testIsGlobalApp() {
    App app = createGlobalApp();
    assertTrue(AppBoundConfigurationUtil.isGlobalApp(app));
  }

  @Test
  void testIsServiceBoundApp() {
    App app = createServiceBoundApp(UUID.randomUUID());
    assertTrue(AppBoundConfigurationUtil.isServiceBoundApp(app));
  }

  // --- setSchedule for service-bound ---

  @Test
  void testSetSchedule_serviceBound() {
    UUID serviceId = UUID.randomUUID();
    App app = createServiceBoundApp(serviceId);

    AppSchedule newSchedule = new AppSchedule().withScheduleTimeline(ScheduleTimeline.WEEKLY);
    AppBoundConfigurationUtil.setSchedule(app, serviceId, newSchedule);

    AppSchedule retrieved = AppBoundConfigurationUtil.getAppSchedule(app, serviceId);
    assertEquals(ScheduleTimeline.WEEKLY, retrieved.getScheduleTimeline());
  }
}
